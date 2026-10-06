# TASKS.md — งานที่เหลือสำหรับสมาชิกคนที่ 2

> เอกสารนี้สำหรับ **สมาชิกคนที่ 2 (Backend Developer)**
> งานทั้งหมดเป็น **งานจริงที่ตรวจพบจากการทดสอบระบบ** ไม่ใช่งานแต่งขึ้น
> อ่านให้ครบก่อนแก้ และ commit **ด้วยชื่อตัวเอง** ทุกงาน

---

## 0. ตั้งค่า Git Identity (ทำก่อนเริ่มงาน)

ข้อนี้สำคัญที่สุด — อาจารย์ตรวจชื่อใน Repository ถ้าไม่ตั้ง commit จะกลายเป็นชื่อคนเดิม

```powershell
cd "C:\Users\mpalg\OneDrive\เดสก์ท็อป\gitea-pros1"

git config user.name  "<ชื่อเต็มจริงของคุณ>"
git config user.email "<อีเมลโรงเรียนของคุณ>"

# ตรวจสอบว่าตั้งแล้ว
git config user.name
git config user.email
```

ยืนยันก่อนเริ่ม:

```powershell
git status
git pull
docker compose ps
```

ถ้า `docker compose ps` ไม่มี container ไหน Up ให้รัน:

```powershell
docker compose up -d
```

---

## งานที่ 1 : แก้ Cancel Booking ให้ใช้ Transaction

### ปัญหา

ไฟล์ `backend/src/routes/booking.routes.js` บรรทัด **258–264**
ทำ 2 query แยกกันโดยไม่มี Transaction:

```js
await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
await prisma.bookingSeat.deleteMany({ where: { bookingId: id } });
```

ถ้าคำสั่งแรกสำเร็จแต่คำสั่งที่สองล้ม (Connection หลุด, DB ปิด, Timeout)
ระบบจะได้ **Booking = CANCELLED แต่ที่นั่งยังถูกล็อกอยู่**

ผลลัพธ์ : ที่นั่งแถว A1, A2 **หายถาวร** ไม่มีใครจองได้อีก
และ `GET /api/showtimes/:id/seats` จะแสดง `isAvailable: false`
ทั้งที่ไม่มีการจองใด ๆ ค้างอยู่

นอกจากนี้ คอมเมนต์ที่บรรทัด 91 เขียนว่า *"บันทึกการจอง (ใช้ Transaction)"*
แต่โค้ดจริง **ไม่ได้ใช้ `$transaction` เลย** — คอมเมนต์กับโค้ดไม่ตรงกัน

### สิ่งที่ต้องแก้

1. ห่อ 2 คำสั่งใน `router.delete('/:id', ...)` ด้วย `prisma.$transaction`
2. แก้คอมเมนต์บรรทัด 91 ให้ตรงกับโค้ดจริง

**ตัวอย่างแนวทาง (บรรทัด 258–264):**

```js
await prisma.$transaction([
  prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED' },
  }),
  prisma.bookingSeat.deleteMany({ where: { bookingId: id } }),
]);
```

> ถ้าใช้แบบ callback `prisma.$transaction(async (tx) => { ... })` ก็ได้
> เลือกแบบที่อธิบายเหตุผลในคอมเมนต์ได้ชัดเจนกว่า

### ไฟล์ที่แก้

- `backend/src/routes/booking.routes.js`

### วิธีทดสอบว่าแก้ถูก

```powershell
docker compose restart backend
Start-Sleep -Seconds 25
```

```powershell
# Login เป็น USER
$t = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
  -ContentType "application/json" `
  -Body '{"identifier":"user@movie.local","password":"User@1234"}').data.token

# จอง
$s = (Invoke-RestMethod -Uri http://localhost:8080/api/showtimes/1/seats `
  -Headers @{Authorization="Bearer $t"}).data.seats
$body = @{ showtimeId=1; seatIds=@($s[0].id, $s[1].id) } | ConvertTo-Json
$b = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/bookings `
  -ContentType "application/json" -Headers @{Authorization="Bearer $t"} -Body $body
"bookingId = $($b.data.id)"

# ยกเลิก
Invoke-RestMethod -Method Delete -Uri "http://localhost:8080/api/bookings/$($b.data.id)" `
  -Headers @{Authorization="Bearer $t"}

# ตรวจว่าที่นั่งคืนเข้าระบบแล้ว (ต้องได้ True)
$s2 = (Invoke-RestMethod -Uri http://localhost:8080/api/showtimes/1/seats `
  -Headers @{Authorization="Bearer $t"}).data.seats
"A1 available = $($s2[0].isAvailable)"
"A2 available = $($s2[1].isAvailable)"

# จองที่นั่งเดิมซ้ำได้ = ระบบรีสตาร์ทถูก
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/bookings `
  -ContentType "application/json" -Headers @{Authorization="Bearer $t"} -Body $body
```

---

## งานที่ 2 : แก้ BookingCode ชนกัน + ข้อความ Error ผิด

### ปัญหา

ไฟล์ `backend/src/routes/booking.routes.js` บรรทัด **86–89**

```js
const count = await prisma.booking.count();
const bookingCode = `BK-${today}-${String(count + 1).padStart(4, '0')}`;
```

**ปัญหา 2 จุด:**

**(ก) Race condition** — ถ้าผู้ใช้ 2 คนกดจองพร้อมกัน
ทั้งคู่อ่าน `count()` ได้ค่าเดียวกัน → สร้าง `BK-20261006-0005` **เหมือนกันทั้งคู่**
คอลัมน์ `bookingCode` มี `@unique` อยู่แล้ว (schema.prisma บรรทัด 156)
ดังนั้นคำสั่งที่สองจะล้มด้วย Prisma error **P2002**

**(ข) ข้อความ Error ผิด** — catch ที่บรรทัด **131–136** ตรวจ P2002 แล้วตอบกลับว่า

> `ที่นั่ง A1 ถูกจองไปแล้ว กรุณาเลือกที่นั่งอื่น`

ทั้งที่ P2002 ครั้งนั้นเกิดจาก **bookingCode ซ้ำ ไม่ใช่ที่นั่งซ้ำ**
ผู้ใช้จะงงว่าเลือกที่นั่งว่างอยู่ ทำไมบอกว่าถูกจอง

### สิ่งที่ต้องแก้

1. ทำให้ `bookingCode` ไม่ชนกัน — มีหลายวิธี เลือกและ**อธิบายเหตุผลในคอมเมนต์**:
   - Retry เมื่อเจอ P2002 (วนซ้ำสูงสุด 3 ครั้ง แล้วเปลี่ยนเลขสุ่ม)
   - หรือใส่ตัวสุ่ม/UUID ลงท้าย `bookingCode`
   - หรืออ่าน `max(bookingCode)` แล้ว +1 ภายใน `$transaction`
2. แยกแยะ P2002 ตาม field ที่ชน แล้วตอบข้อความที่ถูกต้อง:
   - ชนที่ `bookingCode` → ลองใหม่ หรือแจ้งว่าสร้างรหัสไม่สำเร็จ
   - ชนที่ `showtimeId + seatId` (BookingSeat) → ค่อยตอบเรื่องที่นั่งซ้ำ

**ตัวอย่างการแยก field ที่ชน:**

```js
if (error.code === 'P2002') {
  const target = error.meta?.target;
  // target อาจเป็น array เช่น ['showtimeId','seatId'] หรือ 'bookingCode'
  const fields = Array.isArray(target) ? target : [target];

  if (fields.includes('bookingCode')) {
    return res.status(500).json({
      success: false,
      message: 'สร้างรหัสการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    });
  }
  // ... กรณีที่นั่งซ้ำ
}
```

### ไฟล์ที่แก้

- `backend/src/routes/booking.routes.js` (บรรทัด 86–89 และ 129–140)

### วิธีทดสอบว่าแก้ถูก

ทดสอบจอง **พร้อมกัน 10 requests** แล้วตรวจว่า `bookingCode` ไม่ซ้ำกัน:

```powershell
docker compose restart backend; Start-Sleep -Seconds 25

$t = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
  -ContentType "application/json" `
  -Body '{"identifier":"user@movie.local","password":"User@1234"}').data.token

$st = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/showtimes `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $at"} `
  -Body "{`"movieId`":1,`"screen`":`"Race Test`",`"startTime`":`"$((Get-Date).AddDays(5).ToString('yyyy-MM-ddTHH:mm:ss'))`",`"price`":100}")

$seats = (Invoke-RestMethod -Uri "http://localhost:8080/api/showtimes/$($st.data.id)/seats" `
  -Headers @{Authorization="Bearer $t"}).data.seats

# ยิง 10 requests พร้อมกัน (ใช้ที่นั่งคนละตัวเพื่อให้ผ่าน validation)
$jobs = 1..10 | ForEach-Object {
  Start-Job -ScriptBlock {
    param($sid, $seatId, $tok)
    try {
      Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/bookings `
        -ContentType "application/json" -Headers @{Authorization="Bearer $tok}" `
        -Body "{`"showtimeId`":$sid,`"seatIds`":[$seatId]}"
    } catch { $_.ErrorDetails.Message }
  } -ArgumentList $st.data.id, $seats[$_ - 1].id, $t
}
$jobs | Wait-Job | Out-Null
$jobs | Receive-Job
$jobs | Remove-Job
```

แล้วตรวจในฐานข้อมูลว่าไม่มี `bookingCode` ซ้ำกัน:

```powershell
"SELECT `"bookingCode`", count(*) FROM bookings GROUP BY `"bookingCode`" HAVING count(*) > 1;" `
  | docker compose exec -T app-db psql -U app_user -d movie_booking_db
```

ต้องได้ **0 rows**

---

## งานที่ 3 : เพิ่ม Section "ผลการทดสอบ" ใน README

### ปัญหา

`README.md` บรรทัด 689 เขียนว่า

> `README.md` | เขียนเอกสารส่งอาจารย์ **พร้อมผลการทดสอบ**

แต่เอกสาร **ไม่มี Section ผลการทดสอบอยู่จริง** — มีแค่คำสั่งทดสอบ (§7, §8)
ไม่มีตารางสรุปว่าทดสอบอะไร ผ่าน/ไม่ผ่านอย่างไร

### สิ่งที่ต้องแก้

เพิ่ม Section ใหม่ **`## 10. ผลการทดสอบระบบ`** ไว้ก่อน `## สรุป`
(ปัจจุบัน `## สรุป` อยู่ที่บรรทัดประมาณ 810)

เนื้อหาอย่างน้อยต้องมี:

1. **ตารางผลทดสอบ** คอลัมน์: ลำดับ | สิ่งที่ทดสอบ | คำสั่ง/วิธี | ผลลัพธ์
   ครอบคลุมอย่างน้อย 8 ข้อ:
   - Login สำเร็จ / รหัสผิดผิดได้ 401
   - Profile คืนค่า role ถูกต้อง
   - ดูรายการหนัง / รายละเอียดหนัง / รอบฉาย / แผนผังที่นั่ง
   - USER จองตั๋วได้
   - จองที่นั่งซ้ำได้ 409
   - ADMIN จองตั๋วไม่ได้ 403
   - USER เข้า `/api/admin/*` ไม่ได้ 403
   - ยกเลิกการจอง แล้วที่นั่งคืนเข้าระบบ
   - Forgot Password ส่งอีเมลเข้า Mailpit
   - Reset Password ใช้ Token ซ้ำไม่ได้
2. **วันที่ทดสอบ** และ **คำสั่งที่ใช้รันระบบ**
3. ระบุเงื่อนไขว่าทดสอบบน `docker compose up -d` จาก volume ว่างเปล่า

**ข้อควรระวัง:** เขียนเฉพาะสิ่งที่ **รันแล้วเห็นผลจริง**
ห้ามแต่งผลทดสอบที่ไม่ได้รัน — ถ้าไม่แน่ใจ ให้รันคำสั่งใน §7 ก่อนแล้วค่อยบันทึก

### ไฟล์ที่แก้

- `README.md`

### วิธีตรวจ

```powershell
# เช็คว่ามี heading ใหม่
Select-String -Path README.md -Pattern "^## 10\."

# เช็คว่า code fence ยังสมดุล (ต้องได้เลขคู่)
(Select-String -Path README.md -Pattern '^```').Count
```

---

## งานที่ 4 (ยังไม่เริ่ม — รอข้อมูลจากสมาชิกคนที่ 1)

**เรื่อง : Auth Path ต้องตรงตามภาพของอาจารย์**

ยังไม่มีข้อมูลว่าอาจารย์กำหนด Path เป็นอะไร สมาชิกคนที่ 1
จะส่งมาเพิ่มภายหลัง ถ้าได้ข้อมูลแล้วงานนี้จะอยู่ในไฟล์นี้

โดยทั่วไปถ้าต้องแก้ คือแก้ที่
`api-gateway/src/config/routes.js` และ
`api-gateway/src/middleware/authMapping.js`
**ไม่ต้องแตะ Backend**

---

## ก่อน Commit ทุกครั้ง — Checklist

```powershell
git status
docker compose restart backend
Start-Sleep -Seconds 25
# รันคำสั่งทดสอบของงานที่ทำ แล้วค่อย commit
```

- [ ] โค้ดที่แก้ **รันผ่านจริง** ไม่ใช่แค่เขียนเสร็จ
- [ ] รัน `git diff` อ่านโค้ดตัวเองก่อน commit
- [ ] Commit Message ใช้รูปแบบ Conventional Commits
- [ ] **ไม่** commit ไฟล์ `.env`
- [ ] ใช้ชื่อ-อีเมลตัวเอง (เช็คด้วย `git config user.name`)

## รูปแบบ Commit Message

```bash
git add backend/src/routes/booking.routes.js
git commit -m "fix(booking): wrap cancel in transaction to release seats atomically"
```

```bash
git add README.md
git commit -m "docs: add test results section with pass/fail summary"
```

## หลัง Commit

```powershell
git push
```

คำสั่งนี้ครั้งเดียวขึ้นทั้ง **GitHub** และ **Gitea** พร้อมกัน
(ตั้งค่า push URL ไว้ 2 ที่แล้ว — ดูท้าย README §9.3)

แล้วตรวจสอบ:

```powershell
git log --oneline -5
git log --format="%an <%ae>" -5
```

ต้องเห็น **ชื่อของคุณ** อย่างน้อย 1 commit

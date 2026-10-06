# ระบบจองตั๋วหนัง (Movie Ticket Booking System)

## บทสรุป (Executive Summary)

โปรเจกต์นี้เป็นการพัฒนา **ระบบจองตั๋วหนัง** สำหรับส่งงานวิชาระบบ Linux โดยกลุ่มได้เลือกใช้

| หัวข้อ | รายละเอียด |
|---|---|
| **ระบบที่พัฒนา** | ระบบจองตั๋วหนัง (Movie Ticket Booking System) |
| **Backend Framework** | **Express.js + Prisma + PostgreSQL** |
| **รูปแบบการรัน** | Docker Compose |
| **ระบบเสริม** | API Gateway (Express.js) + Gitea + Mailpit |

> **หมายเหตุสำคัญ:** กลุ่มเลือกพัฒนา Custom Backend ด้วย Express.js + Prisma
> แทนการใช้ Headless CMS (เช่น Strapi หรือ Payload CMS) เพื่อให้แตกต่างและไม่ซ้ำกับกลุ่มอื่น
> รวมถึงออกแบบโครงสร้าง API และฐานข้อมูลด้วยตนเองทั้งหมด

---

## สารบัญ

1. [สถาปัตยกรรมระบบ](#1-สถาปัตยกรรมระบบ)
2. [หน้าที่ของแต่ละ Container](#2-หน้าที่ของแต่ละ-container)
3. [โครงสร้าง API](#3-โครงสร้าง-api)
4. [โครงสร้างฐานข้อมูล](#4-โครงสร้างฐานข้อมูล)
5. [เงื่อนไขสิทธิ์ Admin vs User](#5-เงื่อนไขสิทธิ์-admin-vs-user)
6. [วิธีติดตั้งและใช้งาน](#6-วิธีติดตั้งและใช้งาน)
7. [วิธีทดสอบระบบ](#7-วิธีทดสอบระบบ)
8. [วิธีทดสอบ Forgot Password ผ่าน Mailpit](#8-วิธีทดสอบ-forgot-password-ผ่าน-mailpit)
9. [แผนการแบ่งงานและ Git Commit](#9-แผนการแบ่งงานและ-git-commit)

---

## 1. สถาปัตยกรรมระบบ

ระบบประกอบด้วย 3 ส่วนหลัก ทำงานร่วมกันดังนี้

```
                    ┌─────────────────────────────────────────┐
                    │           ผู้ใช้งาน / Client                │
                    │      (Postman / Browser / Frontend)       │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │         API Gateway  (พอร์ต 8080)         │
                    │            api-gateway/                  │
                    │                                          │
                    │  • แมป AUTH API ให้ตรงตาม 69-s1-app      │
                    │  • ส่งต่อ CONTENT API ไป Backend          │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │     Backend ระบบจองตั๋วหนัง (พอร์ต 4000)   │
                    │            backend/                       │
                    │                                          │
                    │   Express.js  +  Prisma ORM              │
                    │   • Auth (Login/Profile/Forgot Token)    │
                    │   • Movie / Showtime / Seat              │
                    │   • Booking (จองตั๋ว)                     │
                    │   • Admin (จัดการระบบหลังบ้าน)           │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │      app-db : PostgreSQL 14              │
                    │   ฐานข้อมูลระบบจองตั๋วหนัง (แยกจาก Gitea)  │
                    └─────────────────────────────────────────┘
```

### ส่วนประกอบเพิ่มเติม (สำหรับงานวิชาระบบ)

```
   ┌──────────────────────────┐      ┌──────────────────────────┐
   │  gitea-server (พอร์ต 3000)│      │  mailpit (พอร์ต 8025)    │
   │  Gitea = Git Server      │      │  ดักจับอีเมล            │
   │  หน้าที่ : เก็บ Source   │      │  หน้าที่ : รับอีเมล       │
   │  Code ของกลุ่ม            │      │  Reset Password          │
   └────────────┬─────────────┘      └────────────┬─────────────┘
                │                                   │
                └──────────► gitea-db ◄────────────┘
                        PostgreSQL ของ Giteา
```

---

## 2. หน้าที่ของแต่ละ Container

| Container | Image | หน้าที่ | พอร์ต |
|---|---|---|---|
| `app-db` | `postgres:14-alpine` | ฐานข้อมูลของระบบจองตั๋วหนัง (Movie, Showtime, Seat, Booking) | ภายในเครือข่าย |
| `backend` | Node.js 20 + Prisma | **ระบบจองตั๋วหนัง** — Business Logic และ API ทั้งหมด | `4000` |
| `api-gateway` | Node.js 20 + Express | แมป Path ของ Auth API ให้ตรงตามเงื่อนไข 69-s1-app | `8080` |
| `gitea-server` | `gitea/gitea:latest` | **Git Server** — เก็บ Source Code ของกลุ่ม | `3000`, `2222` |
| `gitea-db` | `postgres:14-alpine` | ฐานข้อมูลของ Gitea | ภายในเครือข่าย |
| `mailpit` | `axllent/mailpit` | ดักจับอีเมลทั้งหมด เพื่อทดสอบ Forgot Password | `8025`, `1025` |

### ความแตกต่างระหว่าง Gitea กับระบบจองตั๋วหนัง

สองส่วนนี้ทำหน้าที่ **แยกกันชัดเจน** ไม่ปะปนกัน

| ประเด็น | ระบบจองตั๋วหนัง (Backend) | Gitea |
|---|---|---|
| **ประเภท** | Web Application (ระบบสำหรับผู้ใช้งาน) | Git Hosting Service (ระบบเก็บโค้ด) |
| **หน้าที่** | ให้บริการจองตั๋วหนัง | เก็บและจัดการ Source Code |
| **เทคโนโลยี** | Express.js + Prisma + PostgreSQL | Go (Giteา) + PostgreSQL |
| **ผู้ใช้งาน** | ผู้ดูหนังและผู้จองตั๋ว (USER) | นักพัฒนาในกลุ่ม (สมาชิก 2 คน) |
| **เกี่ยวข้องกันหรือไม่** | ไม่เกี่ยวข้อง — ทำงานแยกส่วนกันโดยสิ้นเชิง | ไม่เกี่ยวข้อง — ใช้เก็บโค้ดเท่านั้น |

---

## 3. โครงสร้าง API

ระบบแบ่ง API ออกเป็น 2 กลุ่ม ตามเงื่อนไขที่อาจารย์กำหนด

### 3.1 Authentication API (ตรงตาม 69-s1-app)

Path ของกลุ่มกำหนดให้ตรงกับ Repository `69-s1-app` โดยใช้ API Gateway เป็นตัวแมป
รายละเอียดการแมปอยู่ในไฟล์ `api-gateway/src/config/routes.js`

| Endpoint | Method | หน้าที่ | แมปไปยัง Backend |
|---|---|---|---|
| `/api/auth/login` | `POST` | **LOGIN** — เข้าสู่ระบบ | `POST /auth/login` |
| `/api/auth/profile` | `GET` | **PROFILE** — ดึงข้อมูลโปรไฟล์ | `GET /auth/profile` |
| `/api/auth/forgot-password` | `POST` | **FORGOT PASSWORD TOKEN** — ขอ Reset Token | `POST /auth/forgot-password` |
| `/api/auth/reset-password` | `POST` | ตั้งรหัสผ่านใหม่ด้วย Token | `POST /auth/reset-password` |
| `/api/auth/register` | `POST` | สมัครสมาชิกใหม่ | `POST /auth/register` |

### 3.2 Content API (ยึดโครงสร้างระบบจองตั๋วหนัง)

ส่งต่อแบบ Forward Proxy โดยไม่แก้ไขโครงสร้างข้อมูล

| Endpoint | Method | หน้าที่ | สิทธิ์ |
|---|---|---|---|
| `/api/movies` | `GET` | รายการหนังทั้งหมด | ทุกคน |
| `/api/movies/:id` | `GET` | รายละเอียดหนังพร้อมรอบฉาย | ทุกคน |
| `/api/movies` | `POST` | เพิ่มหนังใหม่ | ADMIN |
| `/api/movies/:id` | `PUT` | แก้ไขข้อมูลหนัง | ADMIN |
| `/api/movies/:id` | `DELETE` | ลบข้อมูลหนัง | ADMIN |
| `/api/showtimes` | `GET` | รายการรอบฉาย | ทุกคน |
| `/api/showtimes/:id/seats` | `GET` | แผนผังที่นั่งพร้อมสถานะ | ทุกคน |
| `/api/showtimes` | `POST` | สร้างรอบฉาย + ที่นั่งอัตโนมัติ | ADMIN |
| `/api/showtimes/:id` | `DELETE` | ลบรอบฉาย | ADMIN |
| `/api/bookings` | `POST` | **จองตั๋วหนัง** | USER |
| `/api/bookings` | `GET` | ประวัติการจองของตัวเอง | USER |
| `/api/bookings/:id` | `DELETE` | ยกเลิกการจอง | USER |
| `/api/bookings/:id` | `GET` | รายละเอียดการจองของตัวเอง | USER |
| `/api/admin/dashboard` | `GET` | แดชบอร์ดสรุประบบ | ADMIN |
| `/api/admin/users` | `GET` | ดูรายชื่อผู้ใช้ทั้งหมด | ADMIN |
| `/api/admin/users/:id/role` | `PUT` | เปลี่ยนบทบาทของผู้ใช้ | ADMIN |
| `/api/admin/users/:id` | `DELETE` | ลบผู้ใช้ | ADMIN |
| `/api/admin/bookings` | `GET` | ดูการจองทั้งหมดของระบบ | ADMIN |

---

## 4. โครงสร้างฐานข้อมูล

ออกแบบด้วย Prisma Schema (`backend/prisma/schema.prisma`) ประกอบด้วย 7 ตาราง

| ตาราง | หน้าที่ | ความสัมพันธ์ |
|---|---|---|
| `users` | ข้อมูลผู้ใช้ (แยก Admin / User) | 1 → N กับ `bookings` |
| `password_reset_tokens` | Token สำหรับ Forgot Password | N → 1 กับ `users` |
| `movies` | ข้อมูลหนัง | 1 → N กับ `showtimes` |
| `showtimes` | รอบฉาย | N → 1 กับ `movies`, 1 → N กับ `seats` |
| `seats` | ที่นั่งภายในรอบฉาย | N → 1 กับ `showtimes` |
| `bookings` | รายการจองตั๋ว | N → 1 กับ `users`, `showtimes` |
| `booking_seats` | ตารางเชื่อมที่นั่งที่ถูกจอง | เชื่อม `bookings` ↔ `seats` |

### จุดสำคัญของการออกแบบ

**ป้องกันการจองที่นั่งซ้ำ**

ตาราง `booking_seats` กำหนด `@@unique([showtimeId, seatId])`
เท่านี้ ฐานข้อมูลจะไม่ยอมให้มีการจองที่นั่งเดียวกันในรอบฉายเดียวกันได้
แม้ผู้ใช้สองคนจะกดจองพร้อมกัน (Race Condition) ระบบก็จะปฏิเสธรายการที่ซ้ำให้อัตโนมัติ

**การคำนวณราคา**

```
ที่นั่ง NORMAL  = ราคาตั๋วตามปกติ
ที่นั่ง PREMIUM = ราคาตั๋ว × 1.5
```

---

## 5. เงื่อนไขสิทธิ์ Admin vs User

ระบบแบ่งสิทธิ์อย่างชัดเจนด้วย Middleware 3 ระดับ
(`backend/src/middleware/auth.js`)

| Middleware | ใช้กับ Route | ผลการทำงาน |
|---|---|---|
| `requireAuth` | ทุก Route ที่ต้อง Login | ตรวจสอบ Bearer Token |
| `requireAdmin` | Route จัดการระบบหลังบ้าน | อนุญาตเฉพาะ Admin |
| `requireUser` | Route จองตั๋ว | ปฏิเสธ Admin ออก |

### 5.1 สิทธิ์ของ ADMIN (ผู้ดูแลระบบหลังบ้าน)

| สิทธิ์ | Endpoint |
|---|---|
| ✅ ดูแลชื่อหนังและรอบฉาย | `POST /api/movies`, `PUT`, `DELETE`, `POST /api/showtimes` |
| ✅ ดูแลผู้ใช้งาน | `GET /api/admin/users`, `PUT .../role`, `DELETE .../:id` |
| ✅ ดูภาพรวมการจองทั้งระบบ | `GET /api/admin/bookings`, `GET /api/admin/dashboard` |
| ❌ **ห้ามจองตั๋ว** | `POST /api/bookings` จะได้รับ 403 Forbidden |
| ❌ **ห้ามดูประวัติการจอง** | `GET /api/bookings` จะได้รับ 403 Forbidden |

> **เหตุผล:** ตามเงื่อนไขของอาจารย์ที่ระบุว่า *"Admin ห้ามทำ Operation ของ User ทั่วไป"*
> ระบบจึงบล็อกไม่ให้ Admin เข้าถึง Endpoint การจองตั๋ว เพื่อแยกแยะบทบาทให้ชัดเจน

### 5.2 สิทธิ์ของ USER (ผู้ใช้ทั่วไป)

| สิทธิ์ | Endpoint |
|---|---|
| ✅ ดูรายการหนังและรอบฉาย | `GET /api/movies`, `GET /api/showtimes` |
| ✅ ดูแผนผังที่นั่ง | `GET /api/showtimes/:id/seats` |
| ✅ **จองตั๋วหนัง** | `POST /api/bookings` |
| ✅ ดูประวัติการจองของตัวเอง | `GET /api/bookings`, `GET /api/bookings/:id` |
| ✅ ยกเลิกการจองของตัวเอง | `DELETE /api/bookings/:id` |
| ✅ จัดการโปรไฟล์ของตัวเอง | `GET /api/auth/profile` |
| ❌ **ห้ามจัดการหนัง/รอบฉาย** | `POST /api/movies` จะได้รับ 403 Forbidden |
| ❌ **ห้ามเข้าถึงระบบหลังบ้าน** | `GET /api/admin/*` จะได้รับ 403 Forbidden |

### 5.3 แผนภาพสิทธิ์

```
                    ┌──────────────────┐
                    │  Login (API)     │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
      ┌───────────────┐             ┌───────────────┐
      │  ADMIN        │             │  USER         │
      │ ดูแลหลังบ้าน   │             │ จองตั๋วหนัง   │
      └───────┬───────┘             └───────┬───────┘
              │                             │
   ✅ จัดการหนัง/รอบฉาย              ✅ ดูหนัง / รอบฉาย
   ✅ จัดการผู้ใช้                  ✅ จองตั๋ว
   ✅ ดูภาพรวมการจอง                ✅ ดูประวัติการจอง
                                      ✅ ยกเลิกการจอง
   ❌ จองตั๋ว          ──────── ถูกปฏิเสธ ────────▶
   ❌ ดูประวัติการจอง  ──────── ถูกปฏิเสธ ────────▶
```

---

## 6. วิธีติดตั้งและใช้งาน

### 6.1 ข้อกำหนดเบื้องต้น

- Docker Desktop ติดตั้งและเปิดใช้งาน
- Docker Compose (รวมมากับ Docker Desktop แล้ว)
- พอร์ตต่อไปนี้ว่าง: `8080`, `4000`, `3000`, `8025`, `1025`, `2222`

### 6.2 โครงสร้างโปรเจกต์

```text
gitea-pros1/
├── docker-compose.yml
├── .env                      # ไม่ถูก Commit (อยู่ใน .gitignore)
├── .env.example
├── .gitignore
├── README.md
│
├── backend/                          # ระบบจองตั๋วหนัง
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── package-lock.json             # ล็อก version ให้เท่ากันทุกเครื่อง
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/               # ใช้โดย prisma migrate deploy
│   │       ├── migration_lock.toml
│   │       └── 20260101000000_init/
│   │           └── migration.sql
│   └── src/
│       ├── index.js
│       ├── app.js
│       ├── lib/
│       │   ├── prisma.js
│       │   └── mailer.js
│       ├── middleware/
│       │   └── auth.js
│       ├── routes/
│       │   ├── index.js
│       │   ├── auth.routes.js
│       │   ├── movie.routes.js
│       │   ├── showtime.routes.js
│       │   ├── booking.routes.js
│       │   └── admin.routes.js
│       └── utils/
│           └── jwt.js
│
└── api-gateway/                      # API Gateway
    ├── Dockerfile
    ├── .dockerignore
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── index.js
        ├── app.js
        ├── proxy.js
        ├── config/
        │   ├── index.js
        │   └── routes.js             # ตารางการแมป Path
        └── middleware/
            └── authMapping.js        # Logic การแมป Auth API
```

### 6.3 ขั้นตอนการติดตั้ง

**ขั้นตอนที่ 1 : เข้าไปที่โฟลเดอร์โปรเจกต์**

```bash
cd gitea-pros1
```

**ขั้นตอนที่ 2 : ตั้งค่าไฟล์ .env**

ไฟล์ `.env` มาพร้อมในโปรเจกต์แล้ว ควรแก้ค่าเหล่านี้ก่อนใช้งานจริง

```env
APP_DB_PASSWORD=รหัสผ่านที่แข็งแรงของคุณ
GITEA_DB_PASSWORD=รหัสผ่านที่แข็งแรงของคุณ
JWT_SECRET=สตริงยาวสุ่มที่ไม่ซ้ำกัน
```

**ขั้นตอนที่ 3 : Build และรัน Container ทั้งหมด**

```bash
docker compose up -d --build
```

คำสั่งนี้จะ Build Image สำหรับ `backend` และ `api-gateway`
แล้วสร้าง Container ทั้ง 6 ตัวพร้อมกัน รวมถึงรัน Prisma Migration
และใส่ข้อมูลเริ่มต้นอัตโนมัติ

**ขั้นตอนที่ 4 : ตรวจสอบสถานะ**

```bash
docker compose ps
```

ทุก Container ควรแสดงสถานะ `Up` และผ่าน Healthcheck

**ขั้นตอนที่ 5 : ตรวจสอบการทำงาน**

เปิด Browser ไปที่

| ระบบ | URL |
|---|---|
| รายการ Endpoint ของ Gateway | http://localhost:8080/api |
| Health Check | http://localhost:8080/health |
| Backend โดยตรง | http://localhost:4000/health |
| Gitea | http://localhost:3000 |
| Mailpit | http://localhost:8025 |

### 6.4 บัญชีทดสอบ (สร้างอัตโนมัติจาก Seed)

| บทบาท | Email | Password | ใช้ทำอะไร |
|---|---|---|---|
| **ADMIN** | `admin@movie.local` | `Admin@1234` | จัดการหนัง รอบฉาย ผู้ใช้ และดูภาพรวม |
| **USER** | `user@movie.local` | `User@1234` | ดูหนัง จองตั๋ว ดูประวัติการจอง |

### 6.5 คำสั่ง Docker ที่ใช้บ่อย

```bash
# ดู Log ของทุก Container
docker compose logs -f

# ดู Log เฉพาะ Backend
docker compose logs -f backend

# หยุดระบบ (เก็บข้อมูลไว้)
docker compose down

# หยุดระบบและลบข้อมูลทั้งหมด (เริ่มใหม่)
docker compose down -v

# เริ่มระบบใหม่
docker compose up -d
```

> ⚠️ **หมายเหตุ `docker compose down -v`** — จะลบข้อมูลของ **ทั้งระบบจองตั๋วหนังและ Gitea**
> ข้อมูลจอง/ผู้ใช้จะถูก Seed ใหม่ให้ตามตารางบัญชีด้านบนอัตโนมัติ
> แต่ **Gitea ต้องตั้งค่า Install Wizard ใหม่** และสร้าง Repository ใหม่อีกครั้ง
> ถ้าต้องการรีเซ็ตข้อมูลระบบจองตั๋วหนังอย่างเดียว ให้รัน seed ซ้ำแทน:
>
> ```bash
> docker compose exec -T backend npx prisma db seed
> ```

---

## 7. วิธีทดสอบระบบ

### 7.1 ทดสอบด้วย Postman หรือ cURL

#### ① LOGIN — เข้าสู่ระบบ

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@movie.local","password":"User@1234"}'
```

**ผลลัพธ์ที่คาดหวัง**

```json
{
  "success": true,
  "message": "เข้าสู่ระบบสำเร็จ",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "user": {
      "id": 2,
      "email": "user@movie.local",
      "username": "user",
      "fullName": "ผู้ใช้ทั่วไป (User)",
      "role": "USER"
    }
  }
}
```

> จดจำค่า `token` ไว้ เพราะต้องใช้ในการเรียก API อื่น

#### ② PROFILE — ดึงข้อมูลโปรไฟล์

```bash
curl -X GET http://localhost:8080/api/auth/profile \
  -H "Authorization: Bearer <วาง token ที่ได้จากขั้นตอน①>"
```

**ผลลัพธ์ที่คาดหวัง**

```json
{
  "success": true,
  "message": "ดึงข้อมูลโปรไฟล์สำเร็จ",
  "data": {
    "id": 2,
    "email": "user@movie.local",
    "username": "user",
    "fullName": "ผู้ใช้ทั่วไป (User)",
    "role": "USER",
    "totalBookings": 0
  }
}
```

#### ③ ดูรายการหนัง

```bash
curl -X GET http://localhost:8080/api/movies
```

#### ④ ดูรอบฉายของหนัง

```bash
curl -X GET "http://localhost:8080/api/showtimes?movieId=1"
```

#### ⑤ ดูแผนผังที่นั่ง

```bash
curl -X GET http://localhost:8080/api/showtimes/1/seats
```

**ผลลัพธ์ (ส่วนหนึ่ง)**

```json
{
  "success": true,
  "data": {
    "showtime": { "id": 1, "screen": "Hall A", "price": 120 },
    "seats": [
      { "id": 1, "seatCode": "A1", "seatType": "NORMAL", "isAvailable": true },
      { "id": 2, "seatCode": "A2", "seatType": "NORMAL", "isAvailable": true }
    ]
  }
}
```

#### ⑥ จองตั๋วหนัง (ต้องเป็น USER)

> `seatIds` คือค่า `id` ของที่นั่งที่ได้จากขั้นตอน ⑤ ไม่ใช่รหัสที่นั่ง (`A1`, `A2`)
> และต้องเป็นที่นั่งของรอบฉายเดียวกัน

```bash
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token ของ USER>" \
  -d '{"showtimeId":1,"seatIds":[1,2]}'
```

**ผลลัพธ์ที่คาดหวัง**

```json
{
  "success": true,
  "message": "จองตั๋วหนังสำเร็จ",
  "data": {
    "id": 1,
    "bookingCode": "BK-20261006-0001",
    "status": "CONFIRMED",
    "totalPrice": 240,
    "movie": "ระบบจองตั๋วหนัง",
    "screen": "Hall A",
    "seats": ["A1", "A2"]
  }
}
```

#### ⑦ ดูประวัติการจอง

```bash
curl -X GET http://localhost:8080/api/bookings \
  -H "Authorization: Bearer <token ของ USER>"
```

### 7.2 ทดสอบการแยกสิทธิ์ Admin / User

#### ทดสอบว่า Admin จองตั๋วไม่ได้

```bash
# 1. Login เป็น Admin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@movie.local","password":"Admin@1234"}'

# 2. ลองจองตั๋วด้วย Token ของ Admin
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token ของ ADMIN>" \
  -d '{"showtimeId":1,"seatIds":[3]}'
```

**ผลลัพธ์ที่คาดหวัง (ต้องได้ 403)**

```json
{
  "success": false,
  "message": "เข้าถึงไม่ได้ : Endpoint นี้สำหรับผู้ใช้งานทั่วไป (User) เท่านั้น"
}
```

#### ทดสอบว่า User เพิ่มหนังไม่ได้

```bash
curl -X POST http://localhost:8080/api/movies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token ของ USER>" \
  -d '{"title":"ทดสอบ","duration":90}'
```

**ผลลัพธ์ที่คาดหวัง (ต้องได้ 403)**

```json
{
  "success": false,
  "message": "เข้าถึงไม่ได้ : ต้องเป็นผู้ดูแลระบบ (Admin) เท่านั้น"
}
```

#### ทดสอบการป้องกันการจองที่นั่งซ้ำ

จองที่นั่ง A1 แล้วลองจอง A1 อีกครั้ง

```json
{
  "success": false,
  "message": "ที่นั่ง A1 ถูกจองไปแล้ว กรุณาเลือกที่นั่งอื่น"
}
```

### 7.3 ทดสอบด้วยแดชบอร์ด Admin

```bash
curl -X GET http://localhost:8080/api/admin/dashboard \
  -H "Authorization: Bearer <token ของ ADMIN>"
```

---

## 8. วิธีทดสอบ Forgot Password ผ่าน Mailpit

ระบบติดตั้ง **Mailpit** เพื่อดักจับอีเมลทั้งหมด ทำให้ทดสอบ Forgot Password ได้โดยไม่ต้องใช้ SMTP จริง
และไม่มีอีเมลออกสู่ Internet

### ขั้นตอนที่ 1 : เปิด Mailpit

เปิด Browser ไปที่ **http://localhost:8025**

จะเห็นหน้า Inbox ว่าง

### ขั้นตอนที่ 2 : ขอ Reset Token

```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@movie.local"}'
```

**ผลลัพธ์ที่คาดหวัง**

```json
{
  "success": true,
  "message": "หากอีเมลนี้มีอยู่ในระบบ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว"
}
```

> **หมายเหตุ 1 :** ต้องดึง Token จากอีเมลใน Mailpit เท่านั้น เพราะระบบตั้งค่า
> `NODE_ENV=production` ไว้ เพื่อไม่ให้ Token หลุดกลับมาใน HTTP Response
>
> **หมายเหตุ 2 :** ถ้า Request ไปด้วย Email ที่ไม่มีอยู่ในระบบ
> ระบบจะตอบกลับเหมือนกันทุกประการ เพื่อไม่ให้เปิดเผยว่า Email ใดมีอยู่จริง

### ขั้นตอนที่ 3 : ดูอีเมลใน Mailpit

กลับไปที่ **http://localhost:8025**

จะพบอีเมลใหม่ 1 ฉบับ หัวข้อ *"🔐 รีเซ็ตรหัสผ่าน — ระบบจองตั๋วหนัง"*

คลิกเปิดอีเมล จะเห็นปุ่ม **"ตั้งรหัสผ่านใหม่"** และลิงก์ที่มี Token อยู่
(หากอ่านจากเมนู **Message → Source** จะเห็น Token ในรูป
`http://localhost:8080/reset-password?token=<64 ตัวอักษร>` ชัดเจนที่สุด)

### ขั้นตอนที่ 4 : ตั้งรหัสผ่านใหม่

นำ Token จากอีเมลมาใช้ กับ `POST /api/auth/reset-password`

> ลิงก์ในอีเมลชี้ไปที่หน้าเว็บ `reset-password` ซึ่งเป็นหน้า Frontend
> ระบบนี้เป็น API เท่านั้น จึงต้องนำ Token มาเรียกผ่าน API ตามตัวอย่างด้านล่าง

```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<วาง token จากอีเมล>","newPassword":"NewPass@123"}'
```

**ผลลัพธ์ที่คาดหวัง**

```json
{
  "success": true,
  "message": "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
}
```

### ขั้นตอนที่ 5 : ทดสอบ Login ด้วยรหัสผ่านใหม่

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@movie.local","password":"NewPass@123"}'
```

### ขั้นตอนที่ 6 : ทดสอบความปลอดภัยของ Token

| กรณีทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|
| ใช้ Token ซ้ำเป็นครั้งที่สอง | 400 — `Token ถูกใช้ไปแล้ว กรุณาขอ Token ใหม่` |
| ใช้ Token ที่หมดอายุ (เกิน 15 นาที) | 400 — `Token หมดอายุแล้ว กรุณาขอ Token ใหม่` |
| ใช้ Token ที่ไม่มีอยู่จริง | 400 — `Token ไม่ถูกต้อง` |

---

## 9. แผนการแบ่งงานและ Git Commit

### 9.1 การแบ่งงานระหว่างสมาชิก 2 คน

| สมาชิก | พื้นที่รับผิดชอบ | ไฟล์ที่ดูแล |
|---|---|---|
| **สมาชิกคนที่ 1** | Infrastructure และระบบหลังบ้าน | `docker-compose.yml`, `.env`, `.env.example`, `.gitignore`, `README.md`, `backend/.dockerignore`, `api-gateway/.dockerignore` |
| **สมาชิกคนที่ 2** | Backend และ API Gateway | `backend/` ทั้งหมด, `api-gateway/` ทั้งหมด |

#### รายละเอียดงานของแต่ละคน

**สมาชิกคนที่ 1 — DevOps & Documentation**

| ไฟล์ | หน้าที่ |
|---|---|
| `docker-compose.yml` | ตั้งค่า Container ทั้ง 6 ตัว และ Network |
| `.env` / `.env.example` | ตั้งค่าตัวแปรของฐานข้อมูลและระบบ |
| `.gitignore` | กันไม่ให้ Commit ไฟล์ลับ |
| `README.md` | เขียนเอกสารส่งอาจารย์ พร้อมผลการทดสอบ |
| ทดสอบระบบรวม | ทดสอบ Forgot Password ผ่าน Mailpit และบันทึกผล |

**สมาชิกคนที่ 2 — Backend Developer**

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/prisma/schema.prisma` | ออกแบบโครงสร้างฐานข้อมูล 7 ตาราง |
| `backend/prisma/seed.js` | สร้างข้อมูลเริ่มต้นสำหรับทดสอบ |
| `backend/src/middleware/auth.js` | สร้าง Middleware แยกสิทธิ์ Admin / User |
| `backend/src/routes/auth.routes.js` | พัฒนา Login, Profile, Forgot Password Token |
| `backend/src/routes/movie.routes.js` | พัฒนา CRUD ข้อมูลหนัง |
| `backend/src/routes/showtime.routes.js` | พัฒนาระบบรอบฉายและที่นั่ง |
| `backend/src/routes/booking.routes.js` | พัฒนาระบบจองตั๋ว พร้อมป้องกันการจองซ้ำ |
| `backend/src/routes/admin.routes.js` | พัฒนาระบบจัดการหลังบ้าน |
| `api-gateway/src/config/routes.js` | กำหนดตารางการแมป Path |
| `api-gateway/src/middleware/authMapping.js` | พัฒนา Logic การแมป Auth API ให้ตรง 69-s1-app |
| `api-gateway/src/proxy.js` | พัฒนา Forward Proxy สำหรับ Content API |

### 9.2 แผนการ Commit

ใช้รูปแบบ **Conventional Commits** เพื่อให้อ่านง่ายและตรวจสอบส่วนร่วมได้ง่าย

#### สมาชิกคนที่ 1

```bash
# Commit ที่ 1 : โครงสร้างโปรเจกต์
git add .gitignore
git commit -m "chore: add gitignore for node, env and prisma"

# Commit ที่ 2 : Docker Compose
git add docker-compose.yml
git commit -m "feat(docker): add compose with 6 containers for movie booking system"
git commit -m "feat(docker): configure gitea with postgres and mailpit smtp"
git commit -m "feat(docker): add backend and api-gateway services"

# Commit ที่ 3 : Environment
git add .env.example
git commit -m "chore(env): add example environment variables"

# Commit ที่ 4 : README
git add README.md
git commit -m "docs: add system architecture and api documentation"
git commit -m "docs: document admin and user permission rules"
git commit -m "docs: add forgot password testing guide via mailpit"
```

#### สมาชิกคนที่ 2

```bash
# Commit ที่ 1 : โครงสร้าง Backend
git add backend/package.json backend/Dockerfile
git commit -m "feat(backend): initialize express project with prisma and docker setup"

# Commit ที่ 2 : ฐานข้อมูล
git add backend/prisma/schema.prisma
git commit -m "feat(db): design schema with 7 tables for movie booking system"
git commit -m "feat(db): add unique constraint to prevent double seat booking"
git add backend/prisma/seed.js
git commit -m "feat(db): add seed data for admin, user, movies and showtimes"

# Commit ที่ 3 : Authentication
git add backend/src/utils/jwt.js backend/src/lib/mailer.js
git commit -m "feat(auth): add jwt utility and mailpit email sender"
git add backend/src/routes/auth.routes.js
git commit -m "feat(auth): implement login, register and profile endpoints"
git commit -m "feat(auth): implement forgot password token with email delivery"
git commit -m "feat(auth): implement reset password with token validation"

# Commit ที่ 4 : สิทธิ์
git add backend/src/middleware/auth.js
git commit -m "feat(auth): add role middleware separating admin and user"

# Commit ที่ 5 : Content API
git add backend/src/routes/movie.routes.js
git commit -m "feat(movie): implement movie CRUD with admin only write access"
git add backend/src/routes/showtime.routes.js
git commit -m "feat(showtime): implement showtime and seat layout management"
git add backend/src/routes/booking.routes.js
git commit -m "feat(booking): implement ticket booking with transaction and seat locking"
git add backend/src/routes/admin.routes.js
git commit -m "feat(admin): implement dashboard, user management and booking overview"

# Commit ที่ 6 : API Gateway
git add api-gateway/package.json api-gateway/Dockerfile
git commit -m "feat(gateway): initialize api gateway with express and docker"
git add api-gateway/src/config/routes.js
git commit -m "feat(gateway): define auth and content route mapping table"
git add api-gateway/src/middleware/authMapping.js
git commit -m "feat(gateway): implement auth mapping for login, profile and forgot token"
git add api-gateway/src/proxy.js
git commit -m "feat(gateway): implement content api forward proxy to backend"
```

### 9.3 ข้อแนะนำสำคัญ

**เรื่องการมีส่วนร่วม**

> อาจารย์ระบุว่า *"หากไม่มีชื่อใน Repository จะไม่นับว่ามีส่วนร่วม"*
> ดังนั้นทั้ง 2 คนต้องมี Commit ปรากฏบน GitHub เพื่อยืนยันการมีส่วนร่วมในโปรเจกต์

**แนวทางที่แนะนำ**

1. ทำงานบน Branch แยกของแต่ละคน เพื่อลดความขัดแย้ง
   - `feature/infrastructure` (สมาชิกคนที่ 1)
   - `feature/backend` (สมาชิกคนที่ 2)
2. ทำ Pull Request เพื่อรวมเข้า `main`
3. ตรวจสอบสถานะก่อน Commit ทุกครั้ง

```bash
git status
git add <เฉพาะไฟล์ของตัวเอง>
git commit -m "ข้อความตามรูปแบบ Conventional Commits"
git push origin <ชื่อ branch>
```

> **หมายเหตุ :** `origin` ถูกตั้ง push URL ไว้ 2 ที่ (GitHub + Gitea)
> ดังนั้นคำสั่ง `git push` ครั้งเดียวจะส่งขึ้น **ทั้งสอง Repository พร้อมกัน**
> เมื่อ merge เข้า `main` แล้วใช้เพียง `git push` โดยไม่ต้องระบุ remote

4. **ห้าม Commit ข้อมูลลับ**
   - ไฟล์ `.env` ถูกใส่ใน `.gitignore` แล้ว
   - ให้ส่งเฉพาะไฟล์ `.env.example` ที่ไม่มีรหัสผ่านจริง

---

## สรุป

โปรเจกต์นี้เป็น **ระบบจองตั๋วหนัง** ที่พัฒนาด้วย **Express.js + Prisma + PostgreSQL**
ประกอบด้วย 2 ส่วนหลัก

| ส่วน | เทคโนโลยี | หน้าที่ |
|---|---|---|
| **ระบบจองตั๋วหนัง** | Express.js + Prisma + PostgreSQL | ระบบหลักที่ให้บริการผู้ใช้ — ดูหนัง จองตั๋ว จัดการระบบ |
| **API Gateway** | Express.js | แมป Path ของ Authentication ให้ตรงตามเงื่อนไข 69-s1-app |

ทั้งระบบทำงานภายใน **Docker Compose** พร้อม **Gitea** (Git Server) และ **Mailpit** (ดักอีเมล)
โดยแต่ละส่วนมีหน้าที่แยกกันอย่างชัดเจน พร้อมระบบสิทธิ์ Admin / User ที่บังคับใช้จริงในระดับโค้ด

> **Mirror** : Repository นี้ถูก Push ขึ้น GitHub และ Gitea พร้อมกันด้วยคำสั่งเดียว
>
> ```bash
> git push
> ```

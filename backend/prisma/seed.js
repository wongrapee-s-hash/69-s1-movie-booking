// =============================================================================
// prisma/seed.js
// ข้อมูลเริ่มต้นสำหรับทดสอบระบบ : Admin, User, หนัง, รอบฉาย, ที่นั่ง
// รันด้วย : npx prisma db seed
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * สร้างที่นั่งแบบอัตโนมัติสำหรับหนึ่งรอบฉาย
 * แถว A-C = NORMAL, แถว D = PREMIUM
 */
function buildSeats(showtimeId) {
  const rows = [
    { rowLabel: 'A', count: 8, seatType: 'NORMAL' },
    { rowLabel: 'B', count: 8, seatType: 'NORMAL' },
    { rowLabel: 'C', count: 8, seatType: 'NORMAL' },
    { rowLabel: 'D', count: 6, seatType: 'PREMIUM' },
  ];

  const seats = [];
  for (const row of rows) {
    for (let n = 1; n <= row.count; n += 1) {
      seats.push({
        showtimeId,
        seatCode: `${row.rowLabel}${n}`,
        rowLabel: row.rowLabel,
        seatNumber: n,
        seatType: row.seatType,
      });
    }
  }
  return seats;
}

async function main() {
  console.log('🌱 เริ่มต้นใส่ข้อมูลเริ่มต้น (Seed) ...');

  // ---------------------------------------------------------------------------
  // 1. ผู้ใช้ : ADMIN (ดูแลระบบหลังบ้าน)
  // ---------------------------------------------------------------------------
  const adminPassword = await bcrypt.hash('Admin@1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@movie.local' },
    update: {},
    create: {
      email: 'admin@movie.local',
      username: 'admin',
      password: adminPassword,
      fullName: 'ผู้ดูแลระบบ (Admin)',
      role: 'ADMIN',
    },
  });
  console.log('✅ สร้าง Admin : admin@movie.local / Admin@1234');

  // ---------------------------------------------------------------------------
  // 2. ผู้ใช้ : USER (ผู้ใช้ทั่วไป)
  // ---------------------------------------------------------------------------
  const userPassword = await bcrypt.hash('User@1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@movie.local' },
    update: {},
    create: {
      email: 'user@movie.local',
      username: 'user',
      password: userPassword,
      fullName: 'ผู้ใช้ทั่วไป (User)',
      role: 'USER',
    },
  });
  console.log('✅ สร้าง User : user@movie.local / User@1234');

  // ---------------------------------------------------------------------------
  // 3. ข้อมูลหนัง
  // ---------------------------------------------------------------------------
  const movies = [
    {
      title: 'ระบบจองตั๋วหนัง',
      description: 'เรื่องราวของสาวสายเทคโนโลยีที่ต้องการสร้างระบบจองตั๋วหนังด้วยตัวเอง',
      genre: 'ดราม่า',
      duration: 120,
      rating: 'PG-13',
    },
    {
      title: 'Deploy กลางคืน',
      description: 'นิยายตำนานการขึ้นระบบ Production ในคืนที่ไม่คาดคิด',
      genre: 'แอ็กชัน',
      duration: 135,
      rating: '4K',
    },
    {
      title: 'Docker ปริศนา',
      description: 'เมื่อ Container ทั้งหมดล้มพังพร้อมกัน ทีมงานต้องกู้ระบบให้ทันเวลา',
      genre: 'ผจญภัย',
      duration: 110,
      rating: 'PG',
    },
  ];

  const createdMovies = [];
  for (const m of movies) {
    const existing = await prisma.movie.findFirst({ where: { title: m.title } });
    if (existing) {
      createdMovies.push(existing);
    } else {
      const created = await prisma.movie.create({ data: m });
      createdMovies.push(created);
      console.log(`✅ สร้างหนัง : ${m.title}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. รอบฉาย + ที่นั่ง
  // ---------------------------------------------------------------------------
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const showtimes = [
    { movieIndex: 0, screen: 'Hall A', dayOffset: 0, hour: 14, price: 120 },
    { movieIndex: 0, screen: 'Hall A', dayOffset: 0, hour: 19, price: 150 },
    { movieIndex: 1, screen: 'Hall B', dayOffset: 0, hour: 16, price: 130 },
    { movieIndex: 2, screen: 'Hall C', dayOffset: 1, hour: 18, price: 100 },
  ];

  for (const s of showtimes) {
    const startTime = new Date(baseDate);
    startTime.setDate(startTime.getDate() + s.dayOffset);
    startTime.setHours(s.hour, 0, 0, 0);

    const showDate = new Date(startTime);
    showDate.setHours(0, 0, 0, 0);

    const exists = await prisma.showtime.findFirst({
      where: { movieId: createdMovies[s.movieIndex].id, startTime },
    });

    if (!exists) {
      const showtime = await prisma.showtime.create({
        data: {
          movieId: createdMovies[s.movieIndex].id,
          screen: s.screen,
          showDate,
          startTime,
          price: s.price,
        },
      });

      await prisma.seat.createMany({ data: buildSeats(showtime.id) });
      console.log(`✅ สร้างรอบฉาย : ${s.screen} @ ${startTime.toLocaleString('th-TH')}`);
    }
  }

  console.log('\n🎬 Seed เสร็จสิ้น');
  console.log(`   Admin ID : ${admin.id}`);
  console.log(`   User  ID : ${user.id}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed ผิดพลาด :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
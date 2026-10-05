// =============================================================================
// src/index.js
// จุดเริ่มต้นของ Backend ระบบจองตั๋วหนัง
// =============================================================================

require('dotenv').config();

const app = require('./app');
const prisma = require('./lib/prisma');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // ตรวจสอบการเชื่อมต่อฐานข้อมูลก่อนเริ่มรับ Request
    await prisma.$connect();
    console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL สำเร็จ');

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('============================================');
      console.log(' 🎬 Backend ระบบจองตั๋วหนัง');
      console.log('    Express.js + Prisma + PostgreSQL');
      console.log('============================================');
      console.log(` Port      : ${PORT}`);
      console.log(` Health    : http://localhost:${PORT}/health`);
      console.log(` Time      : ${new Date().toISOString()}`);
      console.log('============================================');
    });

    // ปิด Server อย่างปลอดภัย
    const shutdown = async (signal) => {
      console.log(`\n⚠️  รับสัญญาณ ${signal} กำลังปิด Server...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ เริ่ม Server ไม่สำเร็จ :', error);
    process.exit(1);
  }
}

start();
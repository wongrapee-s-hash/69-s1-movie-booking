// =============================================================================
// src/lib/prisma.js
// สร้าง Prisma Client ครั้งเดียวแล้วใช้ซ้ำทั้งระบบ (Singleton)
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

module.exports = prisma;
// =============================================================================
// src/app.js
// ตั้งค่า Express Application ของ API Gateway
// =============================================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const config = require('./config');
const { registerAuthRoutes } = require('./middleware/authMapping');
const { registerContentRoutes } = require('./proxy');

const app = express();

// ------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------------
// Health Check ของ Gateway
// ------------------------------------------------------------------
app.get('/health', async (req, res) => {
  let backendStatus = 'unknown';

  try {
    const response = await axios.get(`${config.BACKEND_INTERNAL_URL}/health`, {
      timeout: 5000,
    });
    backendStatus = response.data.success ? 'up' : 'degraded';
  } catch (error) {
    backendStatus = 'down';
  }

  return res.status(200).json({
    success: true,
    service: 'api-gateway',
    purpose: 'แมป API Path ให้ตรงตามเงื่อนไข 69-s1-app',
    backend: config.BACKEND_INTERNAL_URL,
    backendStatus,
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------
// ลงทะเบียน Route ทั้งหมด
//   1) AUTH API    — จัดการเอง (แปลง Request/Response ให้ตรง 69-s1-app)
//   2) CONTENT API — ส่งต่อแบบ Proxy (ยึดโครงสร้างระบบจองตั๋วหนัง)
// ------------------------------------------------------------------
registerAuthRoutes(app);
registerContentRoutes(app);

// ------------------------------------------------------------------
// แสดงรายการ Endpoint ทั้งหมดของ Gateway
// ------------------------------------------------------------------
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'api-gateway',
    message: 'ระบบจองตั๋วหนัง - API Gateway',
    authApi: {
      description: 'โครงสร้างตรงตามเงื่อนไข 69-s1-app',
      endpoints: [
        'POST   /api/auth/login            → เข้าสู่ระบบ',
        'GET    /api/auth/profile          → ดึงข้อมูลโปรไฟล์ (Bearer Token)',
        'POST   /api/auth/forgot-password  → ขอ Reset Token (ส่งอีเมลเข้า Mailpit)',
        'POST   /api/auth/reset-password   → ตั้งรหัสผ่านใหม่ด้วย Token',
        'POST   /api/auth/register         → สมัครสมาชิกใหม่',
      ],
    },
    contentApi: {
      description: 'ยึดโครงสร้างตามระบบจองตั๋วหนัง (ส่งต่อไป Backend)',
      endpoints: [
        'GET    /api/movies                → รายการหนัง',
        'GET    /api/movies/:id            → รายละเอียดหนัง',
        'POST   /api/movies                → เพิ่มหนัง (ADMIN)',
        'PUT    /api/movies/:id            → แก้ไขหนัง (ADMIN)',
        'DELETE /api/movies/:id            → ลบหนัง (ADMIN)',
        'GET    /api/showtimes             → รายการรอบฉาย',
        'GET    /api/showtimes/:id/seats   → แผนผังที่นั่ง',
        'POST   /api/showtimes             → สร้างรอบฉาย (ADMIN)',
        'DELETE /api/showtimes/:id         → ลบรอบฉาย (ADMIN)',
        'POST   /api/bookings              → จองตั๋ว (USER)',
        'GET    /api/bookings              → ประวัติการจองของฉัน (USER)',
        'GET    /api/bookings/:id          → รายละเอียดการจองของฉัน (USER)',
        'DELETE /api/bookings/:id          → ยกเลิกการจอง (USER)',
        'GET    /api/admin/dashboard       → แดชบอร์ดสรุประบบ (ADMIN)',
        'GET    /api/admin/users           → รายชื่อผู้ใช้ทั้งหมด (ADMIN)',
        'PUT    /api/admin/users/:id/role  → เปลี่ยนบทบาทผู้ใช้ (ADMIN)',
        'DELETE /api/admin/users/:id       → ลบผู้ใช้ (ADMIN)',
        'GET    /api/admin/bookings        → การจองทั้งระบบ (ADMIN)',
      ],
    },
  });
});

// ------------------------------------------------------------------
// 404
// ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'ไม่พบ Endpoint ที่เรียก',
    path: req.originalUrl,
    hint: 'ดูรายการ Endpoint ทั้งหมดได้ที่ GET /api',
  });
});

// ------------------------------------------------------------------
// Error Handler
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('❌ Gateway Error :', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'เกิดข้อผิดพลาดภายใน API Gateway',
  });
});

module.exports = app;
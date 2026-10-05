// =============================================================================
// src/app.js
// ตั้งค่า Express Application ของระบบจองตั๋วหนัง
// =============================================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');

const app = express();

// ------------------------------------------------------------------
// Middleware พื้นฐาน
// ------------------------------------------------------------------
app.use(cors()); // ให้ Frontend / API Gateway เรียกได้
app.use(morgan('dev')); // Log ทุก Request
app.use(express.json()); // Parse JSON body
app.use(express.urlencoded({ extended: true })); // Parse Form body

// ------------------------------------------------------------------
// Health Check
// ------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'movie-booking-backend',
    stack: 'Express.js + Prisma + PostgreSQL',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------
// จุดเชื่อมต่อ Route ทั้งหมด
// ------------------------------------------------------------------
app.use('/auth', routes.auth);
app.use('/movies', routes.movie);
app.use('/showtimes', routes.showtime);
app.use('/bookings', routes.booking);
app.use('/admin', routes.admin);

// ------------------------------------------------------------------
// 404 : ไม่พบ Endpoint
// ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'ไม่พบ Endpoint ที่เรียก',
    path: req.originalUrl,
  });
});

// ------------------------------------------------------------------
// Error Handler : จัดการข้อผิดพลาดรวม
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('❌ Error :', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'เกิดข้อผิดพลาดภายในระบบ',
  });
});

module.exports = app;
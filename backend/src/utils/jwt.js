// =============================================================================
// src/utils/jwt.js
// สร้างและตรวจสอบ JSON Web Token สำหรับระบบ Authentication
// =============================================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

/**
 * สร้าง JWT Token จากข้อมูลผู้ใช้
 * ฝัง role ลงไปด้วย เพื่อให้ Middleware ตรวจสิทธิ์ได้โดยไม่ต้อง query ฐานข้อมูล
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** ตรวจสอบและถอดข้อมูลจาก JWT Token */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** สร้าง Token แบบสุ่มสำหรับ Reset Password */
function generateResetToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { signToken, verifyToken, generateResetToken };
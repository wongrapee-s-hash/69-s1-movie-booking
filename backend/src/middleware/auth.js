// =============================================================================
// src/middleware/auth.js
// Middleware สำหรับตรวจสอบสิทธิ์การเข้าถึง API
// แบ่งเป็น 2 ระดับ : requireAuth (ต้อง Login) และ requireAdmin (ต้องเป็น Admin)
// =============================================================================

const { verifyToken } = require('../utils/jwt');

/**
 * ต้อง Login : ตรวจสอบ Bearer Token จาก Authorization Header
 * ฝังข้อมูลผู้ใช้ลงใน req.user
 */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'กรุณาเข้าสู่ระบบก่อน (ต้องส่ง Authorization: Bearer <token>)',
      });
    }

    const token = header.substring(7);
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token ไม่ถูกต้องหรือหมดอายุ',
    });
  }
}

/**
 * ต้องเป็น ADMIN : ใช้ควบคุมระบบหลังบ้าน
 * ตามเงื่อนไขอาจารย์ : Admin ห้ามทำ Operation ของ User ทั่วไป
 * ดังนั้น Admin จะไม่มีสิทธิ์เข้าถึง Endpoint ของ User (เช่น /bookings ของตัวเอง)
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อน',
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'เข้าถึงไม่ได้ : ต้องเป็นผู้ดูแลระบบ (Admin) เท่านั้น',
    });
  }

  return next();
}

/**
 * ต้องเป็น USER : ปฏิเสธ Admin ออกจาก Operation ของ User ทั่วไป
 * ใช้กับ Endpoint จองตั๋ว เพื่อให้เป็นไปตามเงื่อนไขที่แยกบทบาทชัดเจน
 */
function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อน',
    });
  }

  if (req.user.role !== 'USER') {
    return res.status(403).json({
      success: false,
      message: 'เข้าถึงไม่ได้ : Endpoint นี้สำหรับผู้ใช้งานทั่วไป (User) เท่านั้น',
    });
  }

  return next();
}

module.exports = { requireAuth, requireAdmin, requireUser };
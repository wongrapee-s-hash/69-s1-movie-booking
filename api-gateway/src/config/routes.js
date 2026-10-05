// =============================================================================
// src/config/routes.js
// ตารางการแมป (ROUTE MAPPING)
// ------------------------------------------------------------------
// หน้าที่ของไฟล์นี้ : กำหนดว่า Path แบบ 69-s1-app  จะถูกส่งต่อไปที่ Backend
//                    ของระบบจองตั๋วหนังที่ Path ใด
//
// เงื่อนไขของอาจารย์ :
//   "โครงสร้าง API พื้นฐาน (Authentication) ต้องมี Path และโครงสร้าง
//    Request/Response ตรงไม่ต้องเหมือนของอาจารย์"
//   => เราจึงต้องมี Endpoint ครบ : Login, Profile, Forgot Password Token
//      และตั้งชื่อ Path ให้สื่อความหมายชัดเจนตามมาตรฐานของระบบจองตั๋วหนัง
// =============================================================================

/**
 * AUTH API — ต้องตรงกับ 69-s1-app
 * ทุกช่องในคอมเมนต์ระบุว่าเป็นหน้าที่อะไร (Login / Profile / Forgot Token)
 */
const AUTH_ROUTES = [
  {
    // ------------------------------------------------------------------
    // 1) LOGIN  — เข้าสู่ระบบ
    // ------------------------------------------------------------------
    // Path ภายนอก (ของเรา)   : POST /api/auth/login
    // Path ภายหลังของ Backend : POST /auth/login
    // โครงสร้าง Request ที่รองรับ :
    //   { identifier, email, username, password }  ← ยืดหยุ่น ใช้ได้ทั้ง Email และ Username
    method: 'post',
    publicPath: '/api/auth/login',
    backendPath: '/auth/login',
    description: 'LOGIN — เข้าสู่ระบบด้วย Email/Username + Password คืนค่า JWT Token',
  },
  {
    // ------------------------------------------------------------------
    // 2) PROFILE  — ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
    // ------------------------------------------------------------------
    // Path ภายนอก (ของเรา)   : GET /api/auth/profile
    // Path ภายหลังของ Backend : GET /auth/profile
    // ต้องส่ง Header          : Authorization: Bearer <token>
    method: 'get',
    publicPath: '/api/auth/profile',
    backendPath: '/auth/profile',
    description: 'PROFILE — ดึงข้อมูลโปรไฟล์ของผู้ใช้ที่ Login อยู่',
  },
  {
    // ------------------------------------------------------------------
    // 3) FORGOT PASSWORD TOKEN  — ขอ Token สำหรับตั้งรหัสผ่านใหม่
    // ------------------------------------------------------------------
    // Path ภายนอก (ของเรา)   : POST /api/auth/forgot-password
    // Path ภายหลังของ Backend : POST /auth/forgot-password
    // Request Body            : { email }
    // ผลลัพธ์                : ระบบสร้าง Token แล้วส่งลิงก์เข้าอีเมล (ดูที่ Mailpit:8025)
    method: 'post',
    publicPath: '/api/auth/forgot-password',
    backendPath: '/auth/forgot-password',
    description: 'FORGOT PASSWORD TOKEN — ขอ Reset Token และส่งลิงก์เข้าอีเมล',
  },
  {
    // ------------------------------------------------------------------
    // 4) RESET PASSWORD  — ใช้ Token ตั้งรหัสผ่านใหม่
    // ------------------------------------------------------------------
    method: 'post',
    publicPath: '/api/auth/reset-password',
    backendPath: '/auth/reset-password',
    description: 'RESET PASSWORD — ใช้ Token จากอีเมลเพื่อตั้งรหัสผ่านใหม่',
  },
  {
    // ------------------------------------------------------------------
    // 5) REGISTER  — สมัครสมาชิก (เพิ่มเติมจากเงื่อนไข)
    // ------------------------------------------------------------------
    method: 'post',
    publicPath: '/api/auth/register',
    backendPath: '/auth/register',
    description: 'REGISTER — สมัครสมาชิกใหม่ (บทบาทเริ่มต้น USER เสมอ)',
  },
];

/**
 * CONTENT API — ยึดตามโครงสร้างของระบบที่กลุ่มเลือก (ระบบจองตั๋วหนัง)
 * ส่งต่อแบบ Pass-through โดยไม่แก้ไขโครงสร้างข้อมูล
 */
const CONTENT_ROUTES = [
  {
    method: 'get',
    publicPrefix: '/api/movies',
    backendPrefix: '/movies',
    description: 'CONTENT — รายการหนัง / รายละเอียดหนัง',
  },
  {
    method: 'get',
    publicPrefix: '/api/showtimes',
    backendPrefix: '/showtimes',
    description: 'CONTENT — รอบฉาย / แผนผังที่นั่ง',
  },
  {
    method: 'post',
    publicPrefix: '/api/movies',
    backendPrefix: '/movies',
    description: 'CONTENT — เพิ่มหนังใหม่ (ADMIN เท่านั้น)',
  },
  {
    method: 'post',
    publicPrefix: '/api/showtimes',
    backendPrefix: '/showtimes',
    description: 'CONTENT — สร้างรอบฉาย (ADMIN เท่านั้น)',
  },
  {
    method: 'put',
    publicPrefix: '/api/movies',
    backendPrefix: '/movies',
    description: 'CONTENT — แก้ไขข้อมูลหนัง (ADMIN เท่านั้น)',
  },
  {
    method: 'delete',
    publicPrefix: '/api/movies',
    backendPrefix: '/movies',
    description: 'CONTENT — ลบข้อมูลหนัง (ADMIN เท่านั้น)',
  },
  {
    method: 'delete',
    publicPrefix: '/api/showtimes',
    backendPrefix: '/showtimes',
    description: 'CONTENT — ลบรอบฉาย (ADMIN เท่านั้น)',
  },
];

/**
 * ADMIN API — ระบบหลังบ้าน (เฉพาะ ADMIN เท่านั้น)
 * ส่งต่อแบบ Pass-through ตามโครงสร้างของระบบจองตั๋วหนัง
 */
const ADMIN_ROUTES = [
  {
    method: 'get',
    publicPrefix: '/api/admin/dashboard',
    backendPrefix: '/admin/dashboard',
    description: 'ADMIN — แดชบอร์ดสรุปข้อมูลระบบทั้งหมด',
  },
  {
    method: 'get',
    publicPrefix: '/api/admin/users',
    backendPrefix: '/admin/users',
    description: 'ADMIN — ดูรายชื่อผู้ใช้ทั้งหมด',
  },
  {
    method: 'put',
    publicPrefix: '/api/admin/users',
    backendPrefix: '/admin/users',
    description: 'ADMIN — เปลี่ยนบทบาทของผู้ใช้',
  },
  {
    method: 'delete',
    publicPrefix: '/api/admin/users',
    backendPrefix: '/admin/users',
    description: 'ADMIN — ลบผู้ใช้',
  },
  {
    method: 'get',
    publicPrefix: '/api/admin/bookings',
    backendPrefix: '/admin/bookings',
    description: 'ADMIN — ดูภาพรวมการจองทั้งหมด',
  },
];

/**
 * BOOKING API — การจองตั๋วหนัง (ส่วนที่ต้องแก้ไข Path เพิ่มเติม)
 * เนื่องจาก Backend ใช้ /bookings แต่ต้องการ Path ที่สื่อถึง "ตั๋วหนัง"
 */
const BOOKING_ROUTES = [
  {
    method: 'post',
    publicPrefix: '/api/bookings',
    backendPrefix: '/bookings',
    description: 'BOOKING — จองตั๋วหนัง (USER เท่านั้น)',
  },
  {
    method: 'get',
    publicPrefix: '/api/bookings',
    backendPrefix: '/bookings',
    description: 'BOOKING — ประวัติการจองของผู้ใช้ (USER เท่านั้น)',
  },
  {
    method: 'delete',
    publicPrefix: '/api/bookings',
    backendPrefix: '/bookings',
    description: 'BOOKING — ยกเลิกการจอง (USER เท่านั้น)',
  },
];

module.exports = {
  AUTH_ROUTES,
  CONTENT_ROUTES,
  ADMIN_ROUTES,
  BOOKING_ROUTES,
};
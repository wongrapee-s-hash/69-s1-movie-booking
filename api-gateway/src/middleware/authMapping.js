// =============================================================================
// src/middleware/authMapping.js
// ------------------------------------------------------------------
// ไฟล์นี้คือหัวใจของการทำให้ "โครงสร้าง API ตรงตาม 69-s1-app"
// ------------------------------------------------------------------
// หน้าที่ :
//   1) LOGIN            — รับ Request แล้วแปลงชื่อฟิลด์ให้เข้ากับ Backend
//   2) PROFILE          — ส่งต่อ Bearer Token ไปให้ Backend ตรวจสอบ
//   3) FORGOT TOKEN     — รับ Email แล้วส่งต่อให้ Backend สร้าง Token + ส่งอีเมล
//   4) RESET PASSWORD   — ใช้ Token ตั้งรหัสผ่านใหม่
//
// ทุกฟังก์ชันจะรับค่าจาก config/routes.js มาประกอบ Route อัตโนมัติ
// =============================================================================

const axios = require('axios');
const { AUTH_ROUTES } = require('../config/routes');
const config = require('../config');

/** สร้าง Axios Instance สำหรับยิงไป Backend */
const backend = axios.create({
  baseURL: config.BACKEND_INTERNAL_URL,
  timeout: config.TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

/** ส่งต่อ Header ที่จำเป็น (เช่น Authorization) ไปยัง Backend */
function forwardHeaders(req) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  return headers;
}

/**
 * =============================================================================
 * 1) LOGIN — แมป Request/Response ให้ตรงตามมาตรฐานของ 69-s1-app
 * =============================================================================
 * Path ของเรา : POST /api/auth/login
 * ไปยัง Backend : POST /auth/login
 *
 * Request ที่รับได้ (ยืดหยุ่น) :
 *   { identifier, email, username, password }
 *
 * Response ที่คืนกลับ (มาตรฐานเดียว) :
 *   { success, message, data: { token, tokenType, user: {...} } }
 */
async function handleLogin(req, res) {
  try {
    const { identifier, email, username, password } = req.body || {};

    const loginIdentifier = identifier || email || username;

    // ---- Validation ฝั่ง Gateway ----
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Email/Username และ Password',
      });
    }

    // ---- แปลงชื่อฟิลด์ให้ตรงกับที่ Backend คาดหวัง ----
    const backendBody = { identifier: loginIdentifier, password };

    // ---- ส่งต่อไป Backend ----
    const response = await backend.post('/auth/login', backendBody, {
      headers: forwardHeaders(req),
    });

    const result = response.data;
    if (!result.success) {
      return res.status(response.status).json(result);
    }

    // ---- แปลง Response ให้เป็นรูปแบบมาตรฐานของระบบจองตั๋วหนัง ----
    return res.status(200).json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        token: result.data.token,
        tokenType: result.data.tokenType || 'Bearer',
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          username: result.data.user.username,
          fullName: result.data.user.fullName,
          role: result.data.user.role,
        },
      },
    });
  } catch (error) {
    // ---- ส่งต่อ Error จาก Backend ให้ Client ตามเดิม ----
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('❌ Gateway Login Error :', error.message);
    return res.status(503).json({
      success: false,
      message: 'ไม่สามารถเชื่อมต่อกับ Backend ระบบจองตั๋วหนังได้',
    });
  }
}

/**
 * =============================================================================
 * 2) PROFILE — ดึงข้อมูลโปรไฟล์
 * =============================================================================
 * Path ของเรา : GET /api/auth/profile
 * ไปยัง Backend : GET /auth/profile
 *
 * ข้อกำหนด : ต้องส่ง Header  Authorization: Bearer <token>
 *             Gateway จะตรวจสอบรูปแบบเบื้องต้นก่อนส่งต่อ
 */
async function handleProfile(req, res) {
  try {
    const authHeader = req.headers.authorization;

    // ---- ตรวจสอบรูปแบบ Token เบื้องต้นที่ฝั่ง Gateway ----
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบ Authorization Header กรุณา Login ก่อนใช้งาน',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'รูปแบบ Token ไม่ถูกต้อง ต้องเป็น "Bearer <token>"',
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token ว่างเปล่า กรุณา Login ใหม่',
      });
    }

    // ---- ส่งต่อไป Backend เพื่อตรวจสอบ Token และดึงข้อมูล ----
    const response = await backend.get('/auth/profile', {
      headers: forwardHeaders(req),
    });

    const result = response.data;

    return res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลโปรไฟล์สำเร็จ',
      data: {
        id: result.data.id,
        email: result.data.email,
        username: result.data.username,
        fullName: result.data.fullName,
        role: result.data.role,
        totalBookings: result.data.totalBookings,
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      },
    });
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('❌ Gateway Profile Error :', error.message);
    return res.status(503).json({
      success: false,
      message: 'ไม่สามารถเชื่อมต่อกับ Backend ระบบจองตั๋วหนังได้',
    });
  }
}

/**
 * =============================================================================
 * 3) FORGOT PASSWORD TOKEN — ขอ Token สำหรับตั้งรหัสผ่านใหม่
 * =============================================================================
 * Path ของเรา : POST /api/auth/forgot-password
 * ไปยัง Backend : POST /auth/forgot-password
 *
 * Request  : { email }
 * การทำงาน :
 *   1) Backend สร้าง Reset Token แบบสุ่ม
 *   2) Backend บันทึกลงตาราง password_reset_tokens
 *   3) Backend ส่งอีเมล (ลิงก์มี Token อยู่) เข้า Mailpit
 *   4) ผู้ใช้เปิด http://localhost:8025 เพื่อดู Token แล้วกดลิงก์
 *
 * หมายเหตุด้านความปลอดภัย :
 *   จะไม่เปิดเผยว่า "Email นี้มีอยู่จริงหรือไม่" ป้องกันการเดา Email
 */
async function handleForgotPassword(req, res) {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Email เพื่อทำการตั้งรหัสผ่านใหม่',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'รูปแบบ Email ไม่ถูกต้อง',
      });
    }

    const response = await backend.post('/auth/forgot-password', { email }, {
      headers: forwardHeaders(req),
    });

    const result = response.data;

    return res.status(200).json({
      success: true,
      message:
        result.message ||
        'หากอีเมลนี้มีอยู่ในระบบ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว',
      data: result.data
        ? {
            ...result.data,
            mailpitUrl: 'http://localhost:8025',
            hint: 'เปิดดูอีเมลและ Token ได้ที่ Mailpit พอร์ต 8025',
          }
        : undefined,
    });
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('❌ Gateway Forgot Password Error :', error.message);
    return res.status(503).json({
      success: false,
      message: 'ไม่สามารถเชื่อมต่อกับ Backend ระบบจองตั๋วหนังได้',
    });
  }
}

/**
 * =============================================================================
 * 4) RESET PASSWORD — ใช้ Token ตั้งรหัสผ่านใหม่
 * =============================================================================
 * Path ของเรา : POST /api/auth/reset-password
 * ไปยัง Backend : POST /auth/reset-password
 *
 * Request : { token, newPassword }
 */
async function handleResetPassword(req, res) {
  try {
    const { token, newPassword, password } = req.body || {};
    const newPass = newPassword || password;

    if (!token || !newPass) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่ง Token และรหัสผ่านใหม่',
      });
    }

    const response = await backend.post(
      '/auth/reset-password',
      { token, newPassword: newPass },
      { headers: forwardHeaders(req) }
    );

    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('❌ Gateway Reset Password Error :', error.message);
    return res.status(503).json({
      success: false,
      message: 'ไม่สามารถเชื่อมต่อกับ Backend ระบบจองตั๋วหนังได้',
    });
  }
}

/**
 * =============================================================================
 * 5) REGISTER — สมัครสมาชิก
 * =============================================================================
 * Path ของเรา : POST /api/auth/register
 * ไปยัง Backend : POST /auth/register
 *
 * Request : { email, username, password, fullName }
 */
async function handleRegister(req, res) {
  try {
    const { email, username, password, fullName } = req.body || {};

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก Email, Username และ Password ให้ครบ',
      });
    }

    const response = await backend.post(
      '/auth/register',
      { email, username, password, fullName },
      { headers: forwardHeaders(req) }
    );

    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('❌ Gateway Register Error :', error.message);
    return res.status(503).json({
      success: false,
      message: 'ไม่สามารถเชื่อมต่อกับ Backend ระบบจองตั๋วหนังได้',
    });
  }
}

/**
 * ตารางเชื่อมชื่อ Path ของเรา (publicPath) → ฟังก์ชันที่จะจัดการ
 * ข้อมูล Path ทั้งหมดมาจาก config/routes.js (ตารางการแมป)
 */
const HANDLERS = {
  '/api/auth/login': handleLogin,
  '/api/auth/profile': handleProfile,
  '/api/auth/forgot-password': handleForgotPassword,
  '/api/auth/reset-password': handleResetPassword,
  '/api/auth/register': handleRegister,
};

/**
 * ลงทะเบียน Auth Route ทั้งหมดลงใน Express
 * @param {import('express').Express} app
 */
function registerAuthRoutes(app) {
  console.log('\n📋 ตารางการแมป AUTH API (ตามเงื่อนไข 69-s1-app) :');
  console.log('   ┌────────────────────────────────┬────────────┬──────────────────────────────┐');

  for (const route of AUTH_ROUTES) {
    const handler = HANDLERS[route.publicPath];
    if (!handler) continue;

    app[route.method](route.publicPath, handler);

    console.log(
      `   │ ${route.method.toUpperCase().padEnd(6)} ${route.publicPath.padEnd(28)} → ${route.backendPath.padEnd(26)} │`
    );
  }

  console.log('   └────────────────────────────────┴────────────┴──────────────────────────────┘');
}

module.exports = { registerAuthRoutes };
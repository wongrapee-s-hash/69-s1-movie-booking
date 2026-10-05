// =============================================================================
// src/routes/auth.routes.js
// ROUTE ส่วน AUTHENTICATION ของระบบจองตั๋วหนัง
// ประกอบด้วย : Register, Login, Profile, Forgot Password Token, Reset Password
// หมายเหตุ : API Gateway จะทำหน้าที่แมป Path เหล่านี้ให้ตรงกับ 69-s1-app
// =============================================================================

const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../lib/prisma');
const { signToken, generateResetToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { sendResetPasswordEmail } = require('../lib/mailer');

const router = express.Router();

/**
 * POST /auth/register
 * สมัครสมาชิกใหม่ (บทบาทเริ่มต้นเป็น USER เสมอ ป้องกันการสมัครเป็น Admin เอง)
 */
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, fullName } = req.body;

    // ---- Validation ----
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก Email, Username และ Password ให้ครบ',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'รูปแบบ Email ไม่ถูกต้อง' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password ต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    // ---- ตรวจสอบข้อมูลซ้ำ ----
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return res.status(409).json({
        success: false,
        message: `${field} นี้ถูกใช้งานแล้ว`,
      });
    }

    // ---- สร้างผู้ใช้ใหม่ ----
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        fullName: fullName || username,
        role: 'USER', // กำหนด USER เสมอ
      },
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('❌ Register Error :', error);
    return res.status(500).json({ success: false, message: 'สมัครสมาชิกไม่สำเร็จ' });
  }
});

/**
 * POST /auth/login
 * เข้าสู่ระบบ : ตรวจสอบ Email + Password แล้วคืน JWT Token
 * รองรับทั้งการ Login ด้วย Email หรือ Username
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body;
    const loginId = identifier || email || username;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก Email/Username และ Password',
      });
    }

    // ค้นหาผู้ใช้จาก Email หรือ Username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginId }, { username: loginId }],
      },
    });

    // ไม่เปิดเผยว่าไม่พบผู้ใช้หรือ Password ผิด (ความปลอดภัย)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email/Username หรือ Password ไม่ถูกต้อง',
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Email/Username หรือ Password ไม่ถูกต้อง',
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        token,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('❌ Login Error :', error);
    return res.status(500).json({ success: false, message: 'เข้าสู่ระบบไม่สำเร็จ' });
  }
});

/**
 * GET /auth/profile
 * ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน (ต้อง Login)
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { bookings: true } }, // จำนวนการจองทั้งหมด
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานนี้' });
    }

    return res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลโปรไฟล์สำเร็จ',
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        totalBookings: user._count.bookings,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('❌ Profile Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงข้อมูลโปรไฟล์ไม่สำเร็จ' });
  }
});

/**
 * POST /auth/forgot-password
 * ขอ Reset Password Token : สร้าง Token แล้วส่งลิงก์ไปทางอีเมล (Mailpit)
 * ไม่เปิดเผยว่า Email มีอยู่จริงหรือไม่ (ป้องกันการเดา Email)
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Email เพื่อทำการตั้งรหัสผ่านใหม่',
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    const genericMessage =
      'หากอีเมลนี้มีอยู่ในระบบ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว';

    // ถ้าไม่พบผู้ใช้ ก็ตอบกลับเหมือนกันเพื่อไม่ให้เป็นช่องโหว่
    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    // ---- สร้าง Reset Token ----
    const token = generateResetToken();
    const ttl = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    // ลบ Token เก่าที่ยังไม่หมดอายุของผู้ใช้คนนี้ออกก่อน
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    // ---- สร้างลิงก์ตั้งรหัสผ่านใหม่ ----
    const publicUrl = process.env.GATEWAY_PUBLIC_URL || 'http://localhost:8080';
    const resetLink = `${publicUrl}/reset-password?token=${token}`;

    // ---- ส่งอีเมล ----
    try {
      await sendResetPasswordEmail(user.email, user.username, resetLink);
    } catch (mailError) {
      console.error('⚠️ ส่งอีเมลไม่สำเร๐จ :', mailError.message);
      return res.status(500).json({
        success: false,
        message: 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Mailpit',
      });
    }

    return res.status(200).json({
      success: true,
      message: genericMessage,
      // คืน Token ด้วยในโหมด Development เพื่อให้ทดสอบได้สะดวก
      // (ในระบบ Production ต้องลบบรรทัดนี้ออกเพื่อความปลอดภัย)
      data: process.env.NODE_ENV === 'production' ? undefined : {
        token,
        resetLink,
        expiresAt,
        hint: 'เปิดดูอีเมลได้ที่ http://localhost:8025 (Mailpit)',
      },
    });
  } catch (error) {
    console.error('❌ Forgot Password Error :', error);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดระหว่างส่งอีเมล' });
  }
});

/**
 * POST /auth/reset-password
 * ใช้ Reset Token เพื่อตั้งรหัสผ่านใหม่
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่ง Token และรหัสผ่านใหม่',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // ---- ตรวจสอบความถูกต้องของ Token ----
    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }

    if (resetToken.usedAt) {
      return res.status(400).json({
        success: false,
        message: 'Token ถูกใช้ไปแล้ว กรุณาขอ Token ใหม่',
      });
    }

    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Token หมดอายุแล้ว กรุณาขอ Token ใหม่',
      });
    }

    // ---- ตั้งรหัสผ่านใหม่ ----
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่',
    });
  } catch (error) {
    console.error('❌ Reset Password Error :', error);
    return res.status(500).json({ success: false, message: 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ' });
  }
});

module.exports = router;
// =============================================================================
// src/routes/admin.routes.js
// ROUTE สำหรับ ADMIN เท่านั้น — ระบบหลังบ้าน
// ------------------------------------------------------------------
// ตามเงื่อนไขอาจารย์ : Admin ดูแลระบบหลังบ้าน ห้ามทำ Operation ของ User ทั่วไป
// ไฟล์นี้จึงรวบรวมเฉพาะงานบริหารจัดการระบบ ไม่มีการจองตั๋ว / ไม่มีการดูประวัติการจองของ User
// =============================================================================

const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ทุก Route ในไฟล์นี้ต้อง Login และต้องเป็น ADMIN
router.use(requireAuth, requireAdmin);

/**
 * GET /admin/dashboard
 * แดชบอร์ดสรุปข้อมูลระบบทั้งหมด
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalMovies,
      totalShowtimes,
      totalSeats,
      totalBookings,
      confirmedBookings,
      revenue,
      recentBookings,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.movie.count(),
      prisma.showtime.count(),
      prisma.seat.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { totalPrice: true },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { username: true, email: true } },
          showtime: { include: { movie: { select: { title: true } } } },
          seats: { include: { seat: { select: { seatCode: true } } } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลแดชบอร์ดสำเร็จ',
      data: {
        summary: {
          totalUsers,
          totalMovies,
          totalShowtimes,
          totalSeats,
          totalBookings,
          confirmedBookings,
          totalRevenue: Math.round((revenue._sum.totalPrice || 0) * 100) / 100,
        },
        recentBookings: recentBookings.map((b) => ({
          id: b.id,
          bookingCode: b.bookingCode,
          user: b.user.username,
          email: b.user.email,
          movie: b.showtime.movie.title,
          seats: b.seats.map((s) => s.seat.seatCode),
          totalPrice: b.totalPrice,
          status: b.status,
          createdAt: b.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('❌ Dashboard Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงข้อมูลแดชบอร์ดไม่สำเร็จ' });
  }
});

/**
 * GET /admin/users
 * ดูรายชื่อผู้ใช้ทั้งหมดพร้อมสถานะ
 */
router.get('/users', async (req, res) => {
  try {
    const { role, search } = req.query;

    const where = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: 'ดึงรายชื่อผู้ใช้สำเร็จ',
      meta: { total: users.length },
      data: users,
    });
  } catch (error) {
    console.error('❌ Get Users Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงรายชื่อผู้ใช้ไม่สำเร็จ' });
  }
});

/**
 * PUT /admin/users/:id/role
 * เปลี่ยนบทบาทของผู้ใช้ (USER <-> ADMIN)
 */
router.put('/users/:id/role', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'role ต้องเป็น USER หรือ ADMIN',
      });
    }

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, email: true, role: true },
    });

    return res.status(200).json({
      success: true,
      message: `เปลี่ยนบทบาทของ ${user.username} เป็น ${role} สำเร็จ`,
      data: user,
    });
  } catch (error) {
    console.error('❌ Update Role Error :', error);
    return res.status(500).json({ success: false, message: 'เปลี่ยนบทบาทไม่สำเร็จ' });
  }
});

/**
 * DELETE /admin/users/:id
 * ลบผู้ใช้ (Admin เท่านั้น)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบบัญชีของตัวเองได้',
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้ที่ต้องการลบ' });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: `ลบผู้ใช้ ${user.username} สำเร็จ`,
    });
  } catch (error) {
    console.error('❌ Delete User Error :', error);
    return res.status(500).json({ success: false, message: 'ลบผู้ใช้ไม่สำเร็จ' });
  }
});

/**
 * GET /admin/bookings
 * ดูการจองทั้งหมดของระบบ (Admin มีหน้าที่ตรวจสอบภาพรวม)
 * ต่างจาก /bookings ของ USER ที่ดูเฉพาะของตัวเอง
 */
router.get('/bookings', async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, email: true } },
        showtime: { include: { movie: { select: { title: true } } } },
        seats: { include: { seat: { select: { seatCode: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลการจองทั้งหมดสำเร็จ',
      meta: { total: bookings.length },
      data: bookings.map((b) => ({
        id: b.id,
        bookingCode: b.bookingCode,
        user: b.user,
        movie: b.showtime.movie.title,
        screen: b.showtime.screen,
        startTime: b.showtime.startTime,
        seats: b.seats.map((s) => s.seat.seatCode),
        totalPrice: b.totalPrice,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Admin Get Bookings Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงข้อมูลการจองไม่สำเร็จ' });
  }
});

module.exports = router;
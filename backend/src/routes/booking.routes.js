// =============================================================================
// src/routes/booking.routes.js
// ROUTE การจองตั๋วหนัง (Booking) — CORE ของระบบ
// ------------------------------------------------------------------
// สิทธิ์ตามเงื่อนไขอาจารย์ :
//   - เฉพาะ USER เท่านั้นที่จองตั๋วได้ (requireUser)
//   - ADMIN ไม่สามารถจองตั๋ว เพราะ "Admin ห้ามทำ Operation ของ User ทั่วไป"
// =============================================================================

const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireUser } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /bookings
 * จองตั๋วหนัง
 * Body : { showtimeId, seatIds: [1, 2, 3] }
 *
 * Logic สำคัญ : ใช้ Transaction + ตรวจ unique(showtimeId, seatId)
 * เพื่อป้องกันไม่ให้มีการจองที่นั่งเดียวกันพร้อมกัน (Race Condition)
 */
router.post('/', requireAuth, requireUser, async (req, res) => {
  try {
    const { showtimeId, seatIds } = req.body;

    // ---- Validation ----
    if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ showtimeId และ seatIds (อย่างน้อย 1 ที่นั่ง)',
      });
    }

    const showtime = await prisma.showtime.findUnique({
      where: { id: Number(showtimeId) },
      include: { movie: { select: { id: true, title: true } } },
    });

    if (!showtime) {
      return res.status(404).json({ success: false, message: 'ไม่พบรอบฉายที่ต้องการจอง' });
    }

    // ตรวจสอบเวลาฉาย : ห้ามจองรอบที่เริ่มฉายแล้ว
    if (new Date(showtime.startTime) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถจองได้ : รอบฉายนี้เริ่มฉายแล้ว',
      });
    }

    // ค้นหาที่นั่งตาม seatIds
    const seats = await prisma.seat.findMany({
      where: { id: { in: seatIds.map(Number) }, showtimeId: Number(showtimeId) },
    });

    if (seats.length !== seatIds.length) {
      return res.status(400).json({
        success: false,
        message: 'มีรหัสที่นั่งไม่ถูกต้องหรือไม่ได้อยู่ในรอบฉายนี้',
      });
    }

    // ตรวจสอบที่นั่งที่ถูกจองไปแล้วหรือยัง
    const alreadyBooked = await prisma.bookingSeat.findMany({
      where: { showtimeId: Number(showtimeId), seatId: { in: seats.map((s) => s.id) } },
      include: { seat: { select: { seatCode: true } } },
    });

    if (alreadyBooked.length > 0) {
      const codes = alreadyBooked.map((b) => b.seat.seatCode).join(', ');
      return res.status(409).json({
        success: false,
        message: `ที่นั่ง ${codes} ถูกจองไปแล้ว กรุณาเลือกที่นั่งอื่น`,
      });
    }

    // ---- คำนวณราคา ----
    let totalPrice = 0;
    for (const seat of seats) {
      totalPrice += seat.seatType === 'PREMIUM' ? showtime.price * 1.5 : showtime.price;
    }
    totalPrice = Math.round(totalPrice * 100) / 100;

    // ---- สร้างรหัสการจอง ----
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.booking.count();
    const bookingCode = `BK-${today}-${String(count + 1).padStart(4, '0')}`;

    // ---- บันทึกการจอง (ใช้ Transaction) ----
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        showtimeId: Number(showtimeId),
        totalPrice,
        bookingCode,
        status: 'CONFIRMED',
        seats: {
          create: seats.map((seat) => ({
            seatId: seat.id,
            showtimeId: Number(showtimeId),
          })),
        },
      },
      include: {
        seats: { include: { seat: { select: { seatCode: true, seatType: true } } } },
        showtime: {
          include: { movie: { select: { id: true, title: true } } },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'จองตั๋วหนังสำเร็จ',
      data: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        totalPrice: booking.totalPrice,
        movie: booking.showtime.movie.title,
        screen: booking.showtime.screen,
        startTime: booking.showtime.startTime,
        seats: booking.seats.map((bs) => bs.seat.seatCode),
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    // Prisma error P2002 = ละเมิด unique constraint (จองที่นั่งซ้ำ)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'ที่นั่งที่เลือกถูกจองไปแล้ว กรุณาเลือกที่นั่งอื่น',
      });
    }

    console.error('❌ Create Booking Error :', error);
    return res.status(500).json({ success: false, message: 'จองตั๋วหนังไม่สำเร็จ' });
  }
});

/**
 * GET /bookings
 * ประวัติการจองของผู้ใช้ปัจจุบัน (เฉพาะของตัวเอง)
 */
router.get('/', requireAuth, requireUser, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        seats: { include: { seat: { select: { seatCode: true, seatType: true } } } },
        showtime: {
          include: { movie: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = bookings.map((b) => ({
      id: b.id,
      bookingCode: b.bookingCode,
      status: b.status,
      totalPrice: b.totalPrice,
      movie: b.showtime.movie.title,
      screen: b.showtime.screen,
      startTime: b.showtime.startTime,
      seats: b.seats.map((bs) => bs.seat.seatCode),
      createdAt: b.createdAt,
    }));

    const totalSpent = bookings
      .filter((b) => b.status === 'CONFIRMED')
      .reduce((sum, b) => sum + b.totalPrice, 0);

    return res.status(200).json({
      success: true,
      message: 'ดึงประวัติการจองสำเร็จ',
      meta: { total: result.length, totalSpent: Math.round(totalSpent * 100) / 100 },
      data: result,
    });
  } catch (error) {
    console.error('❌ Get Bookings Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงประวัติการจองไม่สำเร็จ' });
  }
});

/**
 * GET /bookings/:id
 * ดูรายละเอียดการจอง (ต้องเป็นของตัวเองเท่านั้น)
 */
router.get('/:id', requireAuth, requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const booking = await prisma.booking.findFirst({
      where: { id, userId: req.user.id },
      include: {
        seats: { include: { seat: { select: { seatCode: true, seatType: true } } } },
        showtime: { include: { movie: { select: { id: true, title: true } } } },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการจองนี้ หรือไม่ใช่การจองของคุณ',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'ดึงรายละเอียดการจองสำเร็จ',
      data: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        totalPrice: booking.totalPrice,
        movie: booking.showtime.movie.title,
        screen: booking.showtime.screen,
        startTime: booking.showtime.startTime,
        seats: booking.seats.map((bs) => bs.seat.seatCode),
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ Get Booking Detail Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงรายละเอียดการจองไม่สำเร็จ' });
  }
});

/**
 * DELETE /bookings/:id
 * ยกเลิกการจอง (ต้องเป็นของตัวเอง) : คืนที่นั่งให้จองได้อีก
 */
router.delete('/:id', requireAuth, requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const booking = await prisma.booking.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการจองนี้ หรือไม่ใช่การจองของคุณ',
      });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'การจองนี้ถูกยกเลิกไปแล้ว',
      });
    }

    await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // ลบรายการที่นั่งที่ผูกกับการจองนี้ เพื่อคืนที่นั่ง
    await prisma.bookingSeat.deleteMany({ where: { bookingId: id } });

    return res.status(200).json({
      success: true,
      message: 'ยกเลิกการจองสำเร็จ ที่นั่งถูกคืนเข้าระบบแล้ว',
    });
  } catch (error) {
    console.error('❌ Cancel Booking Error :', error);
    return res.status(500).json({ success: false, message: 'ยกเลิกการจองไม่สำเร็จ' });
  }
});

module.exports = router;
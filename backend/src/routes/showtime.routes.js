// =============================================================================
// src/routes/showtime.routes.js
// ROUTE รอบฉาย (Showtime) และที่นั่ง (Seat)
// ทุกคนอ่านได้ ส่วนการสร้างรอบฉายทำได้เฉพาะ ADMIN
// =============================================================================

const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /showtimes
 * ดูรายการรอบฉายทั้งหมด รองรับ ?movieId= และ ?date=
 */
router.get('/', async (req, res) => {
  try {
    const { movieId, date } = req.query;

    const where = {};
    if (movieId) {
      where.movieId = Number(movieId);
    }
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.showDate = { gte: startOfDay, lte: endOfDay };
    }

    const showtimes = await prisma.showtime.findMany({
      where,
      include: {
        movie: { select: { id: true, title: true, duration: true, rating: true } },
        _count: { select: { seats: true } },
        bookings: { where: { status: 'CONFIRMED' }, select: { seats: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const result = showtimes.map((s) => {
      const bookedSeats = s.bookings.reduce((sum, b) => sum + b.seats.length, 0);
      return {
        id: s.id,
        movie: s.movie,
        screen: s.screen,
        showDate: s.showDate,
        startTime: s.startTime,
        price: s.price,
        totalSeats: s._count.seats,
        availableSeats: s._count.seats - bookedSeats,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'ดึงรายการรอบฉายสำเร็จ',
      meta: { total: result.length },
      data: result,
    });
  } catch (error) {
    console.error('❌ Get Showtimes Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงรายการรอบฉายไม่สำเร็จ' });
  }
});

/**
 * GET /showtimes/:id/seats
 * ดูแผนผังที่นั่งของรอบฉาย + สถานะที่นั่ง (ว่าง / ถูกจองแล้ว)
 */
router.get('/:id/seats', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const showtime = await prisma.showtime.findUnique({
      where: { id },
      include: {
        movie: { select: { id: true, title: true } },
        seats: {
          include: { bookingSeats: { select: { bookingId: true } } },
          orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }],
        },
      },
    });

    if (!showtime) {
      return res.status(404).json({ success: false, message: 'ไม่พบรอบฉายที่ต้องการ' });
    }

    const seats = showtime.seats.map((seat) => ({
      id: seat.id,
      seatCode: seat.seatCode,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      seatType: seat.seatType,
      isAvailable: seat.bookingSeats.length === 0,
    }));

    return res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลที่นั่งสำเร็จ',
      data: {
        showtime: {
          id: showtime.id,
          movie: showtime.movie,
          screen: showtime.screen,
          startTime: showtime.startTime,
          price: showtime.price,
        },
        seats,
      },
    });
  } catch (error) {
    console.error('❌ Get Seats Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงข้อมูลที่นั่งไม่สำเร็จ' });
  }
});

/**
 * POST /showtimes
 * สร้างรอบฉายใหม่พร้อมสร้างที่นั่งอัตโนมัติ (เฉพาะ ADMIN)
 * Body : { movieId, screen, startTime, price, rows: [{rowLabel,count,seatType}] }
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { movieId, screen, startTime, price, rows } = req.body;

    if (!movieId || !screen || !startTime || !price) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ movieId, screen, startTime และ price',
      });
    }

    const movie = await prisma.movie.findUnique({ where: { id: Number(movieId) } });
    if (!movie) {
      return res.status(404).json({ success: false, message: 'ไม่พบหนังที่ต้องการสร้างรอบฉาย' });
    }

    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'รูปแบบวันเวลาไม่ถูกต้อง' });
    }

    const showDate = new Date(start);
    showDate.setHours(0, 0, 0, 0);

    // โครงสร้างที่นั่งเริ่มต้น ถ้าไม่ได้ระบุ rows
    const seatLayout =
      Array.isArray(rows) && rows.length > 0
        ? rows
        : [
            { rowLabel: 'A', count: 8, seatType: 'NORMAL' },
            { rowLabel: 'B', count: 8, seatType: 'NORMAL' },
            { rowLabel: 'C', count: 8, seatType: 'NORMAL' },
            { rowLabel: 'D', count: 6, seatType: 'PREMIUM' },
          ];

    // สร้างรอบฉายและที่นั่งใน Transaction เดียว
    const showtime = await prisma.showtime.create({
      data: {
        movieId: Number(movieId),
        screen,
        showDate,
        startTime: start,
        price: Number(price),
        seats: {
          create: seatLayout.flatMap((row) =>
            Array.from({ length: Number(row.count) }, (_, i) => ({
              seatCode: `${row.rowLabel}${i + 1}`,
              rowLabel: row.rowLabel,
              seatNumber: i + 1,
              seatType: row.seatType || 'NORMAL',
            }))
          ),
        },
      },
      include: { _count: { select: { seats: true } } },
    });

    return res.status(201).json({
      success: true,
      message: `สร้างรอบฉายสำเร็จ พร้อมที่นั่ง ${showtime._count.seats} ที่`,
      data: showtime,
    });
  } catch (error) {
    console.error('❌ Create Showtime Error :', error);
    return res.status(500).json({ success: false, message: 'สร้างรอบฉายไม่สำเร็จ' });
  }
});

/**
 * DELETE /showtimes/:id
 * ลบรอบฉาย (เฉพาะ ADMIN) - ลบได้ก็ต่อเมื่อยังไม่มีการจอง
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.showtime.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบรอบฉายที่ต้องการลบ' });
    }

    if (existing._count.bookings > 0) {
      return res.status(400).json({
        success: false,
        message: `ลบไม่ได้ : รอบฉายนี้มีการจองอยู่ ${existing._count.bookings} รายการ`,
      });
    }

    await prisma.showtime.delete({ where: { id } });

    return res.status(200).json({ success: true, message: 'ลบรอบฉายสำเร็จ' });
  } catch (error) {
    console.error('❌ Delete Showtime Error :', error);
    return res.status(500).json({ success: false, message: 'ลบรอบฉายไม่สำเร็จ' });
  }
});

module.exports = router;
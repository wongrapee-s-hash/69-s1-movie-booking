// =============================================================================
// src/routes/movie.routes.js
// ROUTE ข้อมูลหนัง (Movie)
// ------------------------------------------------------------------
// สิทธิ์ตามเงื่อนไขอาจารย์ :
//   - USER : ดูรายการหนัง / ดูรายละเอียดหนัง (อ่านอย่างเดียว)
//   - ADMIN : สร้าง / แก้ไข / ลบหนัง (จัดการระบบหลังบ้าน)
// =============================================================================

const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /movies
 * ดูรายการหนังทั้งหมด (ทุกคนเข้าถึงได้)
 * รองรับ ?search= ค้นหาชื่อหนัง และ ?genre= กรองตามแนวหนัง
 */
router.get('/', async (req, res) => {
  try {
    const { search, genre } = req.query;

    const where = {};
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (genre) {
      where.genre = { contains: genre, mode: 'insensitive' };
    }

    const movies = await prisma.movie.findMany({
      where,
      include: {
        showtimes: {
          select: { id: true, screen: true, startTime: true, price: true },
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { releaseDate: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: 'ดึงรายการหนังสำเร็จ',
      meta: { total: movies.length },
      data: movies,
    });
  } catch (error) {
    console.error('❌ Get Movies Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงรายการหนังไม่สำเร็จ' });
  }
});

/**
 * GET /movies/:id
 * ดูรายละเอียดหนัง พร้อมรอบฉายทั้งหมด
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'ID ของหนังไม่ถูกต้อง' });
    }

    const movie = await prisma.movie.findUnique({
      where: { id },
      include: {
        showtimes: {
          include: {
            _count: { select: { seats: true } },
            bookings: { where: { status: 'CONFIRMED' }, select: { seats: true } },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!movie) {
      return res.status(404).json({ success: false, message: 'ไม่พบหนังที่ต้องการ' });
    }

    // คำนวณที่นั่งที่ว่างของแต่ละรอบฉาย
    const showtimes = movie.showtimes.map((s) => {
      const totalSeats = s._count.seats;
      const bookedSeats = s.bookings.reduce((sum, b) => sum + b.seats.length, 0);
      return {
        id: s.id,
        screen: s.screen,
        startTime: s.startTime,
        price: s.price,
        totalSeats,
        availableSeats: totalSeats - bookedSeats,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'ดึงรายละเอียดหนังสำเร็จ',
      data: { ...movie, showtimes, _count: undefined, bookings: undefined },
    });
  } catch (error) {
    console.error('❌ Get Movie Detail Error :', error);
    return res.status(500).json({ success: false, message: 'ดึงรายละเอียดหนังไม่สำเร็จ' });
  }
});

/**
 * POST /movies
 * เพิ่มหนังใหม่ (เฉพาะ ADMIN เท่านั้น)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, genre, duration, rating, posterUrl } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อหนัง' });
    }

    const movie = await prisma.movie.create({
      data: {
        title,
        description: description || null,
        genre: genre || null,
        duration: duration ? Number(duration) : 0,
        rating: rating || null,
        posterUrl: posterUrl || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'เพิ่มข้อมูลหนังสำเร็จ',
      data: movie,
    });
  } catch (error) {
    console.error('❌ Create Movie Error :', error);
    return res.status(500).json({ success: false, message: 'เพิ่มข้อมูลหนังไม่สำเร็จ' });
  }
});

/**
 * PUT /movies/:id
 * แก้ไขข้อมูลหนัง (เฉพาะ ADMIN เท่านั้น)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, genre, duration, rating, posterUrl } = req.body;

    const existing = await prisma.movie.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบหนังที่ต้องการแก้ไข' });
    }

    const movie = await prisma.movie.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        description: description ?? existing.description,
        genre: genre ?? existing.genre,
        duration: duration ? Number(duration) : existing.duration,
        rating: rating ?? existing.rating,
        posterUrl: posterUrl ?? existing.posterUrl,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'แก้ไขข้อมูลหนังสำเร็จ',
      data: movie,
    });
  } catch (error) {
    console.error('❌ Update Movie Error :', error);
    return res.status(500).json({ success: false, message: 'แก้ไขข้อมูลหนังไม่สำเร็จ' });
  }
});

/**
 * DELETE /movies/:id
 * ลบหนัง (เฉพาะ ADMIN เท่านั้น)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.movie.findUnique({
      where: { id },
      include: { _count: { select: { showtimes: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบหนังที่ต้องการลบ' });
    }

    if (existing._count.showtimes > 0) {
      return res.status(400).json({
        success: false,
        message: `ลบไม่ได้ : หนังนี้มีรอบฉายอยู่ ${existing._count.showtimes} รอบ กรุณาลบรอบฉายก่อน`,
      });
    }

    await prisma.movie.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'ลบข้อมูลหนังสำเร็จ',
    });
  } catch (error) {
    console.error('❌ Delete Movie Error :', error);
    return res.status(500).json({ success: false, message: 'ลบข้อมูลหนังไม่สำเร็จ' });
  }
});

module.exports = router;
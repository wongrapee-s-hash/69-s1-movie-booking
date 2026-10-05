// =============================================================================
// src/proxy.js
// ------------------------------------------------------------------
// FORWARD PROXY สำหรับ CONTENT API
// ------------------------------------------------------------------
// ตามเงื่อนไขอาจารย์ :
//   "โครงสร้าง API ส่วน Content ให้ยึดตามระบบที่กลุ่มเลือก"
//   ระบบที่กลุ่มเลือก = ระบบจองตั๋วหนัง (Express.js + Prisma + PostgreSQL)
//
// วิธีทำงาน :
//   Client → Gateway (/api/movies) → Backend (/movies)
//   โครงสร้าง Request/Response ผ่านต่อทั้งหมด ไม่มีการแก้ไขข้อมูล
//   เพื่อให้ Content API ยังคงเป็นโครงสร้างของระบบจองตั๋วหนังอย่างแท้จริง
// =============================================================================

const axios = require('axios');
const config = require('./config');
const {
  CONTENT_ROUTES,
  ADMIN_ROUTES,
  BOOKING_ROUTES,
} = require('./config/routes');

const backend = axios.create({
  baseURL: config.BACKEND_INTERNAL_URL,
  timeout: config.TIMEOUT_MS,
});

/** ส่งต่อ Header ที่จำเป็นไปยัง Backend */
function forwardHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers['content-length'];
  return headers;
}

/**
 * สร้าง Proxy Handler สำหรับ 1 Route
 * @param {string} publicPrefix Path ภายนอก เช่น /api/movies
 * @param {string} backendPrefix Path ภายหลัง เช่น /movies
 */
function createProxyHandler(publicPrefix, backendPrefix) {
  return async function proxyHandler(req, res) {
    try {
      // ---- แปลง Path : /api/movies/1 → /movies/1 ----
      // ตัด publicPrefix (เช่น /api/movies) ออก แล้วเติม backendPrefix (เช่น /movies) แทน
      const fullPath = req.originalUrl.split('?')[0];
      const query = req.originalUrl.includes('?')
        ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
        : '';

      // ส่วนที่เหลือหลังตัด prefix เช่น /1/seats
      const restPath = fullPath.startsWith(publicPrefix)
        ? fullPath.slice(publicPrefix.length)
        : fullPath;

      const targetUrl = `${backendPrefix}${restPath}${query}`;
      const requestConfig = {
        headers: forwardHeaders(req),
        params: req.query,
        timeout: config.TIMEOUT_MS,
        validateStatus: () => true, // ไม่ throw error เพื่อให้ส่งต่อ Status Code จริง
      };

      // ---- เลือกวิธียิงตาม HTTP Method ----
      let response;
      switch (req.method) {
        case 'GET':
          response = await backend.get(targetUrl, requestConfig);
          break;
        case 'POST':
          response = await backend.post(targetUrl, req.body, requestConfig);
          break;
        case 'PUT':
          response = await backend.put(targetUrl, req.body, requestConfig);
          break;
        case 'PATCH':
          response = await backend.patch(targetUrl, req.body, requestConfig);
          break;
        case 'DELETE':
          response = await backend.delete(targetUrl, {
            ...requestConfig,
            data: req.body,
          });
          break;
        default:
          return res.status(405).json({
            success: false,
            message: `ไม่รองรับ HTTP Method : ${req.method}`,
          });
      }

      // ---- ส่งต่อ Response กลับให้ Client ----
      return res.status(response.status).json(response.data);
    } catch (error) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }

      console.error('❌ Proxy Error :', error.message);
      return res.status(503).json({
        success: false,
        message: 'ไม่สามารถเชื่อมต่อกับ Backend ระบบจองตั๋วหนังได้',
      });
    }
  };
}

/**
 * ลงทะเบียน Content Route ทั้งหมด
 * @param {import('express').Express} app
 */
function registerContentRoutes(app) {
  const allRoutes = [...CONTENT_ROUTES, ...ADMIN_ROUTES, ...BOOKING_ROUTES];
  const registered = new Set();

  console.log('\n📋 ตารางการส่งต่อ CONTENT API (ยึดตามโครงสร้างระบบจองตั๋วหนัง) :');
  console.log('   ┌────────────────────────────────┬────────────┬──────────────────────────────┐');

  for (const route of allRoutes) {
    const key = `${route.method}:${route.publicPrefix}`;

    if (registered.has(key)) continue;
    registered.add(key);

    const handler = createProxyHandler(route.publicPrefix, route.backendPrefix);

    // ลงทะเบียน 2 แบบ เพื่อให้รองรับทั้ง Path แบบไม่มี slash ท้าย และแบบมี slash
    //   1) /api/movies      → เรียกรายการหนังทั้งหมด
    //   2) /api/movies/*    → เรียกรายละเอียด เช่น /api/movies/1
    // หมายเหตุ : Express 4 จะไม่จับคู่ '/api/movies' กับ pattern '/api/movies/*'
    //            จึงต้องลงทะเบียนแยกกัน
    app[route.method](route.publicPrefix, handler);
    app[route.method](`${route.publicPrefix}/*`, handler);

    console.log(
      `   │ ${route.method.toUpperCase().padEnd(6)} ${route.publicPrefix.padEnd(28)} → ${route.backendPrefix.padEnd(26)} │`
    );
  }

  console.log('   └────────────────────────────────┴────────────┴──────────────────────────────┘');
}

module.exports = { registerContentRoutes, createProxyHandler };
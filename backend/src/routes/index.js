// =============================================================================
// src/routes/index.js
// รวม Route ทั้งหมดของ Backend ไว้ที่จุดเดียว
// =============================================================================

module.exports = {
  auth: require('./auth.routes'),
  movie: require('./movie.routes'),
  showtime: require('./showtime.routes'),
  booking: require('./booking.routes'),
  admin: require('./admin.routes'),
};
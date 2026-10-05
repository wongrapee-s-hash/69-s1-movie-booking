// =============================================================================
// src/config/index.js
// ตัวแปรสภาพแวดล้อมของ API Gateway
// =============================================================================

module.exports = {
  PORT: Number(process.env.PORT || 8080),
  BACKEND_INTERNAL_URL: process.env.BACKEND_INTERNAL_URL || 'http://backend:4000',
  GATEWAY_PUBLIC_URL: process.env.GATEWAY_PUBLIC_URL || 'http://localhost:8080',
  TIMEOUT_MS: 30000,
};
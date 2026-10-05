// =============================================================================
// src/index.js
// จุดเริ่มต้นของ API Gateway
// =============================================================================

const app = require('./app');
const config = require('./config');

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log('============================================');
  console.log(' 🔀 API Gateway');
  console.log(' แมป Auth API ให้ตรงตามเงื่อนไข 69-s1-app');
  console.log('============================================');
  console.log(` Port           : ${config.PORT}`);
  console.log(` Backend        : ${config.BACKEND_INTERNAL_URL}`);
  console.log(` Public URL     : ${config.GATEWAY_PUBLIC_URL}`);
  console.log(` Endpoint List  : ${config.GATEWAY_PUBLIC_URL}/api`);
  console.log(` Time           : ${new Date().toISOString()}`);
  console.log('============================================');
});

const shutdown = (signal) => {
  console.log(`\n⚠️  รับสัญญาณ ${signal} กำลังปิด API Gateway...`);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
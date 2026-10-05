// =============================================================================
// src/lib/mailer.js
// ส่งอีเมลผ่าน SMTP ของ Mailpit (ดูอีเมลได้ที่ http://localhost:8025)
// ใช้สำหรับส่งลิงก์ Reset Password ในระบบจองตั๋วหนัง
// =============================================================================

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'mailpit';
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const MAIL_FROM = process.env.MAIL_FROM || 'booking@gitea-movie.local';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // Mailpit ไม่ใช้ TLS
  ignoreTLS: true,
  tls: { rejectUnauthorized: false },
});

/**
 * ส่งอีเมล Reset Password
 * @param {string} toEmail อีเมลผู้รับ
 * @param {string} username ชื่อผู้ใช้
 * @param {string} resetLink ลิงก์สำหรับตั้งรหัสผ่านใหม่
 */
async function sendResetPasswordEmail(toEmail, username, resetLink) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #e11d48;">🎬 ระบบจองตั๋วหนัง</h2>
      <p>สวัสดีคุณ <strong>${username}</strong></p>
      <p>คุณได้รับคำขอเปลี่ยนรหัสผ่านของระบบจองตั๋วหนัง</p>
      <p>
        <a href="${resetLink}"
           style="display:inline-block; padding:12px 24px; background:#e11d48;
                  color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold;">
          ตั้งรหัสผ่านใหม่
        </a>
      </p>
      <p><small>หรือ Copy ลิงก์นี้ไปเปิดในเบราว์เซอร์ :<br/>${resetLink}</small></p>
      <hr/>
      <p><small>ลิงก์นี้จะหมดอายุภายใน 15 นาที<br/>
      หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยอีเมลนี้</small></p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: `"Movie Booking System" <${MAIL_FROM}>`,
    to: toEmail,
    subject: '🔐 รีเซ็ตรหัสผ่าน - ระบบจองตั๋วหนัง',
    text: `กดลิงก์เพื่อตั้งรหัสผ่านใหม่: ${resetLink}`,
    html: htmlContent,
  });

  console.log(`📧 ส่งอีเมล Reset Password ไปที่ ${toEmail} (id: ${info.messageId})`);
  return info;
}

module.exports = { sendResetPasswordEmail };
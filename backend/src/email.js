/**
 * email.js
 * Transactional email sender. Uses SMTP when configured (SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, MAIL_FROM); otherwise runs in MOCK mode and just logs
 * the message + any link so the flow is testable without a provider.
 */

const nodemailer = require('nodemailer');

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT || 587);
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const FROM = process.env.MAIL_FROM || 'Aviator <no-reply@aviator.game>';

const ENABLED = !!(HOST && USER && PASS);
let transporter = null;
if (ENABLED) {
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // SSL on 465, STARTTLS otherwise
    auth: { user: USER, pass: PASS },
  });
}

/**
 * Sends an email. Returns true if actually sent, false in mock mode.
 */
const send = async (to, subject, html) => {
  if (!ENABLED) {
    console.log(`[Mail MOCK] to=${to} | subject="${subject}"`);
    const link = (html.match(/https?:\/\/[^"'\s<>]+/) || [])[0];
    if (link) console.log(`[Mail MOCK] link: ${link}`);
    return false;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    return true;
  } catch (e) {
    console.error('[Mail] send failed:', e.message);
    return false;
  }
};

module.exports = { send, mailEnabled: ENABLED };

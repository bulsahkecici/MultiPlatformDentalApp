const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

let transporter = null;

/**
 * E-posta taşıyıcısını (transporter) başlatır
 */
function initializeTransporter() {
  if (!config.email.enabled) {
    logger.info('Email service is disabled');
    return;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  logger.info('Email service initialized');
}

/**
 * E-posta gönderir
 * @param {Object} options - E-posta seçenekleri
 * @param {string} options.to - Alıcı e-postası
 * @param {string} options.subject - E-posta konusu
 * @param {string} options.html - HTML içeriği
 * @param {string} options.text - Düz metin içeriği
 * @returns {Promise<void>}
 */
async function sendEmail({ to, subject, html, text }) {
  if (!config.email.enabled) {
    logger.warn({ to, subject }, 'Email not sent (service disabled)');
    return;
  }

  if (!transporter) {
    initializeTransporter();
  }

  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
      text,
    });

    logger.info({ to, subject }, 'Email sent successfully');
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email');
    throw err;
  }
}

/**
 * E-posta doğrulama e-postası gönderir
 * @param {string} email - Kullanıcı e-postası
 * @param {string} token - Doğrulama token'ı
 * @returns {Promise<void>}
 */
async function sendVerificationEmail(email, token) {
  const verificationUrl = `${config.appUrl}/api/auth/verify-email/${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Thank you for registering with our Dental App!</p>
          <p>Please click the button below to verify your email address:</p>
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2563eb;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Dental App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Verify Your Email
    
    Thank you for registering with our Dental App!
    
    Please visit the following link to verify your email address:
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, please ignore this email.
  `;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email - Dental App',
    html,
    text,
  });
}

/**
 * Parola sıfırlama e-postası gönderir
 * @param {string} email - Kullanıcı e-postası
 * @param {string} token - Sıfırlama token'ı
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>We received a request to reset your password.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
          <div class="warning">
            <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Dental App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    We received a request to reset your password.
    
    Visit the following link to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, please ignore this email.
  `;

  await sendEmail({
    to: email,
    subject: 'Password Reset Request - Dental App',
    html,
    text,
  });
}

/**
 * E-posta doğrulamasından sonra hoş geldiniz e-postası gönderir
 * @param {string} email - Kullanıcı e-postası
 * @param {string} name - Kullanıcı adı
 * @returns {Promise<void>}
 */
async function sendWelcomeEmail(email, name = '') {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Dental App!</h1>
        </div>
        <div class="content">
          <p>Hi${name ? ` ${name}` : ''},</p>
          <p>Your email has been verified successfully!</p>
          <p>You can now access all features of our Dental Management System.</p>
          <p>If you have any questions, feel free to contact our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Dental App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to Dental App!
    
    Hi${name ? ` ${name}` : ''},
    
    Your email has been verified successfully!
    
    You can now access all features of our Dental Management System.
  `;

  await sendEmail({
    to: email,
    subject: 'Welcome to Dental App!',
    html,
    text,
  });
}

// Modül yüklenirken başlat
if (config.email && config.email.enabled) {
  initializeTransporter();
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  initializeTransporter,
};

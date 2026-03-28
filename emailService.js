// emailService.js
// Servicio de email universal (SMTP) para BarberCloud
// Funciona con: Gmail, SendGrid SMTP, Resend, Postmark, SMTP personalizado
//
// Variables de entorno a configurar en Render:
//   SMTP_HOST     = smtp.gmail.com (o tu proveedor)
//   SMTP_PORT     = 587
//   SMTP_USER     = tu@email.com
//   SMTP_PASS     = tu_app_password
//   SMTP_FROM     = BarberCloud <noreply@tudominio.com>
//   FRONTEND_URL  = https://barberscloud.vercel.app

const nodemailer = require("nodemailer");

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // Email no configurado — soft fail
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

/**
 * Enviar email de recuperación de contraseña
 * @param {string} to - Email destino
 * @param {string} resetToken - Token único de reset
 * @param {string} shopName - Nombre de la barbería
 * @returns {Promise<boolean>} true si se envió, false si email no configurado
 */
async function sendPasswordResetEmail(to, resetToken, shopName) {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.warn("[Email] SMTP no configurado — no se envió el email de recuperación");
    return false;
  }

  const frontendBase = process.env.FRONTEND_URL || "https://barberscloud.vercel.app";
  const resetUrl = `${frontendBase}/reset-password.html?token=${resetToken}`;
  const from = process.env.SMTP_FROM || `BarberCloud <noreply@barbercloud.app>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: "Recuperar contraseña — BarberCloud",
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
          <h2 style="color: #38bdf8; margin: 0 0 8px">BarberCloud</h2>
          <p style="color: #94a3b8; margin: 0 0 24px; font-size: 14px">Sistema de gestión para barberías</p>
          
          <h3 style="margin: 0 0 12px">Recuperar tu contraseña</h3>
          <p style="margin: 0 0 16px; font-size: 15px; color: #cbd5e1;">
            Recibiste este email porque solicitaste restablecer la contraseña de <strong>${shopName}</strong>.
          </p>
          <p style="margin: 0 0 24px; font-size: 15px; color: #cbd5e1;">
            El enlace expira en <strong>1 hora</strong>.
          </p>
          
          <a href="${resetUrl}" style="display: inline-block; background: #38bdf8; color: #0f172a; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Restablecer Contraseña
          </a>
          
          <p style="margin: 24px 0 0; font-size: 12px; color: #64748b;">
            Si no solicitaste esto, ignorá este email. Tu contraseña no cambiará.
          </p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">
            O copiá este enlace: ${resetUrl}
          </p>
        </div>
      `
    });
    console.log(`[Email] Email de recuperación enviado a ${to}`);
    return true;
  } catch (err) {
    console.error("[Email] Error enviando email de recuperación:", err.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail };

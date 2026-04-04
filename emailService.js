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
    tls: { rejectUnauthorized: false, servername: host },
    // ═══ FIX DEFINITIVO para Render (IPv6 ENETUNREACH) ═══
    // Render rutea por IPv6 por defecto y Gmail rechaza la conexión.
    // Forzamos IPv4 a nivel de socket TCP (net.connect options).
    family: 4,
    // Nodemailer >= 6.9 también soporta socketOptions como fallback:
    socketOptions: { family: 4 },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

const from = () => process.env.SMTP_FROM || "BarberCloud <noreply@barbercloud.app>";

// ─────────────────────────────────────────────────────────────
// 1. Email de recuperación de contraseña
// ─────────────────────────────────────────────────────────────
async function sendPasswordResetEmail(to, resetToken, shopName) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP no configurado — no se envió el email de recuperación");
    return false;
  }

  const frontendBase = process.env.FRONTEND_URL || "https://barberscloud.vercel.app";
  const resetUrl = `${frontendBase}/reset-password.html?token=${resetToken}`;

  try {
    await transporter.sendMail({
      from: from(),
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

// ─────────────────────────────────────────────────────────────
// 2. Confirmación de turno al CLIENTE
// ─────────────────────────────────────────────────────────────
/**
 * @param {string} to - Email del cliente
 * @param {{ appointmentId, customerName, barbershopName, serviceName, barberName, date, time, notes }} details
 */
async function sendConfirmationToCustomer(to, details) {
  if (!to || !to.includes("@")) return false;

  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP no configurado — no se envió confirmación al cliente");
    return false;
  }

  const { customerName, barbershopName, serviceName, barberName, date, time, appointmentId } = details;

  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      });
    } catch { return date; }
  })();

  try {
    await transporter.sendMail({
      from: from(),
      to,
      subject: `Tu turno en ${barbershopName} está confirmado ✅`,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
          <h2 style="color: #38bdf8; margin: 0 0 4px">BarberCloud</h2>
          <p style="color: #94a3b8; margin: 0 0 28px; font-size: 13px">Sistema de gestión para barberías</p>

          <h3 style="margin: 0 0 8px; color: #f1f5f9;">¡Turno confirmado, ${customerName}! ✂️</h3>
          <p style="color: #94a3b8; margin: 0 0 24px; font-size: 14px;">Estos son los datos de tu reserva en <strong style="color:#e2e8f0">${barbershopName}</strong>:</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Servicio</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Barbero</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${barberName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Fecha</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Hora</td>
              <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; text-align: right;">${time} hs</td>
            </tr>
          </table>

          <p style="margin: 0 0 6px; font-size: 12px; color: #64748b;">Referencia #${appointmentId}</p>
          <p style="margin: 0; font-size: 12px; color: #475569;">Si necesitás cancelar, contactá directamente a la barbería.</p>
        </div>
      `
    });
    console.log(`[Email] Confirmación enviada al cliente ${to} (turno #${appointmentId})`);
    return true;
  } catch (err) {
    console.error("[Email] Error enviando confirmación al cliente:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Aviso de nuevo turno al BARBERO
// ─────────────────────────────────────────────────────────────
/**
 * @param {string} to - Email del barbero
 * @param {{ appointmentId, customerName, customerPhone, customerEmail, serviceName, date, time }} details
 */
async function sendNewAppointmentToBarber(to, details) {
  if (!to || !to.includes("@")) return false;

  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP no configurado — no se envió aviso al barbero");
    return false;
  }

  const { customerName, customerPhone, customerEmail, serviceName, date, time, appointmentId } = details;

  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      });
    } catch { return date; }
  })();

  try {
    await transporter.sendMail({
      from: from(),
      to,
      subject: `Nuevo turno — ${serviceName} con ${customerName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
          <h2 style="color: #38bdf8; margin: 0 0 4px">BarberCloud</h2>
          <p style="color: #94a3b8; margin: 0 0 28px; font-size: 13px">Sistema de gestión para barberías</p>

          <h3 style="margin: 0 0 8px; color: #f1f5f9;">📅 Nuevo turno reservado</h3>
          <p style="color: #94a3b8; margin: 0 0 24px; font-size: 14px;">Un cliente acaba de confirmar un turno.</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Cliente</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Teléfono</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${customerPhone || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Email</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${customerEmail || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Servicio</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #64748b; font-size: 13px;">Fecha</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 14px; text-align: right;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Hora</td>
              <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; text-align: right;">${time} hs</td>
            </tr>
          </table>

          <p style="margin: 0; font-size: 12px; color: #475569;">Referencia de turno #${appointmentId}. Podés gestionar tus turnos desde el panel de BarberCloud.</p>
        </div>
      `
    });
    console.log(`[Email] Aviso enviado al barbero ${to} (turno #${appointmentId})`);
    return true;
  } catch (err) {
    console.error("[Email] Error enviando aviso al barbero:", err.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail, sendConfirmationToCustomer, sendNewAppointmentToBarber };

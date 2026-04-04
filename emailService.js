// emailService.js
// Servicio de email para BarberCloud
//
// PRIORIDAD 1 (PRODUCCIÓN): Resend API (HTTP/443) — funciona en Render free tier
//   Variables: RESEND_API_KEY, RESEND_FROM
//   Signup gratuito: https://resend.com (3000 emails/mes gratis)
//
// PRIORIDAD 2 (LOCAL/FALLBACK): SMTP clásico (nodemailer)
//   Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// NOTA: Render free tier BLOQUEA el puerto 587/465 (SMTP) a nivel de firewall.
// Por eso usamos Resend que comunica vía HTTPS (puerto 443, siempre abierto).

const nodemailer = require("nodemailer");

// ─────────────────────────────────────────────────────────────
// HELPER: Enviar via Resend API (HTTPS)
// ─────────────────────────────────────────────────────────────
async function sendViaResend({ to, subject, html }) {
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || "BarberCloud <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Enviar via SMTP (fallback local)
// ─────────────────────────────────────────────────────────────
function createSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    family: 4,
    socketOptions: { family: 4 },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

const smtpFrom = () => process.env.SMTP_FROM || "BarberCloud <noreply@barbercloud.app>";

// ─────────────────────────────────────────────────────────────
// DISPATCHER: Intenta Resend, luego SMTP como fallback
// ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  // 1. Resend API (preferido en producción)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to, subject, html });
      return true;
    } catch (err) {
      console.error("[Email] Resend falló:", err.message, "— intentando SMTP...");
    }
  }

  // 2. SMTP fallback (funciona en local)
  const transporter = createSmtpTransporter();
  if (!transporter) {
    console.warn("[Email] Sin configuración de email (ni RESEND_API_KEY ni SMTP).");
    return false;
  }
  await transporter.sendMail({ from: smtpFrom(), to, subject, html });
  return true;
}

// ─────────────────────────────────────────────────────────────
// 1. Email de recuperación de contraseña
// ─────────────────────────────────────────────────────────────
async function sendPasswordResetEmail(to, resetToken, shopName) {
  const frontendBase = process.env.FRONTEND_URL || "https://barberscloud.vercel.app";
  const resetUrl = `${frontendBase}/reset-password.html?token=${resetToken}`;

  try {
    await sendEmail({
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
async function sendConfirmationToCustomer(to, details) {
  if (!to || !to.includes("@")) return false;

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
    await sendEmail({
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
async function sendNewAppointmentToBarber(to, details) {
  if (!to || !to.includes("@")) return false;

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
    await sendEmail({
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

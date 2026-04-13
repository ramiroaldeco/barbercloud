// server.js
require("dotenv").config();

// TRIG: Redeploy after manual DB unlock
// Forzar resolución IPv4 para evitar timeouts de Nodemailer hacia Gmail (Render usa IPv6 preferencialmente en algunos clusters, causando ENETUNREACH)
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");

const authRoutes = require("./auth");
const barbershopsRoutes = require("./barbershops");
const servicesRoutes = require("./services");
const appointmentsRoutes = require("./appointments");
const onboardingRoutes = require("./onboarding");
const { router: publicBookingRoutes } = require("./publicBooking");
const clientsRoutes = require("./clients");
const membersRoutes = require("./members");
const blockedTimesRoutes = require("./blockedTimes");
const { router: paymentsRoutes } = require("./payments");
const statisticsRoutes = require("./statistics");
const superadminRoutes = require("./superadmin");
const log = require("./logger");

// =========================
// ✅ GLOBAL ERROR HANDLERS
// Captura crashes y promesas sin manejar — los hace visibles en los logs de Render
// =========================
process.on("uncaughtException", (err) => {
  log.error("[FATAL] uncaughtException — proceso en estado inconsistente:", err.message, "\n", err.stack);
  // No llamamos process.exit() para no derribar el servidor ante errores recuperables.
  // Si el proceso queda inestable, Render lo reinicia solo.
});

process.on("unhandledRejection", (reason) => {
  const detail = reason instanceof Error ? reason.stack : String(reason);
  log.error("[FATAL] unhandledRejection — promesa sin .catch():", detail);
});

const app = express();

// Confiar en el proxy de Render X-Forwarded-For para rate-limit
app.set("trust proxy", 1);

// =========================
// ✅ CORS
// =========================
const corsOptions = {
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // Postman/curl/server-to-server
    if (origin.endsWith(".vercel.app")) return cb(null, true);
    if (origin === "https://ramiroaldeco.github.io") return cb(null, true);
    if (
      origin === "http://localhost:5500" ||
      origin === "http://127.0.0.1:5500" ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) return cb(null, true);

    return cb(new Error("CORS bloqueado para: " + origin), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "20mb" }));

// =========================
// ✅ RATE LIMITING
// =========================

// Auth: max 10 intentos por 15 min por IP (frena fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Esperá 15 minutos e intentá de nuevo." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Onboarding/signup: max 5 por hora por IP (frena creación masiva de cuentas)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Demasiados registros desde esta IP. Intentá más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Booking público: max 30 reservas por hora por IP (frena spam de reservas)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "Demasiadas reservas desde esta IP. Intentá más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
  // Solo limitar el endpoint de booking real (POST), no los de datos
  skip: (req) => req.method !== "POST",
});

// Disponibilidad: max 120 por 15 min por IP (previene scraping y sobrecarga de computación)
const availabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: "Demasiadas consultas de disponibilidad. Esperá un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

// =========================
// ✅ HEALTHCHECK
// =========================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "BarberCloud API funcionando 🚀" });
});

// =========================
// ✅ RUTAS API
// =========================
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/onboarding", signupLimiter, onboardingRoutes);
app.use("/api/barbershops", barbershopsRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/public", bookingLimiter, publicBookingRoutes);
// Disponibilidad: aplica solo a /:slug/availability (método GET)
app.use("/api/public", availabilityLimiter);
app.use("/api/clients", clientsRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/blocked-times", blockedTimesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/superadmin", superadminRoutes);

// =========================
// ✅ MIDDLEWARE ERROR 500
// DEBE estar después de todas las rutas.
// Captura solo errores pasados via next(err) — no interfiere con try/catch existentes.
// =========================
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const context = `[${req.method}] ${req.originalUrl}`;

  if (status >= 500) {
    log.error(`${context} → ${status}:`, err.message, "\n", err.stack || "");
  } else {
    log.warn(`${context} → ${status}:`, err.message);
  }

  if (res.headersSent) return next(err);
  return res.status(status).json({ error: err.message || "Error interno del servidor" });
});

// =========================
// ✅ START SERVER & CRON
// =========================
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Garbage Collector: Libera turnos vencidos cada minuto (en vez de cada 10s)
// En Render free tier reduce la carga de queries a la DB 6x
cron.schedule("* * * * *", async () => {
  try {
    const expiredCount = await prisma.appointment.updateMany({
      where: {
        status: "PENDING_PAYMENT",
        lockExpiresAt: { lte: new Date() }
      },
      data: {
        status: "CANCELLED_EXPIRED",
        lockExpiresAt: null
      }
    });
    if (expiredCount.count > 0) {
      console.log(`[Cron] Liberados ${expiredCount.count} turnos expirados.`);
    }
  } catch (err) {
    console.error("[Cron] Error limpiando turnos:", err.message);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en puerto ${PORT}`);
  if (!process.env.MP_CLIENT_ID) console.warn("[WARN] MP_CLIENT_ID no configurada en env vars");
  if (!process.env.MP_CLIENT_SECRET) console.warn("[WARN] MP_CLIENT_SECRET no configurada en env vars");
  if (!process.env.MP_PUBLIC_KEY) console.warn("[WARN] MP_PUBLIC_KEY no configurada — el SDK de pago no funcionará");
  if (!process.env.JWT_SECRET) console.error("[ERROR] JWT_SECRET no configurada — el sistema no puede funcionar");
  if (!process.env.MP_WEBHOOK_SECRET) console.warn("[WARN] MP_WEBHOOK_SECRET no configurada — el webhook no puede verificar firmas");
});

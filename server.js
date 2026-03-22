// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

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

const app = express();

/**
 * =========================
 * ✅ CORS ROBUSTO Y SEGURO
 * =========================
 * Permite:
 * - Vercel (.vercel.app)
 * - GitHub Pages (producción, opcional)
 * - Localhost (desarrollo)
 * - Requests sin origin (Postman, server-to-server)
 */
const corsOptions = {
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // Postman/curl/server-to-server

    // ✅ Vercel (cualquier subdominio)
    if (origin.endsWith(".vercel.app")) return cb(null, true);

    // ✅ GitHub Pages (si lo seguís usando)
    if (origin === "https://ramiroaldeco.github.io") return cb(null, true);

    // ✅ Local dev (5500 y cualquier puerto)
    if (
      origin === "http://localhost:5500" ||
      origin === "http://127.0.0.1:5500" ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) return cb(null, true);

    return cb(new Error("CORS bloqueado para: " + origin), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  credentials: true,
};

// ⬇️ IMPORTANTE: CORS y preflight ANTES de las rutas
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ habilita preflight
// Aumentar el límite a 20mb para soportar imágenes en Base64 de las fotos de los Miembros
app.use(express.json({ limit: "20mb" }));

/**
 * =========================
 * ✅ HEALTHCHECK
 * =========================
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "BarberCloud API funcionando 🚀" });
});

/**
 * =========================
 * ✅ RUTAS API
 * =========================
 */
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/barbershops", barbershopsRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/public", publicBookingRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/blocked-times", blockedTimesRoutes);
app.use("/api/payments", paymentsRoutes);

/**
 * =========================
 * ✅ START SERVER & CRON
 * =========================
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// FASE 7.1: Garbage Collector - Limpia reservas vencidas cada 10 segundos
setInterval(async () => {
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
      console.log(`[Cron Fase 7.1] Liberados ${expiredCount.count} turnos vencidos.`);
    }
  } catch (err) {
    console.error("[Cron] Error limpiando turnos:", err.message);
  }
}, 10000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en puerto ${PORT}`);
});

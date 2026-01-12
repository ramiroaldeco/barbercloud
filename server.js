// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./auth");
const barbershopsRoutes = require("./barbershops");
const servicesRoutes = require("./services");
const appointmentsRoutes = require("./appointments");
const onboardingRoutes = require("./onboarding");

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
app.use(express.json());

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

/**
 * =========================
 * ✅ START SERVER
 * =========================
 */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en puerto ${PORT}`);
});

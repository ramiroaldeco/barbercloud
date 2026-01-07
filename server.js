// server.js
const express = require("express");
const cors = require("cors");

const authRoutes = require("./auth");
const barbershopsRoutes = require("./barbershops");
const servicesRoutes = require("./services");
const appointmentsRoutes = require("./appointments");
const onboardingRoutes = require("./onboarding"); // ✅ NUEVO

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "BarberCloud API funcionando 🚀" });
});

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes); // ✅ NUEVO
app.use("/api/barbershops", barbershopsRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/appointments", appointmentsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en http://localhost:${PORT}`);
});

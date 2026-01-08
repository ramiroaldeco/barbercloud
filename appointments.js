// appointments.js
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

/**
 * ✅ PRIVADO: SOLO turnos de mi barbería (panel)
 * GET /api/appointments
 */
router.get("/", auth, async (req, res) => {
  try {
    const barbershopId = req.user.barbershopId;

    const appointments = await prisma.appointment.findMany({
      where: { barbershopId },
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });

    res.json(appointments);
  } catch (err) {
    console.error("Error al obtener turnos:", err);
    res.status(500).json({ error: "Error al obtener turnos" });
  }
});

/**
 * ✅ (OPCIONAL) PÚBLICO SAFE (demo): disponibilidad sin datos sensibles
 * GET /api/appointments/public?barbershopId=1
 * Devuelve solo date/time/status (NO nombre/teléfono)
 */
router.get("/public", async (req, res) => {
  try {
    const barbershopId = Number(req.query.barbershopId);
    if (!barbershopId) return res.status(400).json({ error: "Falta barbershopId" });

    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId,
        NOT: { status: "canceled" },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      select: {
        id: true,
        date: true,
        time: true,
        status: true,
        paymentStatus: true,
        serviceId: true, // opcional (por si querés marcar tipo de turno)
      },
    });

    res.json(appointments);
  } catch (err) {
    console.error("Error al obtener turnos públicos:", err);
    res.status(500).json({ error: "Error al obtener turnos públicos" });
  }
});

/**
 * ✅ PÚBLICO: crear turno (pending + calcula seña + fee)
 * POST /api/appointments
 */
router.post("/", async (req, res) => {
  try {
    let { barbershopId, serviceId, customerName, customerPhone, date, time } = req.body;

    if (!barbershopId || !serviceId || !customerName || !customerPhone || !date || !time) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    barbershopId = Number(barbershopId);
    serviceId = Number(serviceId);

    // Traemos config de barbería y servicio
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { id: true, defaultDepositPercentage: true, platformFee: true },
    });
    if (!barbershop) return res.status(404).json({ error: "Barbería no encontrada" });

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, barbershopId: true, price: true, depositPercentage: true },
    });
    if (!service) return res.status(404).json({ error: "Servicio no encontrado" });
    if (service.barbershopId !== barbershopId) {
      return res.status(400).json({ error: "El servicio no pertenece a esa barbería" });
    }

    // ✅ Evitar doble reserva (mismo día y hora para la barbería)
    const existing = await prisma.appointment.findFirst({
      where: {
        barbershopId,
        date,
        time,
        NOT: { status: "canceled" },
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: "Ese horario ya está reservado" });
    }

    // % seña: si el servicio tiene override, lo usa; si no, usa el default de la barbería
    let pct = service.depositPercentage ?? barbershop.defaultDepositPercentage ?? 15;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    const depositAmount = Math.round(service.price * (pct / 100));
    const platformFee = Number(process.env.PLATFORM_FEE ?? 200);
    const totalToPay = depositAmount + platformFee;

    const appointment = await prisma.appointment.create({
      data: {
        barbershopId,
        serviceId,
        customerName,
        customerPhone,
        date,
        time,

        status: "pending",
        paymentStatus: "unpaid",

        depositPercentageAtBooking: pct,
        depositAmount,
        platformFee,
        totalToPay,
      },
      include: {
        barbershop: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, price: true } },
      },
    });

    res.json({
      ok: true,
      appointment,
      pricing: {
        servicePrice: service.price,
        depositPercentage: pct,
        depositAmount,
        platformFee,
        totalToPay,
      },
      nextStep:
        "Integrar MercadoPago: cobrar totalToPay y confirmar turno cuando paymentStatus=paid",
    });
  } catch (err) {
    console.error("Error al crear turno:", err);
    res.status(500).json({ error: "Error al crear turno" });
  }
});

module.exports = router;

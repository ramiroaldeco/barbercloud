// appointments.js
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

function requireOwner(req, res) {
  if (!req.user || req.user.role !== "owner") {
    res.status(403).json({ error: "Solo el dueño puede realizar esta acción" });
    return false;
  }
  return true;
}

// =========================
// PRIVADO (OWNER): listar turnos de mi barbería con filtros
// GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&status=pending|confirmed|canceled&q=nombre|telefono
// =========================
router.get("/", auth, async (req, res) => {
  try {
    const { from, to, status, q } = req.query;

    const where = {
      barbershopId: req.user.barbershopId,
    };

    if (status) where.status = String(status);

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = String(from);
      if (to) where.date.lte = String(to);
    }

    if (q && String(q).trim()) {
      const qq = String(q).trim();
      where.OR = [
        { customerName: { contains: qq, mode: "insensitive" } },
        { customerPhone: { contains: qq, mode: "insensitive" } },
      ];
    }

    const items = await prisma.appointment.findMany({
      where,
      orderBy: [{ date: "asc" }, { time: "asc" }],
      include: {
        service: { select: { id: true, name: true } },
      },
    });

    // ⛔ NO cambiamos formato: devolvemos array (compatible con lo actual)
    return res.json(items);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error listando turnos" });
  }
});

// =========================
// PUBLICO: turnos para disponibilidad (no sensibles)
// GET /api/appointments/public?barbershopId=...
// =========================
router.get("/public", async (req, res) => {
  try {
    const { barbershopId } = req.query;
    if (!barbershopId) return res.status(400).json({ error: "Falta barbershopId" });

    const items = await prisma.appointment.findMany({
      where: { barbershopId: String(barbershopId) },
      select: {
        id: true,
        date: true,
        time: true,
        status: true,
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return res.json(items);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo turnos públicos" });
  }
});

// =========================
// PUBLICO: crear turno (pendiente)
// POST /api/appointments
// =========================
router.post("/", async (req, res) => {
  try {
    const {
      barbershopId,
      serviceId,
      date,
      time,
      customerName,
      customerPhone,
      customerEmail,
      notes,
    } = req.body;

    if (!barbershopId || !serviceId || !date || !time || !customerName || !customerPhone) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // evitar doble reserva
    const existing = await prisma.appointment.findFirst({
      where: {
        barbershopId: String(barbershopId),
        date: String(date),
        time: String(time),
        status: { in: ["pending", "confirmed"] },
      },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ error: "Ese horario ya está reservado" });

    const shop = await prisma.barbershop.findUnique({
      where: { id: String(barbershopId) },
      select: { defaultDepositPercentage: true, platformFee: true },
    });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const service = await prisma.service.findUnique({
      where: { id: String(serviceId) },
      select: { id: true, price: true, depositPercentage: true, name: true },
    });
    if (!service) return res.status(404).json({ error: "Servicio no encontrado" });

    const depositPct =
      service.depositPercentage != null ? service.depositPercentage : shop.defaultDepositPercentage;

    const price = Number(service.price || 0);
    const fee = Number(shop.platformFee || 200); // interno
    const depositAmount = Math.round((price * Number(depositPct || 0)) / 100 + fee);

    const created = await prisma.appointment.create({
      data: {
        barbershopId: String(barbershopId),
        serviceId: String(serviceId),
        date: String(date),
        time: String(time),
        customerName: String(customerName),
        customerPhone: String(customerPhone),
        customerEmail: customerEmail ? String(customerEmail) : null,
        notes: notes ? String(notes) : null,
        status: "pending",
        paymentStatus: "unpaid",
        depositAmount,
        platformFee: fee,
      },
    });

    return res.json({
      ok: true,
      appointment: created,
      depositAmount,
      depositPct,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando turno" });
  }
});

// =========================
// PRIVADO (OWNER): cambiar estado
// PUT /api/appointments/:id/status { status: confirmed|canceled|pending }
// =========================
router.put("/:id/status", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { id } = req.params;
    const { status } = req.body;

    const allowed = new Set(["pending", "confirmed", "canceled"]);
    if (!allowed.has(String(status))) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    // asegurar pertenencia
    const appt = await prisma.appointment.findUnique({
      where: { id: String(id) },
      select: { id: true, barbershopId: true },
    });

    if (!appt) return res.status(404).json({ error: "Turno no encontrado" });
    if (appt.barbershopId !== req.user.barbershopId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updated = await prisma.appointment.update({
      where: { id: String(id) },
      data: { status: String(status) },
    });

    return res.json({ ok: true, appointment: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error actualizando estado" });
  }
});

module.exports = router;

// appointments.js
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");
const { computeSlots } = require("./publicBooking");

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

    const myBarbershopId = req.user?.barbershopId;
    if (typeof myBarbershopId !== "number" || Number.isNaN(myBarbershopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    const where = { barbershopId: myBarbershopId };

    if (status) {
      where.status = String(status);
    }

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

    // Paginación (backward compatible: si no se envían parámetros, devuelve 50 por defecto)
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const pageNum = isNaN(rawPage) ? 1 : Math.max(1, rawPage);
    const limitNum = isNaN(rawLimit) ? 50 : Math.min(200, Math.max(1, rawLimit));
    const skip = (pageNum - 1) * limitNum;

    const [totalCount, items] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        orderBy: [{ date: "asc" }, { time: "asc" }],
        include: {
          service: { select: { id: true, name: true, durationMinutes: true } },
          barber: { select: { id: true, name: true } },
        },
        skip,
        take: limitNum,
      })
    ]);

    return res.json({ 
      items, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error listando turnos: " + e.message, stack: e.stack });
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

    const shopId = Number(barbershopId);
    if (Number.isNaN(shopId)) return res.status(400).json({ error: "barbershopId inválido" });

    const items = await prisma.appointment.findMany({
      where: { barbershopId: shopId },
      select: { id: true, date: true, time: true, status: true },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return res.json(items);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo turnos públicos" });
  }
});

// =========================
// ✅ PRIVADO (OWNER): crear turno manual desde admin
// POST /api/appointments/owner
// body: { serviceId, date, time, customerName, customerPhone?, customerEmail?, notes?, status? }
// =========================
router.post("/owner", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const myBarbershopId = req.user?.barbershopId;
    if (typeof myBarbershopId !== "number" || Number.isNaN(myBarbershopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    const {
      serviceId,
      barberId,
      date,
      time,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      status,
    } = req.body;

    if (!serviceId || !barberId || !date || !time || !customerName) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const srvId = Number(serviceId);
    const brbId = Number(barberId);
    if (Number.isNaN(srvId) || Number.isNaN(brbId)) return res.status(400).json({ error: "IDs inválidos" });

    // Verificar disponibilidad matemática estricta calculada (Fase 2)
    const out = await computeSlots({
      barbershopId: myBarbershopId,
      barberId: brbId,
      serviceId: srvId,
      date: String(date)
    });

    if (!out.slots.includes(String(time))) {
       return res.status(409).json({ error: "Ese horario generaría superposiciones o no cumple las franjas del barbero" });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: myBarbershopId },
      select: { defaultDepositPercentage: true, platformFee: true },
    });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const service = await prisma.service.findUnique({
      where: { id: srvId },
      select: { id: true, price: true, depositPercentage: true, name: true },
    });
    if (!service) return res.status(404).json({ error: "Servicio no encontrado" });

    const depositPct =
      service.depositPercentage != null ? service.depositPercentage : shop.defaultDepositPercentage;

    const price = Number(service.price || 0);
    const fee = Number(shop.platformFee ?? 200);
    const depositAmount = Math.round((price * Number(depositPct || 0)) / 100);
    const totalToPay = depositAmount + fee;

    // ✅ FIX: Solo estados UPPERCASE para evitar estados fantasma con el cron
    const allowedStatus = new Set(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED_EXPIRED", "CANCELLED_MANUAL"]);
    const finalStatus = allowedStatus.has(String(status)) ? String(status) : "CONFIRMED";

    const created = await prisma.appointment.create({
      data: {
        barbershopId: myBarbershopId,
        serviceId: srvId,
        barberId: brbId,
        date: String(date),
        time: String(time),
        customerName: String(customerName),
        customerPhone: customerPhone ? String(customerPhone) : null,
        customerEmail: customerEmail ? String(customerEmail) : null,
        notes: notes ? String(notes) : null,
        status: finalStatus,
        paymentStatus: "unpaid",
        depositPercentageAtBooking: Number(depositPct || 0),
        servicePrice: price,
        depositAmount,
        platformFee: fee,
      },
    });

    return res.json({ ok: true, appointment: created, depositAmount, depositPct, platformFee: fee, servicePrice: price });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando turno (owner)" });
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
      barberId,
      date,
      time,
      customerName,
      customerPhone,
      customerEmail,
      notes,
    } = req.body;

    if (!barbershopId || !serviceId || !barberId || !date || !time || !customerName || !customerPhone) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const shopId = Number(barbershopId);
    const srvId = Number(serviceId);
    const brbId = Number(barberId);
    if (Number.isNaN(shopId) || Number.isNaN(srvId) || Number.isNaN(brbId)) {
      return res.status(400).json({ error: "IDs inválidos" });
    }

    const out = await computeSlots({
      barbershopId: shopId,
      barberId: brbId,
      serviceId: srvId,
      date: String(date)
    });

    if (!out.slots.includes(String(time))) {
       return res.status(409).json({ error: "Ese horario se superpone o no cumple las franjas del barbero" });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: shopId },
      select: { defaultDepositPercentage: true, platformFee: true },
    });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const service = await prisma.service.findUnique({
      where: { id: srvId },
      select: { id: true, price: true, depositPercentage: true, name: true },
    });
    if (!service) return res.status(404).json({ error: "Servicio no encontrado" });

    const depositPct =
      service.depositPercentage != null ? service.depositPercentage : shop.defaultDepositPercentage;

    const price = Number(service.price || 0);
    const fee = Number(shop.platformFee ?? 200);
    const depositAmount = Math.round((price * Number(depositPct || 0)) / 100);
    const totalToPay = depositAmount + fee;

    const created = await prisma.appointment.create({
      data: {
        barbershopId: shopId,
        serviceId: srvId,
        barberId: brbId,
        date: String(date),
        time: String(time),
        customerName: String(customerName),
        customerPhone: String(customerPhone),
        customerEmail: customerEmail ? String(customerEmail) : null,
        notes: notes ? String(notes) : null,
        status: "CONFIRMED",
        paymentStatus: "unpaid",
        depositPercentageAtBooking: Number(depositPct || 0),
        servicePrice: price,
        depositAmount,
        platformFee: fee,
      },
    });

    return res.json({ ok: true, appointment: created, depositAmount, depositPct, platformFee: fee, servicePrice: price });
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

    // ✅ FIX: Solo estados UPPERCASE para consistencia
    const allowed = new Set(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED_EXPIRED", "CANCELLED_MANUAL"]);
    if (!allowed.has(String(status))) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const apptId = Number(id);
    if (Number.isNaN(apptId)) return res.status(400).json({ error: "ID inválido" });

    const appt = await prisma.appointment.findUnique({
      where: { id: apptId },
      select: { id: true, barbershopId: true },
    });

    if (!appt) return res.status(404).json({ error: "Turno no encontrado" });
    if (appt.barbershopId !== req.user.barbershopId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updated = await prisma.appointment.update({
      where: { id: apptId },
      data: { status: String(status) },
    });

    return res.json({ ok: true, appointment: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error actualizando estado" });
  }
});

module.exports = router;

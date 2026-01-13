// publicBooking.js
const express = require("express");
const prisma = require("./prisma");

const router = express.Router();

// ---------- helpers ----------
function isValidDateISO(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function isValidTime(t) {
  return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
function toMin(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}
function toTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function weekdayFromISO(dateISO) {
  // 0=Dom..6=Sáb
  const [y, mo, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getDay();
}
function todayISO() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function nowMinLocal() {
  const dt = new Date();
  return dt.getHours() * 60 + dt.getMinutes();
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// ---------- core: compute slots ----------
async function computeSlots({ barbershopId, serviceId, date, step = 15 }) {
  const service = await prisma.service.findFirst({
    where: { id: Number(serviceId), barbershopId: Number(barbershopId) },
    select: { id: true, durationMinutes: true, name: true, price: true },
  });
  if (!service) {
    const err = new Error("Servicio no encontrado para esta barbería");
    err.status = 404;
    throw err;
  }

  const wd = weekdayFromISO(date);

  const ranges = await prisma.workingHour.findMany({
    where: { barbershopId: Number(barbershopId), weekday: wd },
    orderBy: { startTime: "asc" },
    select: { startTime: true, endTime: true },
  });

  // Si está cerrado
  if (!ranges.length) {
    return { service, slots: [] };
  }

  // ✅ 4.1 Traer bloqueos del día (vacaciones / franjas bloqueadas)
  // Pegado justo después de: if (!ranges.length) return ...
  const blocks = await prisma.blockedTime.findMany({
    where: {
      barbershopId: Number(barbershopId),
      dateFrom: { lte: date },
      OR: [{ dateTo: null }, { dateTo: { gte: date } }],
    },
    select: { startTime: true, endTime: true },
  });

  // si hay un bloqueo día completo => no hay slots
  if (blocks.some(b => !b.startTime && !b.endTime)) {
    return { service, slots: [] };
  }

  const blockedIntervals = blocks
    .filter(b => b.startTime && b.endTime)
    .map(b => ({ start: toMin(b.startTime), end: toMin(b.endTime) }));

  // Turnos existentes del día (ignorar cancelados)
  const appts = await prisma.appointment.findMany({
    where: {
      barbershopId: Number(barbershopId),
      date,
      NOT: { status: "canceled" },
    },
    select: {
      time: true,
      service: { select: { durationMinutes: true } },
    },
  });

  const occupied = appts
    .filter(a => isValidTime(a.time))
    .map(a => {
      const s = toMin(a.time);
      const dur = Number(a.service?.durationMinutes || 30);
      return { start: s, end: s + dur };
    });

  const duration = Number(service.durationMinutes || 30);
  const slots = [];

  const isToday = date === todayISO();
  const minNow = isToday ? nowMinLocal() : -1;

  for (const r of ranges) {
    if (!isValidTime(r.startTime) || !isValidTime(r.endTime)) continue;

    let start = toMin(r.startTime);
    const end = toMin(r.endTime);

    // último inicio posible para que entre la duración
    const lastStart = end - duration;
    if (lastStart < start) continue;

    // si hoy, no ofrecer horas pasadas (con un margen de 0)
    if (isToday && start < minNow) {
      start = minNow;
      // redondeo al step
      start = Math.ceil(start / step) * step;
    }

    for (let t = start; t <= lastStart; t += step) {
      const candStart = t;
      const candEnd = t + duration;

      // ✅ 4.2 Excluir slots que choquen con bloqueos
      const conflictAppt = occupied.some(o => overlaps(candStart, candEnd, o.start, o.end));
      const conflictBlock = blockedIntervals.some(b => overlaps(candStart, candEnd, b.start, b.end));

      if (!conflictAppt && !conflictBlock) slots.push(toTime(candStart));
    }
  }

  return { service, slots };
}

// ---------- PUBLIC: info barbería por slug ----------
router.get("/:slug/barbershop", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const shop = await prisma.barbershop.findFirst({
      where: { slug },
      select: { id: true, name: true, city: true, address: true, phone: true, slug: true, defaultDepositPercentage: true, platformFee: true },
    });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });
    return res.json({ ok: true, item: shop });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo barbería" });
  }
});

// ---------- PUBLIC: listar servicios por slug ----------
router.get("/:slug/services", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const shop = await prisma.barbershop.findFirst({ where: { slug }, select: { id: true } });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const items = await prisma.service.findMany({
      where: { barbershopId: shop.id },
      orderBy: { id: "asc" },
      select: { id: true, name: true, price: true, durationMinutes: true, depositPercentage: true, description: true },
    });

    return res.json({ ok: true, items, barbershopId: shop.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error listando servicios" });
  }
});

// ---------- PUBLIC: disponibilidad por fecha ----------
router.get("/:slug/availability", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const { serviceId, date, step } = req.query;

    if (!serviceId) return res.status(400).json({ error: "Falta serviceId" });
    if (!isValidDateISO(String(date))) return res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });

    // no permitir fechas pasadas
    if (String(date) < todayISO()) return res.json({ ok: true, slots: [], reason: "past_date" });

    const shop = await prisma.barbershop.findFirst({ where: { slug }, select: { id: true } });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const out = await computeSlots({
      barbershopId: shop.id,
      serviceId: Number(serviceId),
      date: String(date),
      step: step ? Number(step) : 15,
    });

    return res.json({ ok: true, date: String(date), service: out.service, slots: out.slots });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || "Error calculando disponibilidad" });
  }
});

// ---------- PUBLIC: crear reserva ----------
router.post("/:slug/book", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const { serviceId, date, time, customerName, customerPhone, customerEmail, notes } = req.body || {};

    if (!serviceId) return res.status(400).json({ error: "Falta serviceId" });
    if (!isValidDateISO(String(date))) return res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    if (!isValidTime(String(time))) return res.status(400).json({ error: "Hora inválida (HH:MM)" });
    if (!customerName || String(customerName).trim().length < 2) return res.status(400).json({ error: "Falta nombre" });
    if (!customerPhone || String(customerPhone).trim().length < 6) return res.status(400).json({ error: "Falta teléfono" });

    if (String(date) < todayISO()) return res.status(400).json({ error: "No se puede reservar en fechas pasadas" });

    const shop = await prisma.barbershop.findFirst({
      where: { slug },
      select: { id: true, defaultDepositPercentage: true, platformFee: true },
    });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    // validar que el slot esté libre (recalcular)
    const out = await computeSlots({
      barbershopId: shop.id,
      serviceId: Number(serviceId),
      date: String(date),
      step: 15,
    });

    if (!out.slots.includes(String(time))) {
      return res.status(409).json({ error: "Ese horario ya no está disponible" });
    }

    // totalToPay / deposit: por ahora “snapshot” básico
    const depositPct = shop.defaultDepositPercentage || 15;
    const servicePrice = out.service.price || 0;
    const depositAmount = Math.round((servicePrice * depositPct) / 100);
    const platformFee = shop.platformFee || 0;
    const totalToPay = depositAmount + platformFee;

    const created = await prisma.appointment.create({
      data: {
        barbershopId: shop.id,
        serviceId: out.service.id,
        date: String(date),
        time: String(time),
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customerEmail ? String(customerEmail).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: "pending",
        paymentStatus: "unpaid",
        depositPercentageAtBooking: depositPct,
        depositAmount,
        platformFee,
        totalToPay,
      },
      select: { id: true },
    });

    return res.json({ ok: true, id: created.id });
  } catch (e) {
    // si justo colisionó el unique barbershopId+date+time
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Horario ocupado" });
    }
    console.error(e);
    return res.status(500).json({ error: "Error creando reserva" });
  }
});

module.exports = router;

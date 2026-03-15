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

// ---------- core: compute slots (Barber-Centric Continuous Engine) ----------
async function computeSlots({ barbershopId, barberId, serviceId, date }) {
  if (!barberId) {
    const err = new Error("Falta barberId para calcular turnos");
    err.status = 400;
    throw err;
  }

  const service = await prisma.service.findFirst({
    where: { id: Number(serviceId), barbershopId: Number(barbershopId) },
    select: { id: true, durationMinutes: true, name: true, price: true, depositPercentage: true },
  });
  if (!service) {
    const err = new Error("Servicio no encontrado para esta barbería");
    err.status = 404;
    throw err;
  }

  const wd = weekdayFromISO(date);

  // Buscar franjas de ESTE barbero (reemplaza old workingHour)
  const ranges = await prisma.barberWorkingHour.findMany({
    where: { barberId: Number(barberId), weekday: wd },
    orderBy: { startTime: "asc" },
    select: { startTime: true, endTime: true },
  });

  if (!ranges.length) {
    return { service, slots: [] }; // Barbero cerrado ese día
  }

  // Buscar bloqueos explícitos (ausencias por vacaciones o cortes manuales)
  const blocks = await prisma.barberBlockedTime.findMany({
    where: {
      barberId: Number(barberId),
      dateFrom: { lte: date },
      OR: [{ dateTo: null }, { dateTo: { gte: date } }],
    },
    select: { startTime: true, endTime: true },
  });

  if (blocks.some(b => !b.startTime && !b.endTime)) {
    return { service, slots: [] }; // Bloqueo de día completo
  }

  const blockedIntervals = blocks
    .filter(b => b.startTime && b.endTime)
    .map(b => ({ start: toMin(b.startTime), end: toMin(b.endTime) }));

  // Buscar los turnos ya ocupados de ESTE barbero en ESA fecha
  const appts = await prisma.appointment.findMany({
    where: {
      barberId: Number(barberId), // Filtro clave Fase 2
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
    })
    .sort((a, b) => a.start - b.start); // Ordenar cronológicamente vital para el algoritmo

  const duration = Number(service.durationMinutes || 30);
  const slots = [];

  const isToday = date === todayISO();
  const minNow = isToday ? nowMinLocal() : -1;

  for (const r of ranges) {
    if (!isValidTime(r.startTime) || !isValidTime(r.endTime)) continue;

    let cursor = toMin(r.startTime);
    const end = toMin(r.endTime);

    // Si es hoy, el cursor no puede iniciar en el pasado
    if (isToday && cursor < minNow) {
      cursor = minNow; 
    }

    // Iterar la franja laboral hasta que ya no quede espacio para un turno completo
    while (cursor + duration <= end) {
      const candStart = cursor;
      const candEnd = cursor + duration;

      // 1. Verificar si choca con algún bloqueo manual
      const isBlocked = blockedIntervals.some(b => overlaps(candStart, candEnd, b.start, b.end));
      
      if (isBlocked) {
         // Salto heurístico: avanzar el cursor al final del bloqueo para buscar del otro lado (simplificación por array length)
         cursor += duration; // Forzamos avance lineal 
         continue;
      }

      // 2. Verificar si choca con algún turno ocupado existente
      // Buscamos el primer turno ocupado que intercepte o viva de acá en más
      const upcomingAppt = occupied.find(o => candStart < o.end && candEnd > o.start);

      if (upcomingAppt) {
        // ¿Entra el servicio *antes* de que empiece este turno ocupado?
        if (candEnd <= upcomingAppt.start) {
            slots.push(toTime(candStart));
            cursor += duration; // Avance perfecto simbiótico
        } else {
            // No entra. Hubo colisión.
            // Regla Fase 2 estricta: Saltamos el cursor EXACTAMENTE al final del turno ocupado.
            cursor = upcomingAppt.end;
        }
      } else {
        // No hay choques por delante
        slots.push(toTime(candStart));
        cursor += duration; // Avance perfecto simbiótico del slot
      }
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

// ---------- PUBLIC: listar barberos activos por slug ----------
router.get("/:slug/members", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const shop = await prisma.barbershop.findFirst({ where: { slug }, select: { id: true } });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const members = await prisma.barber.findMany({
      where: { barbershopId: shop.id, isActive: true },
      include: { services: { select: { id: true } } },
      orderBy: { name: "asc" }
    });

    return res.json({ ok: true, members });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error listando barberos" });
  }
});

// ---------- PUBLIC: disponibilidad por fecha ----------
router.get("/:slug/availability", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const { barberId, serviceId, date } = req.query;

    if (!barberId) return res.status(400).json({ error: "Falta barberId" });
    if (!serviceId) return res.status(400).json({ error: "Falta serviceId" });
    if (!isValidDateISO(String(date))) return res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });

    // no permitir fechas pasadas
    if (String(date) < todayISO()) return res.json({ ok: true, slots: [], reason: "past_date" });

    const shop = await prisma.barbershop.findFirst({ where: { slug }, select: { id: true } });
    if (!shop) return res.status(404).json({ error: "Barbería no encontrada" });

    const out = await computeSlots({
      barbershopId: shop.id,
      barberId: Number(barberId),
      serviceId: Number(serviceId),
      date: String(date)
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
    const { barberId, serviceId, date, time, customerName, customerPhone, customerEmail, notes } = req.body || {};

    if (!barberId) return res.status(400).json({ error: "Falta barberId" });
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

    // validar que el slot estÃ© libre (recalcular con motor adaptativo)
    const out = await computeSlots({
      barbershopId: shop.id,
      barberId: Number(barberId),
      serviceId: Number(serviceId),
      date: String(date)
    });

    if (!out.slots.includes(String(time))) {
      return res.status(409).json({ error: "Ese horario ya no está disponible" });
    }

    // totalToPay / deposit: snapshot al momento de reservar
    const depositPct = out.service.depositPercentage ?? shop.defaultDepositPercentage ?? 15;
    const servicePrice = out.service.price || 0;
    const depositAmount = Math.round((servicePrice * depositPct) / 100);
    const platformFee = shop.platformFee ?? 0;
    const totalToPay = depositAmount + platformFee;

    const created = await prisma.appointment.create({
      data: {
        barbershopId: shop.id,
        serviceId: out.service.id,
        barberId: Number(barberId),
        date: String(date),
        time: String(time),
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customerEmail ? String(customerEmail).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: "pending",
        paymentStatus: "unpaid",
        depositPercentageAtBooking: depositPct,
        servicePrice,
        depositAmount,
        platformFee,
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

module.exports = { router, computeSlots };

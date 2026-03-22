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
function getArgTime() {
  // Obtenemos la fecha/hora actual en Argentina usando Intl para no fallar por 
  // la ubicación del servidor de Render (que suele estar en UTC).
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  
  // Construimos un objeto Date que represente el "ahora" en Argentina 
  // (aunque el sistema crea que es local, los valores numéricos serán los de ARG)
  return new Date(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function nowMinLocal() {
  const dt = getArgTime();
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
      status: true,
      lockExpiresAt: true,
      service: { select: { durationMinutes: true } },
    },
  });

  const nowLocal = new Date();

  const occupied = appts
    .filter(a => {
      // Si el turno está en pago, pero el lock expiró, lo ignoramos (vuelve a estar libre)
      if (a.status === "payment_pending" || a.status === "PENDING_PAYMENT") {
         return a.lockExpiresAt && new Date(a.lockExpiresAt) > nowLocal;
      }
      return true;
    })
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

      // PARCHE FASE 3: Solo redondeamos el inicio para no arrastrar "minutos raros" del reloj
      const remainder = cursor % 10;
      if (remainder !== 0) {
        cursor += (10 - remainder);
      }
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
      select: { id: true, name: true, city: true, address: true, phone: true, slug: true, defaultDepositPercentage: true, platformFee: true, logoBase64: true },
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

    const barber = await prisma.barber.findFirst({
      where: { id: Number(barberId) },
      select: { id: true, mpAccessToken: true, mpStatus: true, name: true }
    });
    if (!barber) return res.status(404).json({ error: "Barbero no encontrado" });

    // validar que el slot esté libre (recalcular con motor adaptativo y respetando locks)
    const out = await computeSlots({
      barbershopId: shop.id,
      barberId: Number(barberId),
      serviceId: Number(serviceId),
      date: String(date)
    });

    if (!out.slots.includes(String(time))) {
      return res.status(409).json({ error: "Ese horario ya no está disponible (alguien lo puede estar pagando ahora mismo)" });
    }

    // Cálculos económicos
    const depositPct = out.service.depositPercentage ?? shop.defaultDepositPercentage ?? 15;
    const servicePrice = out.service.price || 0;
    const depositAmount = Math.round((servicePrice * depositPct) / 100);
    const platformFee = shop.platformFee ?? 0;
    const totalToPay = depositAmount + platformFee;

    // Generar Referencia Única para MVP
    const externalReference = `BC_${shop.id}_${barber.id}_${Date.now()}`;
    // Lock temporal de 10 min
    const lockExpiresAt = new Date();
    lockExpiresAt.setMinutes(lockExpiresAt.getMinutes() + 10);

    // Evaluamos Camino A (Conectado) vs Camino B (Desconectado)
    const canChargeDeposit = (barber.mpStatus === "CONNECTED" && barber.mpAccessToken);
    const MP_ACCESS_TOKEN_OWNER = process.env.MP_ACCESS_TOKEN || ""; // El token de la plataforma SaaS (TÚ)
    
    // Si podemos cobrar seña, usamos el Token del Barbero. Si no, o cobramos solo Fee o lo dejamos pendiente.
    // Para simplificar: Si Camino B -> el turno nace directo PENDIENTE (Sujeto a Confirmación en el local).
    // OJO: El request pedía "cobrar solo el fee de la SaaS".
    // Para cobrar CUALQUIER COSA, usamos MP_ACCESS_TOKEN_OWNER. Si es Camino A, usamos split.
    
    let isSplitPayment = false;
    let finalAmountToCharge = 0;
    let finalTokenToUse = "";
    let finalStatus = "pending";
    let finalPaymentStatus = "unpaid";
    let preferenceId = null;
    let initPoint = null;

    if (canChargeDeposit) {
       // CAMINO A: Cobra Seña + Fee. Paga Barbero, Fee se dirige a vos vía marketplace_fee.
       isSplitPayment = true;
       finalAmountToCharge = totalToPay;
       finalTokenToUse = barber.mpAccessToken; // Se crea en nombre del barbero
       finalStatus = "PENDING_PAYMENT"; // Fase 7: Requiere pago para confirmarse
       finalPaymentStatus = "unpaid";
    } else {
       // CAMINO B: Presencial sin online fee
       finalStatus = "CONFIRMED"; // Fase 7: Se confirma en el local directo
       finalPaymentStatus = "unpaid";
       finalAmountToCharge = 0; // Sin cobro online
    }

    const created = await prisma.appointment.create({
      data: {
        barbershopId: shop.id,
        serviceId: out.service.id,
        barberId: barber.id,
        date: String(date),
        time: String(time),
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: customerEmail ? String(customerEmail).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: finalStatus,
        paymentStatus: finalPaymentStatus,
        paymentProvider: "mercadopago",
        externalReference: externalReference,
        lockExpiresAt: finalStatus === "PENDING_PAYMENT" ? lockExpiresAt : null,
        depositPercentageAtBooking: depositPct,
        servicePrice,
        depositAmount,
        platformFee,
      },
      select: { id: true },
    });

    if (isSplitPayment && finalTokenToUse) {
       // Llamada a MP para crear preferencia
       try {
           // 1) Determinar URLs reales (Fallback seguro a Producción real)
           const frontendBase = process.env.FRONTEND_URL || 'https://barberscloud.vercel.app';
           const backendBase = process.env.BACKEND_URL || 'https://barbercloud.onrender.com';

           const mpBody = {
             items: [
               {
                 title: `Reserva - ${out.service.name} con ${barber.name}`,
                 quantity: 1,
                 currency_id: "ARS",
                 unit_price: finalAmountToCharge
               }
             ],
             payer: {
               name: customerName,
               email: customerEmail || "cliente@barbercloud.com"
             },
             back_urls: {
               success: `${frontendBase}/payment-success.html?slug=${slug}&status=success`,
               failure: `${frontendBase}/payment-failure.html?slug=${slug}&status=failure`,
               pending: `${frontendBase}/payment-pending.html?slug=${slug}&status=pending`
             },
             auto_return: "approved",
             external_reference: externalReference,
             notification_url: `${backendBase}/api/payments/webhook?barberId=${barber.id}`,
             marketplace_fee: platformFee 
           };

         const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
           method: "POST",
           headers: {
             "Authorization": `Bearer ${finalTokenToUse}`,
             "Content-Type": "application/json"
           },
           body: JSON.stringify(mpBody)
         });

         const prefData = await mpRes.json();
         
         if (mpRes.ok && prefData.id) {
            preferenceId = prefData.id;
            initPoint = prefData.init_point;
            
            // Guardamos el paymentId/PrefId en la DB
            await prisma.appointment.update({
              where: { id: created.id },
              data: { paymentId: preferenceId }
            });
         } else {
            console.error("MP Preference Error:", prefData);
            // ❌ FASE 6 (DEBUG MOOD): Removemos el fallback temporalmente para ver POR QUÉ MP RECHAZA LA PREFERENCIA
            await prisma.appointment.delete({ where: { id: created.id } });
            return res.status(400).json({ 
              error: "Mercado Pago rechazó la preferencia de cobro. Razón: " + JSON.stringify(prefData)
            });
         }
       } catch (err) {
         console.error("Fetch MP Error:", err);
         await prisma.appointment.delete({ where: { id: created.id } });
         return res.status(500).json({ error: "No se pudo conectar con Mercado Pago: " + err.message });
       }
    } else if (finalDepositAmount > 0) {
       // Si tenía que cobrar pero barber.mpStatus no es CONNECTED o el token es falso
       await prisma.appointment.delete({ where: { id: created.id } });
       return res.status(400).json({ error: "El barbero no terminó de vincular Mercado Pago correctamente. mpStatus != CONNECTED" });
    }

    return res.json({ 
      ok: true, 
      id: created.id, 
      status: finalStatus,
      preferenceId: preferenceId,
      initPoint: initPoint,
      externalReference: externalReference,
      mpPublicKey: process.env.MP_PUBLIC_KEY || "APP_USR-8baed143-a602-4fd6-912f-614742be1508" // Token dummy publico de prueba si no hay env
    });

  } catch (e) {
    // si justo colisionó el unique barbershopId+date+time
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Horario ocupado" });
    }
    console.error(e);
    return res.status(500).json({ error: "Error creando reserva" });
  }
});

// =========================
// ✅ GET /api/public/appointment-by-preference/:prefId (Fase 7: Para ticket de éxito)
// =========================
router.get("/appointment-by-preference/:prefId", async (req, res) => {
  try {
    const { prefId } = req.params;
    const appt = await prisma.appointment.findUnique({
      where: { externalReference: prefId },
      include: {
        barber: { select: { name: true } },
        service: { select: { name: true } },
        barbershop: { select: { name: true, slug: true, platformFee: true } }
      }
    });

    if (!appt) return res.status(404).json({ error: "Turno no encontrado" });

    // Si el turno expiro justo antes o durante el pago, pero MP ya cobró,
    // podríamos regenerarlo o simplemente mostrarle que hable con el local.
    // Asumiremos que el webhook lo pasará a CONFIRMED o ya lo hizo.
    
    return res.json({
      id: appt.id,
      date: appt.date,
      time: appt.time,
      serviceName: appt.service?.name,
      barberName: appt.barber?.name,
      barbershopName: appt.barbershop?.name,
      slug: appt.barbershop?.slug,
      status: appt.status,
      depositAmount: appt.depositAmount,
      totalAmount: appt.servicePrice
    });
  } catch (err) {
    return res.status(500).json({ error: "Error interno" });
  }
});

module.exports = { router, computeSlots, todayISO, nowMinLocal };

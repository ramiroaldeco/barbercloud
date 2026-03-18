// blockedTimes.js — Barber-Centric (Fase 1 Estabilización)
// Gestiona bloqueos de tiempo por barbero (vacaciones, ausencias, etc.)
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

// GET /api/blocked-times/:barberId
// Lista bloqueos de un barbero específico
router.get("/:barberId", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const barberId = Number(req.params.barberId);
    if (!barberId || Number.isNaN(barberId)) {
      return res.status(400).json({ error: "barberId inválido" });
    }

    // Verificar que el barbero pertenece a mi barbería
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: req.user.barbershopId },
      select: { id: true },
    });
    if (!barber) return res.status(404).json({ error: "Barbero no encontrado" });

    const items = await prisma.barberBlockedTime.findMany({
      where: { barberId },
      orderBy: [{ dateFrom: "asc" }],
    });

    return res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo bloqueos" });
  }
});

// POST /api/blocked-times/:barberId
// Crear bloqueo para un barbero
router.post("/:barberId", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const barberId = Number(req.params.barberId);
    if (!barberId || Number.isNaN(barberId)) {
      return res.status(400).json({ error: "barberId inválido" });
    }

    // Verificar que el barbero pertenece a mi barbería
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: req.user.barbershopId },
      select: { id: true },
    });
    if (!barber) return res.status(404).json({ error: "Barbero no encontrado" });

    const { dateFrom, dateTo, startTime, endTime, reason } = req.body || {};

    if (!isValidDateISO(dateFrom)) {
      return res.status(400).json({ error: "dateFrom inválido (YYYY-MM-DD)" });
    }
    if (dateTo && !isValidDateISO(dateTo)) {
      return res.status(400).json({ error: "dateTo inválido (YYYY-MM-DD)" });
    }

    const dFrom = String(dateFrom);
    const dTo = dateTo ? String(dateTo) : null;
    if (dTo && dTo < dFrom) {
      return res.status(400).json({ error: "dateTo no puede ser menor a dateFrom" });
    }

    const s = startTime ? String(startTime) : null;
    const e2 = endTime ? String(endTime) : null;

    // Si mandan uno de los dos, tienen que mandar ambos
    if ((s && !e2) || (!s && e2)) {
      return res.status(400).json({ error: "Si bloqueás franja, mandá startTime y endTime" });
    }

    if (s && e2) {
      if (!isValidTime(s) || !isValidTime(e2)) {
        return res.status(400).json({ error: "Hora inválida (HH:MM)" });
      }
      if (toMin(e2) <= toMin(s)) {
        return res.status(400).json({ error: "endTime debe ser mayor que startTime" });
      }
    }

    const created = await prisma.barberBlockedTime.create({
      data: {
        barberId,
        dateFrom: dFrom,
        dateTo: dTo,
        startTime: s,
        endTime: e2,
        reason: reason ? String(reason).trim() : null,
      },
    });

    return res.json({ ok: true, item: created });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando bloqueo" });
  }
});

// DELETE /api/blocked-times/:barberId/:id
// Borrar un bloqueo específico de un barbero
router.delete("/:barberId/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const barberId = Number(req.params.barberId);
    const id = Number(req.params.id);
    if (!barberId || !id) return res.status(400).json({ error: "IDs inválidos" });

    // Verificar que el barbero pertenece a mi barbería
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: req.user.barbershopId },
      select: { id: true },
    });
    if (!barber) return res.status(404).json({ error: "Barbero no encontrado" });

    const found = await prisma.barberBlockedTime.findFirst({
      where: { id, barberId },
      select: { id: true },
    });
    if (!found) return res.status(404).json({ error: "Bloqueo no encontrado" });

    await prisma.barberBlockedTime.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error borrando bloqueo" });
  }
});

module.exports = router;

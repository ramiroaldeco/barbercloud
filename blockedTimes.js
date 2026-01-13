// blockedTimes.js
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

// GET /api/blocked-times/mine
router.get("/mine", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const items = await prisma.blockedTime.findMany({
      where: { barbershopId: req.user.barbershopId },
      orderBy: [{ dateFrom: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
    });

    return res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo bloqueos" });
  }
});

// POST /api/blocked-times/mine
router.post("/mine", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

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
    const e = endTime ? String(endTime) : null;

    // si mandan uno de los dos, tienen que mandar ambos
    if ((s && !e) || (!s && e)) {
      return res.status(400).json({ error: "Si bloqueás franja, mandá startTime y endTime" });
    }

    if (s && e) {
      if (!isValidTime(s) || !isValidTime(e)) {
        return res.status(400).json({ error: "Hora inválida (HH:MM)" });
      }
      if (toMin(e) <= toMin(s)) {
        return res.status(400).json({ error: "endTime debe ser mayor que startTime" });
      }
    }

    const created = await prisma.blockedTime.create({
      data: {
        barbershopId: req.user.barbershopId,
        dateFrom: dFrom,
        dateTo: dTo,
        startTime: s,
        endTime: e,
        reason: reason ? String(reason).trim() : null,
      },
    });

    return res.json({ ok: true, item: created });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando bloqueo" });
  }
});

// DELETE /api/blocked-times/mine/:id
router.delete("/mine/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    // seguridad: solo borrar si es de mi barbería
    const found = await prisma.blockedTime.findFirst({
      where: { id, barbershopId: req.user.barbershopId },
      select: { id: true },
    });
    if (!found) return res.status(404).json({ error: "Bloqueo no encontrado" });

    await prisma.blockedTime.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error borrando bloqueo" });
  }
});

module.exports = router;

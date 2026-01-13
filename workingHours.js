// workingHours.js
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

function isValidTime(t) {
  return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function normalizePayload(body) {
  // aceptamos {items:[...]} o {days:[{weekday,ranges:[{start,end}]}]}
  if (Array.isArray(body?.items)) return body.items;

  if (Array.isArray(body?.days)) {
    const out = [];
    for (const d of body.days) {
      const weekday = Number(d.weekday);
      const ranges = Array.isArray(d.ranges) ? d.ranges : [];
      for (const r of ranges) {
        out.push({
          weekday,
          startTime: r.start,
          endTime: r.end,
        });
      }
    }
    return out;
  }
  return null;
}

function validateItems(items) {
  if (!Array.isArray(items)) return "Formato inválido. Enviá {items:[...]}";

  // estructura + rangos por día
  const byDay = new Map();

  for (const it of items) {
    const weekday = Number(it.weekday);
    const startTime = it.startTime;
    const endTime = it.endTime;

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return "weekday inválido (0-6)";
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return "Hora inválida (formato HH:MM)";
    }
    if (toMin(startTime) >= toMin(endTime)) {
      return "Una franja tiene start >= end";
    }

    if (!byDay.has(weekday)) byDay.set(weekday, []);
    byDay.get(weekday).push({ startTime, endTime });
  }

  // no solapes
  for (const [weekday, ranges] of byDay.entries()) {
    ranges.sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1];
      const cur = ranges[i];
      if (toMin(cur.startTime) < toMin(prev.endTime)) {
        return `Solape de horarios en weekday=${weekday}`;
      }
    }
  }

  return null;
}

// GET /api/working-hours/mine
router.get("/mine", auth, async (req, res) => {
  try {
    const items = await prisma.workingHour.findMany({
      where: { barbershopId: req.user.barbershopId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      select: { id: true, weekday: true, startTime: true, endTime: true },
    });
    return res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo plantilla horaria" });
  }
});

// PUT /api/working-hours/mine
router.put("/mine", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const items = normalizePayload(req.body);
    const err = validateItems(items);
    if (err) return res.status(400).json({ error: err });

    await prisma.$transaction(async (tx) => {
      await tx.workingHour.deleteMany({
        where: { barbershopId: req.user.barbershopId },
      });

      if (items.length) {
        await tx.workingHour.createMany({
          data: items.map((it) => ({
            barbershopId: req.user.barbershopId,
            weekday: Number(it.weekday),
            startTime: String(it.startTime),
            endTime: String(it.endTime),
          })),
        });
      }
    });

    const saved = await prisma.workingHour.findMany({
      where: { barbershopId: req.user.barbershopId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      select: { id: true, weekday: true, startTime: true, endTime: true },
    });

    return res.json({ ok: true, items: saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error guardando plantilla horaria" });
  }
});

module.exports = router;

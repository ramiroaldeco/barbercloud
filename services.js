// services.js
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

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

// PUBLICO: listar servicios (booking)
router.get("/", async (req, res) => {
  try {
    const { barbershopId } = req.query;
    if (!barbershopId) return res.json([]);
    const bsId = toIntOrNull(barbershopId);
    if (bsId == null) return res.json([]);
    const items = await prisma.service.findMany({
      where: { barbershopId: bsId },
      orderBy: { id: "asc" }, // ✅ no existe createdAt
    });
    return res.json(items);
  } catch (e) {
    console.error("GET /services ERROR:", e);
    return res.status(500).json({ error: "Error listando servicios" });
  }
});

// PRIVADO: listar mis servicios
router.get("/mine", auth, async (req, res) => {
  try {
    const myShopId = req.user?.barbershopId;
    if (typeof myShopId !== "number" || isNaN(myShopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }
    const items = await prisma.service.findMany({
      where: { barbershopId: myShopId },
      orderBy: { id: "asc" },
    });
    return res.json({ items });
  } catch (e) {
    console.error("GET /services/mine ERROR:", e);
    return res.status(500).json({ error: "Error listando mis servicios" });
  }
});

// PRIVADO: crear servicio
router.post("/", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { name, price, durationMinutes, depositPercentage, description } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: "Falta name o price" });
    }
    const myShopId = req.user?.barbershopId;
    if (typeof myShopId !== "number" || isNaN(myShopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }
    const created = await prisma.service.create({
      data: {
        barbershopId: myShopId,
        name: String(name),
        price: Number(price),
        durationMinutes: durationMinutes != null ? Number(durationMinutes) : 30,
        depositPercentage: depositPercentage != null ? Number(depositPercentage) : null,
        description: description ? String(description) : null,
      },
    });
    return res.json({ ok: true, service: created });
  } catch (e) {
    console.error("POST /services ERROR:", e);
    return res.status(500).json({ error: "Error creando servicio" });
  }
});

// PRIVADO: editar servicio
router.put("/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { id } = req.params;
    const { name, price, durationMinutes, depositPercentage, description } = req.body;
    const myShopId = req.user?.barbershopId;
    if (typeof myShopId !== "number" || isNaN(myShopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }
    const srv = await prisma.service.findUnique({
      where: { id: Number(id) },
      select: { id: true, barbershopId: true },
    });
    if (!srv) return res.status(404).json({ error: "Servicio no encontrado" });
    if (srv.barbershopId !== myShopId) return res.status(403).json({ error: "No autorizado" });

    const updated = await prisma.service.update({
      where: { id: Number(id) },
      data: {
        ...(name != null ? { name: String(name) } : {}),
        ...(price != null ? { price: Number(price) } : {}),
        ...(durationMinutes != null ? { durationMinutes: Number(durationMinutes) } : {}),
        ...(depositPercentage !== undefined
          ? { depositPercentage: depositPercentage == null ? null : Number(depositPercentage) }
          : {}),
        ...(description !== undefined
          ? { description: description == null ? null : String(description) }
          : {}),
      },
    });

    return res.json({ ok: true, service: updated });
  } catch (e) {
    console.error("PUT /services/:id ERROR:", e);
    return res.status(500).json({ error: "Error editando servicio" });
  }
});

// PRIVADO: borrar servicio
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { id } = req.params;
    const myShopId = req.user?.barbershopId;
    if (typeof myShopId !== "number" || isNaN(myShopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }
    const srv = await prisma.service.findUnique({
      where: { id: Number(id) },
      select: { id: true, barbershopId: true },
    });
    if (!srv) return res.status(404).json({ error: "Servicio no encontrado" });
    if (srv.barbershopId !== myShopId) return res.status(403).json({ error: "No autorizado" });
    await prisma.service.delete({ where: { id: Number(id) } });
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /services/:id ERROR:", e);
    return res.status(500).json({ error: "Error borrando servicio" });
  }
});

module.exports = router;

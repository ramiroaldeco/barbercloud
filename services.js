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

// PUBLICO: listar servicios (para booking). Si no mandan barbershopId, devolvemos vacío (seguridad)
router.get("/", async (req, res) => {
  try {
    const { barbershopId } = req.query;
    if (!barbershopId) return res.json([]); // ⛔ evita filtrar todos los servicios del sistema

    const items = await prisma.service.findMany({
      where: { barbershopId: String(barbershopId) },
      orderBy: { createdAt: "asc" },
    });

    return res.json(items);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error listando servicios" });
  }
});

// PRIVADO: listar mis servicios
router.get("/mine", auth, async (req, res) => {
  try {
    const items = await prisma.service.findMany({
      where: { barbershopId: req.user.barbershopId },
      orderBy: { createdAt: "asc" },
    });
    return res.json(items);
  } catch (e) {
    console.error(e);
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

    const created = await prisma.service.create({
      data: {
        barbershopId: req.user.barbershopId,
        name: String(name),
        price: Number(price),
        durationMinutes: durationMinutes != null ? Number(durationMinutes) : 30,
        depositPercentage: depositPercentage != null ? Number(depositPercentage) : null,
        description: description ? String(description) : null,
      },
    });

    return res.json({ ok: true, service: created });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando servicio" });
  }
});

// PRIVADO: editar servicio
router.put("/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { id } = req.params;
    const { name, price, durationMinutes, depositPercentage, description } = req.body;

    const srv = await prisma.service.findUnique({
      where: { id: String(id) },
      select: { id: true, barbershopId: true },
    });
    if (!srv) return res.status(404).json({ error: "Servicio no encontrado" });
    if (srv.barbershopId !== req.user.barbershopId) return res.status(403).json({ error: "No autorizado" });

    const updated = await prisma.service.update({
      where: { id: String(id) },
      data: {
        ...(name != null ? { name: String(name) } : {}),
        ...(price != null ? { price: Number(price) } : {}),
        ...(durationMinutes != null ? { durationMinutes: Number(durationMinutes) } : {}),
        ...(depositPercentage !== undefined ? { depositPercentage: depositPercentage == null ? null : Number(depositPercentage) } : {}),
        ...(description !== undefined ? { description: description == null ? null : String(description) } : {}),
      },
    });

    return res.json({ ok: true, service: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error editando servicio" });
  }
});

// PRIVADO: borrar servicio
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { id } = req.params;

    const srv = await prisma.service.findUnique({
      where: { id: String(id) },
      select: { id: true, barbershopId: true },
    });
    if (!srv) return res.status(404).json({ error: "Servicio no encontrado" });
    if (srv.barbershopId !== req.user.barbershopId) return res.status(403).json({ error: "No autorizado" });

    await prisma.service.delete({ where: { id: String(id) } });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error borrando servicio" });
  }
});

module.exports = router;

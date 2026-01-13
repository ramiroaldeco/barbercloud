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
    // Obtenemos el barbershopId tal cual viene del token (Int)
    const myBarbershopId = req.user?.barbershopId;

    // 1) Validar token coherente
    if (typeof myBarbershopId !== "number" || isNaN(myBarbershopId)) {
      console.error("GET /services/mine: token sin barbershopId válido", { user: req.user });
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    // 2) Verificar que la barbería exista
    const shop = await prisma.barbershop.findUnique({
      where: { id: myBarbershopId },
      select: { id: true },
    });
    if (!shop) {
      return res.status(404).json({ error: "No tenés una barbería asociada a tu cuenta" });
    }

    // 3) Listar servicios de esa barbería
    const items = await prisma.service.findMany({
      where: { barbershopId: myBarbershopId },
      orderBy: { createdAt: "asc" },
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

    // extra guard (por si el token viene raro)
    const myBarbershopId = req.user?.barbershopId;
    if (typeof myBarbershopId !== "number" || isNaN(myBarbershopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    const created = await prisma.service.create({
      data: {
        barbershopId: myBarbershopId, // ✅ Int (sin String)
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

    const myShopId = req.user?.barbershopId; // ✅ sin String()

    if (typeof myShopId !== "number" || isNaN(myShopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    const srv = await prisma.service.findUnique({
      where: { id: Number(id) }, // ✅ id a Int
      select: { id: true, barbershopId: true },
    });
    if (!srv) return res.status(404).json({ error: "Servicio no encontrado" });
    if (srv.barbershopId !== myShopId) return res.status(403).json({ error: "No autorizado" });

    const updated = await prisma.service.update({
      where: { id: Number(id) }, // ✅ id a Int
      data: {
        ...(name != null ? { name: String(name) } : {}),
        ...(price != null ? { price: Number(price) } : {}),
        ...(durationMinutes != null ? { durationMinutes: Number(durationMinutes) } : {}),
        ...(depositPercentage !== undefined
          ? { depositPercentage: depositPercentage == null ? null : Number(depositPercentage) }
          : {}),
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

    const myShopId = req.user?.barbershopId; // ✅ sin String()

    if (typeof myShopId !== "number" || isNaN(myShopId)) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    const srv = await prisma.service.findUnique({
      where: { id: Number(id) }, // ✅ id a Int
      select: { id: true, barbershopId: true },
    });
    if (!srv) return res.status(404).json({ error: "Servicio no encontrado" });
    if (srv.barbershopId !== myShopId) return res.status(403).json({ error: "No autorizado" });

    await prisma.service.delete({ where: { id: Number(id) } }); // ✅ id a Int
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error borrando servicio" });
  }
});

module.exports = router;

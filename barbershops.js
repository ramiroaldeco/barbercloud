// barbershops.js
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

/**
 * (Opcional) Protección simple para crear barberías:
 * Si seteás PLATFORM_ADMIN_KEY en Render, vas a necesitar mandar el header:
 *   x-admin-key: TU_CLAVE
 * Si NO la seteás, el endpoint queda abierto (solo para pruebas).
 */
function requireAdminKeyIfConfigured(req, res) {
  const key = process.env.PLATFORM_ADMIN_KEY;
  if (!key) return true; // no configurado => abierto (modo demo)
  const sent = req.headers["x-admin-key"];
  if (sent !== key) {
    res.status(401).json({ error: "Falta x-admin-key o es incorrecta" });
    return false;
  }
  return true;
}

// Público: lista barberías (demo)
router.get("/", async (req, res) => {
  try {
    const barbershops = await prisma.barbershop.findMany({
      select: { id: true, name: true, city: true, address: true, phone: true },
      orderBy: { id: "asc" },
    });
    res.json(barbershops);
  } catch (err) {
    console.error("Error al obtener barberías:", err);
    res.status(500).json({ error: "Error al obtener barberías" });
  }
});

// Público (demo / onboarding manual): crear barbería
router.post("/", async (req, res) => {
  try {
    if (!requireAdminKeyIfConfigured(req, res)) return;

    const { name, city, address, phone } = req.body;

    if (!name || !city) {
      return res
        .status(400)
        .json({ error: "Faltan campos obligatorios: name, city" });
    }

    // Defaults recomendados
    const defaultDepositPercentage = 15; // recomendado 15%
    const platformFee = 200; // tu comisión por turno (pesos)

    const created = await prisma.barbershop.create({
      data: {
        name: String(name).trim(),
        city: String(city).trim(),
        address: address ? String(address).trim() : null,
        phone: phone ? String(phone).trim() : null,
        defaultDepositPercentage,
        platformFee,
      },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        defaultDepositPercentage: true,
        platformFee: true,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("Error al crear barbería:", err);
    res.status(500).json({ error: "Error al crear barbería" });
  }
});

// Privado: mi barbería (para panel admin)
router.get("/mine", auth, async (req, res) => {
  try {
    const barbershopId = req.user.barbershopId;

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        defaultDepositPercentage: true,
        platformFee: true,
      },
    });

    if (!barbershop)
      return res.status(404).json({ error: "Barbería no encontrada" });

    res.json(barbershop);
  } catch (err) {
    console.error("Error al obtener mi barbería:", err);
    res.status(500).json({ error: "Error al obtener mi barbería" });
  }
});

// Privado: actualizar settings (slider % seña + tu comisión fija)
router.put("/mine/settings", auth, async (req, res) => {
  try {
    // Solo owner (por ahora)
    if (req.user.role !== "owner") {
      return res.status(403).json({ error: "Sin permisos" });
    }

    const barbershopId = req.user.barbershopId;
    let { defaultDepositPercentage, platformFee } = req.body;

    if (defaultDepositPercentage !== undefined) {
      defaultDepositPercentage = Number(defaultDepositPercentage);
      if (Number.isNaN(defaultDepositPercentage))
        return res
          .status(400)
          .json({ error: "defaultDepositPercentage inválido" });
      if (defaultDepositPercentage < 0) defaultDepositPercentage = 0;
      if (defaultDepositPercentage > 100) defaultDepositPercentage = 100;
    }

    if (platformFee !== undefined) {
      platformFee = Number(platformFee);
      if (Number.isNaN(platformFee) || platformFee < 0)
        return res.status(400).json({ error: "platformFee inválido" });
    }

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        ...(defaultDepositPercentage !== undefined
          ? { defaultDepositPercentage }
          : {}),
        ...(platformFee !== undefined ? { platformFee } : {}),
      },
      select: {
        id: true,
        name: true,
        defaultDepositPercentage: true,
        platformFee: true,
      },
    });

    res.json({ ok: true, barbershop: updated });
  } catch (err) {
    console.error("Error al actualizar settings:", err);
    res.status(500).json({ error: "Error al actualizar settings" });
  }
});

module.exports = router;

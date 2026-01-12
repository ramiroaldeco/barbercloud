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
  if (!key) return true;
  const sent = req.headers["x-admin-key"];
  if (sent !== key) {
    res.status(401).json({ error: "Falta x-admin-key o es incorrecta" });
    return false;
  }
  return true;
}

function requireOwner(req, res) {
  if (!req.user || req.user.role !== "owner") {
    res.status(403).json({ error: "Solo el dueño puede realizar esta acción" });
    return false;
  }
  return true;
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Público: lista barberías (demo)
router.get("/", async (req, res) => {
  try {
    const barbershops = await prisma.barbershop.findMany({
      select: { id: true, name: true, city: true, address: true, phone: true, slug: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json(barbershops);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error listando barberías" });
  }
});

// Crear barbería (admin key opcional)
router.post("/", async (req, res) => {
  try {
    if (!requireAdminKeyIfConfigured(req, res)) return;

    const { name, city, address, phone, slug, defaultDepositPercentage, platformFee } = req.body;

    if (!name) return res.status(400).json({ error: "Falta name" });

    const finalSlug = slug ? slugify(slug) : null;

    if (finalSlug) {
      const exists = await prisma.barbershop.findUnique({ where: { slug: finalSlug } });
      if (exists) return res.status(409).json({ error: "Ese slug ya está en uso" });
    }

    const created = await prisma.barbershop.create({
      data: {
        name: String(name),
        city: city ? String(city) : null,
        address: address ? String(address) : null,
        phone: phone ? String(phone) : null,
        slug: finalSlug,
        defaultDepositPercentage: defaultDepositPercentage != null ? Number(defaultDepositPercentage) : 15,
        platformFee: platformFee != null ? Number(platformFee) : 200,
      },
    });

    return res.json({ ok: true, barbershop: created });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error creando barbería" });
  }
});

// Público: obtener barbería por slug
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const shop = await prisma.barbershop.findUnique({
      where: { slug: String(slug) },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        slug: true,
        defaultDepositPercentage: true,
      },
    });
    if (!shop) return res.status(404).json({ error: "No encontrada" });
    return res.json(shop);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo barbería" });
  }
});

// Privado: mi barbería
router.get("/mine", auth, async (req, res) => {
  try {
    const shop = await prisma.barbershop.findUnique({
      where: { id: req.user.barbershopId },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        slug: true,
        defaultDepositPercentage: true,
        platformFee: true, // existe pero el admin v2 NO la muestra
      },
    });
    if (!shop) return res.status(404).json({ error: "No encontrada" });
    return res.json(shop);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error obteniendo mi barbería" });
  }
});

// Privado: editar datos generales (SIN platformFee)
router.put("/mine", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { name, city, address, phone, slug } = req.body;

    let newSlug = undefined;
    if (slug !== undefined) {
      const s = slugify(slug);
      newSlug = s ? s : null;

      if (newSlug) {
        const exists = await prisma.barbershop.findUnique({ where: { slug: newSlug } });
        if (exists && exists.id !== req.user.barbershopId) {
          return res.status(409).json({ error: "Ese slug ya está en uso" });
        }
      }
    }

    const updated = await prisma.barbershop.update({
      where: { id: req.user.barbershopId },
      data: {
        ...(name !== undefined ? { name: String(name) } : {}),
        ...(city !== undefined ? { city: city == null ? null : String(city) } : {}),
        ...(address !== undefined ? { address: address == null ? null : String(address) } : {}),
        ...(phone !== undefined ? { phone: phone == null ? null : String(phone) } : {}),
        ...(slug !== undefined ? { slug: newSlug } : {}),
        // ⛔ platformFee NO se toca acá
      },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        slug: true,
        defaultDepositPercentage: true,
      },
    });

    return res.json({ ok: true, barbershop: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error guardando configuración" });
  }
});

// Privado: editar solo seña por defecto (SIN platformFee)
router.put("/mine/settings", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const { defaultDepositPercentage } = req.body;
    const pct = Number(defaultDepositPercentage);

    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: "defaultDepositPercentage inválido (0-100)" });
    }

    const updated = await prisma.barbershop.update({
      where: { id: req.user.barbershopId },
      data: { defaultDepositPercentage: pct },
      select: {
        id: true,
        defaultDepositPercentage: true,
      },
    });

    return res.json({ ok: true, barbershop: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error guardando seña" });
  }
});

module.exports = router;

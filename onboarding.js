// onboarding.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("./prisma");

const router = express.Router();

function cleanStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

// POST /api/onboarding/signup
// Crea barbershop + owner en un solo paso y devuelve token
router.post("/signup", async (req, res) => {
  try {
    const shopName = cleanStr(req.body.shopName);
    const city = cleanStr(req.body.city);
    const address = cleanStr(req.body.address) || null;
    const phone = cleanStr(req.body.phone) || null;

    const ownerName = cleanStr(req.body.ownerName);
    const email = cleanStr(req.body.email).toLowerCase();
    const password = cleanStr(req.body.password);

    // Validaciones mínimas
    if (!shopName || !city || !ownerName || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos: shopName, city, ownerName, email, password",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "JWT_SECRET no configurado en el servidor",
      });
    }

    // Si ya existe el email, cortamos
    const existing = await prisma.barbershopUser.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        ok: false,
        error: "Ese email ya está registrado.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Transacción: barbershop + user + servicios demo (opcional)
    const result = await prisma.$transaction(async (tx) => {
      const barbershop = await tx.barbershop.create({
        data: {
          name: shopName,
          city,
          address,
          phone,

          // defaults del SaaS (el dueño lo puede cambiar en el admin)
          defaultDepositPercentage: 15,
          platformFee: 200,
        },
      });

      const user = await tx.barbershopUser.create({
        data: {
          barbershopId: barbershop.id,
          name: ownerName,
          email,
          passwordHash,
          role: "owner",
        },
      });

      // Servicios demo básicos para que no quede vacío
      await tx.service.createMany({
        data: [
          {
            barbershopId: barbershop.id,
            name: "Corte",
            price: 4000,
            durationMinutes: 30,
            depositPercentage: null, // usa el default del local
          },
          {
            barbershopId: barbershop.id,
            name: "Corte + Barba",
            price: 5500,
            durationMinutes: 45,
            depositPercentage: null,
          },
        ],
      });

      return { barbershop, user };
    });

    const token = jwt.sign(
      {
        userId: result.user.id,
        barbershopId: result.barbershop.id,
        role: result.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return res.json({
      ok: true,
      token,
      barbershop: {
        id: result.barbershop.id,
        name: result.barbershop.name,
        city: result.barbershop.city,
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (err) {
    console.error("ONBOARDING SIGNUP ERROR:", err);
    return res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
});

module.exports = router;

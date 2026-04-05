// superadmin.js
// Panel de Super Administrador — Solo accesible por el dueño del SaaS
// Protegido por SUPER_ADMIN_PASS (env var) y JWT con rol 'superadmin'

const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("./prisma");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret_bc_2024";
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS;

// ─────────────────────────────────────────────────────────────
// Middleware: requiere JWT con rol 'superadmin'
// ─────────────────────────────────────────────────────────────
function requireSuperAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "No autorizado" });
  try {
    const payload = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    if (payload.role !== "superadmin") return res.status(403).json({ error: "Acceso denegado" });
    req.superadmin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/superadmin/login
// Body: { password: "..." }
// ─────────────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  if (!SUPER_ADMIN_PASS) {
    return res.status(503).json({ error: "SUPER_ADMIN_PASS no configurada en el servidor." });
  }
  const { password } = req.body || {};
  if (!password || password !== SUPER_ADMIN_PASS) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }
  const token = jwt.sign({ role: "superadmin" }, JWT_SECRET, { expiresIn: "8h" });
  return res.json({ token });
});

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/stats
// Métricas globales del SaaS
// ─────────────────────────────────────────────────────────────
router.get("/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [
      totalBarbershops,
      totalBarbers,
      totalAppointments,
      confirmedAppointments,
      paidAppointments,
      last7DaysAppointments,
    ] = await Promise.all([
      prisma.barbershop.count(),
      prisma.barber.count({ where: { isActive: true } }),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: "CONFIRMED" } }),
      prisma.appointment.count({ where: { paymentStatus: "paid" } }),
      prisma.appointment.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),
    ]);

    // Volumen total en señas pagadas
    const paidVolume = await prisma.appointment.aggregate({
      where: { paymentStatus: "paid" },
      _sum: { depositAmount: true }
    });

    // Fee total cobrado (plataforma)
    const feeVolume = await prisma.appointment.aggregate({
      where: { paymentStatus: "paid" },
      _sum: { platformFee: true }
    });

    // Clientes únicos por teléfono
    const uniquePhones = await prisma.appointment.findMany({
      select: { customerPhone: true },
      distinct: ["customerPhone"],
      where: { customerPhone: { not: "" } }
    });

    return res.json({
      totalBarbershops,
      totalBarbers,
      totalAppointments,
      confirmedAppointments,
      paidAppointments,
      last7DaysAppointments,
      uniqueCustomers: uniquePhones.length,
      totalDepositVolume: paidVolume._sum.depositAmount || 0,
      totalFeeVolume: feeVolume._sum.platformFee || 0,
    });
  } catch (err) {
    console.error("[SuperAdmin] Error en stats:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/superadmin/barbershops
// Lista de todas las barberías con stats
// ─────────────────────────────────────────────────────────────
router.get("/barbershops", requireSuperAdmin, async (req, res) => {
  try {
    const shops = await prisma.barbershop.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        platformFee: true,
        defaultDepositPercentage: true,
        _count: {
          select: {
            barbers: true,
            appointments: true,
          }
        }
      },
      orderBy: { id: "desc" }
    });

    // Para cada barbería, contar turnos confirmados y volumen de señas
    const enriched = await Promise.all(shops.map(async (shop) => {
      const [confirmed, volume] = await Promise.all([
        prisma.appointment.count({
          where: { barbershopId: shop.id, status: "CONFIRMED" }
        }),
        prisma.appointment.aggregate({
          where: { barbershopId: shop.id, paymentStatus: "paid" },
          _sum: { depositAmount: true, platformFee: true }
        })
      ]);
      return {
        ...shop,
        confirmedAppointments: confirmed,
        totalDepositVolume: volume._sum.depositAmount || 0,
        totalFeeCollected: volume._sum.platformFee || 0,
      };
    }));

    return res.json({ items: enriched });
  } catch (err) {
    console.error("[SuperAdmin] Error en barbershops:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/superadmin/barbershops/:id/fee
// Editar el platformFee de una barbería
// Body: { platformFee: 200 }
// ─────────────────────────────────────────────────────────────
router.patch("/barbershops/:id/fee", requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { platformFee } = req.body || {};
  if (isNaN(id) || platformFee === undefined || isNaN(Number(platformFee))) {
    return res.status(400).json({ error: "id o platformFee inválidos" });
  }
  try {
    const updated = await prisma.barbershop.update({
      where: { id },
      data: { platformFee: Number(platformFee) },
      select: { id: true, name: true, platformFee: true }
    });
    console.log(`[SuperAdmin] Fee actualizado: Barbería ${updated.name} → $${updated.platformFee}`);
    return res.json({ ok: true, ...updated });
  } catch (err) {
    console.error("[SuperAdmin] Error actualizando fee:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

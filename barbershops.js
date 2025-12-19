// barbershops.js
const express = require('express');
const prisma = require('./prisma');
const auth = require('./authMiddleware');

const router = express.Router();

// Público: lista barberías (demo)
router.get('/', async (req, res) => {
  try {
    const barbershops = await prisma.barbershop.findMany({
      select: { id: true, name: true, city: true, address: true, phone: true }
    });
    res.json(barbershops);
  } catch (err) {
    console.error('Error al obtener barberías:', err);
    res.status(500).json({ error: 'Error al obtener barberías' });
  }
});

// Privado: mi barbería (para panel admin)
router.get('/mine', auth, async (req, res) => {
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

    if (!barbershop) return res.status(404).json({ error: 'Barbería no encontrada' });

    res.json(barbershop);
  } catch (err) {
    console.error('Error al obtener mi barbería:', err);
    res.status(500).json({ error: 'Error al obtener mi barbería' });
  }
});

// Privado: actualizar settings (slider % seña + tu comisión fija)
router.put('/mine/settings', auth, async (req, res) => {
  try {
    // Solo owner (por ahora)
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const barbershopId = req.user.barbershopId;
    let { defaultDepositPercentage, platformFee } = req.body;

    if (defaultDepositPercentage !== undefined) {
      defaultDepositPercentage = Number(defaultDepositPercentage);
      if (Number.isNaN(defaultDepositPercentage)) return res.status(400).json({ error: 'defaultDepositPercentage inválido' });
      if (defaultDepositPercentage < 0) defaultDepositPercentage = 0;
      if (defaultDepositPercentage > 100) defaultDepositPercentage = 100;
    }

    if (platformFee !== undefined) {
      platformFee = Number(platformFee);
      if (Number.isNaN(platformFee) || platformFee < 0) return res.status(400).json({ error: 'platformFee inválido' });
    }

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        ...(defaultDepositPercentage !== undefined ? { defaultDepositPercentage } : {}),
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
    console.error('Error al actualizar settings:', err);
    res.status(500).json({ error: 'Error al actualizar settings' });
  }
});

module.exports = router;

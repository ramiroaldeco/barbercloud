// services.js
const express = require('express');
const prisma = require('./prisma');
const auth = require('./authMiddleware');

const router = express.Router();

// Público: listar servicios (por barbería)
router.get('/', async (req, res) => {
  try {
    const barbershopId = req.query.barbershopId ? Number(req.query.barbershopId) : null;

    const services = await prisma.service.findMany({
      where: barbershopId ? { barbershopId } : {},
      select: {
        id: true,
        barbershopId: true,
        name: true,
        price: true,
        durationMinutes: true,
        depositPercentage: true,
      },
    });

    res.json(services);
  } catch (err) {
    console.error('Error al obtener servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

// Privado: crear servicio
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Sin permisos' });

    const barbershopId = req.user.barbershopId;
    let { name, price, durationMinutes, depositPercentage } = req.body;

    if (!name || price === undefined) return res.status(400).json({ error: 'Faltan datos' });

    price = Number(price);
    if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: 'price inválido' });

    durationMinutes = durationMinutes === undefined ? 30 : Number(durationMinutes);
    if (Number.isNaN(durationMinutes) || durationMinutes <= 0) return res.status(400).json({ error: 'durationMinutes inválido' });

    if (depositPercentage !== undefined && depositPercentage !== null && depositPercentage !== '') {
      depositPercentage = Number(depositPercentage);
      if (Number.isNaN(depositPercentage)) return res.status(400).json({ error: 'depositPercentage inválido' });
      if (depositPercentage < 0) depositPercentage = 0;
      if (depositPercentage > 100) depositPercentage = 100;
    } else {
      depositPercentage = null; // usa default de la barbería
    }

    const service = await prisma.service.create({
      data: {
        barbershopId,
        name,
        price,
        durationMinutes,
        depositPercentage,
      },
    });

    res.json({ ok: true, service });
  } catch (err) {
    console.error('Error al crear servicio:', err);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

module.exports = router;

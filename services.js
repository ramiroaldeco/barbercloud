// Backend/services.js
const express = require('express');
const prisma = require('./prisma');

const router = express.Router();

// GET /api/services?barbershopId=1
router.get('/', async (req, res) => {
  try {
    const { barbershopId } = req.query;

    const where = {};
    if (barbershopId) {
      where.barbershopId = Number(barbershopId);
    }

    const services = await prisma.service.findMany({ where });
    res.json(services);
  } catch (err) {
    console.error('Error al obtener servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

module.exports = router;

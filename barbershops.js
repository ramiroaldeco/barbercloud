// barbershops.js
const express = require('express');
const prisma = require('./prisma');

const router = express.Router();

// GET /api/barbershops
router.get('/', async (req, res) => {
  try {
    const shops = await prisma.barbershop.findMany();
    res.json(shops);
  } catch (err) {
    console.error('Error al obtener barberías:', err);
    res.status(500).json({ error: 'Error al obtener barberías' });
  }
});

module.exports = router;

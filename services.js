const express = require('express');
const router = express.Router();

// Servicios de ejemplo (más adelante habrá tabla services)
const services = [
  { id: 1, barbershopId: 1, name: 'Corte clásico', durationMinutes: 30, price: 5000 },
  { id: 2, barbershopId: 1, name: 'Corte + Barba', durationMinutes: 45, price: 8000 },
];

// GET /api/services?barbershopId=1
router.get('/', (req, res) => {
  const barbershopId = Number(req.query.barbershopId);
  if (barbershopId) {
    return res.json(services.filter((s) => s.barbershopId === barbershopId));
  }
  res.json(services);
});

module.exports = router;

const express = require('express');
const router = express.Router();

// Datos de prueba (después esto será BD)
const barbershops = [
  {
    id: 1,
    name: 'Barbería Demo',
    city: 'Hernando',
    address: 'Calle Falsa 123',
    phone: '+54 9 351 111 2222',
  },
];

// GET /api/barbershops
router.get('/', (req, res) => {
  res.json(barbershops);
});

// GET /api/barbershops/:id
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const shop = barbershops.find((b) => b.id === id);
  if (!shop) return res.status(404).json({ error: 'Barbería no encontrada' });
  res.json(shop);
});

module.exports = router;

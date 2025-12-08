const express = require('express');
const router = express.Router();

const services = [
  { id: 1, barbershopId: 1, name: 'Corte clásico', price: 4000 },
  { id: 2, barbershopId: 1, name: 'Degradé + barba', price: 5500 },
  { id: 3, barbershopId: 1, name: 'Afeitado completo', price: 3500 }
];

router.get('/', (req, res) => {
  const { barbershopId } = req.query;
  let result = services;

  if (barbershopId) {
    result = services.filter(
      (s) => s.barbershopId === Number(barbershopId)
    );
  }

  res.json(result);
});

module.exports = router;

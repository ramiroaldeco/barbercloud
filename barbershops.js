const express = require('express');
const router = express.Router();

const barbershops = [
  {
    id: 1,
    name: 'Barbería Demo',
    city: 'Hernando',
    address: 'Calle Falsa 123',
    phone: '+54 9 351 111 2222'
  }
];

router.get('/', (req, res) => {
  res.json(barbershops);
});

module.exports = router;

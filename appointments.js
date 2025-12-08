const express = require('express');
const router = express.Router();

// Turnos en memoria por ahora
let appointments = [];
let nextId = 1;

// GET /api/appointments (solo para probar)
router.get('/', (req, res) => {
  res.json(appointments);
});

// POST /api/appointments
// body: { barbershopId, serviceId, customerName, customerPhone, date, time }
router.post('/', (req, res) => {
  const { barbershopId, serviceId, customerName, customerPhone, date, time } = req.body;

  if (!barbershopId || !serviceId || !customerName || !customerPhone || !date || !time) {
    return res.status(400).json({ error: 'Faltan datos del turno' });
  }

  const newAppointment = {
    id: nextId++,
    barbershopId,
    serviceId,
    customerName,
    customerPhone,
    date,          // '2025-12-10'
    time,          // '15:30'
    status: 'pending_payment', // después lo cambiamos cuando pague la seña
    createdAt: new Date().toISOString(),
  };

  appointments.push(newAppointment);

  res.status(201).json(newAppointment);
});

module.exports = router;

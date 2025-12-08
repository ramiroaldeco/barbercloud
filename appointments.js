const express = require('express');
const router = express.Router();

const appointments = [];

router.get('/', (req, res) => {
  res.json(appointments);
});

router.post('/', (req, res) => {
  const {
    barbershopId,
    serviceId,
    customerName,
    customerPhone,
    date,
    time
  } = req.body;

  if (
    !barbershopId ||
    !serviceId ||
    !customerName ||
    !customerPhone ||
    !date ||
    !time
  ) {
    return res.status(400).json({ error: 'Faltan datos del turno' });
  }

  const newAppointment = {
    id: appointments.length + 1,
    barbershopId,
    serviceId,
    customerName,
    customerPhone,
    date,
    time,
    createdAt: new Date().toISOString()
  };

  appointments.push(newAppointment);
  res.status(201).json(newAppointment);
});

module.exports = router;

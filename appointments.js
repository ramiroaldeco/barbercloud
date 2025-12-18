const auth = require('./authMiddleware');

// Backend/appointments.js
const express = require('express');
const prisma = require('./prisma');

const router = express.Router();

// GET /api/appointments  (para debug / después panel admin)
router.get('/', async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(appointments);
  } catch (err) {
    console.error('Error al obtener turnos:', err);
    res.status(500).json({ error: 'Error al obtener turnos' });
  }
});

// POST /api/appointments  (lo que usa tu formulario)
router.post('/', async (req, res) => {
  try {
    const {
      barbershopId,
      serviceId,
      customerName,
      customerPhone,
      date,
      time,
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

    const appointment = await prisma.appointment.create({
      data: {
        barbershopId: Number(barbershopId),
        serviceId: Number(serviceId),
        customerName,
        customerPhone,
        date,
        time,
      },
    });

    res.status(201).json(appointment);
  } catch (err) {
    console.error('Error al crear turno:', err);
    res.status(500).json({ error: 'Error al crear turno' });
  }
});

module.exports = router;
// Turnos de la barbería del usuario logueado
router.get('/mine', auth, async (req, res) => {
  try {
    const barbershopId = req.user.barbershopId;

    const appointments = await prisma.appointment.findMany({
      where: { barbershopId },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
      include: {
        barbershop: true,
        service: true,
      },
    });

    res.json(appointments);
  } catch (err) {
    console.error('Error en GET /appointments/mine', err);
    res.status(500).json({ error: 'Error al cargar los turnos de la barbería' });
  }
});


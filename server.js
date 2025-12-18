require('dotenv').config();
const express = require('express');
const cors = require('cors');

const barbershopRoutes = require('./barbershops');
const serviceRoutes = require('./services');
const appointmentRoutes = require('./appointments');
const authRoutes = require('./auth');   // 👈 NUEVO

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BarberCloud API funcionando 🚀' });
});

app.use('/api/auth', authRoutes);           // 👈 NUEVO
app.use('/api/barbershops', barbershopRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en http://localhost:${PORT}`);
});

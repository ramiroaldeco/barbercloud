require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Rutas
const barbershopRoutes = require('./barbershops.js');
const serviceRoutes = require('./services.js');
const appointmentRoutes = require('./appointments.js');

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint de prueba principal
app.get('/', (req, res) => {
  res.send('BarberCloud API OK');
});

// Endpoint de health (opcional, para chequear en Render)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BarberCloud API funcionando 🚀' });
});

// Rutas principales de la API
app.use('/api/barbershops', barbershopRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);

// Puerto (Render usa process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en http://localhost:${PORT}`);
});

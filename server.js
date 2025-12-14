// Backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const barbershopRoutes = require('./barbershops');
const serviceRoutes = require('./services');
const appointmentRoutes = require('./appointments');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Endpoint de prueba
app.get('/', (req, res) => {
  res.send('BarberCloud API OK');
});

// Rutas principales
app.use('/api/barbershops', barbershopRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);

app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en http://localhost:${PORT}`);
});

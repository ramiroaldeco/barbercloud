require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Endpoint de prueba
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BarberCloud API funcionando 🚀' });
});

app.listen(PORT, () => {
  console.log(`Servidor BarberCloud escuchando en http://localhost:${PORT}`);
});

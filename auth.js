// auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const router = express.Router();

// Register (owner)
router.post('/register', async (req, res) => {
  try {
    const { barbershopId, name, email, password } = req.body;

    if (!barbershopId || !name || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const existing = await prisma.barbershopUser.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.barbershopUser.create({
      data: {
        barbershopId: Number(barbershopId),
        name,
        email,
        passwordHash,
        role: 'owner',
      },
      select: { id: true, name: true, email: true, barbershopId: true, role: true },
    });

    res.json({ ok: true, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

    const user = await prisma.barbershopUser.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { userId: user.id, barbershopId: user.barbershopId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, barbershopId: user.barbershopId, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;

// auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// REGISTRO de usuario de barbería
// Por ahora lo vas a usar vos con Postman/Insomnia, después hacemos pantallita.
router.post('/register', async (req, res) => {
  try {
    const { barbershopId, name, email, password } = req.body;

    if (!barbershopId || !name || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const existing = await prisma.barbershopUser.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.barbershopUser.create({
      data: {
        barbershopId: Number(barbershopId),
        name,
        email,
        passwordHash,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      barbershopId: user.barbershopId,
      role: user.role,
    });
  } catch (err) {
    console.error('Error en /auth/register', err);
    res.status(500).json({ error: 'Error interno en el registro' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
	   console.log('REQ BODY EN /auth/register:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    const user = await prisma.barbershopUser.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ error: 'Usuario o contraseña inválidos' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: 'Usuario o contraseña inválidos' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        barbershopId: user.barbershopId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        barbershopId: user.barbershopId,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error en /auth/login', err);
    res.status(500).json({ error: 'Error interno en el login' });
  }
});

module.exports = router;

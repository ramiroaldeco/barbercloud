// prisma/seed.js
const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

async function main() {
  // 1) Barbería demo
  const barbershop = await prisma.barbershop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Barbería Demo - Hernando',
      city: 'Hernando',
      defaultDepositPercentage: 15,
      platformFee: 200,
    },
  });

  // 2) Servicios demo
  const existingServices = await prisma.service.findMany({ where: { barbershopId: barbershop.id } });

  if (existingServices.length === 0) {
    await prisma.service.createMany({
      data: [
        { barbershopId: barbershop.id, name: 'Corte', price: 7000, durationMinutes: 30, depositPercentage: null },
        { barbershopId: barbershop.id, name: 'Corte + Barba', price: 9000, durationMinutes: 45, depositPercentage: null },
      ],
    });
  }

  // 3) Usuario owner demo
  const email = 'demo@barbercloud.com';
  const existingUser = await prisma.barbershopUser.findUnique({ where: { email } });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('123456', 10);
    await prisma.barbershopUser.create({
      data: {
        barbershopId: barbershop.id,
        name: 'Owner Demo',
        email,
        passwordHash,
        role: 'owner',
      },
    });
  }

  console.log('✅ Seed completado');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

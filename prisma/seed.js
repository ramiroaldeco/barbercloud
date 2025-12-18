// Backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Barbería de ejemplo con servicios
  const barberia = await prisma.barbershop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Barbería Demo - Hernando',
      city: 'Hernando',
      services: {
        create: [
          { name: 'Corte clásico', price: 4000 },
          { name: 'Degradé + barba', price: 5500 },
        ],
      },
    },
    include: { services: true },
  });

  console.log('Seed OK:', barberia);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

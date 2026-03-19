require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Barbershop" ADD COLUMN "logoBase64" TEXT;`);
    console.log("Column logoBase64 added to Barbershop");
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log("Column logoBase64 already exists");
    } else {
      console.error(e);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

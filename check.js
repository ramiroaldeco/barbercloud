const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const b = await prisma.barber.findMany({ select: { id: true, name: true, mpStatus: true, mpAccessToken: true } });
  console.log("BARBERS:", b);
}
check().catch(console.error).finally(()=>prisma.$disconnect());

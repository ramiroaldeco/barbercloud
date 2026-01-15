-- CreateTable
CREATE TABLE "BlockedTime" (
  "id" SERIAL PRIMARY KEY,
  "barbershopId" INTEGER NOT NULL,
  "dateFrom" TEXT NOT NULL,
  "dateTo" TEXT,
  "startTime" TEXT,
  "endTime" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ForeignKey
ALTER TABLE "BlockedTime"
ADD CONSTRAINT "BlockedTime_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Index (para filtrar rápido por barbería + rango)
CREATE INDEX "BlockedTime_barbershopId_dateFrom_dateTo_idx"
ON "BlockedTime" ("barbershopId", "dateFrom", "dateTo");

-- ============================================================
-- MIGRACIÓN: Alinear schema Prisma con DB de producción
-- Fecha: 2026-03-18
-- Objetivo Fase 1: Crear tablas faltantes del módulo Barber,
-- agregar columnas faltantes, y corregir constraints.
-- ============================================================

-- ==================== 1. CREAR TABLA BARBER ====================
CREATE TABLE IF NOT EXISTS "Barber" (
  "id" SERIAL PRIMARY KEY,
  "barbershopId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "avatarBase64" TEXT,
  "role" TEXT NOT NULL DEFAULT 'Barbero',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Barber_barbershopId_fkey"
    FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ==================== 2. CREAR TABLA BARBER WORKING HOUR ====================
CREATE TABLE IF NOT EXISTS "BarberWorkingHour" (
  "id" SERIAL PRIMARY KEY,
  "barberId" INTEGER NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,

  CONSTRAINT "BarberWorkingHour_barberId_fkey"
    FOREIGN KEY ("barberId") REFERENCES "Barber"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique: un barbero no puede tener la misma franja duplicada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'BarberWorkingHour_barberId_weekday_startTime_endTime_key'
  ) THEN
    CREATE UNIQUE INDEX "BarberWorkingHour_barberId_weekday_startTime_endTime_key"
      ON "BarberWorkingHour"("barberId", "weekday", "startTime", "endTime");
  END IF;
END $$;

-- ==================== 3. CREAR TABLA BARBER BLOCKED TIME ====================
CREATE TABLE IF NOT EXISTS "BarberBlockedTime" (
  "id" SERIAL PRIMARY KEY,
  "barberId" INTEGER NOT NULL,
  "dateFrom" TEXT NOT NULL,
  "dateTo" TEXT,
  "startTime" TEXT,
  "endTime" TEXT,
  "reason" TEXT,

  CONSTRAINT "BarberBlockedTime_barberId_fkey"
    FOREIGN KEY ("barberId") REFERENCES "Barber"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==================== 4. CREAR TABLA PIVOT _BarberToService ====================
-- Prisma usa tablas implícitas _ModelAToModelB (orden alfabético)
CREATE TABLE IF NOT EXISTS "_BarberToService" (
  "A" INTEGER NOT NULL,
  "B" INTEGER NOT NULL,

  CONSTRAINT "_BarberToService_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Barber"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "_BarberToService_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Service"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Prisma requiere un unique index en (A, B) y un index en B
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = '_BarberToService_AB_unique'
  ) THEN
    CREATE UNIQUE INDEX "_BarberToService_AB_unique" ON "_BarberToService"("A", "B");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = '_BarberToService_B_index'
  ) THEN
    CREATE INDEX "_BarberToService_B_index" ON "_BarberToService"("B");
  END IF;
END $$;

-- ==================== 5. COLUMNAS FALTANTES EN SERVICE ====================
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- ==================== 6. COLUMNAS FALTANTES EN APPOINTMENT ====================
-- barberId: inicialmente nullable para no romper datos existentes, luego NOT NULL
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "barberId" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "servicePrice" INTEGER NOT NULL DEFAULT 0;

-- FK de barberId a Barber
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_barberId_fkey'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_barberId_fkey"
      FOREIGN KEY ("barberId") REFERENCES "Barber"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ==================== 7. CORREGIR UNIQUE CONSTRAINT EN APPOINTMENT ====================
-- Quitar el viejo unique (barbershopId, date, time) que era incorrecto
-- y agregar el correcto (barberId, date, time) — barber-centric
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_barbershopId_date_time_key'
  ) THEN
    ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_barbershopId_date_time_key";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_barberId_date_time_key'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_barberId_date_time_key"
      UNIQUE ("barberId", "date", "time");
  END IF;
END $$;

-- ==================== FIN DE MIGRACIÓN ====================

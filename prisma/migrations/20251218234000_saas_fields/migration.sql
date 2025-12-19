-- Barbershop: defaults del SaaS
ALTER TABLE "Barbershop"
  ADD COLUMN IF NOT EXISTS "defaultDepositPercentage" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "Barbershop"
  ADD COLUMN IF NOT EXISTS "platformFee" INTEGER NOT NULL DEFAULT 200;

-- Service: duración + % opcional
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "depositPercentage" INTEGER;

-- Appointment: estados + snapshot de cobro
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid';

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "depositPercentageAtBooking" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "depositAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "platformFee" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "totalToPay" INTEGER NOT NULL DEFAULT 0;

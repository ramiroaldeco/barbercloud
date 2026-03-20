-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "paymentProvider" TEXT DEFAULT 'mercadopago',
ADD COLUMN "paymentId" TEXT,
ADD COLUMN "externalReference" TEXT,
ADD COLUMN "lockExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Barber" ADD COLUMN "mpAccessToken" TEXT,
ADD COLUMN "mpUserId" TEXT,
ADD COLUMN "mpRefreshToken" TEXT,
ADD COLUMN "mpTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "mpStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED';

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_externalReference_key" ON "Appointment"("externalReference");

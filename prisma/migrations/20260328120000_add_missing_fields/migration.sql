-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "realPaymentId" TEXT;

-- AlterTable
ALTER TABLE "BarbershopUser" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "BarbershopUser" ADD COLUMN "passwordResetExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BarbershopUser_passwordResetToken_key" ON "BarbershopUser"("passwordResetToken");

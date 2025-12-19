-- Create BarbershopUser table (admin/owners)

CREATE TABLE IF NOT EXISTS "BarbershopUser" (
  "id" SERIAL PRIMARY KEY,
  "barbershopId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'BarbershopUser_email_key'
  ) THEN
    CREATE UNIQUE INDEX "BarbershopUser_email_key" ON "BarbershopUser"("email");
  END IF;
END $$;

-- FK to Barbershop
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BarbershopUser_barbershopId_fkey'
  ) THEN
    ALTER TABLE "BarbershopUser"
      ADD CONSTRAINT "BarbershopUser_barbershopId_fkey"
      FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

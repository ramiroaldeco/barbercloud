-- CreateTable
CREATE TABLE IF NOT EXISTS "BlockedTime" (
  "id" SERIAL PRIMARY KEY,
  "barbershopId" INTEGER NOT NULL,
  "dateFrom" TEXT NOT NULL,
  "dateTo" TEXT,
  "startTime" TEXT,
  "endTime" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlockedTime_barbershopId_fkey'
  ) THEN
    ALTER TABLE "BlockedTime"
    ADD CONSTRAINT "BlockedTime_barbershopId_fkey"
    FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- CreateIndex
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'BlockedTime_barbershopId_dateFrom_dateTo_idx'
  ) THEN
    CREATE INDEX "BlockedTime_barbershopId_dateFrom_dateTo_idx"
      ON "BlockedTime" ("barbershopId", "dateFrom", "dateTo");
  END IF;
END$$;

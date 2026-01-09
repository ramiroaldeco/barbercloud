ALTER TABLE "Barbershop" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Barbershop_slug_key" ON "Barbershop" ("slug");

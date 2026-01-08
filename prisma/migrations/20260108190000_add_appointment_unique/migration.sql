-- Agrega restricción única para evitar doble reserva
-- (barbershopId + date + time)

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_barbershopId_date_time_key"
UNIQUE ("barbershopId", "date", "time");

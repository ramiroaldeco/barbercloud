// members.js
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

function requireOwner(req, res) {
  if (!req.user || req.user.role !== "owner") {
    res.status(403).json({ error: "Solo el dueño puede realizar esta acción" });
    return false;
  }
  return true;
}

// GET /api/members
router.get("/", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;

    const members = await prisma.barber.findMany({
      where: { barbershopId: req.user.barbershopId },
      include: {
        services: { select: { id: true, name: true } },
        workingHours: {
          orderBy: [
            { weekday: 'asc' },
            { startTime: 'asc' }
          ]
        },
      },
      orderBy: { name: 'asc' }
    });

    res.json({ ok: true, members });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo miembros" });
  }
});

// POST /api/members
router.post("/", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    
    const { name, role, avatarBase64, servicesIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nombre es obligatorio" });

    // ✅ FIX: Validar que todos los serviceIds pertenezcan a esta barbería (evita cross-tenant injection)
    if (servicesIds && servicesIds.length > 0) {
      const validServices = await prisma.service.findMany({
        where: {
          id: { in: servicesIds.map(id => Number(id)) },
          barbershopId: req.user.barbershopId
        },
        select: { id: true }
      });
      if (validServices.length !== servicesIds.length) {
        return res.status(400).json({ error: "Uno o más servicios no pertenecen a esta barbería" });
      }
    }

    const newBarber = await prisma.barber.create({
      data: {
        barbershopId: req.user.barbershopId,
        name: name.trim(),
        role: role?.trim() || "Barbero",
        avatarBase64: avatarBase64 || null,
        isActive: true,
        services: {
          connect: (servicesIds || []).map(id => ({ id: Number(id) }))
        }
      },
      include: { services: true }
    });

    res.json({ ok: true, barber: newBarber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando miembro" });
  }
});

// PUT /api/members/:id
router.put("/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const id = Number(req.params.id);

    // Verify ownership
    const exists = await prisma.barber.findFirst({
      where: { id, barbershopId: req.user.barbershopId }
    });
    if (!exists) return res.status(404).json({ error: "Miembro no encontrado" });

    const { name, role, avatarBase64, isActive, servicesIds } = req.body;

    // ✅ FIX: Validar que todos los serviceIds pertenezcan a esta barbería
    if (servicesIds && servicesIds.length > 0) {
      const validServices = await prisma.service.findMany({
        where: {
          id: { in: servicesIds.map(sid => Number(sid)) },
          barbershopId: req.user.barbershopId
        },
        select: { id: true }
      });
      if (validServices.length !== servicesIds.length) {
        return res.status(400).json({ error: "Uno o más servicios no pertenecen a esta barbería" });
      }
    }

    const updated = await prisma.barber.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : exists.name,
        role: role !== undefined ? role.trim() : exists.role,
        avatarBase64: avatarBase64 !== undefined ? avatarBase64 : exists.avatarBase64,
        isActive: isActive !== undefined ? isActive : exists.isActive,
        services: servicesIds ? {
          set: servicesIds.map(sid => ({ id: Number(sid) }))
        } : undefined
      },
      include: { 
        services: true, 
        workingHours: {
          orderBy: [
            { weekday: 'asc' },
            { startTime: 'asc' }
          ]
        } 
      }
    });

    res.json({ ok: true, barber: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error actualizando miembro" });
  }
});

// DELETE /api/members/:id -> Soft delete (deactivate)
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const id = Number(req.params.id);

    const exists = await prisma.barber.findFirst({
      where: { id, barbershopId: req.user.barbershopId }
    });
    if (!exists) return res.status(404).json({ error: "Miembro no encontrado" });

    await prisma.barber.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ ok: true, message: "Miembro desactivado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error desactivando miembro" });
  }
});

// PUT /api/members/:id/schedule -> Replaces working hours completely
router.put("/:id/schedule", auth, async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const barberId = Number(req.params.id);

    const exists = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: req.user.barbershopId }
    });
    if (!exists) return res.status(404).json({ error: "Miembro no encontrado" });

    const { schedule } = req.body; // Array of { weekday, startTime, endTime }
    if (!Array.isArray(schedule)) return res.status(400).json({ error: "schedule debe ser array" });

    // Validate times
    for (const slot of schedule) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) || 
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime) || 
          slot.weekday < 0 || slot.weekday > 6) {
        return res.status(400).json({ error: "Formato de horario inválido. Usa weekday 0-6 y HH:MM" });
      }
    }

    // Transaction to replace schedule
    await prisma.$transaction([
      prisma.barberWorkingHour.deleteMany({ where: { barberId } }),
      prisma.barberWorkingHour.createMany({
        data: schedule.map(slot => ({
          barberId,
          weekday: Number(slot.weekday),
          startTime: slot.startTime,
          endTime: slot.endTime
        }))
      })
    ]);

    res.json({ ok: true, message: "Horario actualizado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error actualizando horario" });
  }
});

module.exports = router;

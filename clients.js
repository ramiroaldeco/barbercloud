// clients.js
// Endpoint de clientes: agrupa appointments por customerPhone para la vista Clientes de admin_v2
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

// GET /api/clients/mine
// Devuelve lista de clientes únicos (agrupados por phone) con stats
router.get("/mine", auth, async (req, res) => {
  try {
    const myBarbershopId = req.user.barbershopId;
    if (!myBarbershopId) {
      return res.status(400).json({ error: "Token inválido: falta barbershopId" });
    }

    const q = (req.query.q || "").trim().toLowerCase();

    // Traer todos los appointments no cancelados de mi barbería
    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId: myBarbershopId,
        NOT: { status: "canceled" },
      },
      select: {
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        date: true,
        status: true,
      },
      orderBy: { date: "desc" },
    });

    // Agrupar por teléfono
    const map = new Map();

    for (const a of appointments) {
      const phone = (a.customerPhone || "").trim();
      if (!phone) continue;

      if (!map.has(phone)) {
        map.set(phone, {
          customerName: a.customerName || "",
          customerPhone: phone,
          customerEmail: a.customerEmail || null,
          totalAppointments: 0,
          confirmedAppointments: 0,
          lastDate: null,
        });
      }

      const client = map.get(phone);
      client.totalAppointments++;
      if (a.status === "confirmed") client.confirmedAppointments++;

      // Actualizar nombre si es más reciente
      if (!client.lastDate || a.date > client.lastDate) {
        client.lastDate = a.date;
        if (a.customerName) client.customerName = a.customerName;
        if (a.customerEmail) client.customerEmail = a.customerEmail;
      }
    }

    let items = Array.from(map.values());

    // Filtro libre por nombre o teléfono
    if (q) {
      items = items.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.customerPhone.includes(q)
      );
    }

    // Ordenar por última visita desc
    items.sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));

    return res.json({ ok: true, items });
  } catch (e) {
    console.error("Clients/mine error:", e);
    return res.status(500).json({ error: "Error obteniendo clientes" });
  }
});

module.exports = router;

// clients.js
// Endpoint de clientes: agrupa appointments por customerPhone para la vista Clientes de admin_v2
const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

// ──────────────────────────────────────────────
// Helpers de normalización (para deduplicación)
// ──────────────────────────────────────────────
function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // colapsar espacios múltiples
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, ""); // solo dígitos
}

// GET /api/clients/mine
// Devuelve lista de clientes únicos (agrupados por phone, con fallback por nombre) con stats
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

    // ─────────────────────────────────────────────────────────────────────
    // FASE 1: Agrupar por teléfono normalizado (clave fuerte)
    // Los turnos sin teléfono se guardan en una lista separada para fase 2.
    // ─────────────────────────────────────────────────────────────────────
    const byPhone = new Map(); // phone normalizado  → cliente
    const noPhone = [];        // appointments sin teléfono válido

    for (const a of appointments) {
      const rawPhone = (a.customerPhone || "").trim();
      const phone = normalizePhone(rawPhone);

      if (!phone) {
        // Sin teléfono → guardar para deduplicación por nombre después
        noPhone.push(a);
        continue;
      }

      if (!byPhone.has(phone)) {
        byPhone.set(phone, {
          customerName: a.customerName || "",
          customerPhone: rawPhone, // conservar formato original del más reciente
          customerEmail: a.customerEmail || null,
          totalAppointments: 0,
          confirmedAppointments: 0,
          lastDate: null,
        });
      }

      const client = byPhone.get(phone);
      client.totalAppointments++;
      if (a.status === "confirmed" || a.status === "CONFIRMED") client.confirmedAppointments++;

      // Actualizar con el registro más reciente
      if (!client.lastDate || a.date > client.lastDate) {
        client.lastDate = a.date;
        if (a.customerName) client.customerName = a.customerName;
        if (a.customerEmail) client.customerEmail = a.customerEmail;
        if (rawPhone) client.customerPhone = rawPhone; // mantener formato original del más reciente
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // FASE 2: Procesar turnos SIN teléfono.
    // Estrategia conservadora:
    //   - Si existe ya un cliente con el mismo nombre normalizado (de la fase 1),
    //     acumular visitas en ese cliente (enriquecer) en vez de crear uno nuevo.
    //     Esto cubre el caso: primera reserva sin tel → segunda con tel.
    //   - Si no hay match por nombre con teléfono existente, crear entrada separada
    //     agrupada por nombre normalizado (clave débil).
    // ─────────────────────────────────────────────────────────────────────
    const byNameNoPhone = new Map(); // nombre normalizado → cliente (sin teléfono)

    for (const a of noPhone) {
      const normName = normalizeName(a.customerName);

      // 1. Buscar si ya hay un cliente CON teléfono que tenga el mismo nombre normalizado
      let matchedPhoneClient = null;
      for (const [, c] of byPhone) {
        if (normalizeName(c.customerName) === normName) {
          matchedPhoneClient = c;
          break;
        }
      }

      if (matchedPhoneClient) {
        // Fusionar: sumar visita al cliente con teléfono existente
        matchedPhoneClient.totalAppointments++;
        if (a.status === "confirmed" || a.status === "CONFIRMED") matchedPhoneClient.confirmedAppointments++;
        // Si el turno sin teléfono es más reciente y tiene email, enriquecer
        if ((!matchedPhoneClient.lastDate || a.date > matchedPhoneClient.lastDate)) {
          matchedPhoneClient.lastDate = a.date;
          if (a.customerName) matchedPhoneClient.customerName = a.customerName;
          if (a.customerEmail && !matchedPhoneClient.customerEmail) matchedPhoneClient.customerEmail = a.customerEmail;
        }
        continue;
      }

      // 2. Sin match con cliente que tiene teléfono → agrupar por nombre (clave débil)
      if (!byNameNoPhone.has(normName)) {
        byNameNoPhone.set(normName, {
          customerName: a.customerName || "",
          customerPhone: "",
          customerEmail: a.customerEmail || null,
          totalAppointments: 0,
          confirmedAppointments: 0,
          lastDate: null,
        });
      }

      const client = byNameNoPhone.get(normName);
      client.totalAppointments++;
      if (a.status === "confirmed" || a.status === "CONFIRMED") client.confirmedAppointments++;

      if (!client.lastDate || a.date > client.lastDate) {
        client.lastDate = a.date;
        if (a.customerName) client.customerName = a.customerName;
        if (a.customerEmail) client.customerEmail = a.customerEmail;
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // FASE 3: Combinar ambos mapas en la lista final
    // ─────────────────────────────────────────────────────────────────────
    let items = [
      ...Array.from(byPhone.values()),
      ...Array.from(byNameNoPhone.values()),
    ];

    // Filtro libre por nombre o teléfono
    if (q) {
      items = items.filter(
        (c) =>
          (c.customerName || "").toLowerCase().includes(q) ||
          (c.customerPhone || "").includes(q)
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


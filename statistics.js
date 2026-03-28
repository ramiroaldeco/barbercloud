const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

// ✅ FIX: Calcular fecha en timezone Argentina en vez de UTC
// Render corre en UTC — sin esto un turno del Miércoles 01:00 ARG aparece en martes
function getArgDateString(dateObj) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(dateObj);
}

function getArgMonthKey(dateISO) {
  return dateISO.substring(0, 7); // "YYYY-MM"
}

router.get("/", auth, async (req, res) => {
  try {
    const myBarbershopId = req.user?.barbershopId;
    if (!myBarbershopId) return res.status(403).json({ error: "Falta barbershopId" });

    const days = parseInt(req.query.days) || 30;

    // ✅ FIX: Usar fecha Argentina real como "hoy"
    const todayArg = getArgDateString(new Date());
    
    const fromDateObj = new Date();
    fromDateObj.setDate(fromDateObj.getDate() - days + 1);
    const fromDateArg = getArgDateString(fromDateObj);

    const items = await prisma.appointment.findMany({
      where: {
        barbershopId: myBarbershopId,
        date: { gte: fromDateArg, lte: todayArg }
      },
      include: {
        barber: true,
        service: true
      }
    });

    const isConfirmed = (s) => s === "CONFIRMED" || s === "confirmed";
    const isCanceled = (s) => s.includes("CANCEL") || s.includes("cancel");

    let totalNetIncome = 0;
    let confirmedCount = 0;
    let canceledCount = 0;

    const tsMap = {};
    const barberMap = {};
    const serviceMap = {};
    const clientMap = {};

    const isYear = days >= 365;
    if (!isYear) {
      for (let i = 0; i < days; i++) {
        const d = new Date(fromDateObj);
        d.setDate(d.getDate() + i);
        tsMap[getArgDateString(d)] = { income: 0, appointments: 0 };
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        tsMap[getArgMonthKey(getArgDateString(d))] = { income: 0, appointments: 0 };
      }
    }

    for (const a of items) {
      if (isCanceled(a.status)) {
        canceledCount++;
        continue;
      }

      if (!isConfirmed(a.status)) continue;

      // ✅ FIX: Usar depositAmount (lo que realmente cobró) en vez de servicePrice (precio total)
      // Si depositAmount es 0, el pago se hace presencial — se registra como 0 online
      const netIncome = a.depositAmount > 0 ? a.depositAmount : (a.servicePrice || 0);

      totalNetIncome += netIncome;
      confirmedCount++;

      // Timeseries
      let dateKey = a.date;
      if (isYear) {
        dateKey = getArgMonthKey(a.date);
      }
      if (tsMap[dateKey]) {
        tsMap[dateKey].income += netIncome;
        tsMap[dateKey].appointments++;
      } else if (isYear) {
        tsMap[dateKey] = { income: netIncome, appointments: 1 };
      }

      // Barber Metrics
      if (a.barber) {
        if (!barberMap[a.barber.name]) barberMap[a.barber.name] = { income: 0, count: 0 };
        barberMap[a.barber.name].income += netIncome;
        barberMap[a.barber.name].count++;
      }

      // Service Metrics
      if (a.service) {
        if (!serviceMap[a.service.name]) serviceMap[a.service.name] = { income: 0, count: 0 };
        serviceMap[a.service.name].income += netIncome;
        serviceMap[a.service.name].count++;
      }

      // Client Metrics (agrupado por teléfono)
      if (a.customerPhone) {
        const p = a.customerPhone;
        if (!clientMap[p]) clientMap[p] = { name: a.customerName, count: 0, spent: 0 };
        clientMap[p].count++;
        clientMap[p].spent += netIncome;
        if (a.customerName.length > clientMap[p].name.length) {
          clientMap[p].name = a.customerName;
        }
      }
    }

    const timeseries = Object.keys(tsMap).sort().map(k => ({ date: k, income: tsMap[k].income, appointments: tsMap[k].appointments }));
    const barbersData = Object.keys(barberMap).map(k => ({ name: k, ...barberMap[k] })).sort((a, b) => b.income - a.income);
    const servicesData = Object.keys(serviceMap).map(k => ({ name: k, ...serviceMap[k] })).sort((a, b) => b.income - a.income);
    const topClients = Object.values(clientMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const averageTicket = confirmedCount > 0 ? Math.round(totalNetIncome / confirmedCount) : 0;

    // Tasa de cancelación
    const totalProcessed = confirmedCount + canceledCount;
    const cancellationRate = totalProcessed > 0 ? Math.round((canceledCount / totalProcessed) * 100) : 0;

    res.json({
      summary: {
        totalNetIncome,
        confirmedCount,
        canceledCount,
        cancellationRate,
        averageTicket,
        topBarber: barbersData.length > 0 ? barbersData[0].name : "-",
        topClient: topClients.length > 0 ? topClients[0].name : "-",
      },
      charts: {
        timeseries,
        barbersData,
        servicesData
      },
      rankings: {
        topClients
      }
    });

  } catch (err) {
    console.error("Error en endpoints analytics:", err);
    res.status(500).json({ error: "Error procesando analíticas del servidor." });
  }
});

module.exports = router;

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
        date: { gte: fromDateArg }
      },
      include: {
        barber: true,
        service: true
      }
    });

    const isConfirmed = (s) => s === "CONFIRMED" || s === "confirmed";
    const isCanceled = (s) => s ? (String(s).includes("CANCEL") || String(s).includes("cancel")) : false;

    let totalDepositIncome = 0;
    let totalFullIncome = 0;
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
        tsMap[getArgDateString(d)] = { deposit: 0, total: 0, appointments: 0 };
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        tsMap[getArgMonthKey(getArgDateString(d))] = { deposit: 0, total: 0, appointments: 0 };
      }
    }

    for (const a of items) {
      if (isCanceled(a.status)) {
        canceledCount++;
        continue;
      }

      if (!isConfirmed(a.status)) continue;

      const depositIncome = a.depositAmount || 0;
      const fullIncome = a.servicePrice || 0;

      totalDepositIncome += depositIncome;
      totalFullIncome += fullIncome;
      confirmedCount++;

      // Timeseries
      let dateKey = a.date;
      if (isYear) {
        dateKey = getArgMonthKey(a.date);
      }
      if (!tsMap[dateKey]) {
        tsMap[dateKey] = { deposit: 0, total: 0, appointments: 0 };
      }
      tsMap[dateKey].deposit += depositIncome;
      tsMap[dateKey].total += fullIncome;
      tsMap[dateKey].appointments++;

      // Barber Metrics
      if (a.barber) {
        if (!barberMap[a.barber.name]) barberMap[a.barber.name] = { deposit: 0, total: 0, count: 0 };
        barberMap[a.barber.name].deposit += depositIncome;
        barberMap[a.barber.name].total += fullIncome;
        barberMap[a.barber.name].count++;
      }

      // Service Metrics
      if (a.service) {
        if (!serviceMap[a.service.name]) serviceMap[a.service.name] = { deposit: 0, total: 0, count: 0 };
        serviceMap[a.service.name].deposit += depositIncome;
        serviceMap[a.service.name].total += fullIncome;
        serviceMap[a.service.name].count++;
      }

      // Client Metrics
      if (a.customerPhone) {
        const p = a.customerPhone;
        const cName = a.customerName || "Sin Nombre";
        if (!clientMap[p]) clientMap[p] = { name: cName, count: 0, deposit: 0, total: 0 };
        clientMap[p].count++;
        clientMap[p].deposit += depositIncome;
        clientMap[p].total += fullIncome;
        if (cName.length > (clientMap[p].name || "").length) {
          clientMap[p].name = cName;
        }
      }
    }

    const timeseries = Object.keys(tsMap).sort().map(k => ({ date: k, ...tsMap[k] }));
    const barbersData = Object.keys(barberMap).map(k => ({ name: k, ...barberMap[k] })).sort((a, b) => b.total - a.total);
    const servicesData = Object.keys(serviceMap).map(k => ({ name: k, ...serviceMap[k] })).sort((a, b) => b.total - a.total);
    const topClients = Object.values(clientMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const averageTicket = confirmedCount > 0 ? Math.round(totalFullIncome / confirmedCount) : 0;

    const totalProcessed = confirmedCount + canceledCount;
    const cancellationRate = totalProcessed > 0 ? Math.round((canceledCount / totalProcessed) * 100) : 0;

    res.json({
      summary: {
        totalDepositIncome,
        totalFullIncome,
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
    res.status(500).json({ error: "Error procesando analíticas: " + err.message });
  }
});

module.exports = router;

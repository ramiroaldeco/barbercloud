const express = require("express");
const prisma = require("./prisma");
const auth = require("./authMiddleware");

const router = express.Router();

function getISODateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

router.get("/", auth, async (req, res) => {
  try {
    const myBarbershopId = req.user?.barbershopId;
    if (!myBarbershopId) return res.status(403).json({ error: "Falta barbershopId" });

    // Rango de días (por defecto 30)
    const days = parseInt(req.query.days) || 30;
    
    const todayObj = new Date();
    const toDate = getISODateString(todayObj);

    const fromDateObj = new Date();
    fromDateObj.setDate(todayObj.getDate() - days + 1);
    const fromDate = getISODateString(fromDateObj);

    // Fetch all records in range to compute both confirmed metrics and cancellation ratio
    const items = await prisma.appointment.findMany({
      where: {
        barbershopId: myBarbershopId,
        date: { gte: fromDate, lte: toDate }
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

    const tsMap = {}; // timeseries
    const barberMap = {}; // income/count by barber
    const serviceMap = {}; // income/count by service
    const clientMap = {}; // frequency by client

    // Pre-poblar el timeseries para no tener huecos visuales
    const isYear = days >= 365;
    if (!isYear) {
      for (let i = 0; i < days; i++) {
        const d = new Date(fromDateObj);
        d.setDate(d.getDate() + i);
        tsMap[getISODateString(d)] = { income: 0, appointments: 0 };
      }
    } else {
      // Para un año, la mínima resolución es mes
      for (let i = 0; i < 12; i++) {
        const d = new Date(todayObj);
        d.setMonth(d.getMonth() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        tsMap[`${y}-${m}`] = { income: 0, appointments: 0 };
      }
    }

    // Single-pass computation 
    for (const a of items) {
      if (isCanceled(a.status)) {
        canceledCount++;
        continue;
      }

      if (!isConfirmed(a.status)) continue; // ignore "pending" or explicit ignores

      const netIncome = a.servicePrice || 0;
      
      totalNetIncome += netIncome;
      confirmedCount++;

      // 1. Timeseries Evolution
      let dateKey = a.date;
      if (isYear) {
        dateKey = dateKey.substring(0, 7); // "YYYY-MM"
      }
      if (tsMap[dateKey]) {
        tsMap[dateKey].income += netIncome;
        tsMap[dateKey].appointments++;
      } else if (isYear) {
        tsMap[dateKey] = { income: netIncome, appointments: 1 };
      }

      // 2. Barber Metrics
      if (a.barber) {
        if (!barberMap[a.barber.name]) barberMap[a.barber.name] = { income: 0, count: 0 };
        barberMap[a.barber.name].income += netIncome;
        barberMap[a.barber.name].count++;
      }

      // 3. Service Metrics
      if (a.service) {
        if (!serviceMap[a.service.name]) serviceMap[a.service.name] = { income: 0, count: 0 };
        serviceMap[a.service.name].income += netIncome;
        serviceMap[a.service.name].count++;
      }

      // 4. Client Metrics (group by phone to handle typos in name)
      if (a.customerPhone) {
        const p = a.customerPhone;
        if (!clientMap[p]) clientMap[p] = { name: a.customerName, count: 0, spent: 0 };
        clientMap[p].count++;
        clientMap[p].spent += netIncome;
        // always keep the latest/longest name found for this phone
        if (a.customerName.length > clientMap[p].name.length) {
          clientMap[p].name = a.customerName;
        }
      }
    }

    // Convert Maps to sorted arrays for the frontend charts
    // Timeseries
    const timeseries = Object.keys(tsMap).sort().map(k => ({ date: k, income: tsMap[k].income, appointments: tsMap[k].appointments }));
    
    // Barbers
    const barbersData = Object.keys(barberMap).map(k => ({ name: k, ...barberMap[k] })).sort((a, b) => b.income - a.income);
    
    // Services
    const servicesData = Object.keys(serviceMap).map(k => ({ name: k, ...serviceMap[k] })).sort((a, b) => b.income - a.income);

    // Clients
    const topClients = Object.values(clientMap).sort((a, b) => b.count - a.count).slice(0, 5); // top 5

    // Ticket
    const averageTicket = confirmedCount > 0 ? Math.round(totalNetIncome / confirmedCount) : 0;

    res.json({
      summary: {
        totalNetIncome,
        confirmedCount,
        canceledCount,
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

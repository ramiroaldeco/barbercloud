const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("./prisma");
const auth = require("./authMiddleware"); // ✅ Reutilizamos el middleware de auth existente

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret_bc_2024";

// Credenciales SaaS de Mercado Pago (Marketplace Owner)
const MP_CLIENT_ID = process.env.MP_CLIENT_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI || "https://barbercloud.onrender.com/api/payments/oauth/callback";
const FRONTEND_ADMIN_URL = process.env.FRONTEND_URL 
  ? `${process.env.FRONTEND_URL}/admin_v2.html#/miembros` 
  : "https://barberscloud.vercel.app/admin_v2.html#/miembros";

// Middleware de auth owner (viejo, se mantiene por compatibilidad)
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// =============================================================
// HELPER: Refrescar token de MP expirado automáticamente
// Cuando el token (~180 días) expira, intentamos renovarlo con el refresh_token
// Si la renovación falla, el sistema sigue como si el barbero estuviera desconectado
// =============================================================
async function refreshMPToken(barberId) {
  try {
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      select: { mpRefreshToken: true }
    });

    if (!barber?.mpRefreshToken) {
      console.warn(`[RefreshToken] Barbero ${barberId} no tiene refresh_token guardado`);
      return null;
    }

    const mpRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: barber.mpRefreshToken
      })
    });

    const data = await mpRes.json();

    if (!mpRes.ok || !data.access_token) {
      console.error(`[RefreshToken] Error renovando token barbero ${barberId}:`, JSON.stringify(data));
      await prisma.barber.update({
        where: { id: barberId },
        data: { mpStatus: "ERROR" }
      });
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 15552000));

    await prisma.barber.update({
      where: { id: barberId },
      data: {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token || barber.mpRefreshToken,
        mpTokenExpiresAt: expiresAt,
        mpStatus: "CONNECTED"
      }
    });

    console.log(`[RefreshToken] ✅ Token MP del barbero ${barberId} renovado. Nuevo vencimiento: ${expiresAt.toISOString()}`);
    return data.access_token;

  } catch (err) {
    console.error(`[RefreshToken] Error inesperado renovando token barbero ${barberId}:`, err.message);
    return null;
  }
}

// =============================================================
// HELPER: Verificar firma HMAC de Mercado Pago
// MP envía el header x-signature con formato: ts=TIMESTAMP,v1=HASH
// El hash se construye con: "ts:TIMESTAMP;v1:DATA_ID" 
// firmado con HMAC-SHA256 usando el MP_WEBHOOK_SECRET del dashboard
// Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
// =============================================================
function verifyMPSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  
  // Si no hay secret configurado, logueamos advertencia pero NO bloqueamos
  // (para no romper instalaciones existentes que aún no lo hayan configurado)
  if (!secret) {
    console.warn("[Webhook] MP_WEBHOOK_SECRET no configurada — verificación de firma deshabilitada temporalmente");
    return true;
  }

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];
  
  if (!xSignature) {
    console.warn("[Webhook] Header x-signature ausente");
    return false;
  }

  // Parsear ts y v1 del header
  const parts = {};
  xSignature.split(",").forEach(part => {
    const [k, v] = part.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  });
  
  const { ts, v1 } = parts;
  if (!ts || !v1) {
    console.warn("[Webhook] Header x-signature malformado:", xSignature);
    return false;
  }

  // Verificar que el timestamp no sea muy viejo (replay attack protection - 5 min)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(ts)) > 300) {
    console.warn(`[Webhook] Timestamp muy viejo o futuro: ts=${ts}, now=${now}`);
    return false;
  }

  // Construir el manifest para la verificación
  // MP usa: "id:{data.id};request-id:{x-request-id};ts:{ts};"
  const dataId = req.body?.data?.id || req.query["data.id"] || req.query.id || "";
  const manifest = `id:${dataId};request-id:${xRequestId || ""};ts:${ts};`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(manifest);
  const expected = hmac.digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(v1, "hex")
  );

  if (!isValid) {
    console.error(`[Webhook] ❌ Firma inválida. Expected: ${expected}, Got: ${v1}`);
  }
  
  return isValid;
}

// -------------------------------------------------------------
// 1) OAUTH: Redirigir al Barbero a Mercado Pago
// -------------------------------------------------------------
router.get("/oauth/authorize", (req, res) => {
  const { barberId } = req.query;
  if (!barberId) return res.status(400).send("Falta barberId");
  
  if (!MP_CLIENT_ID) {
    return res.status(500).send("El dueño del SaaS aún no ha configurado MP_CLIENT_ID en Render.");
  }

  const state = String(barberId);
  const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${MP_REDIRECT_URI}`;
  res.redirect(authUrl);
});

// -------------------------------------------------------------
// 2) OAUTH: Callback de Mercado Pago
// -------------------------------------------------------------
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const fallbackFrontendUrl = FRONTEND_ADMIN_URL;

  if (error || !code) {
    console.error("MP OAuth Error:", error);
    return res.send(`
      <script>
        alert("Error al conectar Mercado Pago: ${error}");
        window.location.href = "${fallbackFrontendUrl}";
      </script>
    `);
  }

  const barberId = Number(state);
  if (!barberId || isNaN(barberId)) {
    return res.status(400).send("Invalid State (barberId is missing)");
  }

  try {
    const mpRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: MP_REDIRECT_URI
      })
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Error pidiendo token MP:", data);
      throw new Error(data.message || "Error al obtener tokens de Mercado Pago");
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 15552000));

    await prisma.barber.update({
      where: { id: barberId },
      data: {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token,
        mpUserId: String(data.user_id),
        mpTokenExpiresAt: expiresAt,
        mpStatus: "CONNECTED"
      }
    });

    return res.send(`
      <style>body{font-family:sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;}</style>
      <h2 style="color:#00e676">¡Cuenta de Mercado Pago Conectada!</h2>
      <p>Ya puedes cerrar esta ventana o volver a tu panel.</p>
      <script>
        setTimeout(() => {
           window.location.href = "${fallbackFrontendUrl}";
        }, 3000);
      </script>
    `);

  } catch (err) {
    console.error("Error OAuth callback:", err);
    await prisma.barber.update({
      where: { id: barberId },
      data: { mpStatus: "ERROR" }
    });
    return res.send(`
      <script>
        alert("Ocurrió un error al guardar tu token de Mercado Pago. Intenta nuevamente.");
        window.location.href = "${fallbackFrontendUrl}";
      </script>
    `);
  }
});

// -------------------------------------------------------------
// 3) WEBHOOKS: Recibir Notificaciones de Pago de Mercado Pago
// -------------------------------------------------------------
router.post("/webhook", async (req, res) => {
  // Respondemos 200 rápido para que MP no reintente agresivamente
  res.status(200).send("OK");

  try {
    // ✅ FIX CRÍTICO: Verificar firma HMAC antes de procesar
    if (!verifyMPSignature(req)) {
      console.error("[Webhook] ❌ Firma inválida — request rechazado silenciosamente");
      return;
    }

    const { type, data } = req.body;
    const paymentId = data?.id || req.query["data.id"] || req.query.id;
    const barberId = req.query.barberId;
    
    if (!paymentId || type !== "payment") return;
    if (!barberId) {
      console.error("[Webhook] Falta barberId en query", req.query);
      return;
    }

    console.log(`[Webhook] Recibido. PaymentId: ${paymentId}, BarberId: ${barberId}`);

    // 1. Buscar al barbero para usar su token
    const barber = await prisma.barber.findUnique({
      where: { id: Number(barberId) },
      select: { mpAccessToken: true, mpTokenExpiresAt: true, barbershopId: true }
    });

    if (!barber || !barber.mpAccessToken) {
      console.error(`[Webhook] Barbero ${barberId} no tiene token MP`);
      return;
    }

    // Verificar si el token expiró
    if (barber.mpTokenExpiresAt && new Date(barber.mpTokenExpiresAt) < new Date()) {
      console.error(`[Webhook] Token MP del barbero ${barberId} expirado. No se puede verificar pago ${paymentId}`);
      return;
    }

    // 2. Traer el detalle real del pago desde MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${barber.mpAccessToken}` }
    });
    
    const paymentData = await mpRes.json();
    if (!mpRes.ok) {
      console.error(`[Webhook] Error consultando pago ${paymentId} a MP. HTTP ${mpRes.status}:`, JSON.stringify(paymentData));
      return;
    }

    const { status, external_reference } = paymentData;
    if (!external_reference) {
      console.warn(`[Webhook] Pago ${paymentId} sin external_reference. Ignorando.`);
      return;
    }

    // 3. Buscar el turno en DB
    const appt = await prisma.appointment.findUnique({
      where: { externalReference: external_reference }
    });

    if (!appt) {
      console.warn(`[Webhook] No se encontró turno con ref ${external_reference}.`);
      return;
    }

    // ✅ FIX CRÍTICO: Verificar que el barbero del webhook pertenezca a la misma barbería del turno
    // Esto previene que un atacante use el barberId de otra barbería para procesar pagos cruzados
    if (barber.barbershopId !== appt.barbershopId) {
      console.error(`[Webhook] ❌ Cross-tenant attack detectado: barbero ${barberId} (barbershopId=${barber.barbershopId}) no pertenece a la barbería del turno (barbershopId=${appt.barbershopId})`);
      return;
    }

    // 4. Idempotencia
    if (appt.status === "CONFIRMED" && appt.paymentStatus === "paid") {
      console.log(`[Webhook] Turno ${appt.id} ya estaba CONFIRMED/paid. Ignorando duplicado.`);
      return;
    }
    if (appt.status === "CANCELLED_EXPIRED") {
      console.warn(`[Webhook] Turno ${appt.id} ya expirado/cancelado. Pago ${paymentId} llegó tarde.`);
      return;
    }

    console.log(`[Webhook] Procesando pago ${paymentId}. Estado MP: ${status}. Turno: ${appt.id}`);

    if (status === "approved") {
      // ✅ FIX: Guardar el realPaymentId de MP (necesario para emitir reembolsos)
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: "CONFIRMED",
          paymentStatus: "paid",
          lockExpiresAt: null,
          realPaymentId: String(paymentId) // Guardamos el ID real del pago (no el de la preferencia)
        }
      });
      console.log(`[Webhook] ✅ Turno ${appt.id} CONFIRMADO. Pago ID: ${paymentId}`);
    } 
    else if (status === "rejected" || status === "cancelled") {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: "CANCELLED_EXPIRED",
          lockExpiresAt: null
        }
      });
      console.log(`[Webhook] ❌ Turno ${appt.id} cancelado por pago ${status}.`);
    }
    else if (status === "pending" || status === "in_process") {
      console.log(`[Webhook] ⏳ Pago ${paymentId} pendiente (${status}). Turno ${appt.id} mantiene estado.`);
    }

  } catch (err) {
    console.error("[Webhook] Error en catch:", err.message);
  }
});

// -------------------------------------------------------------
// 4) REEMBOLSO: Devolver seña a cliente
// POST /api/payments/refund/:appointmentId
// Requiere: token de owner válido, turno con paymentStatus=paid y realPaymentId
// -------------------------------------------------------------
router.post("/refund/:appointmentId", auth, async (req, res) => {
  try {
    const apptId = Number(req.params.appointmentId);
    if (isNaN(apptId)) return res.status(400).json({ error: "ID de turno inválido" });

    // Buscar el turno y verificar ownership
    const appt = await prisma.appointment.findUnique({
      where: { id: apptId },
      select: {
        id: true,
        barbershopId: true,
        status: true,
        paymentStatus: true,
        realPaymentId: true,
        depositAmount: true,
        barberId: true,
        customerName: true
      }
    });

    if (!appt) return res.status(404).json({ error: "Turno no encontrado" });

    // Verificar que el turno pertenece a la barbería del owner logueado
    if (appt.barbershopId !== req.user.barbershopId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Solo se puede reembolsar si está pagado
    if (appt.paymentStatus !== "paid") {
      return res.status(400).json({ error: `El turno no está pagado (estado: ${appt.paymentStatus})` });
    }

    // Necesitamos el realPaymentId para llamar a MP
    if (!appt.realPaymentId) {
      return res.status(400).json({ 
        error: "No se puede emitir reembolso automático: el ID de pago real no está registrado. Puede que el pago fue procesado antes de esta versión. Realizá el reembolso manual desde el panel de Mercado Pago."
      });
    }

    // Obtener el token del barbero
    const barber = await prisma.barber.findUnique({
      where: { id: appt.barberId },
      select: { id: true, mpAccessToken: true, mpTokenExpiresAt: true, mpStatus: true }
    });

    if (!barber?.mpAccessToken) {
      return res.status(400).json({ error: "El barbero no tiene Mercado Pago conectado" });
    }

    // Refrescar token si expiró
    let token = barber.mpAccessToken;
    if (barber.mpTokenExpiresAt && new Date(barber.mpTokenExpiresAt) < new Date()) {
      console.warn(`[Refund] Token del barbero ${barber.id} expirado. Intentando renovar...`);
      token = await refreshMPToken(barber.id);
      if (!token) {
        return res.status(400).json({ error: "El token de Mercado Pago expiró y no se pudo renovar. Reconectá MP desde el panel." });
      }
    }

    // Llamar a la API de reembolso de MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${appt.realPaymentId}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({}) // Reembolso total (sin body = monto completo)
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error(`[Refund] Error MP al reembolsar turno ${apptId}:`, JSON.stringify(mpData));
      return res.status(400).json({ 
        error: `Mercado Pago rechazó el reembolso: ${mpData.message || mpData.error || "Error desconocido"}`
      });
    }

    // Actualizar estado en DB
    await prisma.appointment.update({
      where: { id: apptId },
      data: {
        paymentStatus: "refunded",
        status: "CANCELLED_MANUAL"
      }
    });

    console.log(`[Refund] ✅ Reembolso emitido para turno ${apptId}. MP Refund ID: ${mpData.id}`);

    return res.json({ 
      ok: true, 
      message: `Reembolso de $${appt.depositAmount} procesado para ${appt.customerName}`,
      refundId: mpData.id,
      amount: mpData.amount
    });

  } catch (err) {
    console.error("[Refund] Error inesperado:", err.message);
    return res.status(500).json({ error: "Error procesando reembolso" });
  }
});

module.exports = { router, refreshMPToken };


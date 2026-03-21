const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios"); // Si no está axios, usaremos fetch nativo, pero asumo que en Node 18 fetch exite. 
const prisma = require("./prisma");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret_bc_2024";

// Credenciales SaaS de Mercado Pago (Marketplace Owner)
const MP_CLIENT_ID = process.env.MP_CLIENT_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
// URL de redirección (El SaaS recibe al barbero de vuelta)
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI || "https://barbercloud.onrender.com/api/payments/oauth/callback";
const FRONTEND_ADMIN_URL = process.env.FRONTEND_URL 
  ? `${process.env.FRONTEND_URL}/admin_v2.html#/miembros` 
  : "https://barberscloud.vercel.app/admin_v2.html#/miembros";

// Middleware para decodificar al admin/owner logueado (necesario para la auth)
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

// -------------------------------------------------------------
// 1) OAUTH: Redirigir al Barbero a Mercado Pago
// -------------------------------------------------------------
router.get("/oauth/authorize", (req, res) => {
  const { barberId } = req.query;
  if (!barberId) return res.status(400).send("Falta barberId");
  
  if (!MP_CLIENT_ID) {
    return res.status(500).send("El dueño del SaaS aún no ha configurado MP_CLIENT_ID en Render.");
  }

  // El state enviará el ID del barbero para que sepamos a quién asignarle el token al volver.
  const state = String(barberId);
  
  // URL de Mercado Pago para pedir permiso
  const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${MP_REDIRECT_URI}`;
  
  // Redirigimos al navegador a MP
  res.redirect(authUrl);
});

// -------------------------------------------------------------
// 2) OAUTH: Callback de Mercado Pago
// -------------------------------------------------------------
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;

  // URL del frontend a donde mandarlo tras terminar
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
    // Intercambiar el CODE por el ACCESS_TOKEN
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

    // Calcular expiración aproxmada (vienen en segundos)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 15552000)); // Usualmente 180 días

    // Guardar en Prisma para este barbero
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

    // Éxito. Le avisamos al usuario y cerramos o redirigimos.
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
    const { type, data } = req.body;
    const paymentId = data?.id || req.query["data.id"] || req.query.id;
    const barberId = req.query.barberId; // Lo inyectamos en notification_url
    
    // Solo nos interesan los eventos de 'payment' y asegurarnos de tener IDs
    if (!paymentId || type !== "payment") return;
    if (!barberId) {
      console.error("Webhook MP Error: Falta barberId en Query", req.query);
      return;
    }

    // 1. Buscar al barbero para usar su token (ya que recibió el pago)
    const barber = await prisma.barber.findUnique({
      where: { id: Number(barberId) },
      select: { mpAccessToken: true }
    });

    if (!barber || !barber.mpAccessToken) {
      console.error("Webhook MP Error: Barbero no tiene Token");
      return;
    }

    // 2. Traer el detalle real del pago desde MP (verificación de seguridad)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${barber.mpAccessToken}` }
    });
    
    const paymentData = await mpRes.json();
    if (!mpRes.ok) throw new Error("Error fetching payment detail");

    const { status, external_reference } = paymentData;
    if (!external_reference) return;

    // 3. Revisar el estado del turno actual en BD
    const appt = await prisma.appointment.findUnique({
      where: { externalReference: external_reference }
    });

    if (!appt) return;

    // 4. Idempotencia y Lógica de Confirmación
    // Si ya está confirmado, no hacemos nada.
    if (appt.status === "confirmed") return;

    if (status === "approved") {
      // ✅ Pago exitoso y acreditado
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: "confirmed",     // Turno formalizado
          paymentStatus: "paid",   // Seña pagada
          lockExpiresAt: null      // Liberamos el timer de bloqueo
        }
      });
      console.log(`[Webhook] Turno ${appt.id} CONFIRMADO. Pago ID: ${paymentId}`);
    } 
    else if (status === "rejected" || status === "cancelled") {
      // ❌ Pago falló o fue cancelado
      // Si el lock aún está activo y falla, podríamos liberar el slot (null lock).
      // Pero mejor lo pasamos a "canceled" para limpiar basura, o le quitamos el lockExpiresAt y status = "pending" si no querés borrar.
      // Por limpieza, si un pago explícitamente se rechaza/cancela, lo pasaremos a expired para soltar el slot.
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: "expired",
          lockExpiresAt: null
        }
      });
    }

  } catch (err) {
    console.error("Webhook Error en Catch:", err.message);
  }
});

module.exports = { router };

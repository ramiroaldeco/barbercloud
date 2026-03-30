// whatsapp.js
const prisma = require('./prisma');

// Función base para comunicarse con Meta Graph API v21.0
async function sendTemplateMessage(toPhone, templateName, parameters) {
  // Verificamos credenciales para evitar crasheos si no están configuradas
  const TOKEN = process.env.WA_ACCESS_TOKEN;
  const PHONE_ID = process.env.WA_PHONE_ID;

  if (!TOKEN || !PHONE_ID) {
    console.warn(`[WhatsApp] Faltan variables de entorno WA_ACCESS_TOKEN o WA_PHONE_ID. Simulado mensaje a ${toPhone}`);
    return { success: true, messageId: "mock_id_" + Date.now() };
  }

  // Acondicionamos el número: Meta espera código de país sin el '+' ni prefijos locales extras
  // Para Argentina suele ser 549... esto lo deberá manejar el frontend o ser flexible.
  const cleanPhone = toPhone.replace(/\D/g, '');

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_AR" }, // Asumimos español Argentina por defecto, o "es" en Meta
      components: parameters.length > 0 ? [
        {
          type: "body",
          parameters: parameters.map(p => ({
            type: "text",
            text: String(p) // Meta exige string estricto
          }))
        }
      ] : []
    }
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data.error || data));
    }

    return { 
      success: true, 
      messageId: data.messages && data.messages.length > 0 ? data.messages[0].id : null 
    };

  } catch (error) {
    console.error(`[WhatsApp] Error enviando a ${cleanPhone}:`, error.message);
    return { success: false, error: error.message };
  }
}

// -------------------------------------------------------------
// FUNCIONES DE NEGOCIO (ENVÍOS TRANSACCIONALES FIRE-AND-FORGET)
// -------------------------------------------------------------

/**
 * Notifica al cliente que su turno está confirmado.
 * Se dispara cuando el turno es pago en local o al aprobarse MP.
 */
async function notifyCustomerConfirmed(appointmentDetails) {
  // Extraemos la info formateada
  const { id, customerPhone, customerName, date, time, barbershopName, wpOptIn } = appointmentDetails;

  // Si el cliente no dejó celular o desmarcó el checkbox, abortamos prolijamente
  if (!customerPhone || wpOptIn === false) return;

  // Parámetros dinámicos para el template 'turno_confirmado_cliente'
  // {{1}}: Nombre cliente, {{2}}: Barbería, {{3}}: Fecha, {{4}}: Hora
  const params = [
    customerName || "Cliente",
    barbershopName || "Barbería",
    date,
    time
  ];

  // Ejecutamos envío
  const result = await sendTemplateMessage(customerPhone, "turno_confirmado_cliente", params);

  // Dejamos registro asíncrono en DB para trazabilidad
  try {
    await prisma.whatsappLog.create({
      data: {
        appointmentId: id,
        recipientType: "CUSTOMER",
        phone: customerPhone,
        template: "turno_confirmado_cliente",
        status: result.success ? "SENT" : "FAILED",
        messageId: result.messageId || null,
        errorObj: result.error || null
      }
    });
  } catch (dbErr) {
    console.error("[WhatsApp] Error guardando log para cliente:", dbErr.message);
  }
}

/**
 * Notifica al barbero (o dueño) que entró un turno válido.
 */
async function notifyBarberNew(appointmentDetails) {
  const { id, barberPhone, customerName, serviceName, date, time } = appointmentDetails;

  // Si el barbero no configuró un número de celular, lo salteamos
  if (!barberPhone) return;

  // Parámetros para 'nuevo_turno_barbero'
  // {{1}}: Nombre cliente, {{2}}: Servicio, {{3}}: Fecha, {{4}}: Hora
  const params = [
    customerName || "Un cliente",
    serviceName || "su corte",
    date,
    time
  ];

  // Ejecutamos envío
  const result = await sendTemplateMessage(barberPhone, "nuevo_turno_barbero", params);

  // Guardamos log
  try {
    await prisma.whatsappLog.create({
      data: {
        appointmentId: id,
        recipientType: "BARBER",
        phone: barberPhone,
        template: "nuevo_turno_barbero",
        status: result.success ? "SENT" : "FAILED",
        messageId: result.messageId || null,
        errorObj: result.error || null
      }
    });
  } catch (dbErr) {
    console.error("[WhatsApp] Error guardando log para barbero:", dbErr.message);
  }
}

module.exports = {
  notifyCustomerConfirmed,
  notifyBarberNew
};

// signup.js
// Conecta el formulario de signup con /api/onboarding/signup
// Guarda token (bc_token + token) y redirige a admin_v2.html

// API_BASE viene de config.js
const API = (typeof API_BASE !== "undefined" ? API_BASE : "https://barbercloud.onrender.com/api");

const form = document.getElementById("signupForm");
const msg = document.getElementById("msg");
const btnCreate = document.getElementById("btnCreate");

function setMsg(text, type = "info") {
  if (!msg) return;
  msg.textContent = text || "";
  // Mantengo tu estilo: no toco clases globales, solo color inline según estado
  if (type === "ok") msg.style.color = "rgba(34,197,94,.95)";      // verde
  else if (type === "error") msg.style.color = "rgba(248,113,113,.95)"; // rojo
  else msg.style.color = "rgba(148,163,184,.95)";                  // muted
}

function setLoading(isLoading) {
  if (!btnCreate) return;
  btnCreate.disabled = !!isLoading;
  btnCreate.style.opacity = isLoading ? "0.8" : "1";
  btnCreate.style.cursor = isLoading ? "not-allowed" : "pointer";
  btnCreate.textContent = isLoading ? "Creando..." : "Crear cuenta";
}

async function safeReadError(res) {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
    return JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return "Error desconocido";
    }
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  setMsg("");
  setLoading(true);

  try {
    const fd = new FormData(form);

    // Campos EXACTOS según tu HTML
    const shopName = (fd.get("shopName") || "").toString().trim();
    const city = (fd.get("city") || "").toString().trim();
    const phone = (fd.get("phone") || "").toString().trim();
    const address = (fd.get("address") || "").toString().trim();

    const ownerName = (fd.get("ownerName") || "").toString().trim();
    const email = (fd.get("email") || "").toString().trim();
    const password = (fd.get("password") || "").toString();

    if (!shopName || !city || !ownerName || !email || !password) {
      setMsg("Completá los campos obligatorios.", "error");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setMsg("La contraseña debe tener mínimo 6 caracteres.", "error");
      setLoading(false);
      return;
    }

    const payload = {
      shopName,
      city,
      phone: phone || null,
      address: address || null,
      ownerName,
      email,
      password,
    };

    const res = await fetch(`${API}/onboarding/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await safeReadError(res);
      throw new Error(errText);
    }

    const data = await res.json();

    if (!data || !data.token) {
      throw new Error("No recibí token del servidor.");
    }

    // Guardamos token: Admin v2 usa bc_token (y admin viejo puede usar token)
    localStorage.setItem("bc_token", data.token);
    localStorage.setItem("token", data.token);

    setMsg("Cuenta creada ✅ Redirigiendo al panel...", "ok");

    // Redirigir al Admin Pro (config primero)
    window.location.href = "./admin_v2.html#/config";
  } catch (err) {
    console.error(err);
    setMsg("Error: " + (err?.message || "No se pudo crear la cuenta"), "error");
    setLoading(false);
  }
});

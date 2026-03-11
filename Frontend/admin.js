// admin.js
// ❌ NO definir API_BASE acá (viene de config.js, que ya incluye /api)

const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const settingsBox = $("settingsBox");

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const bsName = $("bsName");
const bsCity = $("bsCity");

const publicLinkInput = $("publicLink");
const copyLinkBtn = $("copyLink");

const depositRange = $("depositRange");
const depositLabel = $("depositLabel");
const btnSave = $("btnSave");
const saveMsg = $("saveMsg");
const btnLogout = $("btnLogout");

function setMsg(el, text, ok = true) {
  el.textContent = text || "";
  el.className = ok ? "muted ok" : "muted bad";
}

function getToken() {
  return localStorage.getItem("bc_token") || localStorage.getItem("token") || "";
}

function setToken(t) {
  localStorage.setItem("bc_token", t);
}

function clearToken() {
  localStorage.removeItem("bc_token");
  localStorage.removeItem("barbershopId");
}

depositRange.addEventListener("input", () => {
  depositLabel.textContent = `${depositRange.value}%`;
});

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Seteamos JSON solo si no te pasaron ya otro content-type
  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/**
 * ✅ PASO 3: Link lindo con slug (sin book.html?shop=)
 * - Si existe bs.slug => https://tu-dominio.com/slug
 * - Si NO existe (barbería vieja) => fallback book.html?shop=ID
 */
function setPublicLink(barbershop) {
  if (!publicLinkInput || !barbershop) return;

  const PUBLIC_ORIGIN = window.location.origin; // en Vercel: https://barberscloud.vercel.app

  const slug = barbershop.slug;
  let publicLink = "";

  if (slug) {
    publicLink = `${PUBLIC_ORIGIN}/${slug}`;
  } else {
    // fallback por si alguna barber vieja no tiene slug
    publicLink = `${PUBLIC_ORIGIN}/book.html?shop=${barbershop.id}`;
  }

  publicLinkInput.value = publicLink;

  if (copyLinkBtn) {
    copyLinkBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(publicLink);
        copyLinkBtn.textContent = "Copiado ✅";
        setTimeout(() => (copyLinkBtn.textContent = "Copiar link"), 1200);
      } catch {
        publicLinkInput.select();
        document.execCommand("copy");
      }
    };
  }
}

async function loadSettings() {
  // ✅ OJO: sin /api acá porque API_BASE ya lo tiene incluido
  const bs = await api("/barbershops/mine");

  localStorage.setItem("barbershopId", String(bs.id));

  bsName.textContent = bs.name || "";
  bsCity.textContent = bs.city || "";

  depositRange.value = bs.defaultDepositPercentage ?? 15;
  depositLabel.textContent = `${depositRange.value}%`;

  // ✅ ahora pasa el objeto completo para usar bs.slug si existe
  setPublicLink(bs);

  loginBox.style.display = "none";
  settingsBox.style.display = "block";
  setMsg(saveMsg, "Cargado ✅", true);
}

btnLogin.addEventListener("click", async () => {
  try {
    setMsg(loginMsg, "Ingresando...", true);

    // ✅ sin /api
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value,
      }),
    });

    setToken(data.token);

    setMsg(loginMsg, "OK ✅", true);
    await loadSettings();
  } catch (e) {
    setMsg(loginMsg, e.message, false);
  }
});

btnSave.addEventListener("click", async () => {
  try {
    setMsg(saveMsg, "Guardando...", true);

    // ✅ SOLO enviamos defaultDepositPercentage
    const body = {
      defaultDepositPercentage: Number(depositRange.value),
    };

    // ✅ sin /api
    await api("/barbershops/mine/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    setMsg(saveMsg, "Guardado ✅", true);
  } catch (e) {
    setMsg(saveMsg, e.message, false);
  }
});

btnLogout.addEventListener("click", () => {
  clearToken();
  settingsBox.style.display = "none";
  loginBox.style.display = "block";
  setMsg(loginMsg, "Sesión cerrada.", true);
});

// Auto-load si ya hay token guardado
(async function init() {
  if (getToken()) {
    try {
      await loadSettings();
    } catch (e) {
      clearToken();
      // opcional: mostrar error amigable
      setMsg(loginMsg, "Tu sesión venció. Iniciá sesión de nuevo.", false);
    }
  }
})();

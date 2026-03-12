// admin_v2.js
const API = (typeof API_BASE !== "undefined" ? API_BASE : "https://barbercloud.onrender.com/api");

// ---- token helpers (compat con tu admin viejo) ----
const TOKEN_KEYS = ["bc_token", "token"];
function getToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function setToken(t) {
  localStorage.setItem("bc_token", t);
}
function clearToken() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
}

// ---- small helpers DOM (para NO romper si falta un id) ----
function $(id) {
  return document.getElementById(id);
}
function safeVal(id, fallback = "") {
  const el = $(id);
  if (!el) return fallback;
  return el.value ?? fallback;
}
function safeText(id, txt) {
  const el = $(id);
  if (el) el.textContent = txt;
}
function safeShow(id, show) {
  const el = $(id);
  if (el) el.style.display = show ? "block" : "none";
}

// ---- routing ----
const views = {
  agenda: $("view-agenda"),
  clientes: $("view-clientes"),
  servicios: $("view-servicios"),
  horarios: $("view-horarios"),
  config: $("view-config"),
  miembros: $("view-miembros"),
};

const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

function showView(route) {
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.style.display = k === route ? "block" : "none";
  });

  setActiveNav(route);

  if (route === "agenda") {
    if (pageTitle) pageTitle.textContent = "Agenda";
    if (pageSubtitle) pageSubtitle.textContent = "Gestioná tus turnos";
    loadAppointments();
  }
  if (route === "servicios") {
    if (pageTitle) pageTitle.textContent = "Servicios";
    if (pageSubtitle) pageSubtitle.textContent = "Precios, duración y seña";
    loadServices();
  }
  if (route === "horarios") {
    if (pageTitle) pageTitle.textContent = "Plantilla Horaria";
    if (pageSubtitle) pageSubtitle.textContent = "Horarios semanales";
    loadWorkingHours();
  }
  if (route === "config") {
    if (pageTitle) pageTitle.textContent = "Configuración";
    if (pageSubtitle) pageSubtitle.textContent = "Datos de tu barbería";
    loadConfig();
  }
  if (route === "clientes") {
    if (pageTitle) pageTitle.textContent = "Clientes";
    if (pageSubtitle) pageSubtitle.textContent = "Historial y búsqueda";
    loadClients();
  }
  if (route === "miembros") {
    if (pageTitle) pageTitle.textContent = "Equipo";
    if (pageSubtitle) pageSubtitle.textContent = "Tus barberos y plantillas horarias";
    loadMembers();
  }
}

function getRoute() {
  const hash = location.hash || "#/agenda";
  return hash.replace("#/", "");
}

window.addEventListener("hashchange", () => showView(getRoute()));

// ---- API helpers ----
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function safeTextRes(res) {
  try {
    return await res.text();
  } catch {
    return "Error";
  }
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await safeTextRes(res));
  return res.json();
}

// ---- modal ----
const modalBackdrop = $("modalBackdrop");
const modalTitle = $("modalTitle");
const modalSubtitle = $("modalSubtitle");
const modalBody = $("modalBody");
const btnModalClose = $("btnModalClose");
const btnModalCancel = $("btnModalCancel");
const btnModalOk = $("btnModalOk");

let modalResolve = null;

// ✅ CAMBIO: limpiar modalBody al abrir (para que no quede "sucio")
function openModal({ title, subtitle = "", bodyHtml, okText = "Guardar" }) {
  if (modalBody) modalBody.innerHTML = ""; // ✅ limpiar al abrir
  if (modalTitle) modalTitle.textContent = title;
  if (modalSubtitle) modalSubtitle.textContent = subtitle;
  if (modalBody) modalBody.innerHTML = bodyHtml;
  if (btnModalOk) btnModalOk.textContent = okText;
  if (modalBackdrop) modalBackdrop.style.display = "grid";

  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

// ✅ CAMBIO: NO limpiar modalBody al cerrar (porque después necesitamos leer inputs)
function closeModal(result = null) {
  if (modalBackdrop) modalBackdrop.style.display = "none";
  // ❌ NO borres modalBody acá, porque después necesitamos leer los inputs
  if (modalResolve) modalResolve(result);
  modalResolve = null;
}

btnModalClose?.addEventListener("click", () => closeModal(null));
btnModalCancel?.addEventListener("click", () => closeModal(null));
btnModalOk?.addEventListener("click", () => closeModal({ ok: true }));

// ---- login ----
const loginBackdrop = $("loginBackdrop");
const btnOpenLogin = $("btnOpenLogin");
const btnLogin = $("btnLogin");
const btnLoginClose = $("btnLoginClose");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginError = $("loginError");

function openLogin() {
  if (loginError) loginError.style.display = "none";
  if (loginBackdrop) loginBackdrop.style.display = "grid";
}
function closeLogin() {
  if (loginBackdrop) loginBackdrop.style.display = "none";
}

btnOpenLogin?.addEventListener("click", openLogin);
btnLoginClose?.addEventListener("click", closeLogin);

btnLogin?.addEventListener("click", async () => {
  try {
    if (loginError) loginError.style.display = "none";
    const email = (loginEmail?.value || "").trim();
    const password = loginPassword?.value || "";

    if (!email || !password) {
      if (loginError) {
        loginError.textContent = "Completá email y contraseña.";
        loginError.style.display = "block";
      }
      return;
    }

    const data = await apiPost("/auth/login", { email, password });
    if (!data.token) throw new Error("No recibí token");

    setToken(data.token);
    closeLogin();
    await loadShopHeader();
    showView(getRoute());
  } catch (e) {
    if (loginError) {
      loginError.textContent = "Error: " + e.message;
      loginError.style.display = "block";
    }
  }
});

$("btnLogout")?.addEventListener("click", () => {
  clearToken();
  openLogin();
});

// ---- shop header ----
async function loadShopHeader() {
  try {
    const data = await apiGet("/barbershops/mine");

    safeText("shopName", data.name || "BarberCloud");
    safeText("shopCity", data.city || "Admin");
    const avatar = (data.name || "B").trim().charAt(0).toUpperCase();
    safeText("shopAvatar", avatar);

    const filled = ["name", "city", "address", "phone", "slug"].filter((k) => data[k]).length;
    const pct = Math.round((filled / 5) * 100);
    safeText("setupPct", `${pct}%`);
    const bar = $("setupBar");
    if (bar) bar.style.width = `${pct}%`;
  } catch (e) {
    console.warn("No pude cargar barbería (mine):", e.message);
  }
}

// ---- Agenda ----
function statusBadge(status) {
  if (status === "confirmed") return `<span class="badge good">● Confirmado</span>`;
  if (status === "canceled") return `<span class="badge bad">● Cancelado</span>`;
  return `<span class="badge warn">● Pendiente</span>`;
}

async function loadAppointments() {
  const tbody = document.querySelector("#appointmentsTable tbody");
  const empty = $("appointmentsEmpty");

  // ✅ NO explota si falta algún input en tu HTML
  const q = (safeVal("qAppointments", "") || "").trim();
  const status = safeVal("statusFilter", "");
  const from = safeVal("fromDate", "");
  const to = safeVal("toDate", "");

  if (tbody) tbody.innerHTML = "";
  if (empty) empty.style.display = "none";

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (q) params.set("q", q);

    const data = await apiGet(`/appointments?${params.toString()}`);
    const items = data.items || data || [];

    if (!items.length) {
      if (empty) {
        empty.style.display = "block";
        empty.textContent = "No tenés turnos para este rango.";
      }
      return;
    }

    for (const a of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(a.date || "")}</td>
        <td>${escapeHtml(a.time || "")}</td>
        <td>${escapeHtml(a.service?.name || "")}</td>
        <td>${escapeHtml(a.customerName || "")}</td>
        <td>${escapeHtml(a.customerPhone || "")}</td>
        <td>${statusBadge(a.status)}</td>
        <td class="right">
          <button class="btn" data-act="confirm" data-id="${a.id}">Confirmar</button>
          <button class="btn" data-act="cancel" data-id="${a.id}">Cancelar</button>
        </td>
      `;
      tbody?.appendChild(tr);
    }
  } catch (e) {
    if (empty) {
      empty.style.display = "block";
      empty.textContent = "Error cargando turnos: " + e.message;
    }
  }
}

$("btnApplyFilters")?.addEventListener("click", loadAppointments);

document.querySelector("#appointmentsTable")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (!id || !act) return;

  try {
    if (act === "confirm") await apiPut(`/appointments/${id}/status`, { status: "confirmed" });
    if (act === "cancel") await apiPut(`/appointments/${id}/status`, { status: "canceled" });
    await loadAppointments();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// ✅ NUEVO: Agregar turno (modal + POST /appointments/owner)
// - usa un único addEventListener al botón por ID: btnQuickAdd
// - valida que los inputs existan antes de leer values (safeVal ya lo hace)
async function openAddTurnModal() {
  try {
    // 1) pedir lista de servicios (del dueño)
    const resp = await apiGet("/services/mine");
    const services = resp.items || resp || [];

    if (!services.length) {
      alert("Primero creá al menos 1 servicio en la sección 'Servicios'.");
      location.hash = "#/servicios";
      return;
    }

    const optionsHtml = services
      .map(
        (s) =>
          `<option value="${s.id}">${escapeHtml(s.name)} ($${escapeHtml(String(s.price))})</option>`
      )
      .join("");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const result = await openModal({
      title: "Nuevo turno",
      subtitle: "Cargá cliente, fecha y servicio",
      bodyHtml: `
        <label class="label">Fecha</label>
        <input class="input" id="apptDate" type="date" value="${todayStr}" />

        <label class="label">Hora</label>
        <input class="input" id="apptTime" type="time" value="10:00" />

        <label class="label">Servicio</label>
        <select class="input" id="apptService">
          ${optionsHtml}
        </select>

        <label class="label">Cliente</label>
        <input class="input" id="apptName" placeholder="Nombre y apellido" />

        <label class="label">Teléfono</label>
        <input class="input" id="apptPhone" placeholder="3534..." />
      `,
      okText: "Crear turno",
    });

    if (!result?.ok) return;

    // 2) leer valores (safeVal valida existencia del input)
    const date = String(safeVal("apptDate", "")).trim();
    const time = String(safeVal("apptTime", "")).trim();
    const serviceIdRaw = safeVal("apptService", "");
    const serviceId = Number(serviceIdRaw);
    const customerName = String(safeVal("apptName", "")).trim();
    const customerPhone = String(safeVal("apptPhone", "")).trim();

    if (!date || !time || !serviceIdRaw || Number.isNaN(serviceId)) {
      alert("Completá fecha, hora y servicio.");
      return;
    }
    if (!customerName) {
      alert("Completá el nombre del cliente.");
      return;
    }

    // 3) crear turno desde el admin (dueño) ✅ /appointments/owner
    await apiPost("/appointments/owner", {
      serviceId,
      date,
      time,
      customerName,
      customerPhone: customerPhone || null,
      status: "pending",
    });

    await loadAppointments();
    alert("Turno creado ✅");
  } catch (e) {
    alert("Error creando turno: " + e.message);
  }
}

// ✅ Enganche pedido: un único addEventListener por ID
(function bindQuickAddOnce() {
  const btn = document.getElementById("btnQuickAdd");
  if (!btn) return;
  // evita duplicar listeners si el script se carga 2 veces
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", openAddTurnModal);
})();

// ---- Servicios ----
async function loadServices() {
  const grid = $("servicesGrid");
  if (!grid) return;
  grid.innerHTML = "";

  try {
    const data = await apiGet("/services/mine");
    const items = data.items || data || [];

    if (!items.length) {
      grid.innerHTML = `<div class="muted">Todavía no tenés servicios. Creá el primero.</div>`;
      return;
    }

    for (const s of items) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-head">
          <div>
            <h3 style="margin:0">${escapeHtml(s.name)}</h3>
            <p class="muted" style="margin:6px 0 0">
              $${escapeHtml(String(s.price))} • ${escapeHtml(String(s.durationMinutes || 30))} min
              ${
                s.depositPercentage != null
                  ? `• Seña ${escapeHtml(String(s.depositPercentage))}%`
                  : "• Seña por defecto"
              }
            </p>
          </div>
          <div class="actions">
            <button class="btn" data-edit="${s.id}">Editar</button>
            <button class="btn" data-del="${s.id}">Borrar</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    }
  } catch (e) {
    grid.innerHTML = `<div class="muted">Error cargando servicios: ${escapeHtml(e.message)}</div>`;
  }
}

$("btnNewService")?.addEventListener("click", async () => {
  const result = await openModal({
    title: "Nuevo servicio",
    subtitle: "Creá un servicio para tu barbería",
    bodyHtml: `
      <label class="label">Nombre</label>
      <input class="input" id="srvName" placeholder="Corte" />
      <label class="label">Precio</label>
      <input class="input" id="srvPrice" type="number" placeholder="3000" />
      <label class="label">Duración (min)</label>
      <input class="input" id="srvDur" type="number" placeholder="30" />
      <label class="label">Seña (%) (opcional)</label>
      <input class="input" id="srvDep" type="number" placeholder="15" />
      <label class="label">Descripción (opcional)</label>
      <input class="input" id="srvDesc" placeholder="Corte clásico..." />
    `,
    okText: "Crear",
  });

  if (!result?.ok) return;

  try {
    // ✅ valida existencia antes de leer
    const name = ($("srvName")?.value ?? "").trim();
    const price = Number($("srvPrice")?.value);
    const durationMinutes = Number($("srvDur")?.value || 30);
    const depRaw = $("srvDep")?.value ?? "";
    const depositPercentage = depRaw === "" ? null : Number(depRaw);
    const description = ($("srvDesc")?.value ?? "").trim();

    if (!name || Number.isNaN(price)) throw new Error("Nombre y precio son obligatorios");

    await apiPost("/services", {
      name,
      price,
      durationMinutes,
      depositPercentage,
      description: description || null,
    });

    closeModal();
    await loadServices();
  } catch (e) {
    alert("Error: " + e.message);
  }
});

$("servicesGrid")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const editId = btn.dataset.edit;
  const delId = btn.dataset.del;

  if (delId) {
    if (!confirm("¿Seguro que querés borrar este servicio?")) return;
    try {
      await apiDelete(`/services/${delId}`);
      await loadServices();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  if (editId) {
    try {
      const services = await apiGet("/services/mine");
      const items = services.items || services || [];
      const s = items.find((x) => String(x.id) === String(editId));
      if (!s) return alert("No encontré el servicio");

      const result = await openModal({
        title: "Editar servicio",
        subtitle: "Actualizá precio, duración o seña",
        bodyHtml: `
          <label class="label">Nombre</label>
          <input class="input" id="srvName" value="${escapeAttr(s.name)}" />
          <label class="label">Precio</label>
          <input class="input" id="srvPrice" type="number" value="${escapeAttr(String(s.price))}" />
          <label class="label">Duración (min)</label>
          <input class="input" id="srvDur" type="number" value="${escapeAttr(
            String(s.durationMinutes || 30)
          )}" />
          <label class="label">Seña (%) (vacío = usa por defecto)</label>
          <input class="input" id="srvDep" type="number" value="${
            s.depositPercentage == null ? "" : escapeAttr(String(s.depositPercentage))
          }" />
          <label class="label">Descripción (opcional)</label>
          <input class="input" id="srvDesc" value="${
            s.description ? escapeAttr(String(s.description)) : ""
          }" />
        `,
        okText: "Guardar",
      });

      if (!result?.ok) return;

      // ✅ valida existencia antes de leer
      const name = ($("srvName")?.value ?? "").trim();
      const price = Number($("srvPrice")?.value);
      const durationMinutes = Number($("srvDur")?.value || 30);
      const depRaw = $("srvDep")?.value ?? "";
      const depositPercentage = depRaw === "" ? null : Number(depRaw);
      const description = ($("srvDesc")?.value ?? "").trim();

      await apiPut(`/services/${editId}`, {
        name,
        price,
        durationMinutes,
        depositPercentage,
        description: description || null,
      });

      closeModal();
      await loadServices();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }
});

// ---- Config ----
async function loadConfig() {
  try {
    const shop = await apiGet("/barbershops/mine");
    if ($("cfgName")) $("cfgName").value = shop.name || "";
    if ($("cfgCity")) $("cfgCity").value = shop.city || "";
    if ($("cfgAddress")) $("cfgAddress").value = shop.address || "";
    if ($("cfgPhone")) $("cfgPhone").value = shop.phone || "";
    if ($("cfgSlug")) $("cfgSlug").value = shop.slug || "";
    if ($("cfgDepositPct"))
      $("cfgDepositPct").value =
        shop.defaultDepositPercentage != null ? String(shop.defaultDepositPercentage) : "";
  } catch (e) {
    console.warn(e.message);
  }
}

$("btnSaveConfig")?.addEventListener("click", async () => {
  try {
    const name = safeVal("cfgName", "").trim();
    const city = safeVal("cfgCity", "").trim();
    const address = safeVal("cfgAddress", "").trim();
    const phone = safeVal("cfgPhone", "").trim();
    const slug = safeVal("cfgSlug", "").trim();
    const pctRaw = safeVal("cfgDepositPct", "").trim();
    const pct = pctRaw === "" ? NaN : Number(pctRaw);

    await apiPut("/barbershops/mine", {
      name,
      city: city || null,
      address: address || null,
      phone: phone || null,
      slug: slug || null,
    });

    if (!Number.isNaN(pct)) {
      await apiPut("/barbershops/mine/settings", { defaultDepositPercentage: pct });
    }

    await loadShopHeader();
    alert("Guardado ✅");
  } catch (e) {
    alert("Error: " + e.message);
  }
});

// ---- utils ----
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[s]));
}
function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- Clientes ----
async function loadClients() {
  const tbody = document.querySelector("#clientsTable tbody");
  const empty = $("clientsEmpty");
  const q = (safeVal("qClients", "") || "").trim();

  if (tbody) tbody.innerHTML = "";
  if (empty) empty.style.display = "none";

  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);

    const data = await apiGet(`/clients/mine?${params.toString()}`);
    const items = data.items || [];

    if (!items.length) {
      if (empty) {
        empty.style.display = "block";
        empty.textContent = q ? "No se encontraron clientes." : "No hay clientes todavía.";
      }
      return;
    }

    for (const c of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(c.customerName || "")}</td>
        <td>${escapeHtml(c.customerPhone || "")}</td>
        <td>${escapeHtml(c.customerEmail || "—")}</td>
        <td>${c.totalAppointments || 0}</td>
        <td>${c.confirmedAppointments || 0}</td>
        <td>${escapeHtml(c.lastDate || "—")}</td>
      `;
      tbody?.appendChild(tr);
    }
  } catch (e) {
    if (empty) {
      empty.style.display = "block";
      empty.textContent = "Error cargando clientes: " + e.message;
    }
  }
}

$("btnSearchClients")?.addEventListener("click", loadClients);

// ---- Calendar Tab Toggle ----
let currentTab = "list";

document.querySelector(".tabs")?.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;

  const mode = tab.dataset.tab;
  if (!mode) return;

  currentTab = mode;

  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");

  const tableWrap = document.querySelector("#view-agenda .table-wrap");
  const filtersEl = document.querySelector("#view-agenda .filters");
  const emptyEl = $("appointmentsEmpty");
  const calEl = $("calendarView");

  if (mode === "list") {
    if (tableWrap) tableWrap.style.display = "block";
    if (filtersEl) filtersEl.style.display = "flex";
    if (emptyEl) emptyEl.style.display = "";
    if (calEl) calEl.style.display = "none";
    loadAppointments();
  } else {
    if (tableWrap) tableWrap.style.display = "none";
    if (filtersEl) filtersEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "none";
    if (calEl) calEl.style.display = "block";
    renderCalendar();
  }
});

// ---- Calendar Render ----
let calWeekOffset = 0;

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push({ date: `${yyyy}-${mm}-${dd}`, dayName: d.toLocaleDateString("es-AR", { weekday: "short" }), dayNum: dd });
  }
  return dates;
}

async function renderCalendar() {
  const cal = $("calendarView");
  if (!cal) return;

  const dates = getWeekDates(calWeekOffset);
  const from = dates[0].date;
  const to = dates[6].date;

  let items = [];
  try {
    const data = await apiGet(`/appointments?from=${from}&to=${to}`);
    items = data.items || data || [];
  } catch (e) {
    cal.innerHTML = `<div class="muted">Error cargando turnos: ${escapeHtml(e.message)}</div>`;
    return;
  }

  // Group by date+hour
  const grid = {};
  for (const a of items) {
    if (a.status === "canceled") continue;
    const hour = (a.time || "00:00").slice(0, 2);
    const key = `${a.date}_${hour}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(a);
  }

  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(String(h).padStart(2, "0"));

  const headerCells = dates.map(d => `<th style="text-align:center;min-width:100px">${d.dayName}<br/><b>${d.dayNum}</b></th>`).join("");

  const rows = hours.map(h => {
    const cells = dates.map(d => {
      const key = `${d.date}_${h}`;
      const appts = grid[key] || [];
      const content = appts.map(a => {
        const badge = a.status === "confirmed" ? "good" : "warn";
        return `<div class="badge ${badge}" style="font-size:11px;margin:2px 0;display:block">${escapeHtml(a.customerName || "?")} ${escapeHtml(a.time || "")}</div>`;
      }).join("");
      return `<td style="vertical-align:top;padding:6px">${content}</td>`;
    }).join("");
    return `<tr><td style="color:var(--muted);font-size:12px;white-space:nowrap">${h}:00</td>${cells}</tr>`;
  }).join("");

  cal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">
      <button class="btn" id="calPrev">◀ Anterior</button>
      <span><b>${dates[0].date}</b> — <b>${dates[6].date}</b></span>
      <button class="btn" id="calNext">Siguiente ▶</button>
    </div>
    <div class="table-wrap">
      <table class="table" style="min-width:900px">
        <thead><tr><th style="width:60px">Hora</th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  $("calPrev")?.addEventListener("click", () => { calWeekOffset--; renderCalendar(); });
  $("calNext")?.addEventListener("click", () => { calWeekOffset++; renderCalendar(); });
}

// botones top
$("btnReload")?.addEventListener("click", async () => {
  await loadShopHeader();
  showView(getRoute());
});

// ===============================
// PLANTILLA HORARIA (PRO)
// ===============================
const WEEKDAYS = [
  { i: 0, name: "Domingo" },
  { i: 1, name: "Lunes" },
  { i: 2, name: "Martes" },
  { i: 3, name: "Miércoles" },
  { i: 4, name: "Jueves" },
  { i: 5, name: "Viernes" },
  { i: 6, name: "Sábado" },
];

let whState = {}; // {weekday: [{startTime,endTime}]}

function whEmptyState() {
  const s = {};
  for (const d of WEEKDAYS) s[d.i] = [];
  return s;
}

function parseTimeToMin(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function validateState(state) {
  for (const d of WEEKDAYS) {
    const ranges = state[d.i] || [];
    for (const r of ranges) {
      if (!r.startTime || !r.endTime) return `Faltan horas en ${d.name}`;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime)) return `Hora inválida en ${d.name}`;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.endTime)) return `Hora inválida en ${d.name}`;
      if (parseTimeToMin(r.startTime) >= parseTimeToMin(r.endTime)) {
        return `En ${d.name}, la hora de inicio debe ser menor a la de fin`;
      }
    }
    // no solapes
    const sorted = [...ranges].sort((a, b) => parseTimeToMin(a.startTime) - parseTimeToMin(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (parseTimeToMin(sorted[i].startTime) < parseTimeToMin(sorted[i - 1].endTime)) {
        return `En ${d.name}, tenés franjas superpuestas`;
      }
    }
  }
  return null;
}

async function loadWorkingHours() {
  const root = document.getElementById("view-horarios");
  if (!root) return;

  root.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <h3 style="margin:0">Plantilla semanal</h3>
          <p class="muted" style="margin:6px 0 0">Definí tus horarios por día. Podés tener varias franjas (mañana/tarde).</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn" id="btnWhReset">Restablecer</button>
          <button class="btn primary" id="btnWhSave">Guardar cambios</button>
        </div>
      </div>
    </div>

    <div id="whGrid" class="grid wh-grid"></div>

    <div class="muted" style="margin-top:10px">
      Tip: si dejás un día sin franjas, queda como <b>cerrado</b>.
    </div>
  `;

  // load from API
  whState = whEmptyState();
  try {
    const data = await apiGet("/working-hours/mine");
    const items = data.items || [];
    for (const it of items) {
      const w = Number(it.weekday);
      if (!whState[w]) whState[w] = [];
      whState[w].push({ startTime: it.startTime, endTime: it.endTime });
    }
    // ordenar
    for (const d of WEEKDAYS) {
      whState[d.i].sort((a, b) => parseTimeToMin(a.startTime) - parseTimeToMin(b.startTime));
    }
  } catch (e) {
    // si no existe todavía, igual mostramos vacío
    console.warn("No pude cargar working hours:", e.message);
  }

  renderWorkingHours();

  // ✅ 6.3 Llamarlo cuando entras a Plantilla Horaria
  await loadBlockedTimes();

  document.getElementById("btnWhReset")?.addEventListener("click", () => {
    if (!confirm("¿Restablecer la plantilla a vacío?")) return;
    whState = whEmptyState();
    renderWorkingHours();
  });

  document.getElementById("btnWhSave")?.addEventListener("click", saveWorkingHours);
}

function renderWorkingHours() {
  const grid = document.getElementById("whGrid");
  if (!grid) return;

  grid.innerHTML = WEEKDAYS.map((d) => {
    const ranges = whState[d.i] || [];
    const isClosed = ranges.length === 0;

    const rows = ranges
      .map(
        (r, idx) => `
        <div class="wh-row" style="display:flex;gap:10px;align-items:flex-end;margin-top:10px">
          <div style="flex:1">
            <label class="muted" style="display:block;margin-bottom:6px">Desde</label>
            <input class="input" type="time" data-wh-start="${d.i}:${idx}" value="${escapeAttr(r.startTime)}" />
          </div>
          <div style="flex:1">
            <label class="muted" style="display:block;margin-bottom:6px">Hasta</label>
            <input class="input" type="time" data-wh-end="${d.i}:${idx}" value="${escapeAttr(r.endTime)}" />
          </div>
          <button class="btn" data-wh-del="${d.i}:${idx}" title="Eliminar franja">✕</button>
        </div>
      `
      )
      .join("");

    return `
      <div class="card">
        <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">${d.name}</h3>
            <p class="muted" style="margin:6px 0 0">${isClosed ? "Cerrado" : "Abierto"}</p>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <!-- Toggle -->
            <button class="btn" data-wh-toggle="${d.i}">
              ${isClosed ? "Abrir" : "Cerrar"}
            </button>

            <!-- Add -->
            <button class="btn" data-wh-add="${d.i}" ${isClosed ? "disabled" : ""}>+ Agregar franja</button>

            <!-- Copy -->
            <button class="btn" data-wh-copy="${d.i}" ${isClosed ? "disabled" : ""}>Copiar</button>
          </div>
        </div>

        <div style="margin-top:12px">
          ${
            isClosed
              ? `<div class="muted">Sin franjas. (${d.name} cerrado)</div>`
              : rows
          }
        </div>

        ${
          isClosed
            ? ""
            : `
          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" data-wh-preset="${d.i}:corrido">Preset: corrido</button>
            <button class="btn" data-wh-preset="${d.i}:cortado">Preset: cortado</button>
            <button class="btn" data-wh-preset="${d.i}:tarde">Preset: tarde</button>
          </div>
        `
        }
      </div>
    `;
  }).join("");

  // delegation
  grid.onclick = (e) => {
    const addBtn = e.target.closest("[data-wh-add]");
    const delBtn = e.target.closest("[data-wh-del]");
    const toggleBtn = e.target.closest("[data-wh-toggle]");
    const copyBtn = e.target.closest("[data-wh-copy]");
    const presetBtn = e.target.closest("[data-wh-preset]");

    if (toggleBtn) {
      const wd = Number(toggleBtn.dataset.whToggle);
      const ranges = whState[wd] || [];
      if (ranges.length === 0) {
        // abrir con default lindo
        whState[wd] = [{ startTime: "10:00", endTime: "13:00" }, { startTime: "16:00", endTime: "20:00" }];
      } else {
        // cerrar
        whState[wd] = [];
      }
      renderWorkingHours();
      return;
    }

    if (addBtn) {
      const wd = Number(addBtn.dataset.whAdd);
      if (!whState[wd]) whState[wd] = [];
      whState[wd].push({ startTime: "10:00", endTime: "13:00" });
      renderWorkingHours();
      return;
    }

    if (delBtn) {
      const [wdStr, idxStr] = String(delBtn.dataset.whDel).split(":");
      const wd = Number(wdStr);
      const idx = Number(idxStr);
      whState[wd].splice(idx, 1);
      renderWorkingHours();
      return;
    }

    if (presetBtn) {
      const [wdStr, preset] = String(presetBtn.dataset.whPreset).split(":");
      const wd = Number(wdStr);
      if (preset === "corrido") {
        whState[wd] = [{ startTime: "10:00", endTime: "20:00" }];
      } else if (preset === "cortado") {
        whState[wd] = [{ startTime: "10:00", endTime: "13:00" }, { startTime: "16:00", endTime: "20:00" }];
      } else if (preset === "tarde") {
        whState[wd] = [{ startTime: "16:00", endTime: "21:00" }];
      }
      renderWorkingHours();
      return;
    }

    if (copyBtn) {
      const wd = Number(copyBtn.dataset.whCopy);
      openCopyDayModal(wd);
      return;
    }
  };

  grid.oninput = (e) => {
    const startEl = e.target.closest("[data-wh-start]");
    const endEl = e.target.closest("[data-wh-end]");
    if (startEl) {
      const [wdStr, idxStr] = String(startEl.dataset.whStart).split(":");
      const wd = Number(wdStr);
      const idx = Number(idxStr);
      whState[wd][idx].startTime = startEl.value;
    }
    if (endEl) {
      const [wdStr, idxStr] = String(endEl.dataset.whEnd).split(":");
      const wd = Number(wdStr);
      const idx = Number(idxStr);
      whState[wd][idx].endTime = endEl.value;
    }
  };
}

// ===============================
// MODAL “COPIAR DÍA A…”
// (pegado abajo de renderWorkingHours / bloque plantilla horaria)
// ===============================
async function openCopyDayModal(fromWeekday) {
  const fromName = WEEKDAYS.find(d => d.i === fromWeekday)?.name || "Día";

  const checks = WEEKDAYS
    .filter(d => d.i !== fromWeekday)
    .map(d => `
      <label style="display:flex;gap:10px;align-items:center;margin:8px 0">
        <input type="checkbox" data-copy-target="${d.i}" />
        <span>${d.name}</span>
      </label>
    `).join("");

  const body = `
    <div class="muted">Copiar horarios de <b>${fromName}</b> a:</div>
    <div style="margin-top:10px">${checks}</div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" id="btnCopyAll">Copiar a toda la semana</button>
    </div>
  `;

  const result = await openModal({
    title: "Copiar horarios",
    subtitle: "Ahorra tiempo copiando un día a otros días",
    bodyHtml: body,
    okText: "Copiar",
  });

  if (!result?.ok) return;

  // targets seleccionados
  const targets = Array.from(document.querySelectorAll("[data-copy-target]"))
    .filter(el => el.checked)
    .map(el => Number(el.dataset.copyTarget));

  // si tocó ok sin seleccionar nada
  if (!targets.length) {
    alert("Seleccioná al menos un día.");
    return;
  }

  const source = (whState[fromWeekday] || []).map(r => ({ ...r }));
  for (const t of targets) {
    whState[t] = source.map(r => ({ ...r }));
  }
  renderWorkingHours();
}

// botón "copiar a toda la semana" dentro del modal
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btnCopyAll");
  if (!btn) return;
  // tilda todos los checkboxes del modal
  document.querySelectorAll("[data-copy-target]").forEach(el => el.checked = true);
});

async function saveWorkingHours() {
  const err = validateState(whState);
  if (err) return alert(err);

  // flatten
  const items = [];
  for (const d of WEEKDAYS) {
    const ranges = whState[d.i] || [];
    for (const r of ranges) {
      items.push({
        weekday: d.i,
        startTime: r.startTime,
        endTime: r.endTime,
      });
    }
  }

  try {
    await apiPut("/working-hours/mine", { items });
    alert("Plantilla guardada ✅");
  } catch (e) {
    alert("Error guardando: " + e.message);
  }
}

// ===============================
// 6.2 BLOQUEOS / VACACIONES (admin)
// Pegado en la parte de Plantilla Horaria o al final del archivo
// ===============================
async function loadBlockedTimes() {
  const box = document.getElementById("blocksList");
  if (!box) return;

  box.innerHTML = `<div class="muted">Cargando bloqueos...</div>`;
  try {
    const data = await apiGet("/blocked-times/mine");
    const items = data.items || [];

    if (!items.length) {
      box.innerHTML = `<div class="muted">No hay bloqueos.</div>`;
      return;
    }

    box.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${items.map(b => {
          const range = b.dateTo ? `${b.dateFrom} → ${b.dateTo}` : b.dateFrom;
          const time = (b.startTime && b.endTime) ? ` • ${b.startTime}-${b.endTime}` : ` • Día completo`;
          const reason = b.reason ? ` • ${escapeHtml(b.reason)}` : "";
          return `
            <div class="card" style="padding:12px;display:flex;justify-content:space-between;align-items:center;gap:12px">
              <div>
                <div><b>${range}</b>${time}${reason}</div>
              </div>
              <button class="btn" data-del-block="${b.id}">Eliminar</button>
            </div>
          `;
        }).join("")}
      </div>
    `;

    box.onclick = async (e) => {
      const btn = e.target.closest("[data-del-block]");
      if (!btn) return;
      const id = btn.dataset.delBlock;

      if (!confirm("¿Eliminar este bloqueo?")) return;
      await apiDelete(`/blocked-times/mine/${id}`);
      await loadBlockedTimes();
    };

  } catch (e) {
    box.innerHTML = `<div class="muted">Error cargando bloqueos: ${escapeHtml(e.message)}</div>`;
  }
}

async function openAddBlockModal() {
  const body = `
    <label class="muted">Desde (YYYY-MM-DD)</label>
    <input id="blkFrom" class="input" type="date" />

    <label class="muted" style="margin-top:10px;display:block">Hasta (opcional)</label>
    <input id="blkTo" class="input" type="date" />

    <div style="margin-top:10px" class="muted">Si no ponés horas, se bloquea el día completo.</div>

    <div style="display:flex;gap:10px;margin-top:10px">
      <div style="flex:1">
        <label class="muted">Desde</label>
        <input id="blkStart" class="input" type="time" />
      </div>
      <div style="flex:1">
        <label class="muted">Hasta</label>
        <input id="blkEnd" class="input" type="time" />
      </div>
    </div>

    <label class="muted" style="margin-top:10px;display:block">Motivo (opcional)</label>
    <input id="blkReason" class="input" placeholder="Vacaciones / médico / etc." />
  `;

  const res = await openModal({
    title: "Nuevo bloqueo",
    subtitle: "Esto se va a reflejar en los horarios disponibles del booking",
    bodyHtml: body,
    okText: "Guardar",
  });
  if (!res?.ok) return;

  const dateFrom = document.getElementById("blkFrom")?.value;
  const dateTo = document.getElementById("blkTo")?.value || null;
  const startTime = document.getElementById("blkStart")?.value || null;
  const endTime = document.getElementById("blkEnd")?.value || null;
  const reason = document.getElementById("blkReason")?.value || null;

  await apiPost("/blocked-times/mine", { dateFrom, dateTo, startTime, endTime, reason });
  await loadBlockedTimes();
}

// Hook botón
document.addEventListener("click", (e) => {
  const b = e.target.closest("#btnAddBlock");
  if (!b) return;
  openAddBlockModal();
});

// ===============================
// 7. MÓDULO DE MIEMBROS
// ===============================
async function loadMembers() {
  const grid = $("membersGrid");
  if (!grid) return;
  
  grid.innerHTML = `<div class="muted">Cargando equipo...</div>`;
  try {
    const res = await apiGet("/members");
    const members = res.members || [];
    
    // Solo mostramos barberos activos
    const activeMembers = members.filter(m => m.isActive);
    
    if (!activeMembers.length) {
      grid.innerHTML = `<div class="muted">Todavía no agregaste a nadie a tu equipo.</div>`;
      return;
    }
    
    grid.innerHTML = activeMembers.map(m => {
      const avatarSrc = m.avatarBase64 || "https://ui-avatars.com/api/?name=" + encodeURIComponent(m.name) + "&background=1e293b&color=38bdf8";
      const servicesNames = m.services.map(s => s.name).join(", ") || "Sin servicios";
      return `
        <div class="card" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${avatarSrc}" alt="${escapeAttr(m.name)}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid var(--border-h);" />
            <div>
              <h3 style="margin:0">${escapeHtml(m.name)}</h3>
              <p class="muted" style="margin:4px 0 0; font-size:13px;">${escapeHtml(m.role)}</p>
            </div>
          </div>
          <div>
            <p style="font-size:13px; margin:0"><b>Servicios:</b> <span class="muted">${escapeHtml(servicesNames)}</span></p>
          </div>
          <div style="margin-top:auto; display:flex; gap:8px; flex-wrap:wrap">
            <button class="btn" data-edit-member="${m.id}" style="flex:1">Editar</button>
            <button class="btn" data-schedule-member="${m.id}" style="flex:1; background:var(--surface);">Horarios</button>
            <button class="icon-btn" data-del-member="${m.id}" style="color:#ef4444" title="Desactivar">✕</button>
          </div>
        </div>
      `;
    }).join("");
    
    window._cachedMembers = members;
  } catch (err) {
    grid.innerHTML = `<div class="muted">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// Convert File to WebP Base64 (max 150x150)
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 150;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
        } else {
          if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", 0.8));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

$("btnNewMember")?.addEventListener("click", async () => {
  let services = [];
  try {
    const sRes = await apiGet("/services/mine");
    services = sRes.items || sRes || [];
  } catch(e) {}
  
  const servicesHtml = services.map(s => `
    <label style="display:flex; align-items:center; gap:8px; font-size:14px;">
      <input type="checkbox" name="memServices" value="${s.id}" checked />
      <span>${escapeHtml(s.name)}</span>
    </label>
  `).join("");

  const res = await openModal({
    title: "Nuevo Miembro",
    subtitle: "Agregá un profesional a tu equipo",
    bodyHtml: `
      <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px;">
        <div id="avatarPreview" style="width:70px; height:70px; border-radius:50%; background:var(--surface); border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <span class="muted" style="font-size:12px;">Foto</span>
        </div>
        <div style="flex:1">
          <label class="label">Foto de perfil (opcional)</label>
          <input type="file" id="memFile" accept="image/*" class="input" style="padding:6px; font-size:12px;" />
        </div>
      </div>
      <label class="label">Nombre</label>
      <input id="memName" class="input" placeholder="Ej: Carlos" />
      <label class="label">Rol / Especialidad</label>
      <input id="memRole" class="input" placeholder="Ej: Barbero Senior" value="Barbero" />
      <label class="label" style="margin-top:16px;">Servicios asignados</label>
      <div style="display:flex; flex-direction:column; gap:6px; background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
        ${servicesHtml || '<span class="muted" style="font-size:13px">Creá servicios primero.</span>'}
      </div>
    `,
    okText: "Guardar",
  });
  
  if (!res?.ok) return;
  
  const name = $("memName")?.value || "";
  const role = $("memRole")?.value || "";
  const fileInput = $("memFile");
  
  let avatarBase64 = null;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try { avatarBase64 = await compressImageToBase64(fileInput.files[0]); } catch (err) {}
  }
  
  const servicesIds = Array.from(document.querySelectorAll('input[name="memServices"]:checked')).map(el => el.value);
  
  try {
    await apiPost("/members", { name, role, avatarBase64, servicesIds });
    await loadMembers();
  } catch (err) { alert("Error: " + err.message); }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "memFile" && e.target.files?.length) {
    const preview = $("avatarPreview");
    if (preview) {
      try {
        const b64 = await compressImageToBase64(e.target.files[0]);
        preview.innerHTML = `<img src="${b64}" style="width:100%; height:100%; object-fit:cover;" />`;
        preview.style.border = "2px solid var(--cyan)";
      } catch (err) {}
    }
  }
});

$("membersGrid")?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-member]");
  const delBtn = e.target.closest("[data-del-member]");
  const schBtn = e.target.closest("[data-schedule-member]");
  
  if (delBtn) {
    const id = delBtn.dataset.delMember;
    if (!confirm("¿Desactivar barbero? Ya no recibirá turnos nuevos.")) return;
    try {
      await apiDelete("/members/" + id);
      await loadMembers();
    } catch (err) { alert("Error: " + err.message); }
    return;
  }
  
  if (editBtn) {
    const id = editBtn.dataset.editMember;
    const m = (window._cachedMembers || []).find(x => String(x.id) === id);
    if (!m) return;
    
    let services = [];
    try { const sRes = await apiGet("/services/mine"); services = sRes.items || sRes || []; } catch(err) {}
    const mServiceIds = m.services.map(s => Number(s.id));
    
    const servicesHtml = services.map(s => `
      <label style="display:flex; align-items:center; gap:8px; font-size:14px;">
        <input type="checkbox" name="memServices" value="${s.id}" ${mServiceIds.includes(s.id) ? "checked" : ""} />
        <span>${escapeHtml(s.name)}</span>
      </label>
    `).join("");

    const currentImg = m.avatarBase64 ? `<img src="${m.avatarBase64}" style="width:100%; height:100%; object-fit:cover;" />` : `<span class="muted" style="font-size:12px;">Foto</span>`;
    
    const res = await openModal({
      title: "Editar Miembro",
      subtitle: escapeHtml(m.name),
      bodyHtml: `
        <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px;">
          <div id="avatarPreview" style="width:70px; height:70px; border-radius:50%; background:var(--surface); border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${currentImg}
          </div>
          <div style="flex:1">
            <label class="label">Reemplazar Foto</label>
            <input type="file" id="memFile" accept="image/*" class="input" style="padding:6px; font-size:12px;" />
          </div>
        </div>
        <label class="label">Nombre</label>
        <input id="memName" class="input" value="${escapeAttr(m.name)}" />
        <label class="label">Rol / Especialidad</label>
        <input id="memRole" class="input" value="${escapeAttr(m.role)}" />
        <label class="label" style="margin-top:16px;">Servicios</label>
        <div style="display:flex; flex-direction:column; gap:6px; background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
          ${servicesHtml}
        </div>
      `,
      okText: "Guardar",
    });
    
    if (!res?.ok) return;
    
    const name = $("memName")?.value || "";
    const role = $("memRole")?.value || "";
    let avatarBase64 = undefined;
    const fileInput = $("memFile");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try { avatarBase64 = await compressImageToBase64(fileInput.files[0]); } catch (err) {}
    }
    const servicesIds = Array.from(document.querySelectorAll('input[name="memServices"]:checked')).map(el => el.value);
    
    try {
      await apiPut("/members/" + id, { name, role, avatarBase64, servicesIds });
      await loadMembers();
    } catch (err) { alert("Error: " + err.message); }
    return;
  }
  
  if (schBtn) {
    const id = schBtn.dataset.scheduleMember;
    const m = (window._cachedMembers || []).find(x => String(x.id) === id);
    if (!m) return;
    
    const daysHtml = WEEKDAYS.map(d => {
      const hrs = m.workingHours.filter(wh => wh.weekday === d.i);
      const hasHours = hrs.length > 0;
      const startObj = hrs[0]?.startTime || "10:00";
      const endObj = hrs[hrs.length - 1]?.endTime || "20:00";
      
      return `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);">
          <div style="width:100px; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chk_${d.i}" class="day-check" data-day="${d.i}" ${hasHours ? "checked" : ""} />
            <label style="font-weight:600; font-size:14px;" for="chk_${d.i}">${d.name}</label>
          </div>
          <div style="flex:1; display:flex; gap:10px; align-items:center;">
            <input type="time" class="input day-start" id="start_${d.i}" value="${hasHours ? startObj : "10:00"}" ${hasHours ? "" : "disabled"} style="padding:4px 8px; font-size:13px;" />
            <span class="muted">a</span>
            <input type="time" class="input day-end" id="end_${d.i}" value="${hasHours ? endObj : "20:00"}" ${hasHours ? "" : "disabled"} style="padding:4px 8px; font-size:13px;" />
          </div>
        </div>
      `;
    }).join("");
    
    const res = await openModal({
      title: "Horarios",
      subtitle: escapeHtml(m.name),
      bodyHtml: `<div style="margin-bottom:16px;">${daysHtml}</div>`,
      okText: "Guardar Horarios"
    });
    
    if (!res?.ok) return;
    
    const schedule = [];
    document.querySelectorAll(".day-check").forEach(chk => {
      if (chk.checked) {
        const d = chk.dataset.day;
        const sTime = $("start_" + d)?.value;
        const eTime = $("end_" + d)?.value;
        if (sTime && eTime) schedule.push({ weekday: d, startTime: sTime, endTime: eTime });
      }
    });
    
    try {
      await apiPut("/members/" + id + "/schedule", { schedule });
      await loadMembers();
      alert("Horarios guardados ✅");
    } catch(err) { alert("Error guardando horario: " + err.message); }
  }
});

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("day-check")) {
    const d = e.target.dataset.day;
    const startObj = $("start_" + d);
    const endObj = $("end_" + d);
    if (startObj) startObj.disabled = !e.target.checked;
    if (endObj) endObj.disabled = !e.target.checked;
  }
});

// init
(async function init() {
  if (!getToken()) openLogin();

  await loadShopHeader();
  showView(getRoute());
})();

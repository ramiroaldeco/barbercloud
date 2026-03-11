const API = window.API_BASE || "https://barbercloud.onrender.com/api";

// slug por ?slug=... o por path /barberrami
function getSlug() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get("slug");
  if (q) return q;

  // ejemplo: /barberrami  o /book.html/barberrami (según hosting)
  const parts = location.pathname.split("/").filter(Boolean);
  // si estás en /book.html, el slug no está. si estás en /barberrami, sí.
  const last = parts[parts.length - 1];
  if (last && !last.endsWith(".html")) return last;

  return "";
}
const slug = getSlug();

const $ = (id) => document.getElementById(id);

let state = { barbershop: null, services: [], selectedTime: null };

// =====================
// WIZARD UI (NUEVO)
// =====================
let currentStep = 1;

function showStep(n) {
  currentStep = n;

  ["step1", "step2", "step3", "step4"].forEach((id, idx) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("is-visible", idx + 1 === n);
  });

  const steps = document.querySelectorAll("#stepper .step");
  steps.forEach((x) => {
    const s = Number(x.dataset.step);
    x.classList.toggle("is-active", s === n);
    x.classList.toggle("is-done", s < n);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function safeText(el, txt) {
  if (!el) return;
  el.textContent = txt ?? "";
}

function updateSideSummary() {
  const s = state.services.find(x => x.id === Number($("serviceSelect")?.value));
  const date = $("dateInput")?.value || "";
  const time = state.selectedTime || "";

  const pct = s?.depositPercentage ?? state.barbershop?.defaultDepositPercentage ?? 15;
  const price = s?.price ?? 0;
  const deposit = Math.round((price * pct) / 100);
  const fee = state.barbershop?.platformFee ?? 0;
  const total = deposit + fee;

  safeText($("sideService"), s ? `${s.name} ($${s.price})` : "—");
  safeText($("sideDate"), date || "—");
  safeText($("sideTime"), time || "—");
  safeText($("sideDeposit"), s ? `$${total} (seña $${deposit} + fee $${fee})` : "—");
}

function renderFinalSummary() {
  const s = state.services.find(x => x.id === Number($("serviceSelect")?.value));
  const date = $("dateInput")?.value || "";
  const time = state.selectedTime || "";

  const pct = s?.depositPercentage ?? state.barbershop?.defaultDepositPercentage ?? 15;
  const price = s?.price ?? 0;
  const deposit = Math.round((price * pct) / 100);
  const fee = state.barbershop?.platformFee ?? 0;
  const total = deposit + fee;

  const box = $("finalSummary");
  if (box) {
    box.innerHTML = `
      <div><b>Servicio:</b> ${s?.name ?? "—"} (${s?.durationMinutes ?? "—"} min)</div>
      <div><b>Fecha:</b> ${date || "—"} • <b>Hora:</b> ${time || "—"}</div>
      <div style="margin-top:8px"><b>Precio:</b> $${price}</div>
      <div><b>Seña:</b> $${deposit} (${pct}%)</div>
      <div><b>Fee plataforma:</b> $${fee}</div>
      <div style="margin-top:4px"><b>Total a pagar ahora:</b> $${total}</div>
    `;
  }

  updateSideSummary();
}

// ✅ A) NUEVO: habilitar/deshabilitar botón reservar según slot + nombre + teléfono
function refreshBookButton() {
  const name = $("nameInput")?.value.trim() || "";
  const phone = $("phoneInput")?.value.trim() || "";
  const btn = $("btnBook");
  if (btn) btn.disabled = !(state.selectedTime && name && phone);
}

function apiUrl(path) { return API + path; }

async function apiGet(path) {
  const r = await fetch(apiUrl(path));
  const t = await r.text();
  let data;
  try { data = JSON.parse(t); } catch { data = { raw: t }; }
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}
async function apiPost(path, body) {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let data;
  try { data = JSON.parse(t); } catch { data = { raw: t }; }
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function renderServiceSummary() {
  const id = Number($("serviceSelect")?.value);
  const s = state.services.find(x => x.id === id);
  if (!s) return;

  const pct = s.depositPercentage ?? state.barbershop?.defaultDepositPercentage ?? 15;
  const deposit = Math.round((s.price * pct) / 100);
  const fee = state.barbershop?.platformFee ?? 0;
  const total = deposit + fee;

  const el = $("serviceSummary");
  if (el) {
    el.innerHTML =
      `Duración: <b>${s.durationMinutes} min</b> • Precio: <b>$${s.price}</b> • Seña: <b>$${deposit}</b> (${pct}%) + fee $${fee} = <b>$${total}</b>`;
  }

  updateSideSummary();
}

function renderServices() {
  const sel = $("serviceSelect");
  if (!sel) return;

  sel.innerHTML = state.services.map(s =>
    `<option value="${s.id}">${s.name} ($${s.price})</option>`
  ).join("");

  // ✅ resumen del servicio apenas se renderiza el select
  renderServiceSummary();
}

function renderSlots(slots) {
  const box = $("slots");
  state.selectedTime = null;
  refreshBookButton();
  updateSideSummary();

  const btnGoTo3 = $("btnGoTo3");
  if (btnGoTo3) btnGoTo3.disabled = true;

  if (!box) return;

  if (!slots.length) {
    box.innerHTML = "";
    if ($("slotHint")) $("slotHint").textContent = "No hay horarios disponibles para ese día.";
    return;
  }

  if ($("slotHint")) $("slotHint").textContent = "Elegí un horario:";
  box.innerHTML = slots.map(t => `
    <button class="btn" data-slot="${t}" aria-pressed="false">${t}</button>
  `).join("");

  // ✅ B) handler: deja el slot “fijo” visualmente + refresca botón + habilita continuar
  box.onclick = (e) => {
    const b = e.target.closest("[data-slot]");
    if (!b) return;

    const t = b.dataset.slot;
    state.selectedTime = t;

    // marcar seleccionado (visual)
    box.querySelectorAll("[data-slot]").forEach(x => {
      x.classList.remove("primary", "is-selected");
      x.setAttribute("aria-pressed", "false");
    });

    b.classList.add("primary", "is-selected");
    b.setAttribute("aria-pressed", "true");

    refreshBookButton();
    updateSideSummary();

    if (btnGoTo3) btnGoTo3.disabled = false;
  };
}

async function init() {
  // ✅ Bloquear fechas pasadas + default hoy
  const dateInput = $("dateInput");
  if (dateInput) dateInput.min = todayISO();

  if (!slug) {
    safeText($("shopTitle"), "Falta slug");
    safeText($("shopMeta"), "Usá: book.html?slug=barberrami o entrá a /barberrami (con rewrites)");
    const btnLoad = $("btnLoad") || $("btnFetchSlots");
    if (btnLoad) btnLoad.disabled = true;
    return;
  }

  // info barbería + servicios
  const shop = await apiGet(`/public/${slug}/barbershop`);
  state.barbershop = shop.item;

  safeText($("shopTitle"), state.barbershop.name);
  safeText($("shopMeta"),
    `${state.barbershop.city || ""} ${state.barbershop.address ? "• " + state.barbershop.address : ""}`.trim()
  );

  const services = await apiGet(`/public/${slug}/services`);
  state.services = services.items || [];
  renderServices();

  // ✅ init: resumen + hint pro
  renderServiceSummary();
  if ($("slotHint")) $("slotHint").textContent = "Elegí fecha y tocá “Ver horarios”.";

  // ✅ cada vez que cambie el servicio: refresca resumen y resetea slots
  const sel = $("serviceSelect");
  if (sel) {
    sel.addEventListener("change", () => {
      renderServiceSummary();
      renderSlots([]);
      if ($("slotHint")) $("slotHint").textContent = "Elegí fecha y tocá “Ver horarios”.";
    });
  }

  // ✅ habilitar “Reservar” cuando corresponda
  ["nameInput", "phoneInput"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("input", refreshBookButton);
  });

  // fecha default
  if (dateInput) dateInput.value = todayISO();

  // =====================
  // Wiring Wizard Buttons
  // =====================
  // Si tenés IDs viejos, soportamos ambos:
  const btnFetch = $("btnFetchSlots") || $("btnLoad");
  if (btnFetch) btnFetch.addEventListener("click", async () => {
    await loadSlots();
    showStep(2);
  });

  const b1 = $("btnBackTo1");
  if (b1) b1.addEventListener("click", () => showStep(1));

  const b2 = $("btnBackTo2");
  if (b2) b2.addEventListener("click", () => showStep(2));

  const b3 = $("btnBackTo3");
  if (b3) b3.addEventListener("click", () => showStep(3));

  const go3 = $("btnGoTo3");
  if (go3) go3.addEventListener("click", () => showStep(3));

  const go4 = $("btnGoTo4");
  if (go4) go4.addEventListener("click", () => {
    const name = $("nameInput")?.value.trim() || "";
    const phone = $("phoneInput")?.value.trim() || "";
    if (!name || !phone) {
      safeText($("bookMsg"), "Completá nombre y teléfono.");
      refreshBookButton();
      return;
    }
    renderFinalSummary();
    showStep(4);
  });

  const btnBook = $("btnBook");
  if (btnBook) btnBook.addEventListener("click", book);

  // estado inicial
  refreshBookButton();
  updateSideSummary();
  showStep(1);
}

async function loadSlots() {
  const serviceId = $("serviceSelect")?.value;
  const date = $("dateInput")?.value;

  if ($("bookMsg")) $("bookMsg").textContent = "";

  try {
    const data = await apiGet(
      `/public/${slug}/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}&step=15`
    );
    renderSlots(data.slots || []);
  } catch (e) {
    if ($("slotHint")) $("slotHint").textContent = "Error cargando horarios: " + e.message;
  }
}

async function book() {
  const serviceId = Number($("serviceSelect")?.value);
  const date = $("dateInput")?.value;
  const time = state.selectedTime;
  const customerName = $("nameInput")?.value.trim() || "";
  const customerPhone = $("phoneInput")?.value.trim() || "";
  const customerEmail = $("emailInput")?.value.trim() || "";
  const notes = $("notesInput")?.value.trim() || "";

  if (!time) return;

  // ✅ validar antes del try
  if (!customerName || !customerPhone) {
    if ($("bookMsg")) $("bookMsg").textContent = "Completá nombre y teléfono.";
    refreshBookButton();
    return;
  }

  try {
    const resp = await apiPost(`/public/${slug}/book`, {
      serviceId,
      date,
      time,
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      notes: notes || null,
    });

    if ($("bookMsg")) $("bookMsg").textContent = `Listo ✅ Tu turno quedó pendiente. Código: #${resp.id}`;

    // Limpieza suave
    state.selectedTime = null;
    refreshBookButton();
    renderFinalSummary(); // deja el resumen armado aunque limpie la hora
    updateSideSummary();

    // Quedate en confirmar (step 4) mostrando el mensaje
    showStep(4);
  } catch (e) {
    if ($("bookMsg")) $("bookMsg").textContent = "No se pudo reservar: " + e.message;
    loadSlots();
  }
}

init().catch(err => {
  safeText($("shopTitle"), "Error");
  safeText($("shopMeta"), err.message);
});

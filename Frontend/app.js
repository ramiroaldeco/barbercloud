// app.js
// Usa API_BASE definido en config.js (https://barbercloud.onrender.com/api)

const barbershopSelect = document.getElementById("barbershopSelect");
const serviceSelect = document.getElementById("serviceSelect");

async function loadBarbershops() {
  try {
    const resp = await fetch(`${API_BASE}/barbershops`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "API error");

    barbershopSelect.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No hay barberías disponibles";
      opt.disabled = true;
      opt.selected = true;
      barbershopSelect.appendChild(opt);
      serviceSelect.innerHTML = "";
      return;
    }

    data.forEach((bs) => {
      const opt = document.createElement("option");
      opt.value = bs.id;
      opt.textContent = bs.name;
      barbershopSelect.appendChild(opt);
    });

    // Carga servicios de la primera barbería
    loadServices(data[0].id);
  } catch (e) {
    alert(e.message || "No se pudieron cargar las barberías.");
  }
}

async function loadServices(barbershopId) {
  try {
    const res = await fetch(`${API_BASE}/services?barbershopId=${barbershopId}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error al cargar servicios");

    serviceSelect.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No hay servicios disponibles";
      serviceSelect.appendChild(option);
      return;
    }

    data.forEach((service) => {
      const option = document.createElement("option");
      option.value = service.id;
      option.textContent = `${service.name} - $${service.price}`;
      serviceSelect.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    alert("No se pudieron cargar los servicios.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadBarbershops();

  barbershopSelect.addEventListener("change", (e) => {
    const barbershopId = e.target.value;
    if (barbershopId) loadServices(barbershopId);
  });

  const form = document.getElementById("appointmentForm");
  const submitBtn = form.querySelector('button[type="submit"]');

  let isSubmitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;
    submitBtn.disabled = true;

    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Reservando...";

    const body = {
      barbershopId: Number(barbershopSelect.value),
      serviceId: Number(serviceSelect.value),
      customerName: document.getElementById("customerName").value.trim(),
      customerPhone: document.getElementById("customerPhone").value.trim(),
      date: document.getElementById("date").value,
      time: document.getElementById("time").value,
    };

    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Error al crear turno.");
        return;
      }

      console.log("Turno creado:", data);
      alert("Turno creado correctamente. (Por ahora sin pago de seña)");
      form.reset();
    } catch (err) {
      console.error(err);
      alert("Error de conexión con el servidor");
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});

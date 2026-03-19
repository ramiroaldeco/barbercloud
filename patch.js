const fs = require('fs');

let js = fs.readFileSync('barbercloudFRONTEND/admin_v2.js', 'utf8');

// Patch 1: loadShopHeader avatar logic
js = js.replace(
  'const avatar = (data.name || "B").trim().charAt(0).toUpperCase();\n    safeText("shopAvatar", avatar);',
  `// Identidad (Logo)
    const avatarEl = $("shopAvatar");
    if (avatarEl) {
      if (data.logoBase64) {
        avatarEl.style.padding = "0";
        avatarEl.innerHTML = \`<img src="\${data.logoBase64}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />\`;
      } else {
        avatarEl.style.padding = "";
        const initial = (data.name || "B").trim().charAt(0).toUpperCase();
        avatarEl.innerHTML = initial;
      }
    }`
);

// Patch 1b: fallback for \r\n
js = js.replace(
  'const avatar = (data.name || "B").trim().charAt(0).toUpperCase();\r\n    safeText("shopAvatar", avatar);',
  `// Identidad (Logo)
    const avatarEl = $("shopAvatar");
    if (avatarEl) {
      if (data.logoBase64) {
        avatarEl.style.padding = "0";
        avatarEl.innerHTML = \`<img src="\${data.logoBase64}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />\`;
      } else {
        avatarEl.style.padding = "";
        const initial = (data.name || "B").trim().charAt(0).toUpperCase();
        avatarEl.innerHTML = initial;
      }
    }`
);

// Patch 2: loadConfig
const targetLoadConfig = `if ($("cfgDepositPct"))
      $("cfgDepositPct").value =
        shop.defaultDepositPercentage != null ? String(shop.defaultDepositPercentage) : "";`;

const replLoadConfig = `${targetLoadConfig}
        
    const p = $("cfgLogoPreview");
    const f = $("cfgLogoFallback");
    if (shop.logoBase64) {
        if (p) { p.src = shop.logoBase64; p.style.display = "block"; }
        if (f) { f.style.display = "none"; }
    } else {
        if (p) { p.src = ""; p.style.display = "none"; }
        if (f) { f.style.display = "flex"; }
    }
    window.pendingLogoRemoved = false;
    const fileInp = $("cfgLogoFile");
    if (fileInp) fileInp.value = "";`;

js = js.replace(targetLoadConfig, replLoadConfig);
js = js.replace(targetLoadConfig.replace(/\n/g, '\r\n'), replLoadConfig);

// Patch 3: btnSaveConfig and Base64 helpers
const targetSaveBtn = `$("btnSaveConfig")?.addEventListener("click", async () => {`;
const replSaveBtn = `
window.pendingLogoRemoved = false;
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$("btnRemoveLogo")?.addEventListener("click", () => {
    const p = $("cfgLogoPreview");
    const f = $("cfgLogoFallback");
    if (p) { p.src = ""; p.style.display = "none"; }
    if (f) { f.style.display = "flex"; }
    const fileInp = $("cfgLogoFile");
    if (fileInp) fileInp.value = "";
    window.pendingLogoRemoved = true;
});

$("cfgLogoFile")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        alert("El logo es muy pesado. Máximo 2MB.");
        e.target.value = "";
        return;
    }
    try {
        const b64 = await fileToBase64(file);
        const p = $("cfgLogoPreview");
        const f = $("cfgLogoFallback");
        if (p) { p.src = b64; p.style.display = "block"; }
        if (f) { f.style.display = "none"; }
        window.pendingLogoRemoved = false;
    } catch(err) { console.error(err); }
});

$("btnSaveConfig")?.addEventListener("click", async () => {`;

js = js.replace(targetSaveBtn, replSaveBtn);


const targetApiPut = `await apiPut("/barbershops/mine", {
      name,
      city: city || null,
      address: address || null,
      phone: phone || null,
      slug: slug || null,
    });`;

const targetApiPutRN = `await apiPut("/barbershops/mine", {\r
      name,\r
      city: city || null,\r
      address: address || null,\r
      phone: phone || null,\r
      slug: slug || null,\r
    });`;

const replApiPut = `
    const fileInp = $("cfgLogoFile");
    let logoPayload = undefined;
    if (window.pendingLogoRemoved) {
      logoPayload = null;
    } else if (fileInp && fileInp.files && fileInp.files[0]) {
      logoPayload = await fileToBase64(fileInp.files[0]);
    }

    await apiPut("/barbershops/mine", {
      name,
      city: city || null,
      address: address || null,
      phone: phone || null,
      slug: slug || null,
      ...(logoPayload !== undefined ? { logoBase64: logoPayload } : {})
    });
    window.pendingLogoRemoved = false;
    if (fileInp) fileInp.value = "";`;

if (js.includes(targetApiPut)) {
    js = js.replace(targetApiPut, replApiPut);
} else {
    js = js.replace(targetApiPutRN, replApiPut);
}

fs.writeFileSync('barbercloudFRONTEND/admin_v2.js', js, 'utf8');
console.log('admin_v2.js patched!');

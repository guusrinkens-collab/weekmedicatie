// ============================================================
// camera.js — Apothekerlabel scannen via Claude API
// ============================================================
window.WM = window.WM || {};

WM.Camera = (() => {
  const { Settings } = WM.Data;
  const { toast, showLoader, hideLoader, openModal, closeModal } = WM.UI;

  // ── Scanner openen ────────────────────────────────────────
  function openScanner(medId = null) {
    const settings = Settings.get();

    if (!settings.apiKey) {
      toast('Voer eerst een Claude API-sleutel in via Meer → Instellingen', 'warning', 5000);
      WM.App.navigate('instellingen');
      return;
    }

    const html = `
      <div style="text-align:center;">
        <p style="color:var(--text-muted);margin-bottom:20px;font-size:0.9rem;">
          Maak een foto van het apothekerlabel. De AI leest de medicatiegegevens automatisch uit.
        </p>

        <label for="camera-input" class="btn btn-primary btn-lg btn-full" style="cursor:pointer;display:flex;gap:10px;justify-content:center;">
          ${WM.UI.icon('camera')} Foto maken / uploaden
        </label>
        <input type="file" id="camera-input" accept="image/*" capture="environment"
               style="display:none;" onchange="WM.Camera.handleImage(event, '${medId}')">

        <p class="form-hint" style="margin-top:16px;">
          Zorg voor goede belichting en houd het label recht.
        </p>

        <div id="scan-preview" style="display:none;margin-top:16px;">
          <img id="scan-img" style="max-width:100%;border-radius:12px;margin-bottom:12px;" alt="Label">
          <div id="scan-result"></div>
        </div>
      </div>`;

    openModal('Label scannen', html);
  }

  // ── Afbeelding verwerken ──────────────────────────────────
  async function handleImage(event, medId) {
    const file = event.target.files[0];
    if (!file) return;

    const preview = document.getElementById('scan-preview');
    const img = document.getElementById('scan-img');
    if (preview && img) {
      img.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    }

    const base64 = await fileToBase64(file);
    const mediaType = file.type || 'image/jpeg';

    showLoader('Label wordt geanalyseerd…');

    try {
      const result = await scanWithClaude(base64, mediaType);
      hideLoader();
      if (result) {
        showScanResult(result, medId);
      } else {
        toast('Kon geen gegevens lezen van het label', 'error');
      }
    } catch (err) {
      hideLoader();
      console.error('Scan error:', err);
      toast('Fout bij het scannen: ' + (err.message || 'Onbekende fout'), 'error');
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Claude API aanroepen ──────────────────────────────────
  async function scanWithClaude(base64Data, mediaType) {
    const settings = Settings.get();
    const apiKey = settings.apiKey;

    if (!apiKey) throw new Error('Geen API-sleutel ingesteld');

    const prompt = `Analyseer dit apothekerlabel van een Nederlandse apotheek en extraheer de volgende informatie.
Geef het antwoord ALLEEN als JSON (geen uitleg, geen markdown, geen code block):
{
  "name": "alleen de merknaam of generieke naam van het medicijn (bv. 'Metoprolol' of 'Losartan'), NIET de dosering of fabrikant",
  "dosage": "alleen de sterkte per tablet/capsule (bv. '50mg' of '10mg/ml'), NIET de inname-instructies",
  "quantity": 30,
  "usageInstructions": "hoe en wanneer innemen (bv. '1 tablet per dag, ochtend bij het opstaan')",
  "activeIngredient": "werkzame stof indien apart vermeld"
}

Regels:
- name: alleen de medicijnnaam, maximaal 3 woorden
- dosage: alleen getal + eenheid (mg, ml, mcg, IE), geen instructies
- quantity: alleen het getal (integer), of null
- Als een veld niet leesbaar is, gebruik null`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API fout: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) throw new Error('Leeg antwoord van API');

    try {
      const clean = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Kon JSON niet parsen uit antwoord');
    }
  }

  // ── Scanresultaat tonen ───────────────────────────────────
  function showScanResult(result, medId) {
    const container = document.getElementById('scan-result');
    if (!container) return;

    const rows = [
      result.name           && { label: 'Naam',         value: result.name },
      result.dosage         && { label: 'Dosering',     value: result.dosage },
      result.quantity       && { label: 'Aantal stuks', value: result.quantity },
      result.usageInstructions && { label: 'Gebruik',   value: result.usageInstructions },
    ].filter(Boolean);

    const rowsHTML = rows.map(r => `
      <div class="scan-row">
        <span class="scan-row-label">${r.label}</span>
        <span class="scan-row-value">${r.value}</span>
      </div>`).join('');

    const existingMeds = WM.Data.Medications.all();
    const resultJSON = JSON.stringify(result).replace(/"/g, '&quot;');

    const stockBtn = existingMeds.length > 0 && result.quantity
      ? `<button class="btn btn-outline btn-full" style="margin-top:10px;"
             onclick="WM.Camera.openStockRefill(${resultJSON})">
           📦 Bijvullen voor bestaand medicijn
         </button>`
      : '';

    container.innerHTML = `
      <div class="scan-result-card">
        <div class="scan-result-header">✓ Label gelezen</div>
        ${rowsHTML}
        <div style="margin-top:16px;">
          <button class="btn btn-primary btn-full"
              onclick="WM.Camera.applyResult(${resultJSON}, '${medId}')">
            💊 Nieuw medicijn aanmaken
          </button>
          ${stockBtn}
        </div>
      </div>`;
  }

  // ── Voorraad bijvullen voor bestaand medicijn ─────────────
  function openStockRefill(result) {
    const meds = WM.Data.Medications.all();
    const options = meds.map(m =>
      `<option value="${m.id}">${m.name} — ${m.dosage} (nu: ${m.stock ?? '?'})</option>`
    ).join('');

    closeModal();
    setTimeout(() => {
      openModal('Voorraad bijvullen', `
        <div>
          <div class="scan-row" style="margin-bottom:16px;">
            <span class="scan-row-label">Gescand</span>
            <span class="scan-row-value">${result.name || '?'}${result.quantity ? ' — ' + result.quantity + ' st.' : ''}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Kies medicijn</label>
            <select class="form-select" id="stock-med-select">${options}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Aantal toe te voegen</label>
            <input type="number" class="form-input" id="stock-add-amount"
                   value="${result.quantity || ''}" min="1" step="1" placeholder="aantal pillen">
          </div>
          <button class="btn btn-primary btn-full" onclick="WM.Camera.confirmStockRefill()">
            ✓ Bijvullen
          </button>
        </div>`);
    }, 300);
  }

  function confirmStockRefill() {
    const medId  = document.getElementById('stock-med-select')?.value;
    const amount = parseInt(document.getElementById('stock-add-amount')?.value);
    if (!medId || !amount || amount <= 0) { toast('Vul een geldig aantal in', 'warning'); return; }
    WM.Data.Medications.updateStock(medId, amount);
    closeModal();
    toast(`Voorraad bijgevuld met ${amount} stuks`, 'success');
    WM.App.refreshPage();
  }

  // ── Scan toepassen op medicijnformulier ───────────────────
  function applyResult(result, medId) {
    closeModal();
    setTimeout(() => {
      if (medId) {
        WM.Medications.editMedication(medId);
      } else {
        WM.Medications.addMedication();
      }
      setTimeout(() => WM.Medications.prefillForm(result), 300);
    }, 300);
  }

  return { openScanner, handleImage, applyResult, openStockRefill, confirmStockRefill };
})();

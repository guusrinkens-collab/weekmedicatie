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
               style="display:none;" onchange="WM.Camera.handleImage(event, '${medId || ''}')">

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
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => URL.revokeObjectURL(objectUrl);
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

    const prompt = `Je analyseert een foto van een Nederlands apothekerlabel.

BELANGRIJK — welke tekst lezen:
- Lees ALLEEN de tekst op het apothekerlabel op de voorgrond (het witte of gekleurde stickerlabel van de apotheek).
- Negeer tekst die zichtbaar is door het label heen van de verpakking eronder (fabrikantsnaam, barcode, achtergrondtekst).
- Bij overlappende of gedeeltelijk zichtbare tekst: gebruik de meest leesbare versie en noteer twijfel in het "warning"-veld.
- Bij laag contrast of onduidelijk beeld: doe je best en geef confidence "low" mee.

Geef het antwoord UITSLUITEND als geldige JSON (geen uitleg, geen markdown, geen code block):
{
  "medication_name": "alleen de merknaam of generieke naam van het medicijn (bv. 'Metoprolol'), maximaal 3 woorden, NIET de dosering",
  "dosage": "alleen de sterkte per eenheid (bv. '50 mg' of '10 mg/ml'), NIET de inname-instructies",
  "package_quantity": "het totale aantal tabletten/capsules/ml in de verpakking als getal (bv. 30), of null",
  "usage_instructions": "hoe en wanneer innemen (bv. '1 tablet per dag, ochtend bij het opstaan'), of null",
  "confidence": "high | medium | low",
  "warning": "optionele string — vul in bij slechte beeldkwaliteit, onduidelijke tekst of twijfel over een veld; laat weg als alles duidelijk is"
}

Regels:
- Geef ALTIJD een resultaat terug, ook bij slechte kwaliteit — gebruik dan confidence "low" en een beschrijvend warning-bericht.
- confidence "high": alle velden duidelijk leesbaar.
- confidence "medium": meeste velden leesbaar, één veld onzeker.
- confidence "low": beeld onduidelijk, meerdere velden onzeker, of tekst van onderliggende verpakking stoort.
- package_quantity: alleen het getal (integer) of null, geen eenheden.
- Geef nooit een lege JSON of een foutmelding terug.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
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
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') throw new Error('Scan duurde te lang (timeout). Controleer uw verbinding.');
      throw fetchErr;
    }
    clearTimeout(timeout);

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
      result.medication_name    && { label: 'Naam',         value: result.medication_name },
      result.dosage             && { label: 'Dosering',     value: result.dosage },
      result.package_quantity   && { label: 'Aantal stuks', value: result.package_quantity },
      result.usage_instructions && { label: 'Gebruik',      value: result.usage_instructions },
    ].filter(Boolean);

    const rowsHTML = rows.map(r => `
      <div class="scan-row">
        <span class="scan-row-label">${r.label}</span>
        <span class="scan-row-value">${r.value}</span>
      </div>`).join('');

    const needsVerification = result.confidence === 'low' || result.warning;
    const warningText = result.warning || 'De scan is onzeker. Controleer de ingevulde gegevens voordat u opslaat.';
    const warningBanner = needsVerification ? `
      <div class="scan-warning-banner">
        <span class="scan-warning-icon">⚠️</span>
        <span>${warningText}</span>
      </div>` : '';

    const confidenceBadge = result.confidence ? `
      <span class="scan-confidence scan-confidence--${result.confidence}">
        ${result.confidence === 'high' ? '✓ Hoge zekerheid' : result.confidence === 'medium' ? '~ Gemiddelde zekerheid' : '! Lage zekerheid'}
      </span>` : '';

    const existingMeds = WM.Data.Medications.all();
    const resultJSON = JSON.stringify(result).replace(/"/g, '&quot;');

    const stockBtn = existingMeds.length > 0 && result.package_quantity
      ? `<button class="btn btn-outline btn-full" style="margin-top:10px;"
             onclick="WM.Camera.openStockRefill(${resultJSON})">
           📦 Bijvullen voor bestaand medicijn
         </button>`
      : '';

    container.innerHTML = `
      <div class="scan-result-card">
        <div class="scan-result-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>✓ Label gelezen</span>
          ${confidenceBadge}
        </div>
        ${warningBanner}
        ${rowsHTML}
        <div style="margin-top:16px;">
          <button class="btn btn-primary btn-full"
              onclick="WM.Camera.applyResult(${resultJSON}, '${medId || ''}')">
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
    const mapped = {
      name:              result.medication_name,
      dosage:            result.dosage,
      quantity:          result.package_quantity,
      usageInstructions: result.usage_instructions,
    };
    closeModal();
    setTimeout(() => {
      if (medId && medId !== 'null' && medId !== '') {
        WM.Medications.editMedication(medId);
      } else {
        WM.Medications.addMedication();
      }
      setTimeout(() => {
        WM.Medications.prefillForm(mapped);
        if (result.confidence === 'low' || result.warning) {
          const msg = result.warning || 'Lage scanzekerheid — controleer de gegevens voor het opslaan.';
          WM.UI.toast('⚠️ ' + msg, 'warning', 7000);
        }
      }, 300);
    }, 300);
  }

  return { openScanner, handleImage, applyResult, openStockRefill, confirmStockRefill };
})();

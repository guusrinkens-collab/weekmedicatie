// ============================================================
// medications.js — Medicatiebeheer (CRUD) + Wizard flow
// ============================================================
window.WM = window.WM || {};

WM.Medications = (() => {
  const { Medications: MData, Tapering: TData } = WM.Data;
  const { openModal, closeModal, toast, confirmDialog, icon } = WM.UI;

  // ── Wizard & detail state ──────────────────────────────────
  let _wizard = {};
  let _detailId = null;

  // ── Medicatielijst ─────────────────────────────────────────
  function render() {
    const meds = MData.all();
    const alerts = WM.Stock.getAlerts();

    let html = '';

    if (alerts.length > 0) {
      html += `<div class="section-title">⚠️ Waarschuwingen</div>`;
      html += alerts.map(a => WM.Stock.renderAlertBanner(a)).join('');
    }

    if (meds.length === 0) {
      html += WM.UI.emptyState(
        'Geen medicijnen',
        'Voeg uw eerste medicijn toe.',
        `<button class="btn btn-primary" onclick="WM.Medications.startAddFlow()">
           ${icon('plus')} Medicijn toevoegen
         </button>`
      );
    } else {
      html += `<div class="section-title">Mijn medicijnen (${meds.length})</div>`;
      html += meds.map(med => renderMedCard(med)).join('');
      html += `
        <button class="btn btn-outline btn-full add-med-btn"
                onclick="WM.Medications.startAddFlow()">
          ${icon('plus')} Nieuw medicijn toevoegen
        </button>`;
    }

    return html;
  }

  function renderMedCard(med) {
    const tapering = TData.forMedication(med.id);
    const moments = (med.moments || []).map(m =>
      `<span class="moment-dot ${m}"></span>`
    ).join('');

    const taperBadge = tapering
      ? `<span class="badge badge-primary" style="margin-top:4px;">⬇ ${TData.currentDose(tapering)}${tapering.unit}</span>`
      : '';

    const daysLeft = med.stock != null && med.dailyUsage
      ? Math.floor(med.stock / med.dailyUsage)
      : null;
    const stockClass = daysLeft !== null
      ? (daysLeft <= 7 ? 'low' : daysLeft <= 14 ? 'medium' : '')
      : '';
    const stockBadge = daysLeft !== null
      ? `<span class="stock-days ${stockClass}">${daysLeft}d</span>`
      : '';

    return `
      <div class="med-card fade-in" onclick="WM.Medications.openDetail('${med.id}')">
        <div class="med-icon">💊</div>
        <div class="med-info">
          <div class="med-name">${med.name}</div>
          <div class="med-dosage">${med.dosage}</div>
          <div class="med-moments">${moments}</div>
          ${taperBadge}
        </div>
        <div class="med-right">
          ${stockBadge}
          <button class="btn btn-sm btn-outline refill-btn"
              onclick="event.stopPropagation();WM.Medications.quickFillStock('${med.id}')"
              title="Voorraad bijvullen">＋</button>
        </div>
      </div>`;
  }

  // ── Detailpagina ───────────────────────────────────────────
  function openDetail(id) {
    _detailId = id;
    WM.App.navigate('medicatie-detail');
  }

  function renderDetail() {
    const med = MData.get(_detailId);
    if (!med) { WM.App.navigate('medicatie'); return ''; }

    const tapering = TData.forMedication(_detailId);
    const momentLabels = { ochtend: '☀️ Ochtend', middag: '🌤️ Middag', avond: '🌙 Avond' };

    const daysLeft = med.stock != null && med.dailyUsage
      ? Math.floor(med.stock / med.dailyUsage)
      : null;
    const stockClass = daysLeft !== null
      ? (daysLeft <= 7 ? 'danger' : daysLeft <= 14 ? 'warning' : 'ok')
      : '';

    return `
      <div class="subpage-header">
        ${WM.UI.backButton('medicatie')}
        <h2 class="subpage-title">${med.name}</h2>
        <button class="btn btn-sm btn-outline" style="margin-left:auto;flex-shrink:0;"
                onclick="WM.Medications.editMedication('${med.id}')">Bewerken</button>
      </div>

      <div class="med-detail-hero">
        <div class="med-detail-icon-wrap">💊</div>
        <div class="med-detail-name">${med.name}</div>
        <div class="med-detail-dosage">${med.dosage}</div>
        <div class="med-detail-moments">
          ${(med.moments || []).map(m =>
            `<span class="moment-pill ${m}">${momentLabels[m]}</span>`
          ).join('')}
        </div>
      </div>

      <div class="section-title">Voorraad</div>
      <div class="card">
        <div class="detail-row">
          <span class="detail-label">Huidige voorraad</span>
          <span class="detail-value ${stockClass}">
            ${med.stock != null ? med.stock + ' stuks' : '—'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pillen per inname</span>
          <span class="detail-value">${med.pillsPerDose || 1}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Dagelijks gebruik</span>
          <span class="detail-value">${med.dailyUsage || '—'} per dag</span>
        </div>
        ${daysLeft !== null ? `
        <div class="detail-row">
          <span class="detail-label">Nog voldoende voor</span>
          <span class="detail-value ${stockClass}">${daysLeft} dagen</span>
        </div>` : ''}
        <button class="btn btn-outline" style="margin-top:12px;width:100%;"
                onclick="WM.Medications.quickFillStock('${med.id}')">
          ＋ Voorraad bijvullen
        </button>
      </div>

      ${tapering ? `
      <div class="section-title">Afbouwschema</div>
      <div class="card">
        <div class="detail-row">
          <span class="detail-label">Huidige dosis</span>
          <span class="detail-value">${TData.currentDose(tapering)}${tapering.unit}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Traject</span>
          <span class="detail-value">${tapering.startDose} → ${tapering.endDose}${tapering.unit}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Afbouwstap</span>
          <span class="detail-value">−${tapering.reductionStep}${tapering.unit} / ${tapering.intervalDays} dagen</span>
        </div>
      </div>` : ''}

      <div style="display:flex;gap:12px;margin-top:8px;padding-bottom:16px;">
        <button class="btn btn-primary" style="flex:1;"
                onclick="WM.Medications.editMedication('${med.id}')">
          Bewerken
        </button>
        <button class="btn btn-danger btn-sm"
                onclick="WM.Medications.deleteMedication('${med.id}')">
          Verwijderen
        </button>
      </div>`;
  }

  // ── Wizard: Startscherm ────────────────────────────────────
  function startAddFlow() {
    _wizard = {};
    WM.App.navigate('medicatie-start');
  }

  function renderStart() {
    const hasApiKey = !!WM.Data.Settings.get().apiKey;
    return `
      <div class="subpage-header">
        ${WM.UI.backButton('medicatie')}
        <h2 class="subpage-title">Medicijn toevoegen</h2>
      </div>

      <p class="wizard-intro">Hoe wil je beginnen?</p>

      <div class="wizard-choices">
        <button class="wizard-choice-btn${hasApiKey ? '' : ' choice-disabled'}"
                onclick="${hasApiKey
                  ? 'WM.Medications.startScan()'
                  : "WM.UI.toast('Stel eerst een API-sleutel in via Meer → Instellingen','warning')"}">
          <span class="wizard-choice-icon">📷</span>
          <div class="wizard-choice-text">
            <div class="wizard-choice-title">Scan apotheeklabel</div>
            <div class="wizard-choice-sub">${hasApiKey
              ? 'Vult het formulier automatisch in'
              : 'Vereist API-sleutel — niet ingesteld'}</div>
          </div>
          <span class="wizard-choice-arrow">›</span>
        </button>

        <button class="wizard-choice-btn" onclick="WM.Medications.goToStap1()">
          <span class="wizard-choice-icon">✏️</span>
          <div class="wizard-choice-text">
            <div class="wizard-choice-title">Handmatig invullen</div>
            <div class="wizard-choice-sub">Naam, dosering en tijdstip</div>
          </div>
          <span class="wizard-choice-arrow">›</span>
        </button>
      </div>`;
  }

  function startScan() {
    WM.Camera.openScanner();
  }

  function goToStap1() {
    WM.App.navigate('medicatie-stap1');
  }

  // ── Wizard: Stap 1 — Basisgegevens ────────────────────────
  function renderStap1() {
    const w = _wizard;
    const moments = w.moments || [];
    const momentOptions = ['ochtend', 'middag', 'avond'];
    const momentLabels = { ochtend: '☀️ Ochtend', middag: '🌤️ Middag', avond: '🌙 Avond' };

    return `
      <div class="subpage-header">
        ${WM.UI.backButton('medicatie-start')}
        <h2 class="subpage-title">Basisgegevens</h2>
      </div>

      <div class="wizard-progress">
        <div class="wizard-step-dot active">1</div>
        <div class="wizard-step-line"></div>
        <div class="wizard-step-dot">2</div>
      </div>

      <form id="stap1-form" autocomplete="off"
            onsubmit="event.preventDefault();WM.Medications.saveStap1()">

        <div class="form-group">
          <label class="form-label">Naam medicijn <span class="required-star">*</span></label>
          <input type="text" name="name" class="form-input"
                 value="${w.name || ''}" placeholder="bv. Metoprolol" autofocus>
        </div>

        <div class="form-group">
          <label class="form-label">Dosering <span class="required-star">*</span></label>
          <input type="text" name="dosage" class="form-input"
                 value="${w.dosage || ''}" placeholder="bv. 50mg">
        </div>

        <div class="form-group">
          <label class="form-label">Wanneer innemen <span class="required-star">*</span></label>
          <div class="check-group">
            ${momentOptions.map(mo => `
              <label class="check-chip ${moments.includes(mo) ? 'checked-' + mo : ''}" id="chip-${mo}">
                <input type="checkbox" name="moments" data-group="moments" value="${mo}"
                       ${moments.includes(mo) ? 'checked' : ''}
                       onchange="WM.Medications.updateChip('${mo}',this)">
                ${momentLabels[mo]}
              </label>`).join('')}
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px;">
          Volgende →
        </button>
      </form>`;
  }

  function saveStap1() {
    const form = document.getElementById('stap1-form');
    if (!form) return;

    const name = form.querySelector('[name=name]').value.trim();
    const dosage = form.querySelector('[name=dosage]').value.trim();
    const moments = [...form.querySelectorAll('[name=moments]:checked')].map(c => c.value);

    if (!name)    { toast('Naam is verplicht', 'warning'); return; }
    if (!dosage)  { toast('Dosering is verplicht', 'warning'); return; }
    if (!moments.length) { toast('Kies minstens één tijdstip', 'warning'); return; }

    _wizard.name    = name;
    _wizard.dosage  = dosage;
    _wizard.moments = moments;

    WM.App.navigate('medicatie-stap2');
  }

  // ── Wizard: Stap 2 — Details ───────────────────────────────
  function renderStap2() {
    const w = _wizard;
    const defaultPills = w.pillsPerDose || 1;
    const defaultDaily = w.dailyUsage != null
      ? w.dailyUsage
      : defaultPills * (w.moments || []).length;

    const momentNamen = { ochtend: 'Ochtend', middag: 'Middag', avond: 'Avond' };

    return `
      <div class="subpage-header">
        ${WM.UI.backButton('medicatie-stap1')}
        <h2 class="subpage-title">Details</h2>
      </div>

      <div class="wizard-progress">
        <div class="wizard-step-dot done">✓</div>
        <div class="wizard-step-line active"></div>
        <div class="wizard-step-dot active">2</div>
      </div>

      <div class="wizard-summary-card">
        <span class="wizard-summary-icon">💊</span>
        <div>
          <div class="wizard-summary-name">${w.name}</div>
          <div class="wizard-summary-sub">${w.dosage} · ${(w.moments || []).map(m => momentNamen[m]).join(' · ')}</div>
        </div>
      </div>

      <form id="stap2-form" autocomplete="off"
            onsubmit="event.preventDefault();WM.Medications.saveStap2()">

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pillen per inname</label>
            <input type="number" name="pillsPerDose" id="pills-per-dose" class="form-input"
                   value="${defaultPills}" min="0.01" step="0.01"
                   oninput="WM.Medications.updateDailyUsageStap2()">
          </div>
          <div class="form-group">
            <label class="form-label">Huidige voorraad</label>
            <input type="number" name="stock" class="form-input"
                   value="${w.stock != null ? w.stock : ''}" min="0" step="1"
                   placeholder="aantal pillen">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Gebruik per dag</label>
          <input type="number" name="dailyUsage" id="daily-usage-stap2" class="form-input"
                 value="${defaultDaily}" min="0" step="0.01">
          <p class="form-hint">Automatisch berekend · pas aan indien nodig</p>
        </div>

        <div class="form-group">
          <div class="toggle-wrap">
            <span class="toggle-label-text">Afbouwschema toevoegen</span>
            <label class="toggle">
              <input type="checkbox" id="tapering-toggle" ${w.isTapering ? 'checked' : ''}
                     onchange="WM.Medications.toggleTaperingForm(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div id="tapering-form-section"
             class="${w.isTapering ? '' : 'hidden'} tapering-form-section">
          <div class="tapering-form-title">${icon('trending')} Afbouwschema</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Startdosis</label>
              <input type="number" name="taperStart" class="form-input"
                     value="${w.taperStart || ''}" min="0" step="0.1" placeholder="bv. 20">
            </div>
            <div class="form-group">
              <label class="form-label">Einddosis</label>
              <input type="number" name="taperEnd" class="form-input"
                     value="${w.taperEnd || ''}" min="0" step="0.1" placeholder="bv. 0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Vermindering/stap</label>
              <input type="number" name="taperStep" class="form-input"
                     value="${w.taperStep || ''}" min="0.01" step="0.01" placeholder="bv. 0.25">
            </div>
            <div class="form-group">
              <label class="form-label">Interval (dagen)</label>
              <input type="number" name="taperInterval" class="form-input"
                     value="${w.taperInterval || ''}" min="1" step="1" placeholder="bv. 14">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Eenheid</label>
              <input type="text" name="taperUnit" class="form-input"
                     value="${w.taperUnit || 'mg'}" placeholder="mg">
            </div>
            <div class="form-group">
              <label class="form-label">Startdatum</label>
              <input type="date" name="taperStartDate" class="form-input"
                     value="${w.taperStartDate || WM.Data.today()}">
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px;">
          Opslaan
        </button>
      </form>`;
  }

  function updateDailyUsageStap2() {
    const pills = parseFloat(document.getElementById('pills-per-dose')?.value) || 1;
    const moments = (_wizard.moments || []).length;
    const input = document.getElementById('daily-usage-stap2');
    if (input) input.value = parseFloat((pills * moments).toFixed(3));
  }

  function saveStap2() {
    const form = document.getElementById('stap2-form');
    if (!form) return;

    const isTapering = form.querySelector('#tapering-toggle').checked;

    if (isTapering) {
      const missing = ['taperStart','taperEnd','taperStep','taperInterval']
        .filter(f => !form.querySelector(`[name=${f}]`)?.value);
      if (missing.length) {
        toast('Vul alle afbouwvelden in of zet het schema uit', 'warning');
        return;
      }
    }

    const pillsPerDose = Math.max(0.01, parseFloat(form.querySelector('[name=pillsPerDose]').value) || 1);
    const rawStock     = form.querySelector('[name=stock]').value;
    const stock        = rawStock !== '' ? Math.max(0, parseInt(rawStock)) : null;
    const dailyUsage   = parseFloat(form.querySelector('[name=dailyUsage]').value)
                         || pillsPerDose * _wizard.moments.length;

    const saved = MData.save({
      name:         _wizard.name,
      dosage:       _wizard.dosage,
      moments:      _wizard.moments,
      pillsPerDose,
      stock,
      dailyUsage,
      isTapering
    });
    const medId = saved && saved.id;

    if (isTapering && medId) {
      WM.Data.Tapering.save({
        medicationId:   medId,
        startDose:      parseFloat(form.querySelector('[name=taperStart]').value),
        endDose:        parseFloat(form.querySelector('[name=taperEnd]').value),
        reductionStep:  parseFloat(form.querySelector('[name=taperStep]').value),
        intervalDays:   parseInt(form.querySelector('[name=taperInterval]').value),
        unit:           form.querySelector('[name=taperUnit]').value || 'mg',
        startDate:      form.querySelector('[name=taperStartDate]').value || WM.Data.today(),
        active:         true
      });
    }

    WM.Notifications.scheduleToday();
    toast('Medicijn toegevoegd', 'success');
    _wizard = {};
    WM.App.navigate('medicatie');
  }

  // ── Bewerken via modal (bestaande flow) ───────────────────
  function medFormHTML(med = null) {
    const m = med || {};
    const moments = m.moments || [];
    const momentOptions = ['ochtend', 'middag', 'avond'];
    const momentLabels = { ochtend: '☀️ Ochtend', middag: '🌤️ Middag', avond: '🌙 Avond' };
    const tapering = med ? TData.forMedication(med.id) : null;

    return `
      <form id="med-form" autocomplete="off">
        <div class="form-group">
          <label class="form-label">Naam medicijn *</label>
          <input type="text" name="name" class="form-input"
                 value="${m.name || ''}" required placeholder="bv. Metoprolol">
        </div>

        <div class="form-group">
          <label class="form-label">Dosering *</label>
          <input type="text" name="dosage" class="form-input"
                 value="${m.dosage || ''}" required placeholder="bv. 50mg">
        </div>

        <div class="form-group">
          <label class="form-label">Innamemomenten *</label>
          <div class="check-group">
            ${momentOptions.map(mo => `
              <label class="check-chip ${moments.includes(mo) ? 'checked-' + mo : ''}" id="chip-${mo}">
                <input type="checkbox" name="moments" data-group="moments" value="${mo}"
                       ${moments.includes(mo) ? 'checked' : ''}
                       onchange="WM.Medications.updateChip('${mo}',this)">
                ${momentLabels[mo]}
              </label>`).join('')}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pillen per inname</label>
            <input type="number" name="pillsPerDose" class="form-input"
                   value="${m.pillsPerDose || 1}" min="0.01" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Huidige voorraad</label>
            <input type="number" name="stock" class="form-input"
                   value="${m.stock != null ? m.stock : ''}" min="0" step="1"
                   placeholder="aantal pillen">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Gebruik per dag (berekend)</label>
          <input type="number" name="dailyUsage" class="form-input" id="daily-usage-input"
                 value="${m.dailyUsage || ''}" min="0" step="0.01"
                 placeholder="automatisch berekend">
          <p class="form-hint">Pillen per inname × aantal momenten</p>
        </div>

        <div class="form-group">
          <div class="toggle-wrap">
            <span class="toggle-label-text">Afbouwschema actief</span>
            <label class="toggle">
              <input type="checkbox" id="tapering-toggle"
                     ${m.isTapering || tapering ? 'checked' : ''}
                     onchange="WM.Medications.toggleTaperingForm(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div id="tapering-form-section"
             class="${(m.isTapering || tapering) ? '' : 'hidden'} tapering-form-section">
          <div class="tapering-form-title">${icon('trending')} Afbouwschema instellen</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Startdosis</label>
              <input type="number" name="taperStart" class="form-input"
                     value="${tapering ? tapering.startDose : ''}" min="0" step="0.1"
                     placeholder="bv. 20">
            </div>
            <div class="form-group">
              <label class="form-label">Einddosis</label>
              <input type="number" name="taperEnd" class="form-input"
                     value="${tapering ? tapering.endDose : ''}" min="0" step="0.1"
                     placeholder="bv. 0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Vermindering/stap</label>
              <input type="number" name="taperStep" class="form-input"
                     value="${tapering ? tapering.reductionStep : ''}" min="0.01" step="0.01"
                     placeholder="bv. 0.25">
            </div>
            <div class="form-group">
              <label class="form-label">Interval (dagen)</label>
              <input type="number" name="taperInterval" class="form-input"
                     value="${tapering ? tapering.intervalDays : ''}" min="1" step="1"
                     placeholder="bv. 14">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Eenheid</label>
              <input type="text" name="taperUnit" class="form-input"
                     value="${tapering ? tapering.unit : 'mg'}" placeholder="mg">
            </div>
            <div class="form-group">
              <label class="form-label">Startdatum</label>
              <input type="date" name="taperStart_date" class="form-input"
                     value="${tapering ? tapering.startDate.slice(0,10) : WM.Data.today()}">
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:8px;">
          ${med ? `<button type="button" class="btn btn-danger btn-sm"
                           onclick="WM.Medications.deleteMedication('${med.id}')">
                     Verwijderen
                   </button>` : ''}
          <button type="submit" class="btn btn-primary btn-full">Opslaan</button>
        </div>
      </form>`;
  }

  function toggleTaperingForm(show) {
    const section = document.getElementById('tapering-form-section');
    if (section) {
      if (show) section.classList.remove('hidden');
      else      section.classList.add('hidden');
    }
  }

  function updateChip(moment, checkbox) {
    const chip = document.getElementById(`chip-${moment}`);
    if (!chip) return;
    if (checkbox.checked) chip.classList.add(`checked-${moment}`);
    else                  chip.classList.remove(`checked-${moment}`);
    updateDailyUsage();
  }

  function updateDailyUsage() {
    const form = document.getElementById('med-form');
    if (!form) return;
    const checkedMoments = form.querySelectorAll('[data-group=moments]:checked').length;
    const pillsPerDose   = parseFloat(form.querySelector('[name=pillsPerDose]')?.value) || 1;
    const input = document.getElementById('daily-usage-input');
    if (input) input.value = checkedMoments * pillsPerDose;
  }

  function editMedication(id) {
    const med = MData.get(id);
    if (!med) return;
    openModal('Medicijn bewerken', medFormHTML(med), {
      onOpen: () => {
        const form = document.getElementById('med-form');
        form.onsubmit = e => { e.preventDefault(); saveMedication(id); };
        form.querySelector('[name=pillsPerDose]').addEventListener('input', updateDailyUsage);
      }
    });
  }

  // ── Snel bijvullen ────────────────────────────────────────
  function quickFillStock(medId) {
    const med = MData.get(medId);
    if (!med) return;
    openModal(`Bijvullen: ${med.name}`, `
      <div>
        <div class="scan-row" style="margin-bottom:16px;">
          <span class="scan-row-label">Huidige voorraad</span>
          <span class="scan-row-value">${med.stock ?? '–'} stuks</span>
        </div>
        <div class="form-group">
          <label class="form-label">Aantal pillen toevoegen</label>
          <input type="number" class="form-input" id="quick-stock-input"
                 value="" min="1" step="1" placeholder="bv. 30" autofocus>
        </div>
        <button class="btn btn-primary btn-full"
            onclick="WM.Medications.confirmQuickStock('${medId}')">
          ✓ Bijvullen
        </button>
      </div>`);
  }

  function confirmQuickStock(medId) {
    const amount = parseInt(document.getElementById('quick-stock-input')?.value);
    if (!amount || amount <= 0) { toast('Vul een geldig aantal in', 'warning'); return; }
    WM.Data.Medications.updateStock(medId, amount);
    closeModal();
    toast(`Voorraad bijgevuld met ${amount} stuks`, 'success');
    WM.App.refreshPage();
  }

  // ── Prefill vanuit label-scan ─────────────────────────────
  function prefillForm(data) {
    const page = WM.App.currentPage();

    // Wizard-modus: vul _wizard en ga naar stap 1
    if (page === 'medicatie-start' || page === 'medicatie-stap1') {
      if (data.name)    _wizard.name   = data.name;
      if (data.dosage)  _wizard.dosage = data.dosage;
      if (data.quantity) _wizard.stock = parseInt(data.quantity);
      if (data.usageInstructions) {
        const instr = data.usageInstructions.toLowerCase();
        _wizard.moments = [];
        if (instr.includes('ochtend') || instr.includes('morning'))                             _wizard.moments.push('ochtend');
        if (instr.includes('middag') || instr.includes('afternoon') || instr.includes('noon'))  _wizard.moments.push('middag');
        if (instr.includes('avond')  || instr.includes('evening')   || instr.includes('night')) _wizard.moments.push('avond');
      }
      WM.App.navigate('medicatie-stap1');
      toast('Formulier ingevuld vanuit label', 'success');
      return;
    }

    // Klassieke modal-modus
    const form = document.getElementById('med-form');
    if (!form) return;
    if (data.name)     form.querySelector('[name=name]').value    = data.name;
    if (data.dosage)   form.querySelector('[name=dosage]').value  = data.dosage;
    if (data.quantity) form.querySelector('[name=stock]').value   = data.quantity;
    if (data.usageInstructions) {
      const instr = data.usageInstructions.toLowerCase();
      const tryCheck = (val) => {
        const cb = form.querySelector(`[value=${val}]`);
        if (cb) { cb.checked = true; updateChip(val, cb); }
      };
      if (instr.includes('ochtend') || instr.includes('morning'))                             tryCheck('ochtend');
      if (instr.includes('middag') || instr.includes('afternoon') || instr.includes('noon'))  tryCheck('middag');
      if (instr.includes('avond')  || instr.includes('evening')   || instr.includes('night')) tryCheck('avond');
    }
    updateDailyUsage();
    toast('Formulier ingevuld vanuit label', 'success');
  }

  // ── Opslaan (edit-modal) ──────────────────────────────────
  function saveMedication(existingId = null) {
    const form = document.getElementById('med-form');
    const data = WM.UI.getFormData('med-form');

    if (!data.name   || !data.name.trim())   { toast('Naam is verplicht', 'warning'); return; }
    if (!data.dosage || !data.dosage.trim()) { toast('Dosering is verplicht', 'warning'); return; }
    if (!data.moments || data.moments.length === 0) { toast('Kies minstens één innametijdstip', 'warning'); return; }

    const pillsPerDose = Math.max(0.5, parseFloat(data.pillsPerDose) || 1);
    const moments      = Array.isArray(data.moments) ? data.moments : [data.moments];
    const dailyUsage   = Math.max(0, parseFloat(data.dailyUsage) || pillsPerDose * moments.length);
    const isTapering   = form.querySelector('#tapering-toggle').checked;
    const rawStock     = data.stock !== '' ? parseInt(data.stock) : null;
    const stock        = rawStock !== null ? Math.max(0, rawStock) : null;

    const medData = {
      id: existingId || undefined,
      name: data.name.trim(),
      dosage: data.dosage.trim(),
      moments,
      pillsPerDose,
      stock,
      dailyUsage,
      isTapering
    };

    const saved = MData.save(medData);
    const medId = existingId || (saved && saved.id);

    if (isTapering && (!data.taperStart || !data.taperEnd || !data.taperStep || !data.taperInterval)) {
      toast('Vul alle afbouwvelden in of zet het schema uit', 'warning');
      return;
    }

    if (isTapering && data.taperStart && data.taperEnd && data.taperStep && data.taperInterval) {
      const existing = TData.forMedication(medId);
      WM.Data.Tapering.save({
        id:            existing ? existing.id : undefined,
        medicationId:  medId,
        startDose:     parseFloat(data.taperStart),
        endDose:       parseFloat(data.taperEnd),
        reductionStep: parseFloat(data.taperStep),
        intervalDays:  parseInt(data.taperInterval),
        unit:          data.taperUnit || 'mg',
        startDate:     data.taperStart_date || WM.Data.today(),
        active:        true
      });
    } else if (!isTapering) {
      const existing = TData.forMedication(medId);
      if (existing) WM.Data.Tapering.delete(existing.id);
    }

    closeModal();
    WM.Notifications.scheduleToday();
    toast('Medicijn bijgewerkt', 'success');

    // Na bewerken: terug naar detailpagina als we daar vandaan kwamen
    if (WM.App.currentPage() === 'medicatie-detail') {
      WM.App.refreshPage();
    } else {
      WM.App.navigate('medicatie');
    }
  }

  function deleteMedication(id) {
    const med = MData.get(id);
    confirmDialog(`"${med ? med.name : 'Dit medicijn'}" definitief verwijderen?`, () => {
      MData.delete(id);
      closeModal();
      WM.Notifications.scheduleToday();
      toast('Medicijn verwijderd', 'success');
      WM.App.navigate('medicatie');
    });
  }

  return {
    render, renderMedCard,
    openDetail, renderDetail,
    startAddFlow, renderStart, startScan, goToStap1,
    renderStap1, saveStap1,
    renderStap2, saveStap2, updateDailyUsageStap2,
    editMedication, prefillForm, deleteMedication,
    toggleTaperingForm, updateChip,
    quickFillStock, confirmQuickStock
  };
})();

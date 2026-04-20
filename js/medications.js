// ============================================================
// medications.js — Medicatiebeheer (CRUD)
// ============================================================
window.WM = window.WM || {};

WM.Medications = (() => {
  const { Medications: MData, Tapering: TData } = WM.Data;
  const { openModal, closeModal, toast, confirmDialog, icon } = WM.UI;

  // ── Pagina ────────────────────────────────────────────────
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
        `<button class="btn btn-primary" onclick="WM.Medications.addMedication()">
           ${icon('plus')} Medicijn toevoegen
         </button>`
      );
    } else {
      html += `<div class="section-title">Alle medicijnen (${meds.length})</div>`;
      html += meds.map(med => renderMedCard(med)).join('');
    }

    return html;
  }

  function renderMedCard(med) {
    const tapering = TData.forMedication(med.id);
    const moments = (med.moments || []).map(m =>
      `<span class="moment-dot ${m}"></span>`
    ).join('');

    const taperBadge = tapering
      ? `<span class="badge badge-primary" style="margin-top:4px;">⬇ Afbouw: ${TData.currentDose(tapering)}${tapering.unit}</span>`
      : '';

    return `
      <div class="med-card fade-in" onclick="WM.Medications.editMedication('${med.id}')">
        <div class="med-icon">💊</div>
        <div class="med-info">
          <div class="med-name">${med.name}</div>
          <div class="med-dosage">${med.dosage}</div>
          <div class="med-moments">${moments}</div>
          ${taperBadge}
        </div>
        <div class="med-right">
          ${WM.Stock.renderStockInfo(med)}
          <button class="btn btn-sm btn-outline refill-btn"
              onclick="event.stopPropagation();WM.Medications.quickFillStock('${med.id}')"
              title="Voorraad bijvullen">＋ Bijvullen</button>
        </div>
      </div>`;
  }

  // ── Formulier ─────────────────────────────────────────────
  function medFormHTML(med = null) {
    const m = med || {};
    const moments = m.moments || [];
    const momentOptions = ['ochtend', 'middag', 'avond'];
    const momentLabels = { ochtend: '☀️ Ochtend', middag: '🌤️ Middag', avond: '🌙 Avond' };

    const tapering = med ? TData.forMedication(med.id) : null;

    return `
      <form id="med-form" autocomplete="off">
        ${med ? '' : `
          <div style="margin-bottom:16px;">
            <button type="button" class="btn btn-outline btn-full" onclick="WM.Camera.openScanner('${med ? med.id : ''}')">
              ${icon('camera')} Apothekerlabel scannen
            </button>
            <p class="form-hint">Scan een label om het formulier automatisch in te vullen</p>
          </div>
          <hr class="divider">
        `}

        <div class="form-group">
          <label class="form-label">Naam medicijn *</label>
          <input type="text" name="name" class="form-input" value="${m.name || ''}" required placeholder="bv. Metoprolol">
        </div>

        <div class="form-group">
          <label class="form-label">Dosering *</label>
          <input type="text" name="dosage" class="form-input" value="${m.dosage || ''}" required placeholder="bv. 50mg">
        </div>

        <div class="form-group">
          <label class="form-label">Innamemomenten *</label>
          <div class="check-group">
            ${momentOptions.map(mo => `
              <label class="check-chip ${moments.includes(mo) ? 'checked-' + mo : ''}" id="chip-${mo}">
                <input type="checkbox" name="moments" data-group="moments" value="${mo}" ${moments.includes(mo) ? 'checked' : ''} onchange="WM.Medications.updateChip('${mo}',this)">
                ${momentLabels[mo]}
              </label>`).join('')}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pillen per inname</label>
            <input type="number" name="pillsPerDose" class="form-input" value="${m.pillsPerDose || 1}" min="0.01" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Huidige voorraad</label>
            <input type="number" name="stock" class="form-input" value="${m.stock != null ? m.stock : ''}" min="0" step="1" placeholder="aantal pillen">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Gebruik per dag (berekend)</label>
          <input type="number" name="dailyUsage" class="form-input" id="daily-usage-input" value="${m.dailyUsage || ''}" min="0" step="0.01" placeholder="automatisch berekend">
          <p class="form-hint">Wordt automatisch berekend: pillen per inname × aantal momenten</p>
        </div>

        <!-- Afbouwschema -->
        <div class="form-group">
          <div class="toggle-wrap">
            <span class="toggle-label-text">Afbouwschema actief</span>
            <label class="toggle">
              <input type="checkbox" id="tapering-toggle" ${m.isTapering || tapering ? 'checked' : ''} onchange="WM.Medications.toggleTaperingForm(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div id="tapering-form-section" class="${(m.isTapering || tapering) ? '' : 'hidden'} tapering-form-section">
          <div class="tapering-form-title">${icon('trending')} Afbouwschema instellen</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Startdosis</label>
              <input type="number" name="taperStart" class="form-input" value="${tapering ? tapering.startDose : ''}" min="0" step="0.1" placeholder="bv. 20">
            </div>
            <div class="form-group">
              <label class="form-label">Einddosis</label>
              <input type="number" name="taperEnd" class="form-input" value="${tapering ? tapering.endDose : ''}" min="0" step="0.1" placeholder="bv. 0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Vermindering/stap</label>
              <input type="number" name="taperStep" class="form-input" value="${tapering ? tapering.reductionStep : ''}" min="0.01" step="0.01" placeholder="bv. 0.25">
            </div>
            <div class="form-group">
              <label class="form-label">Interval (dagen)</label>
              <input type="number" name="taperInterval" class="form-input" value="${tapering ? tapering.intervalDays : ''}" min="1" step="1" placeholder="bv. 14">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Eenheid</label>
              <input type="text" name="taperUnit" class="form-input" value="${tapering ? tapering.unit : 'mg'}" placeholder="mg">
            </div>
            <div class="form-group">
              <label class="form-label">Startdatum</label>
              <input type="date" name="taperStart_date" class="form-input" value="${tapering ? tapering.startDate.slice(0,10) : WM.Data.today()}">
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:8px;">
          ${med ? `<button type="button" class="btn btn-danger btn-sm" onclick="WM.Medications.deleteMedication('${med.id}')">Verwijderen</button>` : ''}
          <button type="submit" class="btn btn-primary btn-full">Opslaan</button>
        </div>
      </form>`;
  }

  function toggleTaperingForm(show) {
    const section = document.getElementById('tapering-form-section');
    if (section) {
      if (show) section.classList.remove('hidden');
      else section.classList.add('hidden');
    }
  }

  function updateChip(moment, checkbox) {
    const chip = document.getElementById(`chip-${moment}`);
    if (!chip) return;
    if (checkbox.checked) chip.classList.add(`checked-${moment}`);
    else chip.classList.remove(`checked-${moment}`);
    // Update berekend dagelijks gebruik
    updateDailyUsage();
  }

  function updateDailyUsage() {
    const form = document.getElementById('med-form');
    if (!form) return;
    const checkedMoments = form.querySelectorAll('[data-group=moments]:checked').length;
    const pillsPerDose = parseFloat(form.querySelector('[name=pillsPerDose]')?.value) || 1;
    const daily = checkedMoments * pillsPerDose;
    const input = document.getElementById('daily-usage-input');
    if (input) input.value = daily;
  }

  // ── Modal openen ──────────────────────────────────────────
  function addMedication() {
    openModal('Medicijn toevoegen', medFormHTML(), {
      onOpen: () => {
        const form = document.getElementById('med-form');
        form.onsubmit = e => { e.preventDefault(); saveMedication(null); };
        form.querySelector('[name=pillsPerDose]').addEventListener('input', updateDailyUsage);
        updateDailyUsage();
      }
    });
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

  // Formulier invullen vanuit scan
  function prefillForm(data) {
    const form = document.getElementById('med-form');
    if (!form) return;
    if (data.name) form.querySelector('[name=name]').value = data.name;
    if (data.dosage) form.querySelector('[name=dosage]').value = data.dosage;
    if (data.quantity) form.querySelector('[name=stock]').value = data.quantity;
    if (data.usageInstructions) {
      // Probeer momenten te detecteren
      const instr = data.usageInstructions.toLowerCase();
      if (instr.includes('ochtend') || instr.includes('morning')) {
        const cb = form.querySelector('[value=ochtend]');
        if (cb) { cb.checked = true; updateChip('ochtend', cb); }
      }
      if (instr.includes('middag') || instr.includes('afternoon') || instr.includes('noon')) {
        const cb = form.querySelector('[value=middag]');
        if (cb) { cb.checked = true; updateChip('middag', cb); }
      }
      if (instr.includes('avond') || instr.includes('evening') || instr.includes('night')) {
        const cb = form.querySelector('[value=avond]');
        if (cb) { cb.checked = true; updateChip('avond', cb); }
      }
    }
    updateDailyUsage();
    toast('Formulier ingevuld vanuit label', 'success');
  }

  // ── Opslaan ───────────────────────────────────────────────
  function saveMedication(existingId = null) {
    const form = document.getElementById('med-form');
    const data = WM.UI.getFormData('med-form');

    if (!data.name || !data.name.trim()) { toast('Naam is verplicht', 'warning'); return; }
    if (!data.dosage || !data.dosage.trim()) { toast('Dosering is verplicht', 'warning'); return; }
    if (!data.moments || data.moments.length === 0) { toast('Kies minstens één innametijdstip', 'warning'); return; }

    const pillsPerDose = Math.max(0.5, parseFloat(data.pillsPerDose) || 1);
    const moments = Array.isArray(data.moments) ? data.moments : [data.moments];
    const dailyUsage = Math.max(0, parseFloat(data.dailyUsage) || pillsPerDose * moments.length);
    const isTapering = form.querySelector('#tapering-toggle').checked;

    const rawStock = data.stock !== '' ? parseInt(data.stock) : null;
    const stock = rawStock !== null ? Math.max(0, rawStock) : null;

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

    // Valideer afbouwvelden als toggle aan staat
    if (isTapering && (!data.taperStart || !data.taperEnd || !data.taperStep || !data.taperInterval)) {
      toast('Vul alle afbouwvelden in of zet het schema uit', 'warning');
      return;
    }

    // Afbouwschema opslaan indien ingevuld
    if (isTapering && data.taperStart && data.taperEnd && data.taperStep && data.taperInterval) {
      const existing = TData.forMedication(medId);
      WM.Data.Tapering.save({
        id: existing ? existing.id : undefined,
        medicationId: medId,
        startDose: parseFloat(data.taperStart),
        endDose: parseFloat(data.taperEnd),
        reductionStep: parseFloat(data.taperStep),
        intervalDays: parseInt(data.taperInterval),
        unit: data.taperUnit || 'mg',
        startDate: data.taperStart_date || WM.Data.today(),
        active: true
      });
    } else if (!isTapering) {
      // Verwijder bestaand tapering als toggle uit staat
      const existing = TData.forMedication(medId);
      if (existing) WM.Data.Tapering.delete(existing.id);
    }

    closeModal();
    WM.Notifications.scheduleToday();
    toast(existingId ? 'Medicijn bijgewerkt' : 'Medicijn toegevoegd', 'success');
    WM.App.refreshPage();
  }

  function deleteMedication(id) {
    const med = MData.get(id);
    confirmDialog(`"${med ? med.name : 'Dit medicijn'}" definitief verwijderen?`, () => {
      MData.delete(id);
      closeModal();
      WM.Notifications.scheduleToday();
      toast('Medicijn verwijderd', 'success');
      WM.App.refreshPage();
    });
  }

  return { render, renderMedCard, addMedication, editMedication, prefillForm, deleteMedication, toggleTaperingForm, updateChip, quickFillStock, confirmQuickStock };
})();

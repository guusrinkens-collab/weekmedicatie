// ============================================================
// tapering.js — Afbouwschema's (weergave & beheer)
// ============================================================
window.WM = window.WM || {};

WM.Tapering = (() => {
  const { Tapering: TData, Medications } = WM.Data;
  const { openModal, closeModal, toast, formatDate, formatRelativeDate, backButton } = WM.UI;

  // ── Pagina renderen ───────────────────────────────────────
  function render() {
    const taperings = TData.all();
    const meds = Medications.all();

    let html = `
      <div class="subpage-header">
        ${backButton('meer')}
        <h2 class="subpage-title">Afbouwschema's</h2>
      </div>`;

    if (taperings.length === 0) {
      html += WM.UI.emptyState(
        'Geen afbouwschema\'s',
        'Voeg een afbouwschema toe via het medicatiebeheer.',
        ''
      );
    } else {
      taperings.forEach(t => {
        const med = meds.find(m => m.id === t.medicationId);
        if (!med) return;
        html += renderTaperingCard(t, med);
      });
    }

    return html;
  }

  function renderTaperingCard(t, med) {
    const currentDose = TData.currentDose(t);
    const nextDate = TData.nextReductionDate(t);
    const isComplete = TData.isComplete(t);
    const totalReduction = t.startDose - t.endDose;
    const doneReduction = t.startDose - currentDose;
    const progressPct = totalReduction > 0 ? Math.min(100, Math.round(doneReduction / totalReduction * 100)) : 0;

    const startDate = new Date(t.startDate);
    const totalDays = Math.round((t.startDose - t.endDose) / t.reductionStep) * t.intervalDays;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays);

    return `
      <div class="tapering-card fade-in">
        <div class="card-header">
          <div>
            <div class="card-title">${med.name}</div>
            <div class="card-subtitle">${med.dosage}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${isComplete
              ? '<span class="badge badge-success">Voltooid</span>'
              : t.active ? '<span class="badge badge-primary">Actief</span>' : '<span class="badge">Inactief</span>'
            }
            <button class="btn btn-ghost btn-sm" onclick="WM.Tapering.editTapering('${t.id}')">
              ${WM.UI.icon('edit')}
            </button>
          </div>
        </div>

        <div class="tapering-progress">
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px;">Huidige dosis</div>
            <div class="dose-display">${currentDose}<span class="dose-unit"> ${t.unit || 'mg'}</span></div>
          </div>
          <div style="flex:1;">
            <div class="taper-bar">
              <div class="taper-fill" style="width:${progressPct}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);margin-top:4px;">
              <span>${t.startDose}${t.unit || 'mg'}</span>
              <span>${progressPct}%</span>
              <span>${t.endDose}${t.unit || 'mg'}</span>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.8rem;">
          <div class="settings-item" style="padding:10px 12px;">
            <div>
              <div style="color:var(--text-muted);font-size:0.7rem;">Vermindering</div>
              <div style="font-weight:700;">${t.reductionStep}${t.unit || 'mg'} per ${t.intervalDays} dag${t.intervalDays > 1 ? 'en' : ''}</div>
            </div>
          </div>
          <div class="settings-item" style="padding:10px 12px;">
            <div>
              <div style="color:var(--text-muted);font-size:0.7rem;">${isComplete ? 'Eindatum' : 'Volgende stap'}</div>
              <div style="font-weight:700;">${isComplete
                ? formatDate(endDate.toISOString().slice(0,10), 'medium')
                : (nextDate ? formatRelativeDate(nextDate.toISOString().slice(0,10)) : '–')
              }</div>
            </div>
          </div>
        </div>

        ${!isComplete && nextDate ? `
          <div style="margin-top:10px;padding:10px 12px;background:rgba(108,99,255,0.1);border-radius:8px;font-size:0.8rem;">
            <span style="color:var(--text-muted);">Volgende verlaging: </span>
            <strong>${currentDose - t.reductionStep}${t.unit || 'mg'}</strong>
            <span style="color:var(--text-muted);"> op ${formatDate(nextDate.toISOString().slice(0,10), 'medium')}</span>
          </div>` : ''}
      </div>`;
  }

  // ── Formulier ─────────────────────────────────────────────
  function taperingFormHTML(tapering = null, medId = null) {
    const t = tapering || {};
    const meds = Medications.all();
    const medOptions = meds.map(m =>
      `<option value="${m.id}" ${(t.medicationId || medId) === m.id ? 'selected' : ''}>${m.name} (${m.dosage})</option>`
    ).join('');

    return `
      <form id="tapering-form">
        <div class="form-group">
          <label class="form-label">Medicijn</label>
          <select name="medicationId" class="form-select" required>
            <option value="">Kies medicijn…</option>
            ${medOptions}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Startdosis</label>
            <input type="number" name="startDose" class="form-input" value="${t.startDose || ''}" min="0" step="0.5" required placeholder="bv. 20">
          </div>
          <div class="form-group">
            <label class="form-label">Einddosis</label>
            <input type="number" name="endDose" class="form-input" value="${t.endDose || ''}" min="0" step="0.5" required placeholder="bv. 0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Vermindering per stap</label>
            <input type="number" name="reductionStep" class="form-input" value="${t.reductionStep || ''}" min="0.5" step="0.5" required placeholder="bv. 5">
          </div>
          <div class="form-group">
            <label class="form-label">Interval (dagen)</label>
            <input type="number" name="intervalDays" class="form-input" value="${t.intervalDays || ''}" min="1" step="1" required placeholder="bv. 14">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Eenheid</label>
            <input type="text" name="unit" class="form-input" value="${t.unit || 'mg'}" placeholder="mg">
          </div>
          <div class="form-group">
            <label class="form-label">Startdatum</label>
            <input type="date" name="startDate" class="form-input" value="${t.startDate ? t.startDate.slice(0,10) : WM.Data.today()}" required>
          </div>
        </div>
        <div class="form-group">
          <div class="toggle-wrap">
            <span class="toggle-label-text">Schema actief</span>
            <label class="toggle">
              <input type="checkbox" name="active" ${t.active !== false ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;">
          ${tapering ? `<button type="button" class="btn btn-danger btn-sm" onclick="WM.Tapering.deleteTapering('${t.id}')">Verwijderen</button>` : ''}
          <button type="submit" class="btn btn-primary btn-full">Opslaan</button>
        </div>
      </form>`;
  }

  function openTaperingModal(tapering = null, medId = null) {
    openModal(tapering ? 'Afbouwschema bewerken' : 'Nieuw afbouwschema', taperingFormHTML(tapering, medId), {
      onOpen: () => {
        document.getElementById('tapering-form').onsubmit = e => {
          e.preventDefault();
          saveTapering(tapering ? tapering.id : null);
        };
      }
    });
  }

  function saveTapering(existingId = null) {
    const form = document.getElementById('tapering-form');
    const data = WM.UI.getFormData('tapering-form');
    if (!data.medicationId) { toast('Kies een medicijn', 'warning'); return; }
    if (!data.startDose || !data.endDose || !data.reductionStep || !data.intervalDays) {
      toast('Vul alle velden in', 'warning'); return;
    }

    const t = {
      id: existingId || undefined,
      medicationId: data.medicationId,
      startDose: parseFloat(data.startDose),
      endDose: parseFloat(data.endDose),
      reductionStep: parseFloat(data.reductionStep),
      intervalDays: parseInt(data.intervalDays),
      unit: data.unit || 'mg',
      startDate: data.startDate,
      active: form.querySelector('[name=active]').checked
    };

    TData.save(t);
    // Koppel ook aan medicijn
    const med = Medications.get(t.medicationId);
    if (med) {
      Medications.save({ ...med, isTapering: t.active });
    }

    closeModal();
    toast('Afbouwschema opgeslagen', 'success');
    if (WM.App.currentPage() === 'afbouw') WM.App.refreshPage();
  }

  function editTapering(id) {
    const t = TData.get(id);
    if (!t) return;
    openTaperingModal(t);
  }

  function deleteTapering(id) {
    WM.UI.confirmDialog('Afbouwschema verwijderen?', () => {
      TData.delete(id);
      toast('Afbouwschema verwijderd', 'success');
      closeModal();
      if (WM.App.currentPage() === 'afbouw') WM.App.refreshPage();
    });
  }

  function addTaperingForMed(medId) {
    openTaperingModal(null, medId);
  }

  // Inline display voor een medicijn (op de vandaag-pagina)
  function inlineStatus(med) {
    const t = TData.forMedication(med.id);
    if (!t) return '';
    const dose = TData.currentDose(t);
    const next = TData.nextReductionDate(t);
    return `
      <div style="margin-top:6px;padding:6px 10px;background:rgba(108,99,255,0.1);border-radius:6px;font-size:0.75rem;">
        <span style="color:var(--primary-light);">⬇ Afbouw: </span>
        <strong>${dose}${t.unit}</strong>
        ${next ? `<span style="color:var(--text-muted);"> · volgende stap ${WM.UI.formatRelativeDate(next.toISOString().slice(0,10))}</span>` : ''}
      </div>`;
  }

  return { render, renderTaperingCard, openTaperingModal, editTapering, deleteTapering, addTaperingForMed, inlineStatus };
})();

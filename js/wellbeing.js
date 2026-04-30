// ============================================================
// wellbeing.js — Dagelijks welzijnslog
// ============================================================
window.WM = window.WM || {};

WM.Wellbeing = (() => {
  const { Wellbeing: WData } = WM.Data;
  const { toast, backButton, escapeHTML } = WM.UI;

  const MOODS = [
    { val: 1, emoji: '😞', label: 'Slecht' },
    { val: 2, emoji: '😕', label: 'Matig' },
    { val: 3, emoji: '😐', label: 'Redelijk' },
    { val: 4, emoji: '😊', label: 'Goed' },
    { val: 5, emoji: '😄', label: 'Uitstekend' }
  ];

  let selectedMood = 0;

  function render() {
    const today = WM.Data.today();
    const existing = WData.get(today);
    const history = WData.history(30);
    selectedMood = existing ? existing.mood : 0;

    let html = `
      <div class="subpage-header">
        ${backButton('meer')}
        <h2 class="subpage-title">Welzijnslog</h2>
      </div>

      <div class="section-title">Hoe voelt u zich vandaag?</div>
      <div class="card">
        <div class="mood-selector">
          ${MOODS.map(m => `
            <button class="mood-btn ${existing && existing.mood === m.val ? 'selected' : ''}"
                    id="mood-${m.val}"
                    onclick="WM.Wellbeing.selectMood(${m.val})"
                    title="${m.label}">
              ${m.emoji}
            </button>`).join('')}
        </div>

        <div id="mood-label" style="text-align:center;font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
          ${existing && existing.mood ? MOODS[existing.mood - 1].label : 'Kies uw stemming'}
        </div>

        <div class="form-group">
          <label class="form-label">Notitie (optioneel)</label>
          <textarea id="wellbeing-note" class="form-textarea" placeholder="Hoe gaat het? Bijwerkingen, opmerkingen…">${existing ? escapeHTML(existing.note || '') : ''}</textarea>
        </div>

        <button class="btn btn-primary btn-full" onclick="WM.Wellbeing.saveEntry()">
          Opslaan
        </button>
      </div>

      <div class="section-title">Afgelopen 30 dagen</div>`;

    // Kleine kalenderweergave
    html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
    const entries = history.filter(h => h.entry);
    if (entries.length === 0) {
      html += `<p style="color:var(--text-muted);font-size:0.85rem;padding:16px 0;">Nog geen welzijnsdata</p>`;
    } else {
      entries.slice(0, 10).forEach(({ date, entry }) => {
        const mood = MOODS[entry.mood - 1];
        const isToday = date === WM.Data.today();
        html += `
          <div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.5rem;">${mood ? mood.emoji : '❓'}</span>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:0.85rem;">${isToday ? 'Vandaag' : WM.UI.formatDate(date, 'medium')}</div>
              ${entry.note ? `<div style="font-size:0.8rem;color:var(--text-muted);">${escapeHTML(entry.note)}</div>` : ''}
            </div>
            <span class="badge badge-${entry.mood >= 4 ? 'success' : entry.mood <= 2 ? 'danger' : 'info'}">${mood ? mood.label : '–'}</span>
          </div>`;
      });
    }
    html += `</div>`;

    return html;
  }

  function selectMood(val) {
    selectedMood = val;
    MOODS.forEach(m => {
      const btn = document.getElementById(`mood-${m.val}`);
      if (btn) btn.classList.toggle('selected', m.val === val);
    });
    const label = document.getElementById('mood-label');
    if (label) label.textContent = MOODS[val - 1]?.label || '';
  }

  function saveEntry() {
    if (!selectedMood) { toast('Kies een stemming', 'warning'); return; }
    const note = document.getElementById('wellbeing-note')?.value?.trim() || '';
    WData.save(WM.Data.today(), { mood: selectedMood, note });
    toast('Welzijn opgeslagen', 'success');
    WM.App.refreshPage();
  }

  // Mini-widget voor vandaag-pagina
  function todayWidget() {
    const today = WM.Data.today();
    const existing = WData.get(today);
    if (existing) return ''; // Al ingevuld, toon niets

    return `
      <div class="card" style="margin-bottom:16px;background:rgba(108,99,255,0.08);border-color:rgba(108,99,255,0.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;">Hoe voelt u zich?</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Log uw dagelijkse welzijn</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="WM.App.navigate('welzijn')">
            ${WM.UI.icon('heart')} Invullen
          </button>
        </div>
      </div>`;
  }

  return { render, selectMood, saveEntry, todayWidget };
})();

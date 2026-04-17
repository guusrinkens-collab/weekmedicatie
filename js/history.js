// ============================================================
// history.js — Inname-geschiedenis (laatste 30 dagen)
// ============================================================
window.WM = window.WM || {};

WM.History = (() => {
  const { Schedule: SData, Medications, Wellbeing: WData } = WM.Data;
  const { formatDate, backButton } = WM.UI;

  const MOMENTS = ['ochtend', 'middag', 'avond'];
  const MOOD_EMOJIS = ['', '😞', '😕', '😐', '😊', '😄'];

  function render() {
    const history = SData.history(30);
    const meds = Medications.all();
    const wellbeing = WData.history(30);
    const wellbeingMap = {};
    wellbeing.forEach(w => { wellbeingMap[w.date] = w.entry; });

    let html = `<div class="section-title">Laatste 30 dagen</div>
      <div class="history-grid">`;

    history.forEach(({ date, data }) => {
      const wb = wellbeingMap[date];
      const isToday = date === WM.Data.today();

      let total = 0, done = 0;
      if (data) {
        MOMENTS.forEach(m => {
          meds.filter(med => med.moments && med.moments.includes(m)).forEach(med => {
            total++;
            if (data[m] && data[m][med.id] && data[m][med.id].taken) done++;
          });
        });
      }

      const pct = total > 0 ? Math.round(done / total * 100) : -1;
      let heatClass = 'hd-0';
      if (pct === 100) heatClass = 'hd-100';
      else if (pct >= 75) heatClass = 'hd-75';
      else if (pct >= 50) heatClass = 'hd-50';

      const d = new Date(date + 'T00:00:00');
      const dayNum = d.getDate();
      const moodEmoji = wb && wb.mood ? MOOD_EMOJIS[wb.mood] : '';

      html += `
        <div class="history-day ${heatClass} ${isToday ? 'today' : ''}"
             onclick="WM.History.showDay('${date}')">
          <div class="history-day-date">${dayNum}</div>
          ${moodEmoji ? `<div class="history-day-mood">${moodEmoji}</div>` : ''}
          <div class="history-day-pct">${pct >= 0 ? pct + '%' : '–'}</div>
        </div>`;
    });

    html += `</div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:0.75rem;color:var(--text-muted);">
        <div style="width:14px;height:14px;border-radius:3px;background:rgba(16,185,129,0.15);border:1px solid var(--border);"></div> 100%
        <div style="width:14px;height:14px;border-radius:3px;background:rgba(245,158,11,0.12);border:1px solid var(--border);"></div> 75%+
        <div style="width:14px;height:14px;border-radius:3px;background:rgba(239,68,68,0.10);border:1px solid var(--border);"></div> 50%+
        <div style="width:14px;height:14px;border-radius:3px;background:var(--bg-card);border:1px solid var(--border);"></div> Geen data
      </div>`;

    return html;
  }

  function showDay(date) {
    const meds = Medications.all();
    const dayData = SData.getDay(date);
    const wb = WData.get(date);
    const isToday = date === WM.Data.today();

    let total = 0, done = 0;
    let html = `<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">${formatDate(date, 'long')}</p>`;

    if (wb) {
      const moodEmoji = MOOD_EMOJIS[wb.mood] || '';
      html += `
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;gap:12px;align-items:center;">
            <span style="font-size:2rem;">${moodEmoji}</span>
            <div>
              <div style="font-weight:700;">Welzijn ${isToday ? 'vandaag' : 'die dag'}</div>
              ${wb.note ? `<div style="font-size:0.85rem;color:var(--text-muted);">${wb.note}</div>` : ''}
            </div>
          </div>
        </div>`;
    }

    MOMENTS.forEach(moment => {
      const labels = { ochtend: '☀️ Ochtend', middag: '🌤️ Middag', avond: '🌙 Avond' };
      const medsForMoment = meds.filter(med => med.moments && med.moments.includes(moment));
      if (medsForMoment.length === 0) return;

      html += `<div class="section-title">${labels[moment]}</div>`;

      medsForMoment.forEach(med => {
        total++;
        const intake = (dayData[moment] && dayData[moment][med.id]) || { taken: false, time: null };
        if (intake.taken) done++;

        html += `
          <div class="intake-card ${intake.taken ? 'taken' : ''}" style="cursor:default;">
            <div class="intake-check" ${intake.taken ? 'style="background:var(--success);border-color:var(--success);color:white;"' : ''}>
              ${intake.taken ? WM.UI.icon('check') : ''}
            </div>
            <div style="flex:1;">
              <div class="intake-name">${med.name}</div>
              <div class="intake-dosage">${med.dosage}</div>
            </div>
            <div class="intake-meta">
              ${intake.taken
                ? `<span class="badge badge-success">✓ ${intake.time || 'Ingenomen'}</span>`
                : `<span class="badge badge-danger">Gemist</span>`}
            </div>
          </div>`;
      });
    });

    if (total === 0) {
      html += `<p style="color:var(--text-muted);text-align:center;padding:20px;">Geen medicijnen ingepland voor deze dag.</p>`;
    } else {
      const pct = Math.round(done / total * 100);
      html = `
        <div class="today-progress" style="margin-bottom:16px;">
          <div class="progress-header">
            <span class="progress-title">${pct === 100 ? '✅ Alle medicatie ingenomen' : 'Inname overzicht'}</span>
            <span class="progress-count">${done}/${total}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>` + html;
    }

    WM.UI.openModal(isToday ? 'Vandaag' : formatDate(date, 'medium'), html);
  }

  return { render, showDay };
})();

// ============================================================
// schedule.js — Vandaag-pagina (dagelijks innamesschema)
// ============================================================
window.WM = window.WM || {};

WM.Schedule = (() => {
  const { Schedule: SData, Medications } = WM.Data;
  const { formatDate, toast } = WM.UI;

  const MOMENTS = [
    { key: 'ochtend', label: 'Ochtend', emoji: '☀️' },
    { key: 'middag',  label: 'Middag',  emoji: '🌤️' },
    { key: 'avond',   label: 'Avond',   emoji: '🌙' }
  ];

  function render() {
    const today = WM.Data.today();
    const meds = Medications.all();
    const dayData = SData.getDay(today);
    const alerts = WM.Stock.getAlerts();

    // Statistieken
    let totalIntakes = 0, doneIntakes = 0;
    MOMENTS.forEach(m => {
      const medsForMoment = meds.filter(med => med.moments && med.moments.includes(m.key));
      medsForMoment.forEach(med => {
        totalIntakes++;
        const intake = dayData[m.key] && dayData[m.key][med.id];
        if (intake && intake.taken) doneIntakes++;
      });
    });

    const pct = totalIntakes > 0 ? Math.round(doneIntakes / totalIntakes * 100) : 0;

    let html = `
      <div style="width:100%;border-radius:16px;overflow:hidden;margin-bottom:16px;max-height:200px;">
        <img src="assets/today-banner.jpg" alt="Weekmedicatie" style="width:100%;height:200px;object-fit:cover;object-position:center top;display:block;">
      </div>
      <p class="today-date">${formatDate(today, 'long')}</p>

      ${alerts.length > 0 ? alerts.slice(0, 3).map(a => WM.Stock.renderAlertBanner(a)).join('') : ''}

      <div class="today-progress">
        <div class="progress-header">
          <span class="progress-title ${pct === 100 ? 'progress-complete' : ''}">
            ${pct === 100 ? '✅ Alles ingenomen!' : 'Voortgang vandaag'}
          </span>
          <span class="progress-count">${doneIntakes} / ${totalIntakes}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%" id="progress-fill"></div>
        </div>
      </div>`;

    MOMENTS.forEach(moment => {
      const medsForMoment = meds.filter(med => med.moments && med.moments.includes(moment.key));
      if (medsForMoment.length === 0) return;

      const doneMoment = medsForMoment.filter(med => {
        const intake = dayData[moment.key] && dayData[moment.key][med.id];
        return intake && intake.taken;
      }).length;

      html += `
        <div class="moment-section">
          <div class="moment-header ${moment.key}">
            <span class="moment-emoji">${moment.emoji}</span>
            <span>${moment.label}</span>
            <span class="moment-badge">${doneMoment}/${medsForMoment.length}</span>
          </div>`;

      medsForMoment.forEach(med => {
        const intake = (dayData[moment.key] && dayData[moment.key][med.id]) || { taken: false, time: null };
        const taken = intake.taken;
        const taperInfo = WM.Tapering.inlineStatus(med);

        html += `
          <div class="intake-card ${taken ? 'taken' : ''}" id="intake-${moment.key}-${med.id}" onclick="WM.Schedule.toggleIntake('${moment.key}', '${med.id}')">
            <div class="intake-check">
              ${taken ? WM.UI.icon('check') : ''}
            </div>
            <div style="flex:1;min-width:0;">
              <div class="intake-name">${med.name}</div>
              <div class="intake-dosage">${med.dosage}${med.pillsPerDose > 1 ? ` · ${med.pillsPerDose}x` : ''}</div>
              ${taperInfo}
            </div>
            <div class="intake-meta">
              ${taken && intake.time ? `<div class="intake-time">${intake.time}</div>` : ''}
              ${WM.Stock.renderStockInfo(med)}
            </div>
          </div>`;
      });

      html += `</div>`;
    });

    if (totalIntakes === 0) {
      html += WM.UI.emptyState(
        'Geen medicijnen ingepland',
        'Voeg medicijnen toe via de Medicatie-tab.',
        `<button class="btn btn-primary" onclick="WM.App.navigate('medicatie')">Medicatie beheren</button>`
      );
    }

    return html;
  }

  function toggleIntake(moment, medId) {
    const today = WM.Data.today();
    const current = SData.getIntake(today, moment, medId);
    const newTaken = !current.taken;

    SData.setIntake(today, moment, medId, newTaken);

    // Voorraad bijwerken
    WM.Stock.recordIntake(medId, newTaken);

    // UI bijwerken zonder volledige herrender
    const card = document.getElementById(`intake-${moment}-${medId}`);
    if (card) {
      if (newTaken) {
        card.classList.add('taken');
        const time = new Date().toTimeString().slice(0, 5);
        const check = card.querySelector('.intake-check');
        if (check) check.innerHTML = WM.UI.icon('check');
        const meta = card.querySelector('.intake-meta');
        if (meta) {
          const timeEl = meta.querySelector('.intake-time') || document.createElement('div');
          timeEl.className = 'intake-time';
          timeEl.textContent = time;
          meta.prepend(timeEl);
        }
      } else {
        card.classList.remove('taken');
        const check = card.querySelector('.intake-check');
        if (check) check.innerHTML = '';
        const timeEl = card.querySelector('.intake-time');
        if (timeEl) timeEl.remove();
      }
      // Stockweergave updaten
      const med = Medications.get(medId);
      if (med) {
        const stockEl = card.querySelector('.med-stock');
        if (stockEl) stockEl.outerHTML = WM.Stock.renderStockInfo(med);
      }
    }

    // Voortgangsbalk updaten
    updateProgress();

    // Notificatie
    if (newTaken) {
      const med = Medications.get(medId);
      toast(`${med ? med.name : 'Medicijn'} ingenomen ✓`, 'success', 2000);
    }
  }

  function updateProgress() {
    const today = WM.Data.today();
    const meds = Medications.all();
    const dayData = SData.getDay(today);
    let total = 0, done = 0;

    MOMENTS.forEach(m => {
      meds.filter(med => med.moments && med.moments.includes(m.key)).forEach(med => {
        total++;
        const intake = dayData[m.key] && dayData[m.key][med.id];
        if (intake && intake.taken) done++;
      });
    });

    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';

    const countEl = document.querySelector('.progress-count');
    if (countEl) countEl.textContent = `${done} / ${total}`;

    const title = document.querySelector('.progress-title');
    if (title) {
      if (pct === 100) {
        title.textContent = '✅ Alles ingenomen!';
        title.classList.add('progress-complete');
        WM.Notifications.maybeCongratulate();
      } else {
        title.textContent = 'Voortgang vandaag';
        title.classList.remove('progress-complete');
      }
    }

    // Moment-badges updaten
    MOMENTS.forEach(m => {
      const medsM = meds.filter(med => med.moments && med.moments.includes(m.key));
      const doneM = medsM.filter(med => {
        const intake = dayData[m.key] && dayData[m.key][med.id];
        return intake && intake.taken;
      }).length;
      const badge = document.querySelector(`.moment-header.${m.key} .moment-badge`);
      if (badge) badge.textContent = `${doneM}/${medsM.length}`;
    });
  }

  // Middernacht-reset controleren
  function checkMidnightReset() {
    const lastDate = localStorage.getItem('wm_last_date');
    const today = WM.Data.today();
    if (lastDate && lastDate !== today) {
      // Nieuwe dag: opschonen
      WM.Data.Schedule.cleanup();
      toast('Goedemorgen! Schema is gereset voor vandaag.', 'info', 4000);
    }
    localStorage.setItem('wm_last_date', today);
  }

  return { render, toggleIntake, updateProgress, checkMidnightReset };
})();

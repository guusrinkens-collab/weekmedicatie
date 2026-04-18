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

    const circumference = 2 * Math.PI * 54; // r=54
    const dashOffset = circumference * (1 - pct / 100);
    const ringColor = pct === 100 ? 'var(--success)' : 'url(#prog-gradient)';

    let html = `
      <div class="today-hero">
        <div class="today-hero-left">
          <p class="today-hero-date">${formatDate(today, 'long')}</p>
          <p class="today-hero-label ${pct === 100 ? 'hero-complete' : ''}">
            ${pct === 100 ? '✅ Alles ingenomen!' : 'Voortgang vandaag'}
          </p>
        </div>
        <div class="today-ring-wrap">
          <svg class="today-ring" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="prog-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--primary-light)"/>
                <stop offset="100%" stop-color="var(--secondary)"/>
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="54" class="ring-track"/>
            <circle cx="60" cy="60" r="54" class="ring-fill"
              stroke="${ringColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}"
              id="progress-ring"/>
          </svg>
          <div class="ring-label">
            <span class="ring-pct" id="ring-pct">${pct}</span>
            <span class="ring-unit">%</span>
          </div>
        </div>
      </div>

      ${alerts.length > 0 ? alerts.slice(0, 3).map(a => WM.Stock.renderAlertBanner(a)).join('') : ''}`;

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

    // Ring bijwerken
    const ring = document.getElementById('progress-ring');
    const circumference = 2 * Math.PI * 54;
    if (ring) {
      ring.style.strokeDashoffset = circumference * (1 - pct / 100);
      ring.setAttribute('stroke', pct === 100 ? 'var(--success)' : 'url(#prog-gradient)');
    }
    const pctEl = document.getElementById('ring-pct');
    if (pctEl) pctEl.textContent = pct;

    const label = document.querySelector('.today-hero-label');
    if (label) {
      if (pct === 100) {
        label.textContent = '✅ Alles ingenomen!';
        label.classList.add('hero-complete');
        WM.Notifications.maybeCongratulate();
      } else {
        label.textContent = 'Voortgang vandaag';
        label.classList.remove('hero-complete');
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

// ============================================================
// weekdoosjes.js — Weekoverzicht voor het vullen van medicijnendoosjes
// ============================================================
window.WM = window.WM || {};

WM.Weekdoosjes = (() => {
  const { Medications, Tapering: TData } = WM.Data;
  const { backButton } = WM.UI;

  const MOMENTS = [
    { key: 'ochtend', label: 'Ochtend', emoji: '☀️' },
    { key: 'middag',  label: 'Middag',  emoji: '🌤️' },
    { key: 'avond',   label: 'Avond',   emoji: '🌙' }
  ];

  const DAY_NAMES = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  // Bereken dosis op een specifieke datum (voor afbouwschema's)
  function doseOnDate(tapering, date) {
    const start = new Date(tapering.startDate);
    const daysPassed = Math.max(0, Math.floor((date - start) / 86400000));
    const reductions = Math.floor(daysPassed / tapering.intervalDays);
    const dose = tapering.startDose - reductions * tapering.reductionStep;
    return Math.max(tapering.endDose, dose);
  }

  function render() {
    const meds = Medications.all();

    if (meds.length === 0) {
      return `
        <div class="subpage-header">
          ${backButton('meer')}
          <h2 class="subpage-title">Weekdoosjes</h2>
        </div>
        ${WM.UI.emptyState(
          'Geen medicijnen',
          'Voeg medicijnen toe via de Medicatie-tab.',
          `<button class="btn btn-primary" onclick="WM.App.navigate('medicatie')">Medicatie beheren</button>`
        )}`;
    }

    // Komende 7 dagen
    const days = [];
    const todayStr = new Date().toDateString();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    // Controleer of er taperingwijzigingen zijn in de komende 7 dagen
    const hasTapering = meds.some(m => TData.forMedication(m.id));

    let html = `
      <div class="subpage-header">
        ${backButton('meer')}
        <h2 class="subpage-title">Weekdoosjes</h2>
      </div>
      <p class="weekdoos-intro">Wat gaat er per dagvak in uw medicijnendoosje — komende 7 dagen.</p>

      <div class="weekdoos-scroll">
        <table class="weekdoos-table">
          <thead>
            <tr>
              <th class="weekdoos-moment-col"></th>`;

    days.forEach(d => {
      const isToday = d.toDateString() === todayStr;
      html += `
              <th class="weekdoos-day-col${isToday ? ' today' : ''}">
                <div class="weekdoos-day-name">${DAY_NAMES[d.getDay()]}</div>
                <div class="weekdoos-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
              </th>`;
    });

    html += `
            </tr>
          </thead>
          <tbody>`;

    let anyMomentShown = false;

    MOMENTS.forEach(moment => {
      const medsForMoment = meds.filter(m => m.moments && m.moments.includes(moment.key));
      if (medsForMoment.length === 0) return;
      anyMomentShown = true;

      html += `
            <tr>
              <td class="weekdoos-moment-label">
                <span class="weekdoos-moment-emoji">${moment.emoji}</span>
                <span>${moment.label}</span>
              </td>`;

      days.forEach(d => {
        const isToday = d.toDateString() === todayStr;
        html += `<td class="weekdoos-cell${isToday ? ' today' : ''}">`;

        medsForMoment.forEach(med => {
          const tapering = TData.forMedication(med.id);
          let countLabel;
          if (tapering) {
            const dose = doseOnDate(tapering, d);
            countLabel = `${dose}${tapering.unit || 'mg'}`;
          } else {
            const p = med.pillsPerDose || 1;
            countLabel = `${p}×`;
          }
          html += `
                  <div class="weekdoos-pill">
                    <span class="weekdoos-pill-name">${med.name}</span>
                    <span class="weekdoos-pill-count">${countLabel}</span>
                  </div>`;
        });

        html += `</td>`;
      });

      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>`;

    if (hasTapering) {
      html += `
      <div class="weekdoos-tip">
        ⬇ Afbouwdoses worden per dag berekend — een dosiswijziging in de komende week is automatisch zichtbaar.
      </div>`;
    }

    // Totaaloverzicht per dag (handig voor het vullen)
    html += `
      <div class="section-title" style="margin-top:16px;">Totaal per dag</div>
      <div class="weekdoos-totals">`;

    days.forEach(d => {
      const isToday = d.toDateString() === todayStr;
      let totalPills = 0;
      MOMENTS.forEach(moment => {
        meds.filter(m => m.moments && m.moments.includes(moment.key)).forEach(med => {
          const tapering = TData.forMedication(med.id);
          if (tapering) {
            // Voor afbouwmedicatie tellen we de dosis niet op als pillen
          } else {
            totalPills += med.pillsPerDose || 1;
          }
        });
      });

      const regularMeds = meds.filter(m => !TData.forMedication(m.id));
      const taperMeds = meds.filter(m => TData.forMedication(m.id));
      let pillCount = 0;
      regularMeds.forEach(med => {
        (med.moments || []).forEach(() => { pillCount += med.pillsPerDose || 1; });
      });

      html += `
        <div class="weekdoos-total-card${isToday ? ' today' : ''}">
          <div class="weekdoos-total-day">${DAY_NAMES[d.getDay()]}</div>
          <div class="weekdoos-total-date">${d.getDate()}/${d.getMonth() + 1}</div>
          ${pillCount > 0 ? `<div class="weekdoos-total-count">${pillCount} pil${pillCount !== 1 ? 'len' : ''}</div>` : ''}
          ${taperMeds.length > 0 ? `<div class="weekdoos-total-taper">+ ${taperMeds.length} afbouw</div>` : ''}
        </div>`;
    });

    html += `</div>`;

    return html;
  }

  return { render };
})();

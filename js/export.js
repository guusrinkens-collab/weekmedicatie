// ============================================================
// export.js — PDF-export van weekoverzicht
// ============================================================
window.WM = window.WM || {};

WM.Export = (() => {
  const { Medications, Schedule: SData, Wellbeing: WData, Contacts: CData } = WM.Data;
  const { formatDate, escapeHTML } = WM.UI;

  const MOMENTS = [
    { key: 'ochtend', label: '☀️ Ochtend' },
    { key: 'middag',  label: '🌤️ Middag' },
    { key: 'avond',   label: '🌙 Avond' }
  ];

  const DAYS_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];

  function generateWeekHTML() {
    const meds = Medications.all();
    const contacts = CData.get();
    const today = new Date();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));

    // 7 dagen vanaf maandag
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(thisMonday);
      d.setDate(thisMonday.getDate() + i);
      weekDays.push(d);
    }

    const weekStart = weekDays[0].toISOString().slice(0, 10);
    const weekEnd = weekDays[6].toISOString().slice(0, 10);

    let html = `<!DOCTYPE html><html lang="nl"><head>
<meta charset="UTF-8">
<title>Weekmedicatie – ${formatDate(weekStart, 'medium')} t/m ${formatDate(weekEnd, 'medium')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: white; padding: 20px; }
  h1 { font-size: 20px; margin-bottom: 4px; color: #4f46e5; }
  h2 { font-size: 14px; margin: 16px 0 8px; color: #4f46e5; border-bottom: 2px solid #e0e0e0; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 10px 0 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; }
  .header-sub { font-size: 11px; color: #666; }
  .week-grid { display: grid; grid-template-columns: 100px repeat(7, 1fr); border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
  .week-cell { padding: 6px 8px; border-right: 1px solid #ddd; border-bottom: 1px solid #ddd; }
  .week-cell:nth-child(7n) { border-right: none; }
  .week-header { background: #4f46e5; color: white; font-weight: 700; text-align: center; font-size: 11px; }
  .week-med-label { background: #f5f5f5; font-weight: 600; font-size: 11px; }
  .moment-label { font-size: 9px; color: #888; display: block; }
  .check-box { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #999; border-radius: 3px; margin-right: 4px; }
  .check-done { background: #10b981; border-color: #10b981; }
  .med-overview { margin-bottom: 16px; }
  .med-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  .med-row:nth-child(odd) { background: #f9f9f9; }
  .stock-low { color: #f59e0b; font-weight: 700; }
  .stock-critical { color: #ef4444; font-weight: 700; }
  .contact-block { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .contact-box { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
  .contact-type { font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase; }
  .contact-name { font-size: 13px; font-weight: 700; margin: 4px 0; }
  .contact-detail { font-size: 11px; color: #555; margin: 2px 0; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
  @media print {
    body { padding: 10px; }
    .no-print { display: none; }
  }
</style></head><body>`;

    html += `
<div class="header">
  <div>
    <h1>💊 Weekmedicatie</h1>
    <div class="header-sub">Week van ${formatDate(weekStart, 'medium')} t/m ${formatDate(weekEnd, 'medium')}</div>
    <div class="header-sub">Afgedrukt op: ${formatDate(today.toISOString().slice(0,10), 'long')}</div>
  </div>
</div>`;

    // === Weekrooster ===
    html += `<h2>Weekrooster</h2>`;

    // Per innametijdstip
    MOMENTS.forEach(moment => {
      const medsForMoment = meds.filter(m => m.moments && m.moments.includes(moment.key));
      if (medsForMoment.length === 0) return;

      html += `<h3>${moment.label}</h3><div class="week-grid">`;

      // Header rij
      html += `<div class="week-cell week-header">Medicijn</div>`;
      weekDays.forEach(d => {
        html += `<div class="week-cell week-header">${DAYS_NL[d.getDay()]}<br>${d.getDate()}</div>`;
      });

      medsForMoment.forEach(med => {
        html += `<div class="week-cell week-med-label">${escapeHTML(med.name)}<br><span class="moment-label">${escapeHTML(med.dosage)}</span></div>`;
        weekDays.forEach(d => {
          const dateKey = d.toISOString().slice(0, 10);
          const dayData = SData.getDay(dateKey);
          const intake = (dayData[moment.key] && dayData[moment.key][med.id]) || {};
          const taken = intake.taken;
          html += `<div class="week-cell" style="text-align:center;">
            <span class="check-box ${taken ? 'check-done' : ''}">${taken ? '✓' : ''}</span>
            ${taken && intake.time ? `<span style="font-size:9px;color:#888;">${intake.time}</span>` : ''}
          </div>`;
        });
      });

      html += `</div>`;
    });

    // === Medicatieoverzicht & voorraad ===
    html += `<h2>Medicatieoverzicht & Voorraad</h2>
<div class="med-overview">
  <div class="med-row" style="background:#f0f0ff;font-weight:700;">
    <span>Medicijn</span><span>Dosering</span><span>Momenten</span><span>Pillen/dag</span><span>Voorraad</span><span>Nog voor</span>
  </div>`;

    meds.forEach(med => {
      const days = WM.Stock.daysRemaining(med);
      const status = WM.Stock.stockStatus(med);
      const stockCls = status === 'critical' ? 'stock-critical' : status === 'low' ? 'stock-low' : '';
      const daysText = days === Infinity ? '∞' : `${days} d`;
      const momentLabels = (med.moments || []).map(m => ({ ochtend: 'ocht.', middag: 'midd.', avond: 'av.' }[m])).join(', ');
      html += `
        <div class="med-row">
          <span><strong>${escapeHTML(med.name)}</strong></span>
          <span>${escapeHTML(med.dosage)}</span>
          <span>${momentLabels}</span>
          <span>${med.dailyUsage || '–'}</span>
          <span class="${stockCls}">${med.stock ?? '–'}</span>
          <span class="${stockCls}">${daysText}</span>
        </div>`;
    });

    html += `</div>`;

    // === Contacten ===
    if (contacts.gp?.name || contacts.pharmacy?.name) {
      html += `<h2>Contacten</h2><div class="contact-block">`;
      if (contacts.gp?.name) {
        html += `<div class="contact-box">
          <div class="contact-type">Huisarts</div>
          <div class="contact-name">${escapeHTML(contacts.gp.name)}</div>
          ${contacts.gp.phone ? `<div class="contact-detail">📞 ${escapeHTML(contacts.gp.phone)}</div>` : ''}
          ${contacts.gp.address ? `<div class="contact-detail">📍 ${escapeHTML(contacts.gp.address)}</div>` : ''}
        </div>`;
      }
      if (contacts.pharmacy?.name) {
        html += `<div class="contact-box">
          <div class="contact-type">Apotheek</div>
          <div class="contact-name">${escapeHTML(contacts.pharmacy.name)}</div>
          ${contacts.pharmacy.phone ? `<div class="contact-detail">📞 ${escapeHTML(contacts.pharmacy.phone)}</div>` : ''}
          ${contacts.pharmacy.address ? `<div class="contact-detail">📍 ${escapeHTML(contacts.pharmacy.address)}</div>` : ''}
          ${contacts.pharmacy.openingHours ? `<div class="contact-detail">🕐 ${escapeHTML(contacts.pharmacy.openingHours)}</div>` : ''}
        </div>`;
      }
      html += `</div>`;
    }

    html += `
<div class="footer">
  Gegenereerd door Weekmedicatie · ${new Date().toLocaleDateString('nl-NL', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
  <br>Bewaar dit document op een veilige plek.
</div>
<div class="no-print" style="margin-top:20px;text-align:center;">
  <button onclick="window.print()" style="padding:12px 24px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;">
    🖨️ Afdrukken / Opslaan als PDF
  </button>
</div>
</body></html>`;

    return html;
  }

  function exportPDF() {
    const html = generateWeekHTML();
    const win = window.open('', '_blank');
    if (!win) {
      WM.UI.toast('Pop-ups zijn geblokkeerd. Sta pop-ups toe voor deze pagina.', 'warning', 5000);
      return;
    }
    win.document.write(html);
    win.document.close();
    // Print na 1 seconde (wachten tot afbeeldingen geladen zijn)
    setTimeout(() => { try { win.print(); } catch(e) {} }, 800);
    WM.UI.toast('Export geopend in nieuw tabblad', 'success');
  }

  return { exportPDF };
})();

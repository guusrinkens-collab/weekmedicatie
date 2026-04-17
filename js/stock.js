// ============================================================
// stock.js — Voorraadbeheer & herbestelalarm
// ============================================================
window.WM = window.WM || {};

WM.Stock = (() => {
  const { Medications, Settings } = WM.Data;
  const { isPharmacyClosed, latestSafeOrderDate, addDays, toKey } = WM.Holidays;

  // Bereken dagen voorraad resterend
  function daysRemaining(med) {
    if (med.stock === null || med.stock === undefined || !med.dailyUsage || med.dailyUsage <= 0) return Infinity;
    return Math.floor(med.stock / med.dailyUsage);
  }

  // Datum waarop voorraad op is
  function stockEmptyDate(med) {
    const days = daysRemaining(med);
    if (days === Infinity) return null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  // Status van voorraad
  function stockStatus(med) {
    const settings = Settings.get();
    const threshold = settings.lowStockDays || 7;
    const days = daysRemaining(med);

    if (days === Infinity) return 'ok';
    if (days <= 2) return 'critical';
    if (days <= threshold) return 'low';
    return 'ok';
  }

  // Laatste veilige besteldatum (rekening houdend met sluitingsdagen)
  function safeOrderDate(med) {
    const emptyDate = stockEmptyDate(med);
    if (!emptyDate) return null;
    return latestSafeOrderDate(emptyDate, 1);
  }

  // Alle alarmen genereren
  function getAlerts() {
    const meds = Medications.all();
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    meds.forEach(med => {
      if (!med.stock && med.stock !== 0) return;
      const status = stockStatus(med);
      if (status === 'ok') return;

      const days = daysRemaining(med);
      const orderDate = safeOrderDate(med);
      const emptyDate = stockEmptyDate(med);

      let urgency = 'warning';
      let message = '';
      let orderMessage = '';

      if (status === 'critical') {
        urgency = 'danger';
        message = `Kritiek lage voorraad: nog ${days} dag${days !== 1 ? 'en' : ''}`;
      } else {
        message = `Lage voorraad: nog ${days} dagen`;
      }

      if (orderDate) {
        const orderKey = toKey(orderDate);
        const todayKey = toKey(today);
        if (orderKey < todayKey) {
          orderMessage = 'Bestel vandaag nog! Uiterste besteldatum verstreken.';
          urgency = 'danger';
        } else if (orderKey === todayKey) {
          orderMessage = 'Bestel vandaag voor tijdige levering.';
        } else {
          orderMessage = `Bestel uiterlijk op ${WM.UI.formatDate(orderKey, 'medium')}.`;
        }
      }

      // Controleer op feestdagen in de resterende periode
      const upcomingHolidays = [];
      if (emptyDate) {
        for (let i = 0; i <= days; i++) {
          const d = addDays(today, i);
          if (isPharmacyClosed(d)) {
            const name = WM.Holidays.holidayName(d);
            if (name && !upcomingHolidays.includes(name)) {
              upcomingHolidays.push(name);
            }
          }
        }
      }

      alerts.push({
        med,
        status: urgency,
        days,
        message,
        orderMessage,
        orderDate,
        emptyDate,
        upcomingHolidays
      });
    });

    // Sorteer: critical eerst
    return alerts.sort((a, b) => (b.status === 'danger' ? 1 : 0) - (a.status === 'danger' ? 1 : 0));
  }

  // Stockkaart HTML voor medicatielijst
  function renderStockInfo(med) {
    const days = daysRemaining(med);
    const status = stockStatus(med);
    const cls = status === 'critical' ? 'stock-danger' : status === 'low' ? 'stock-warn' : '';
    const daysText = days === Infinity ? '∞' : `${days}d`;

    return `
      <div class="med-stock">
        <div class="stock-count ${cls}">${med.stock ?? '–'}</div>
        <div class="stock-days ${cls}">${days === Infinity ? 'onbeperkt' : daysText + ' over'}</div>
      </div>`;
  }

  // Alarm-banner HTML
  function renderAlertBanner(alert) {
    const cls = alert.status === 'danger' ? 'danger' : '';
    const icon = alert.status === 'danger' ? '🚨' : '⚠️';
    const holidayText = alert.upcomingHolidays.length
      ? `<br><small>Feestdag(en) ingepland: ${alert.upcomingHolidays.join(', ')}</small>` : '';

    return `
      <div class="alert-banner ${cls}">
        <span class="alert-icon" onclick="WM.Medications.editMedication('${alert.med.id}')">${icon}</span>
        <div class="alert-text" onclick="WM.Medications.editMedication('${alert.med.id}')">
          <div class="alert-title">${alert.med.name} — ${alert.message}</div>
          <div class="alert-msg">${alert.orderMessage}${holidayText}</div>
        </div>
        <button class="btn btn-sm btn-primary"
            onclick="event.stopPropagation();WM.Medications.quickFillStock('${alert.med.id}')">
          Bijvullen
        </button>
      </div>`;
  }

  // Voorraad bijwerken na inname
  function recordIntake(medId, taken) {
    const med = Medications.get(medId);
    if (!med) return;
    const delta = taken ? -(med.pillsPerDose || 1) : (med.pillsPerDose || 1);
    return Medications.updateStock(medId, delta);
  }

  return { daysRemaining, stockEmptyDate, stockStatus, safeOrderDate, getAlerts, renderStockInfo, renderAlertBanner, recordIntake };
})();

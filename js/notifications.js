// ============================================================
// notifications.js — Pushmeldingen voor innamemomenten
// ============================================================
window.WM = window.WM || {};

WM.Notifications = (() => {
  const { Settings, Medications, Schedule: SData } = WM.Data;

  let timers = [];
  let midnightTimer = null;

  // ── Toestemming vragen ────────────────────────────────────
  async function requestPermission() {
    if (!('Notification' in window)) {
      WM.UI.toast('Meldingen worden niet ondersteund in deze browser', 'warning');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      WM.UI.toast('Meldingen zijn geblokkeerd. Pas dit aan in uw browserinstellingen.', 'warning', 5000);
      return false;
    }
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  function hasPermission() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // ── Notificatie sturen ────────────────────────────────────
  function sendNotification(title, body, tag = 'medicatie') {
    if (!hasPermission()) return;
    new Notification(title, {
      body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag,
      renotify: true,
      vibrate: [200, 100, 200]
    });
  }

  // ── Timers instellen ──────────────────────────────────────
  function scheduleToday() {
    // Verwijder bestaande timers
    timers.forEach(clearTimeout);
    timers = [];

    const settings = Settings.get();
    if (!settings.notifications || !hasPermission()) return;

    const times = settings.notificationTimes || { ochtend: '08:00', middag: '13:00', avond: '20:00' };
    const meds = Medications.all();
    const today = WM.Data.today();
    const now = new Date();

    const MOMENTS = ['ochtend', 'middag', 'avond'];

    MOMENTS.forEach(moment => {
      const [h, m] = (times[moment] || '08:00').split(':').map(Number);
      const fireTime = new Date();
      fireTime.setHours(h, m, 0, 0);

      if (fireTime <= now) return; // Al voorbij

      const medsForMoment = meds.filter(med => med.moments && med.moments.includes(moment));
      if (medsForMoment.length === 0) return;

      const delay = fireTime - now;
      const momentLabels = { ochtend: 'ochtend', middag: 'middag', avond: 'avond' };
      const medNames = medsForMoment.map(m => m.name).join(', ');

      const timer = setTimeout(() => {
        // Check of ze al ingenomen zijn
        const dayData = SData.getDay(today);
        const allTaken = medsForMoment.every(med => {
          const intake = dayData[moment] && dayData[moment][med.id];
          return intake && intake.taken;
        });

        if (!allTaken) {
          const labels = { ochtend: '☀️ Ochtend', middag: '🌤️ Middag', avond: '🌙 Avond' };
          sendNotification(
            `${labels[moment]} medicatie`,
            `Neem uw ${momentLabels[moment]}medicijnen: ${medNames}`,
            `medicatie-${moment}`
          );
        }
      }, delay);

      timers.push(timer);
    });
  }

  // ── Stel in middernacht-reset in ─────────────────────────
  function scheduleMidnightReset() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const midnight = new Date();
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 1, 0, 0); // 00:01
    const delay = midnight - now;

    midnightTimer = setTimeout(() => {
      midnightTimer = null;
      scheduleToday();
      scheduleMidnightReset();
    }, delay);
  }

  // ── Felicitatie bij volledig schema ──────────────────────
  function maybeCongratulate() {
    const key = `wm_congrat_${WM.Data.today()}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    if (hasPermission()) {
      sendNotification('🎉 Goed gedaan!', 'U heeft alle medicijnen van vandaag ingenomen!', 'congrats');
    }
  }

  // ── Instellingenpagina-sectie ─────────────────────────────
  function renderSettingsSection() {
    const settings = Settings.get();
    const times = settings.notificationTimes || { ochtend: '08:00', middag: '13:00', avond: '20:00' };
    const permitted = hasPermission();
    const enabled = settings.notifications && permitted;

    return `
      <div class="section-title">🔔 Herinneringen</div>
      <div class="card">
        <div class="form-group">
          <div class="toggle-wrap">
            <div>
              <div class="toggle-label-text">Medicatie-herinneringen</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">
                ${permitted ? 'Meldingen zijn toegestaan' : 'Toestemming vereist'}
              </div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="notif-toggle" ${enabled ? 'checked' : ''}
                     onchange="WM.Notifications.toggleNotifications(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div id="notif-times" style="${enabled ? '' : 'opacity:0.4;pointer-events:none;'}">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">☀️ Ochtend</label>
              <input type="time" class="form-input" id="notif-ochtend" value="${times.ochtend}" onchange="WM.Notifications.saveTime('ochtend',this.value)">
            </div>
            <div class="form-group">
              <label class="form-label">🌤️ Middag</label>
              <input type="time" class="form-input" id="notif-middag" value="${times.middag}" onchange="WM.Notifications.saveTime('middag',this.value)">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">🌙 Avond</label>
            <input type="time" class="form-input" id="notif-avond" value="${times.avond}" onchange="WM.Notifications.saveTime('avond',this.value)" style="max-width:calc(50% - 6px);">
          </div>
        </div>

        ${!permitted ? `
          <button class="btn btn-outline btn-full" onclick="WM.Notifications.enable()">
            Toestemming geven voor meldingen
          </button>` : ''}
      </div>`;
  }

  async function toggleNotifications(enabled) {
    const timesEl = document.getElementById('notif-times');
    if (enabled) {
      const granted = await requestPermission();
      if (!granted) {
        document.getElementById('notif-toggle').checked = false;
        return;
      }
      if (timesEl) timesEl.style.cssText = '';
      Settings.update({ notifications: true });
      scheduleToday();
      WM.UI.toast('Herinneringen ingeschakeld', 'success');
    } else {
      if (timesEl) timesEl.style.cssText = 'opacity:0.4;pointer-events:none;';
      Settings.update({ notifications: false });
      timers.forEach(clearTimeout);
      timers = [];
      if (midnightTimer) { clearTimeout(midnightTimer); midnightTimer = null; }
      WM.UI.toast('Herinneringen uitgeschakeld', 'info');
    }
  }

  async function enable() {
    const granted = await requestPermission();
    if (granted) {
      Settings.update({ notifications: true });
      scheduleToday();
      WM.UI.toast('Herinneringen ingeschakeld', 'success');
      if (WM.App.currentPage() === 'instellingen') WM.App.refreshPage();
    }
  }

  function saveTime(moment, value) {
    const settings = Settings.get();
    settings.notificationTimes[moment] = value;
    Settings.save(settings);
    scheduleToday();
  }

  function init() {
    scheduleToday();
    scheduleMidnightReset();
  }

  return { requestPermission, hasPermission, sendNotification, scheduleToday, maybeCongratulate, renderSettingsSection, toggleNotifications, enable, saveTime, init };
})();

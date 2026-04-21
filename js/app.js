// ============================================================
// app.js — Hoofdcoördinator: router, navigatie, initialisatie
// ============================================================
window.WM = window.WM || {};

WM.App = (() => {
  // ── Paginadefinities ──────────────────────────────────────
  const PAGES = {
    vandaag:     { render: () => WM.Schedule.render(),    title: 'Vandaag',         navKey: 'vandaag' },
    medicatie:   { render: () => WM.Medications.render(), title: 'Medicatie',       navKey: 'medicatie' },
    geschiedenis:{ render: () => WM.History.render(),     title: 'Geschiedenis',    navKey: 'geschiedenis' },
    meer:        { render: () => renderMeer(),             title: 'Meer',            navKey: 'meer' },
    weekdoosjes: { render: () => WM.Weekdoosjes.render(),  title: 'Weekdoosjes',     navKey: 'meer' },
    thema:       { render: () => WM.Theme.render(),       title: 'Thema\'s',        navKey: 'meer' },
    contacten:   { render: () => WM.Contacts.render(),    title: 'Contacten',       navKey: 'meer' },
    afbouw:      { render: () => WM.Tapering.render(),    title: 'Afbouwschema\'s', navKey: 'meer' },
    welzijn:     { render: () => WM.Wellbeing.render(),   title: 'Welzijnslog',     navKey: 'meer' },
    instellingen:{ render: () => renderSettings(),        title: 'Instellingen',    navKey: 'meer' }
  };

  const NAV_TABS = ['vandaag', 'medicatie', 'geschiedenis', 'meer'];
  let _currentPage = 'vandaag';

  // ── Meer-pagina renderen ──────────────────────────────────
  function renderMeer() {
    const meds = WM.Data.Medications.all();
    const alerts = WM.Stock.getAlerts();

    return `
      ${alerts.length > 0 ? `
        <div class="section-title">⚠️ Waarschuwingen (${alerts.length})</div>
        ${alerts.slice(0,2).map(a => WM.Stock.renderAlertBanner(a)).join('')}
      ` : ''}

      <div class="section-title">Functies</div>
      <div class="meer-grid">
        <div class="meer-card" onclick="WM.App.navigate('weekdoosjes')">
          <div class="meer-card-icon" style="background:rgba(16,185,129,0.15);">🗓️</div>
          <div class="meer-card-label">Weekdoosjes</div>
          <div class="meer-card-sub">7-dagenplanning</div>
        </div>
        <div class="meer-card" onclick="WM.App.navigate('afbouw')">
          <div class="meer-card-icon" style="background:rgba(139,92,246,0.15);">⬇️</div>
          <div class="meer-card-label">Afbouwschema's</div>
          <div class="meer-card-sub">${WM.Data.Tapering.all().filter(t=>t.active).length} actief</div>
        </div>
        <div class="meer-card" onclick="WM.App.navigate('welzijn')">
          <div class="meer-card-icon" style="background:rgba(236,72,153,0.15);">❤️</div>
          <div class="meer-card-label">Welzijnslog</div>
          <div class="meer-card-sub">Dagelijkse stemming</div>
        </div>
        <div class="meer-card" onclick="WM.App.navigate('contacten')">
          <div class="meer-card-icon" style="background:rgba(59,130,246,0.15);">📞</div>
          <div class="meer-card-label">Contacten</div>
          <div class="meer-card-sub">Arts & apotheek</div>
        </div>
        <div class="meer-card" onclick="WM.Export.exportPDF()">
          <div class="meer-card-icon" style="background:rgba(16,185,129,0.15);">📄</div>
          <div class="meer-card-label">Export PDF</div>
          <div class="meer-card-sub">Weekoverzicht</div>
        </div>
        <div class="meer-card" onclick="WM.App.navigate('thema')">
          <div class="meer-card-icon" style="background:rgba(245,158,11,0.15);">🎨</div>
          <div class="meer-card-label">Thema's</div>
          <div class="meer-card-sub">Kleuraanpassing</div>
        </div>
        <div class="meer-card" onclick="WM.App.navigate('instellingen')">
          <div class="meer-card-icon" style="background:rgba(107,114,128,0.15);">⚙️</div>
          <div class="meer-card-label">Instellingen</div>
          <div class="meer-card-sub">API & meldingen</div>
        </div>
      </div>

      <div class="section-title">Over</div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:2rem;">💊</span>
          <div>
            <div style="font-weight:700;">Weekmedicatie</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">Versie 1.0 · Offline beschikbaar</div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px;">${meds.length} medicijn${meds.length !== 1 ? 'en' : ''} opgeslagen</div>
          </div>
        </div>
      </div>`;
  }

  // ── Instellingenpagina ────────────────────────────────────
  function renderSettings() {
    const settings = WM.Data.Settings.get();

    return `
      <div class="subpage-header">
        ${WM.UI.backButton('meer')}
        <h2 class="subpage-title">Instellingen</h2>
      </div>

      <div class="section-title">🤖 Claude API</div>
      <div class="card">
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">
          Vereist voor het scannen van apothekerlabels.
          Uw API-sleutel wordt alleen lokaal opgeslagen.
        </p>
        <div class="form-group">
          <label class="form-label">API-sleutel</label>
          <input type="password" id="api-key-input" class="form-input"
                 value="${settings.apiKey || ''}"
                 placeholder="sk-ant-api03-…"
                 autocomplete="new-password">
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="WM.App.saveApiKey()">Opslaan</button>
          ${settings.apiKey ? `<button class="btn btn-danger btn-sm" onclick="WM.App.clearApiKey()">Verwijderen</button>` : ''}
        </div>
        <p class="form-hint" style="margin-top:8px;">
          Vraag een API-sleutel aan op console.anthropic.com
        </p>
      </div>

      ${WM.Notifications.renderSettingsSection()}

      <div class="section-title">📊 Drempelwaarden</div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Waarschuwing lage voorraad (dagen)</label>
          <input type="number" id="low-stock-days" class="form-input"
                 value="${settings.lowStockDays || 7}" min="1" max="30">
          <p class="form-hint">Waarschuw als voorraad minder dan X dagen meegaat</p>
        </div>
        <button class="btn btn-outline" onclick="WM.App.saveThresholds()">Opslaan</button>
      </div>

      <div class="section-title">🗑️ Gegevens</div>
      <div class="card">
        <div class="settings-item" style="margin-bottom:8px;">
          <div class="settings-item-info">
            <div class="settings-item-label">Alle gegevens wissen</div>
            <div class="settings-item-sub">Verwijdert alle medicijnen, innames en instellingen</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="WM.App.clearAllData()">Wissen</button>
        </div>
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-label">App vernieuwen</div>
            <div class="settings-item-sub">Herlaad de app (behoudt gegevens)</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="location.reload()">Vernieuwen</button>
        </div>
      </div>`;
  }

  // ── Navigatie ─────────────────────────────────────────────
  const SUBPAGE_PARENT = {
    weekdoosjes: 'meer', thema: 'meer', contacten: 'meer',
    afbouw: 'meer', welzijn: 'meer', instellingen: 'meer'
  };

  function navigate(pageKey) {
    if (!PAGES[pageKey]) return;
    _currentPage = pageKey;

    const page = PAGES[pageKey];
    const contentEl = document.getElementById('page-content');
    if (!contentEl) return;

    // Render pagina
    try {
      contentEl.innerHTML = page.render();
    } catch (err) {
      console.error('Paginafout:', err);
      WM.UI.toast('Fout bij laden: ' + err.message, 'error');
      return;
    }
    contentEl.classList.add('slide-in');
    setTimeout(() => contentEl.classList.remove('slide-in'), 300);

    // Nav-tabs updaten
    const navKey = page.navKey || pageKey;
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === navKey);
    });

    // Header-titel
    const titleEl = document.getElementById('app-title');
    if (titleEl) titleEl.textContent = page.title;

    // Terugknop in header tonen/verbergen
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) {
      const parent = SUBPAGE_PARENT[pageKey];
      if (parent) {
        backBtn.style.display = 'flex';
        backBtn.onclick = () => navigate(parent);
      } else {
        backBtn.style.display = 'none';
      }
    }

    // Page-specific initialisaties
    if (pageKey === 'thema') {
      setTimeout(() => WM.Theme.initColorPickers(), 100);
    }

    // Scroll naar boven
    contentEl.scrollTop = 0;

    // Nav-badge bijwerken
    updateNavAlerts();
  }

  function updateNavAlerts() {
    const alerts = WM.Stock.getAlerts();
    const hasDanger = alerts.some(a => a.status === 'danger');
    const hasAlert = alerts.length > 0;
    const btn = document.querySelector('.nav-btn[data-page="medicatie"]');
    if (!btn) return;
    btn.classList.toggle('has-danger', hasDanger);
    btn.classList.toggle('has-alert', !hasDanger && hasAlert);
  }

  function currentPage() { return _currentPage; }

  function refreshPage() { navigate(_currentPage); }

  // ── Instellingen-acties ───────────────────────────────────
  function saveApiKey() {
    const key = document.getElementById('api-key-input')?.value?.trim();
    WM.Data.Settings.update({ apiKey: key || '' });
    WM.UI.toast(key ? 'API-sleutel opgeslagen' : 'API-sleutel geleegd', 'success');
    refreshPage();
  }

  function clearApiKey() {
    WM.UI.confirmDialog('API-sleutel verwijderen?', () => {
      WM.Data.Settings.update({ apiKey: '' });
      WM.UI.toast('API-sleutel verwijderd', 'success');
      refreshPage();
    });
  }

  function saveThresholds() {
    const days = parseInt(document.getElementById('low-stock-days')?.value) || 7;
    WM.Data.Settings.update({ lowStockDays: days });
    WM.UI.toast('Drempelwaarde opgeslagen', 'success');
  }

  function clearAllData() {
    WM.UI.confirmDialog(
      'Weet u zeker dat u ALLE gegevens wilt wissen? Dit kan niet ongedaan worden gemaakt.',
      () => {
        Object.keys(localStorage).filter(k => k.startsWith('wm_')).forEach(k => localStorage.removeItem(k));
        WM.UI.toast('Alle gegevens gewist', 'success');
        setTimeout(() => location.reload(), 1000);
      }
    );
  }

  // ── Pull-to-refresh ───────────────────────────────────
  function initPullToRefresh() {
    const el = document.getElementById('page-content');
    const indicator = document.getElementById('ptr-indicator');
    if (!el || !indicator) return;

    const THRESHOLD = 65;
    let startY = 0;
    let pulling = false;

    document.addEventListener('touchstart', e => {
      if (el.scrollTop === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!pulling) return;
      const dist = e.touches[0].clientY - startY;
      if (dist <= 0) { pulling = false; indicator.className = ''; return; }
      indicator.classList.toggle('ptr-ready', dist >= THRESHOLD);
      indicator.classList.add('ptr-pulling');
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      if (!indicator.classList.contains('ptr-ready')) {
        indicator.className = '';
        return;
      }
      indicator.classList.remove('ptr-pulling', 'ptr-ready');
      indicator.classList.add('ptr-loading');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update();
          setTimeout(() => location.reload(), 800);
        });
      } else {
        setTimeout(() => location.reload(), 800);
      }
    });
  }

  // ── Initialisatie ─────────────────────────────────────────
  function init() {
    // Thema laden
    WM.Theme.loadSavedTheme();

    // Middernacht-reset controleren
    WM.Schedule.checkMidnightReset();

    // Notificaties starten
    WM.Notifications.init();

    // Modal sluiten via overlay-klik
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) WM.UI.closeModal();
    });
    document.querySelector('.modal-close')?.addEventListener('click', WM.UI.closeModal);

    // Bottom-nav koppelen
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        navigate(page);
      });
    });

    // Initiële pagina laden
    navigate('vandaag');

    // Online/offline melding
    window.addEventListener('online', () => WM.UI.toast('Verbinding hersteld', 'success'));
    window.addEventListener('offline', () => WM.UI.toast('Geen internetverbinding – app werkt offline', 'warning'));

    // Pull-to-refresh
    initPullToRefresh();

    console.log('💊 Weekmedicatie geladen');
  }

  return { navigate, currentPage, refreshPage, saveApiKey, clearApiKey, saveThresholds, clearAllData, updateNavAlerts, init, renderMeer };
})();

// ── App starten zodra DOM klaar is ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  WM.App.init();
});

// ============================================================
// theme.js — Kleurthema's & aanpassing
// ============================================================
window.WM = window.WM || {};

WM.Theme = (() => {
  const { Theme: TData } = WM.Data;
  const { toast, backButton } = WM.UI;

  const BUILTIN_THEMES = [
    {
      id: 'purple',
      name: 'Kosmisch Paars',
      primary: '#6c63ff', primaryDark: '#4f46e5', primaryLight: '#a78bfa',
      secondary: '#06b6d4', accent: '#f59e0b',
      bg: '#0f0f1a', bgSurface: '#1a1a2e', bgCard: '#16213e', bgCard2: '#0d1117'
    },
    {
      id: 'teal',
      name: 'Oceaangroen',
      primary: '#14b8a6', primaryDark: '#0d9488', primaryLight: '#5eead4',
      secondary: '#3b82f6', accent: '#f59e0b',
      bg: '#0a1514', bgSurface: '#0f2320', bgCard: '#132b27', bgCard2: '#091312'
    },
    {
      id: 'ocean',
      name: 'Diepzee Blauw',
      primary: '#2563eb', primaryDark: '#1d4ed8', primaryLight: '#60a5fa',
      secondary: '#8b5cf6', accent: '#06b6d4',
      bg: '#0a0f1e', bgSurface: '#0f172a', bgCard: '#1e293b', bgCard2: '#0c1220'
    },
    {
      id: 'sunset',
      name: 'Zonsondergang',
      primary: '#f97316', primaryDark: '#ea580c', primaryLight: '#fb923c',
      secondary: '#ec4899', accent: '#fbbf24',
      bg: '#1a0f09', bgSurface: '#2a1a0f', bgCard: '#3a2010', bgCard2: '#150c07'
    },
    {
      id: 'rose',
      name: 'Robijnrood',
      primary: '#e11d48', primaryDark: '#be123c', primaryLight: '#fb7185',
      secondary: '#f97316', accent: '#a855f7',
      bg: '#1a0812', bgSurface: '#250d1a', bgCard: '#33111f', bgCard2: '#170610'
    }
  ];

  // ── Thema toepassen ───────────────────────────────────────
  function applyTheme(themeId, customColors = null) {
    let theme = BUILTIN_THEMES.find(t => t.id === themeId);

    if (!theme && customColors) {
      // Aangepast thema
      theme = {
        id: themeId,
        ...customColors
      };
    }

    if (!theme) theme = BUILTIN_THEMES[0];

    const root = document.documentElement;

    if (BUILTIN_THEMES.find(t => t.id === themeId)) {
      // Gebruik data-theme attribuut voor ingebouwde thema's (CSS doet de rest)
      root.setAttribute('data-theme', themeId);
    } else {
      // Aangepast thema: stel CSS-variabelen in
      root.removeAttribute('data-theme');
      root.style.setProperty('--primary', theme.primary);
      root.style.setProperty('--primary-dark', theme.primaryDark || shadeColor(theme.primary, -20));
      root.style.setProperty('--primary-light', theme.primaryLight || shadeColor(theme.primary, 30));
      root.style.setProperty('--secondary', theme.secondary);
      root.style.setProperty('--accent', theme.accent);
      if (theme.bg) root.style.setProperty('--bg', theme.bg);
      if (theme.bgSurface) root.style.setProperty('--bg-surface', theme.bgSurface);
      if (theme.bgCard) root.style.setProperty('--bg-card', theme.bgCard);
      if (theme.bgCard2) root.style.setProperty('--bg-card2', theme.bgCard2);
    }

    // Update meta theme-color
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', theme.primary);
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  function loadSavedTheme() {
    const data = TData.get();
    const current = data.current || 'purple';
    const custom = data.customThemes || [];
    const customMatch = custom.find(t => t.id === current);
    applyTheme(current, customMatch);
  }

  // ── Pagina ────────────────────────────────────────────────
  function render() {
    const data = TData.get();
    const current = data.current || 'purple';
    const customThemes = data.customThemes || [];

    let html = `
      <div class="subpage-header">
        ${backButton('meer')}
        <h2 class="subpage-title">Thema's</h2>
      </div>

      <div class="section-title">Standaard thema's</div>
      <div class="theme-grid">
        ${BUILTIN_THEMES.map(t => themeCard(t, current === t.id)).join('')}
      </div>`;

    html += `
      <div class="section-title">Aangepast thema maken</div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Naam</label>
          <input type="text" id="custom-theme-name" class="form-input" placeholder="Mijn thema" value="">
        </div>
        <div class="color-picker-row">
          <span class="color-picker-label">Primaire kleur</span>
          <input type="color" id="cp-primary" class="color-picker-input" value="#6c63ff">
        </div>
        <div class="color-picker-row">
          <span class="color-picker-label">Secundaire kleur</span>
          <input type="color" id="cp-secondary" class="color-picker-input" value="#06b6d4">
        </div>
        <div class="color-picker-row">
          <span class="color-picker-label">Accentkleur</span>
          <input type="color" id="cp-accent" class="color-picker-input" value="#f59e0b">
        </div>
        <div id="theme-preview" style="height:60px;border-radius:12px;margin:12px 0;background:linear-gradient(135deg, #6c63ff, #06b6d4);display:flex;align-items:center;justify-content:center;gap:12px;">
          <div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;"></div>
          <span style="color:white;font-weight:700;">Voorvertoning</span>
        </div>
        <button class="btn btn-primary btn-full" onclick="WM.Theme.saveCustomTheme()">
          Thema opslaan & toepassen
        </button>
      </div>`;

    if (customThemes.length > 0) {
      html += `<div class="section-title">Mijn thema's</div>`;
      html += `<div class="theme-grid">
        ${customThemes.map(t => customThemeCard(t, current === t.id)).join('')}
      </div>`;
    }

    return html;
  }

  function themeCard(theme, isActive) {
    const grad = `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`;
    return `
      <div class="theme-card ${isActive ? 'active' : ''}"
           style="background:${grad};"
           onclick="WM.Theme.selectTheme('${theme.id}')">
        <div class="theme-name">${theme.name}</div>
        <div class="theme-colors">
          <div class="theme-swatch" style="background:${theme.primary};"></div>
          <div class="theme-swatch" style="background:${theme.secondary};"></div>
          <div class="theme-swatch" style="background:${theme.accent};"></div>
        </div>
      </div>`;
  }

  function customThemeCard(theme, isActive) {
    const grad = `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark || theme.primary})`;
    return `
      <div class="theme-card ${isActive ? 'active' : ''}"
           style="background:${grad};position:relative;"
           onclick="WM.Theme.selectTheme('${theme.id}', true)">
        <button onclick="event.stopPropagation();WM.Theme.deleteCustomTheme('${theme.id}')"
                style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.4);border:none;color:white;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:0.8rem;">✕</button>
        <div class="theme-name">${theme.name}</div>
        <div class="theme-colors">
          <div class="theme-swatch" style="background:${theme.primary};"></div>
          <div class="theme-swatch" style="background:${theme.secondary};"></div>
          <div class="theme-swatch" style="background:${theme.accent};"></div>
        </div>
      </div>`;
  }

  function selectTheme(id, isCustom = false) {
    const data = TData.get();
    data.current = id;
    TData.save(data);

    const customMatch = (data.customThemes || []).find(t => t.id === id);
    applyTheme(id, customMatch || null);
    toast('Thema toegepast', 'success');

    // Update actieve staat
    document.querySelectorAll('.theme-card').forEach(el => el.classList.remove('active'));
    // Herrender is niet nodig, alleen visuele update
    if (WM.App.currentPage() === 'thema') WM.App.refreshPage();
  }

  function saveCustomTheme() {
    const name = document.getElementById('custom-theme-name')?.value?.trim();
    if (!name) { toast('Geef een naam voor je thema', 'warning'); return; }

    const primary = document.getElementById('cp-primary')?.value || '#6c63ff';
    const secondary = document.getElementById('cp-secondary')?.value || '#06b6d4';
    const accent = document.getElementById('cp-accent')?.value || '#f59e0b';

    const data = TData.get();
    const id = 'custom_' + Date.now();
    const newTheme = {
      id, name, primary,
      primaryDark: shadeColor(primary, -20),
      primaryLight: shadeColor(primary, 30),
      secondary, accent,
      bg: '#0f0f1a', bgSurface: '#1a1a2e', bgCard: '#16213e', bgCard2: '#0d1117'
    };

    if (!data.customThemes) data.customThemes = [];
    data.customThemes.push(newTheme);
    data.current = id;
    TData.save(data);

    applyTheme(id, newTheme);
    toast(`Thema "${name}" opgeslagen`, 'success');
    WM.App.refreshPage();
  }

  function deleteCustomTheme(id) {
    WM.UI.confirmDialog('Dit thema verwijderen?', () => {
      const data = TData.get();
      data.customThemes = (data.customThemes || []).filter(t => t.id !== id);
      if (data.current === id) {
        data.current = 'purple';
        applyTheme('purple');
      }
      TData.save(data);
      toast('Thema verwijderd', 'success');
      WM.App.refreshPage();
    });
  }

  // Live preview in kleurpicker
  function initColorPickers() {
    const updatePreview = () => {
      const p = document.getElementById('cp-primary')?.value;
      const s = document.getElementById('cp-secondary')?.value;
      const a = document.getElementById('cp-accent')?.value;
      const preview = document.getElementById('theme-preview');
      if (preview && p && s) {
        preview.style.background = `linear-gradient(135deg, ${p}, ${s})`;
        const dot = preview.querySelector('div');
        if (dot && a) dot.style.background = a;
      }
    };
    ['cp-primary','cp-secondary','cp-accent'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });
  }

  return { render, loadSavedTheme, selectTheme, saveCustomTheme, deleteCustomTheme, initColorPickers, applyTheme, BUILTIN_THEMES };
})();

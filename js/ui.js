// ============================================================
// ui.js — UI-hulpfuncties: toasts, modals, loaders
// ============================================================
window.WM = window.WM || {};

WM.UI = (() => {
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function safeTel(value) {
    return String(value ?? '').replace(/[^\d+()[\]\s.-]/g, '').trim();
  }

  function safeEmail(value) {
    const email = String(value ?? '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  // ── Toast-notificaties ────────────────────────────────────
  function toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  // ── Modal ─────────────────────────────────────────────────
  let modalStack = [];

  function openModal(title, bodyHTML, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const modal   = document.getElementById('modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl  = document.getElementById('modal-body');
    if (!overlay) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = '';
    bodyEl.innerHTML = bodyHTML;

    // Opties
    if (options.wide) modal.classList.add('modal-wide');
    else modal.classList.remove('modal-wide');

    overlay.classList.remove('hidden');
    overlay.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // Init callback na render
    if (options.onOpen) setTimeout(options.onOpen, 50);

    modalStack.push({ title, options });
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('modal-open');
    overlay.classList.add('modal-closing');
    document.body.style.overflow = '';
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('modal-closing');
      document.getElementById('modal-body').innerHTML = '';
    }, 250);
    modalStack.pop();
  }

  function confirmDialog(message, onConfirm, onCancel) {
    const html = `
      <div class="confirm-dialog">
        <p>${escapeHTML(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" id="confirm-cancel">Annuleren</button>
          <button class="btn btn-danger" id="confirm-ok">Bevestigen</button>
        </div>
      </div>`;
    openModal('Bevestigen', html);
    setTimeout(() => {
      document.getElementById('confirm-ok').onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
      document.getElementById('confirm-cancel').onclick = () => { closeModal(); if (onCancel) onCancel(); };
    }, 50);
  }

  // ── Laadindicator ─────────────────────────────────────────
  function showLoader(message = 'Laden…') {
    let el = document.getElementById('global-loader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-loader';
      el.innerHTML = `<div class="loader-spinner"></div><p>${escapeHTML(message)}</p>`;
      document.body.appendChild(el);
    } else {
      el.querySelector('p').textContent = message;
    }
    el.classList.remove('hidden');
  }

  function hideLoader() {
    const el = document.getElementById('global-loader');
    if (el) el.classList.add('hidden');
  }

  // ── Formulier-helpers ─────────────────────────────────────
  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') {
        if (el.dataset.group) {
          if (!data[el.dataset.group]) data[el.dataset.group] = [];
          if (el.checked) data[el.dataset.group].push(el.value);
        } else {
          data[el.name] = el.checked;
        }
      } else {
        data[el.name] = el.value;
      }
    });
    return data;
  }

  function fillForm(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;
    Object.entries(data).forEach(([key, value]) => {
      const el = form.querySelector(`[name="${key}"]`);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value != null ? value : '';
    });
  }

  // ── Datum-helpers ─────────────────────────────────────────
  const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const DAGEN   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const DAGEN_KORT = ['zo','ma','di','wo','do','vr','za'];

  function formatDate(dateStr, format = 'long') {
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr + 'T00:00:00');
    if (format === 'long') {
      return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (format === 'medium') {
      return `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
    }
    if (format === 'short') {
      return `${d.getDate()}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    }
    if (format === 'weekday') {
      return DAGEN_KORT[d.getDay()];
    }
    return dateStr;
  }

  function formatRelativeDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'vandaag';
    if (diff === 1) return 'morgen';
    if (diff === -1) return 'gisteren';
    if (diff > 0) return `over ${diff} dagen`;
    return `${Math.abs(diff)} dagen geleden`;
  }

  // ── SVG-iconen ────────────────────────────────────────────
  const ICONS = {
    pill:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-35 12 12)"/><line x1="6.4" y1="7.9" x2="17.6" y2="16.1" transform="rotate(-35 12 12)"/></svg>',
    plus:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    camera:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    warning:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    phone:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    export:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    heart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    trending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    back:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
    bell:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    palette:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'
  };

  function icon(name, cls = '') {
    return `<span class="icon ${cls}">${ICONS[name] || ''}</span>`;
  }

  // ── Terug-knop voor subpagina's ───────────────────────────
  function backButton(targetPage, label = 'Terug') {
    return `<button class="btn-back" onclick="WM.App.navigate('${targetPage}')">${icon('back')} ${label}</button>`;
  }

  // ── Lege-staat component ──────────────────────────────────
  function emptyState(msg, subMsg = '', actionHTML = '') {
    return `
      <div class="empty-state">
        <div class="empty-icon">💊</div>
        <p class="empty-msg">${escapeHTML(msg)}</p>
        ${subMsg ? `<p class="empty-sub">${escapeHTML(subMsg)}</p>` : ''}
        ${actionHTML}
      </div>`;
  }

  return { toast, openModal, closeModal, confirmDialog, showLoader, hideLoader, getFormData, fillForm, formatDate, formatRelativeDate, icon, backButton, emptyState, escapeHTML, escapeAttr, safeTel, safeEmail, ICONS };
})();

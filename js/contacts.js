// ============================================================
// contacts.js — Huisarts & apotheekcontacten
// ============================================================
window.WM = window.WM || {};

WM.Contacts = (() => {
  const { Contacts: CData } = WM.Data;
  const { toast, openModal, closeModal, backButton, icon, escapeHTML, escapeAttr, safeTel, safeEmail } = WM.UI;

  function render() {
    const contacts = CData.get();

    let html = `
      <div class="subpage-header">
        ${backButton('meer')}
        <h2 class="subpage-title">Contacten</h2>
      </div>`;

    html += renderContactCard('Huisarts', contacts.gp, 'gp');
    html += renderContactCard('Apotheek', contacts.pharmacy, 'pharmacy');

    // Komende sluitingsdagen apotheek
    const upcoming = WM.Holidays.upcomingHolidays(30);
    if (upcoming.length > 0) {
      html += `<div class="section-title">📅 Apotheek gesloten (komende 30 dagen)</div>`;
      html += `<div class="card">`;
      upcoming.forEach(h => {
        html += `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
            <span>${escapeHTML(h.name)}</span>
            <span style="color:var(--text-muted);">${WM.UI.formatDate(h.date, 'medium')}</span>
          </div>`;
      });
      html += `</div>`;
    }

    return html;
  }

  function renderContactCard(type, contact, key) {
    const hasData = contact.name || contact.phone;
    return `
      <div class="contact-card fade-in">
        <div class="contact-type-label">${escapeHTML(type)}</div>
        ${hasData ? `
          ${contact.name ? `<div class="contact-name">${escapeHTML(contact.name)}</div>` : ''}
          ${contact.address ? `<div class="contact-detail">${icon('calendar')} ${escapeHTML(contact.address)}</div>` : ''}
          ${contact.phone ? `<div class="contact-detail">${icon('phone')} <a href="tel:${escapeAttr(safeTel(contact.phone))}">${escapeHTML(contact.phone)}</a></div>` : ''}
          ${contact.email && safeEmail(contact.email) ? `<div class="contact-detail">✉️ <a href="mailto:${escapeAttr(safeEmail(contact.email))}">${escapeHTML(contact.email)}</a></div>` : ''}
          ${contact.openingHours ? `<div class="contact-detail">🕐 ${escapeHTML(contact.openingHours)}</div>` : ''}
          ${contact.notes ? `<div class="contact-detail" style="color:var(--text-muted);font-style:italic;">💬 ${escapeHTML(contact.notes)}</div>` : ''}
        ` : `<p style="color:var(--text-dim);font-size:0.85rem;">Geen contactgegevens opgeslagen</p>`}
        <button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="WM.Contacts.editContact('${key}')">
          ${icon('edit')} Bewerken
        </button>
      </div>`;
  }

  function editContact(key) {
    const contacts = CData.get();
    const contact = contacts[key] || {};
    const label = key === 'gp' ? 'Huisarts' : 'Apotheek';

    const html = `
      <form id="contact-form">
        <div class="form-group">
          <label class="form-label">Naam</label>
          <input type="text" name="name" class="form-input" value="${escapeAttr(contact.name || '')}" placeholder="${key === 'gp' ? 'Dr. Jansen' : 'Apotheek de Lindeboom'}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefoonnummer</label>
          <input type="tel" name="phone" class="form-input" value="${escapeAttr(contact.phone || '')}" placeholder="020-1234567">
        </div>
        <div class="form-group">
          <label class="form-label">Adres</label>
          <input type="text" name="address" class="form-input" value="${escapeAttr(contact.address || '')}" placeholder="Hoofdstraat 1, Amsterdam">
        </div>
        <div class="form-group">
          <label class="form-label">E-mailadres</label>
          <input type="email" name="email" class="form-input" value="${escapeAttr(contact.email || '')}" placeholder="info@apotheek.nl">
        </div>
        ${key === 'pharmacy' ? `
          <div class="form-group">
            <label class="form-label">Openingstijden</label>
            <input type="text" name="openingHours" class="form-input" value="${escapeAttr(contact.openingHours || '')}" placeholder="ma-vr 08:30–17:30">
          </div>` : ''}
        <div class="form-group">
          <label class="form-label">Notities</label>
          <textarea name="notes" class="form-textarea" placeholder="Extra informatie…">${escapeHTML(contact.notes || '')}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">Opslaan</button>
      </form>`;

    openModal(`${label} bewerken`, html, {
      onOpen: () => {
        document.getElementById('contact-form').onsubmit = e => {
          e.preventDefault();
          saveContact(key);
        };
      }
    });
  }

  function saveContact(key) {
    const data = WM.UI.getFormData('contact-form');
    const contacts = CData.get();
    contacts[key] = { ...contacts[key], ...data };
    CData.save(contacts);
    closeModal();
    toast('Contactgegevens opgeslagen', 'success');
    WM.App.refreshPage();
  }

  return { render, editContact };
})();

// ============================================================
// data.js — Centrale data-laag (localStorage)
// ============================================================
window.WM = window.WM || {};

WM.Data = (() => {
  const KEYS = {
    MEDICATIONS: 'wm_medications',
    SCHEDULE:    'wm_schedule',
    WELLBEING:   'wm_wellbeing',
    CONTACTS:    'wm_contacts',
    THEME:       'wm_theme',
    SETTINGS:    'wm_settings',
    TAPERING:    'wm_tapering'
  };

  // ── Hulpfuncties ──────────────────────────────────────────
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function load(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch {
      console.warn(`[Weekmedicatie] Ongeldige data in ${key}, standaardwaarden worden gebruikt.`);
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[Weekmedicatie] Opslaan mislukt voor ${key}:`, e);
      if (window.WM?.UI?.toast) WM.UI.toast('Opslaan mislukt: geheugen vol?', 'error');
    }
  }

  // ── Medicijnen ────────────────────────────────────────────
  const Medications = {
    all() { return load(KEYS.MEDICATIONS, []); },

    get(id) { return this.all().find(m => m.id === id) || null; },

    save(data) {
      const meds = this.all();
      const now = new Date().toISOString();
      if (data.id) {
        const idx = meds.findIndex(m => m.id === data.id);
        if (idx >= 0) {
          meds[idx] = { ...meds[idx], ...data, updatedAt: now };
        } else {
          meds.push({ ...data, createdAt: now, updatedAt: now });
        }
      } else {
        const newMed = { ...data, id: uuid(), createdAt: now, updatedAt: now };
        meds.push(newMed);
        save(KEYS.MEDICATIONS, meds);
        return newMed;
      }
      save(KEYS.MEDICATIONS, meds);
      return data;
    },

    delete(id) {
      const meds = this.all().filter(m => m.id !== id);
      save(KEYS.MEDICATIONS, meds);
      // Verwijder ook tapering
      WM.Data.Tapering.deleteForMedication(id);
    },

    updateStock(id, delta) {
      const meds = this.all();
      const idx = meds.findIndex(m => m.id === id);
      if (idx >= 0) {
        meds[idx].stock = Math.max(0, (meds[idx].stock || 0) + delta);
        meds[idx].updatedAt = new Date().toISOString();
        save(KEYS.MEDICATIONS, meds);
        return meds[idx].stock;
      }
      return 0;
    }
  };

  // ── Dagschema (innames) ───────────────────────────────────
  const Schedule = {
    getDay(date = today()) {
      const all = load(KEYS.SCHEDULE, {});
      return all[date] || { ochtend: {}, middag: {}, avond: {} };
    },

    setIntake(date = today(), moment, medId, taken, time = null) {
      const all = load(KEYS.SCHEDULE, {});
      if (!all[date]) all[date] = { ochtend: {}, middag: {}, avond: {} };
      if (!all[date][moment]) all[date][moment] = {};
      all[date][moment][medId] = { taken, time: time || (taken ? new Date().toTimeString().slice(0,5) : null) };
      save(KEYS.SCHEDULE, all);
    },

    getIntake(date = today(), moment, medId) {
      const day = this.getDay(date);
      return (day[moment] && day[moment][medId]) || { taken: false, time: null };
    },

    // Geschiedenis: laatste N dagen
    history(days = 30) {
      const all = load(KEYS.SCHEDULE, {});
      const result = [];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, data: all[key] || null });
      }
      return result;
    },

    // Verwijder oude data (ouder dan 60 dagen)
    cleanup() {
      const all = load(KEYS.SCHEDULE, {});
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      Object.keys(all).forEach(k => { if (k < cutoffStr) delete all[k]; });
      save(KEYS.SCHEDULE, all);
    }
  };

  // ── Afbouwschema's ────────────────────────────────────────
  const Tapering = {
    all() { return load(KEYS.TAPERING, []); },

    get(id) { return this.all().find(t => t.id === id) || null; },

    forMedication(medId) { return this.all().find(t => t.medicationId === medId && t.active) || null; },

    save(data) {
      const all = this.all();
      const now = new Date().toISOString();
      if (data.id) {
        const idx = all.findIndex(t => t.id === data.id);
        if (idx >= 0) { all[idx] = { ...all[idx], ...data, updatedAt: now }; }
        else { all.push({ ...data, createdAt: now, updatedAt: now }); }
      } else {
        all.push({ ...data, id: uuid(), createdAt: now, updatedAt: now });
      }
      save(KEYS.TAPERING, all);
    },

    delete(id) {
      save(KEYS.TAPERING, this.all().filter(t => t.id !== id));
    },

    deleteForMedication(medId) {
      save(KEYS.TAPERING, this.all().filter(t => t.medicationId !== medId));
    },

    // Bereken huidige dosis op basis van startdatum
    currentDose(tapering) {
      if (!tapering || !tapering.active) return null;
      const start = new Date(tapering.startDate);
      const now = new Date();
      const daysPassed = Math.max(0, Math.floor((now - start) / 86400000));
      const reductions = Math.floor(daysPassed / tapering.intervalDays);
      const dose = tapering.startDose - (reductions * tapering.reductionStep);
      return Math.max(tapering.endDose, dose);
    },

    nextReductionDate(tapering) {
      if (!tapering || !tapering.active) return null;
      const start = new Date(tapering.startDate);
      const now = new Date();
      const daysPassed = Math.max(0, Math.floor((now - start) / 86400000));
      const reductions = Math.floor(daysPassed / tapering.intervalDays);
      const nextDay = (reductions + 1) * tapering.intervalDays;
      const nextDate = new Date(start);
      nextDate.setDate(nextDate.getDate() + nextDay);
      return nextDate;
    },

    isComplete(tapering) {
      if (!tapering) return false;
      return this.currentDose(tapering) <= tapering.endDose;
    }
  };

  // ── Welzijnslog ───────────────────────────────────────────
  const Wellbeing = {
    all() { return load(KEYS.WELLBEING, {}); },

    get(date = today()) { return this.all()[date] || null; },

    save(date = today(), data) {
      const all = this.all();
      all[date] = { ...data, updatedAt: new Date().toISOString() };
      save(KEYS.WELLBEING, all);
    },

    history(days = 30) {
      const all = this.all();
      const result = [];
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, entry: all[key] || null });
      }
      return result;
    }
  };

  // ── Contacten ─────────────────────────────────────────────
  const Contacts = {
    get() {
      return load(KEYS.CONTACTS, {
        gp: { name: '', phone: '', address: '', email: '', notes: '' },
        pharmacy: { name: '', phone: '', address: '', email: '', openingHours: '', notes: '' }
      });
    },
    save(data) { save(KEYS.CONTACTS, data); }
  };

  // ── Thema ─────────────────────────────────────────────────
  const Theme = {
    get() {
      return load(KEYS.THEME, {
        current: 'purple',
        customThemes: []
      });
    },
    save(data) { save(KEYS.THEME, data); }
  };

  // ── Instellingen ──────────────────────────────────────────
  const Settings = {
    get() {
      return load(KEYS.SETTINGS, {
        apiKey: '',
        notifications: false,
        notificationTimes: { ochtend: '08:00', middag: '13:00', avond: '20:00' },
        lowStockDays: 7
      });
    },
    save(data) { save(KEYS.SETTINGS, data); },
    update(partial) { this.save({ ...this.get(), ...partial }); }
  };

  return { Medications, Schedule, Tapering, Wellbeing, Contacts, Theme, Settings, uuid, today };
})();

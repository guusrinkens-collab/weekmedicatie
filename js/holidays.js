// ============================================================
// holidays.js — Nederlandse feestdagen & apotheeksluitingen
// ============================================================
window.WM = window.WM || {};

WM.Holidays = (() => {
  // Paasberekening (Meeus/Jones/Butcher algoritme)
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function toKey(date) {
    return date.toISOString().slice(0, 10);
  }

  // Alle Nederlandse feestdagen voor een jaar
  function getDutchHolidays(year) {
    const e = easter(year);
    const holidays = new Set([
      // Vaste data
      `${year}-01-01`,  // Nieuwjaarsdag
      `${year}-04-27` === `${year}-04-27` // Koningsdag (27 april, bij zondag → 26 april)
        ? (new Date(year, 3, 27).getDay() === 0 ? `${year}-04-26` : `${year}-04-27`)
        : `${year}-04-27`,
      `${year}-05-05`,  // Bevrijdingsdag
      `${year}-12-25`,  // Eerste Kerstdag
      `${year}-12-26`,  // Tweede Kerstdag

      // Paasgebonden feestdagen
      toKey(addDays(e, -2)),  // Goede Vrijdag
      toKey(e),               // Eerste Paasdag
      toKey(addDays(e, 1)),   // Tweede Paasdag
      toKey(addDays(e, 39)),  // Hemelvaartsdag
      toKey(addDays(e, 49)),  // Eerste Pinksterdag
      toKey(addDays(e, 50))   // Tweede Pinksterdag
    ]);

    // Fix Koningsdag (27 april = zondag → 26 april)
    const koningsdag = new Date(year, 3, 27);
    if (koningsdag.getDay() === 0) {
      holidays.delete(`${year}-04-27`);
      holidays.add(`${year}-04-26`);
    } else {
      holidays.add(`${year}-04-27`);
    }

    return holidays;
  }

  // Cache per jaar
  const holidayCache = {};
  function getHolidays(year) {
    if (!holidayCache[year]) holidayCache[year] = getDutchHolidays(year);
    return holidayCache[year];
  }

  function isHoliday(date) {
    const d = date instanceof Date ? date : new Date(date);
    return getHolidays(d.getFullYear()).has(toKey(d));
  }

  function isWeekend(date) {
    const d = date instanceof Date ? date : new Date(date);
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  // Is de apotheek gesloten op deze dag?
  function isPharmacyClosed(date) {
    return isWeekend(date) || isHoliday(date);
  }

  // Bereken de laatste veilige besteldatum
  // stock_empty_date: datum waarop voorraad op is
  // leadTimeDays: levertijd apotheek in werkdagen (standaard 1)
  function latestSafeOrderDate(stockEmptyDate, leadTimeDays = 1) {
    let date = stockEmptyDate instanceof Date ? new Date(stockEmptyDate) : new Date(stockEmptyDate);

    // Stap terug totdat we genoeg open apothekendagen vinden
    let workDaysNeeded = leadTimeDays;
    while (workDaysNeeded > 0 || isPharmacyClosed(date)) {
      date = addDays(date, -1);
      if (!isPharmacyClosed(date)) workDaysNeeded--;
    }
    return date;
  }

  // Tel gesloten dagen tussen vandaag en een datum
  function countClosedDays(fromDate, toDate) {
    let count = 0;
    let d = new Date(fromDate);
    const end = new Date(toDate);
    while (d < end) {
      if (isPharmacyClosed(d)) count++;
      d = addDays(d, 1);
    }
    return count;
  }

  // Naam van een feestdag
  function holidayName(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const key = toKey(d);
    const e = easter(year);

    const names = {
      [`${year}-01-01`]: 'Nieuwjaarsdag',
      [toKey(addDays(e, -2))]: 'Goede Vrijdag',
      [toKey(e)]: 'Eerste Paasdag',
      [toKey(addDays(e, 1))]: 'Tweede Paasdag',
      [`${year}-05-05`]: 'Bevrijdingsdag',
      [toKey(addDays(e, 39))]: 'Hemelvaartsdag',
      [toKey(addDays(e, 49))]: 'Eerste Pinksterdag',
      [toKey(addDays(e, 50))]: 'Tweede Pinksterdag',
      [`${year}-12-25`]: 'Eerste Kerstdag',
      [`${year}-12-26`]: 'Tweede Kerstdag'
    };
    const koningsdag = new Date(year, 3, 27).getDay() === 0 ? `${year}-04-26` : `${year}-04-27`;
    names[koningsdag] = 'Koningsdag';
    return names[key] || null;
  }

  // Komende feestdagen (volgende 30 dagen)
  function upcomingHolidays(days = 30) {
    const result = [];
    for (let i = 0; i <= days; i++) {
      const d = addDays(new Date(), i);
      const key = toKey(d);
      const name = holidayName(d);
      if (name) result.push({ date: key, name });
    }
    return result;
  }

  return { isHoliday, isWeekend, isPharmacyClosed, latestSafeOrderDate, countClosedDays, holidayName, upcomingHolidays, addDays, toKey };
})();

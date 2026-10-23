/*
 * Calcul du calendrier de traitement : séances de radiothérapie,
 * cures de chimiothérapie et prises de sang hebdomadaires.
 */

const DAY_MS = 86400000;
const WEEKDAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function parseISODate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function mondayOf(date) {
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

function formatDate(date, withWeekday) {
  if (!date) return '';
  const s = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return withWeekday ? `${WEEKDAYS_LONG[date.getDay()]} ${s}` : s;
}

function formatShort(date) {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/**
 * @param {object} p
 * @param {number} p.totalSessions
 * @param {number} p.daysPerWeek
 * @param {boolean} p.bifract          2 séances par jour
 * @param {string} [p.startDate]       AAAA-MM-JJ ; sinon calendrier relatif
 * @param {boolean} p.chemo
 * @param {number|null} p.chemoInterval jours entre deux cures (1 = quotidienne, null = J1 seulement)
 */
function computeSchedule(p) {
  const hasDates = !!parseISODate(p.startDate);
  // Sans date : lundi de référence arbitraire, les dates ne sont pas affichées.
  const start = parseISODate(p.startDate) || new Date(2024, 0, 1);
  const perDay = p.bifract ? 2 : 1;
  const pattern = DAY_PATTERNS[p.daysPerWeek] || DAY_PATTERNS[5];

  const treatment = [];
  let remaining = p.totalSessions;
  let sessionNo = 1;
  let d = new Date(start);
  for (let guard = 0; remaining > 0 && guard < 3650; guard++) {
    if (treatment.length === 0 || pattern.includes(d.getDay())) {
      const n = Math.min(perDay, remaining);
      treatment.push({ date: new Date(d), sessions: n, first: sessionNo, last: sessionNo + n - 1 });
      sessionNo += n;
      remaining -= n;
    }
    d = addDays(d, 1);
  }
  const lastDay = treatment.length ? treatment[treatment.length - 1].date : start;

  const chemoDays = [];
  const bloodDays = [];
  if (p.chemo) {
    if (p.chemoInterval === 1) {
      treatment.forEach((t) => chemoDays.push(t.date));
    } else if (p.chemoInterval) {
      for (let c = new Date(start); c <= lastDay; c = addDays(c, p.chemoInterval)) chemoDays.push(c);
    } else {
      chemoDays.push(new Date(start));
    }
    for (let b = addDays(start, -2); b <= lastDay; b = addDays(b, 7)) bloodDays.push(b);
  }

  const rtMap = new Map(treatment.map((t) => [dayKey(t.date), t]));
  const chemoSet = new Set(chemoDays.map(dayKey));
  const bloodSet = new Set(bloodDays.map(dayKey));

  const firstDay = bloodDays.length ? bloodDays[0] : start;
  const startWeek = mondayOf(start);
  const weeks = [];
  for (let w = mondayOf(firstDay); w <= lastDay; w = addDays(w, 7)) {
    const idx = Math.round((w - startWeek) / (7 * DAY_MS));
    const days = [];
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(w, i);
      const k = dayKey(day);
      const rt = rtMap.get(k) || null;
      if (rt) count += rt.sessions;
      days.push({ date: day, rt, chemo: chemoSet.has(k), blood: bloodSet.has(k), weekend: i >= 5 });
    }
    weeks.push({ label: idx < 0 ? 'Avant' : `Semaine ${idx + 1}`, days, count });
  }

  return {
    hasDates,
    start,
    lastDay,
    treatmentDays: treatment.length,
    weeks,
    firstBlood: bloodDays[0] || null,
  };
}

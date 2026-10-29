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
 * @param {number[]} [p.chemoCycleDays] jours de chaque cure, en décalage depuis J1 (défaut [0] ;
 *                                     ex. [0, 1, 2] = 3 jours de suite, [0, 7] = J1 J8)
 * @param {boolean} [p.dailyChemoEveryDay] chimiothérapie quotidienne aussi les jours sans séance (week-ends inclus)
 * @param {number} [p.splitAfter]      split course : nombre de séances du temps 1 (0 = pas de split)
 * @param {number} [p.splitPause]      split course : durée de la pause en jours après la dernière séance du temps 1
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
  const split = p.splitAfter > 0 && p.splitAfter < p.totalSessions;
  let pauseStart = null;
  let pauseEnd = null;
  let resumeDate = null;
  for (let guard = 0; remaining > 0 && guard < 3650; guard++) {
    if (treatment.length === 0 || pattern.includes(d.getDay())) {
      // Le temps 1 s'arrête exactement après splitAfter séances (utile en bi-fractionné)
      const beforeSplit = split && !resumeDate ? p.splitAfter - (sessionNo - 1) : Infinity;
      const n = Math.min(perDay, remaining, beforeSplit);
      treatment.push({ date: new Date(d), sessions: n, first: sessionNo, last: sessionNo + n - 1 });
      sessionNo += n;
      remaining -= n;
      if (split && !resumeDate && sessionNo - 1 === p.splitAfter) {
        // Reprise au premier jour de traitement suivant la pause
        pauseStart = addDays(d, 1);
        let r = addDays(d, (p.splitPause || 0) + 1);
        while (!pattern.includes(r.getDay())) r = addDays(r, 1);
        resumeDate = r;
        pauseEnd = addDays(r, -1);
        d = r;
        continue;
      }
    }
    d = addDays(d, 1);
  }
  const lastDay = treatment.length ? treatment[treatment.length - 1].date : start;
  const inPause = (date) => !!pauseStart && date >= pauseStart && date <= pauseEnd;

  const chemoDays = [];
  const bloodDays = [];
  if (p.chemo) {
    if (p.chemoInterval === 1 && !p.dailyChemoEveryDay) {
      treatment.forEach((t) => chemoDays.push(t.date));
    } else if (p.chemoInterval) {
      const offsets = p.chemoCycleDays && p.chemoCycleDays.length ? p.chemoCycleDays : [0];
      for (let c = new Date(start); c <= lastDay; c = addDays(c, p.chemoInterval)) {
        offsets.forEach((o) => chemoDays.push(addDays(c, o)));
      }
    } else {
      chemoDays.push(new Date(start));
    }
    for (let b = addDays(start, -2); b <= lastDay; b = addDays(b, 7)) bloodDays.push(b);
  }
  // Pas de chimiothérapie concomitante ni de bilan associé pendant la pause du split course
  const keptChemo = chemoDays.filter((c) => !inPause(c));
  // Prise de sang jamais le week-end : avancée au vendredi précédent
  const keptBlood = bloodDays.filter((b) => !inPause(addDays(b, 2)))
    .map((b) => (b.getDay() === 6 ? addDays(b, -1) : b.getDay() === 0 ? addDays(b, -2) : b));

  const rtMap = new Map(treatment.map((t) => [dayKey(t.date), t]));
  const chemoSet = new Set(keptChemo.map(dayKey));
  const bloodSet = new Set(keptBlood.map(dayKey));

  const firstDay = keptBlood.length ? keptBlood[0] : start;
  // Une cure commencée pendant la radiothérapie peut se terminer après la dernière séance
  const gridEnd = keptChemo.reduce((m, c) => (c > m ? c : m), lastDay);
  const startWeek = mondayOf(start);
  const weeks = [];
  for (let w = mondayOf(firstDay); w <= gridEnd; w = addDays(w, 7)) {
    const idx = Math.round((w - startWeek) / (7 * DAY_MS));
    const days = [];
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(w, i);
      const k = dayKey(day);
      const rt = rtMap.get(k) || null;
      if (rt) count += rt.sessions;
      days.push({ date: day, rt, chemo: chemoSet.has(k), blood: bloodSet.has(k), weekend: i >= 5, pause: inPause(day) });
    }
    const allPause = !count && days.some((x) => x.pause);
    weeks.push({ label: idx < 0 ? 'Avant' : `Semaine ${idx + 1}`, days, count, pause: allPause });
  }

  return {
    hasDates,
    start,
    lastDay,
    treatmentWeeks: weeks.filter((w) => w.count > 0).length,
    weeks,
    firstBlood: keptBlood[0] || null,
    split,
    pauseStart,
    pauseEnd,
    resumeDate,
    pauseDays: pauseStart ? Math.round((resumeDate - pauseStart) / DAY_MS) : 0,
  };
}

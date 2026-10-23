/* Éditeur de PPS – radiothérapie : navigation, formulaires et rendu du document. */

const app = document.getElementById('app');
// Logo intégré (js/logo.js) ; repli sur le fichier image si le script n'a pas été chargé.
const LOGO = typeof LOGO_SRC !== 'undefined' ? LOGO_SRC : 'img/logo-hcl.jpg';
const breadcrumb = document.getElementById('breadcrumb');

function newState() {
  return {
    view: 'home',
    loc: null,
    locOther: '',
    rtType: '',
    daysPerWeek: 5,
    totalSessions: '',
    chemo: null,
    chemoRhythm: '',
    chemoRhythmOther: '',
    pause: null,
    pauseDetails: '',
    dai: null,
    opts: {},
    agents: {},
    freeExams: [''], // localisation « Autre »
    // Saisies du PPS
    patient: { nom: '', prenom: '', ddn: '' },
    medecin: '',
    etablissement: '',
    appts: {}, // id -> { date, time, lieu }
    extraAppts: [], // { name, date, time, lieu }
    extraEffects: [], // { kind: 'acute'|'late', effect, explain }
    extraConduct: '',
  };
}

let state = newState();

/* ---------- utilitaires ---------- */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const getLoc = () => LOCALISATIONS.find((l) => l.id === state.loc);
const locLabel = () => (state.loc === 'autre' && state.locOther.trim() ? state.locOther.trim() : getLoc().label);
const rtTypeLabel = () => (RT_TYPES.find((t) => t.id === state.rtType) || {}).label || '';
const rhythm = () => CHEMO_RHYTHMS.find((r) => r.id === state.chemoRhythm);

function rhythmLabel() {
  const r = rhythm();
  if (!r) return '';
  if (r.id === 'autre') return state.chemoRhythmOther.trim() || 'autre rythme';
  return r.long || r.label.toLowerCase();
}

function chemoAgentsLabel() {
  const loc = getLoc();
  if (loc.chemoAgents) return loc.chemoAgents.filter((a) => state.agents[a.id]).map((a) => a.label).join(', ');
  // Molécule implicite de la localisation (ex. Temodal pour le crâne)
  return buildContent().systemic
    .filter((g) => g.type === 'chimio' && g.name !== 'Chimiothérapie')
    .map((g) => g.name).join(', ');
}

function radioGroup(name, options, value) {
  return `<div class="choices">${options.map((o) => `
    <label class="choice ${String(value) === String(o.id) ? 'checked' : ''}">
      <input type="radio" name="${name}" value="${esc(o.id)}" ${String(value) === String(o.id) ? 'checked' : ''}>
      <span>${esc(o.label)}</span>
    </label>`).join('')}</div>`;
}

const YES_NO = [{ id: 'oui', label: 'Oui' }, { id: 'non', label: 'Non' }];
const yn = (v) => (v === null ? '' : v ? 'oui' : 'non');

function setBreadcrumb() {
  const parts = [];
  if (state.loc) parts.push(`<button type="button" data-action="go" data-view="form">${esc(locLabel())}</button>`);
  if (['options', 'pps'].includes(state.view)) parts.push('<button type="button" data-action="go" data-view="options">Options</button>');
  if (state.view === 'pps') parts.push('<span>PPS</span>');
  breadcrumb.innerHTML = parts.join('<span class="sep">›</span>');
}

function render() {
  setBreadcrumb();
  if (state.view === 'home') renderHome();
  else if (state.view === 'form') renderForm();
  else if (state.view === 'options') renderOptions();
  else renderPps();
  window.scrollTo(0, 0);
}

/* ---------- 1. Choix de la localisation ---------- */

function renderHome() {
  app.innerHTML = `
    <section class="panel narrow">
      <div class="home-brand">
        <img src="${LOGO}" alt="HCL – Hôpital Lyon Sud">
        <span>Service de Radiothérapie</span>
      </div>
      <h1>Éditeur de PPS de radiothérapie</h1>
      <p class="lead">Choisissez la localisation tumorale.</p>
      <div class="loc-grid">
        ${LOCALISATIONS.map((l) => `
          <button type="button" class="loc-card" data-action="pick-loc" data-loc="${l.id}">${esc(l.label)}</button>`).join('')}
      </div>
    </section>`;
}

/* ---------- 2. Paramètres du traitement ---------- */

function renderForm() {
  const loc = getLoc();
  const types = RT_TYPES.filter((t) => !t.onlyFor || t.onlyFor.includes(loc.id));
  if (!types.some((t) => t.id === state.rtType)) state.rtType = '';

  app.innerHTML = `
    <form class="panel narrow" id="form-main" novalidate>
      <h1>${esc(loc.label)}</h1>
      ${loc.id === 'autre' ? `
        <div class="field">
          <label class="label" for="locOther">Préciser la localisation</label>
          <input id="locOther" data-bind="locOther" type="text" value="${esc(state.locOther)}" placeholder="ex. : Sein gauche">
        </div>` : ''}

      <fieldset class="field">
        <legend class="label">Type de radiothérapie</legend>
        ${radioGroup('rtType', types, state.rtType)}
      </fieldset>

      <fieldset class="field">
        <legend class="label">Nombre de jours de traitement par semaine</legend>
        ${radioGroup('daysPerWeek', [1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n) })), state.daysPerWeek)}
      </fieldset>

      <div class="field">
        <label class="label" for="totalSessions">Nombre total de séances</label>
        <input id="totalSessions" data-bind="totalSessions" type="number" min="1" max="100" inputmode="numeric" value="${esc(state.totalSessions)}" class="short">
      </div>

      <fieldset class="field">
        <legend class="label">Chimiothérapie concomitante</legend>
        ${radioGroup('chemo', YES_NO, yn(state.chemo))}
        ${state.chemo ? `
          <div class="sub">
            <span class="label small">Rythme de la chimiothérapie</span>
            ${radioGroup('chemoRhythm', CHEMO_RHYTHMS, state.chemoRhythm)}
            ${state.chemoRhythm === 'autre' ? `
              <input type="text" data-bind="chemoRhythmOther" value="${esc(state.chemoRhythmOther)}" placeholder="Préciser le rythme" aria-label="Préciser le rythme">` : ''}
          </div>` : ''}
      </fieldset>

      <fieldset class="field">
        <legend class="label">Pause dans le traitement</legend>
        ${radioGroup('pause', YES_NO, yn(state.pause))}
        ${state.pause ? `
          <div class="sub">
            <textarea data-bind="pauseDetails" rows="3" placeholder="Détails de la pause (dates, durée, motif…)" aria-label="Détails de la pause">${esc(state.pauseDetails)}</textarea>
          </div>` : ''}
      </fieldset>

      <fieldset class="field">
        <legend class="label">DAI (défibrillateur automatique implantable)</legend>
        ${radioGroup('dai', YES_NO, yn(state.dai))}
      </fieldset>

      <p id="form-errors" class="errors" role="alert"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-action="home">Changer de localisation</button>
        <button type="submit" class="btn primary">Valider la fiche</button>
      </div>
    </form>`;
}

function validateForm() {
  const errs = [];
  if (state.loc === 'autre' && !state.locOther.trim()) errs.push('Préciser la localisation.');
  if (!state.rtType) errs.push('Choisir le type de radiothérapie.');
  const n = Number(state.totalSessions);
  if (!Number.isInteger(n) || n < 1 || n > 100) errs.push('Saisir un nombre total de séances (entier entre 1 et 100).');
  if (state.chemo === null) errs.push('Indiquer s’il y a une chimiothérapie concomitante.');
  if (state.chemo && !state.chemoRhythm) errs.push('Choisir le rythme de la chimiothérapie.');
  if (state.chemo && state.chemoRhythm === 'autre' && !state.chemoRhythmOther.trim()) errs.push('Préciser le rythme de la chimiothérapie.');
  if (state.pause === null) errs.push('Indiquer s’il y a une pause dans le traitement.');
  if (state.dai === null) errs.push('Indiquer si le patient est porteur d’un DAI.');
  return errs;
}

/* ---------- 3. Options spécifiques à la localisation ---------- */

function checkboxList(group, items, values) {
  return `<div class="checks">${items.map((o) => `
    <label class="check ${values[o.id] ? 'checked' : ''}">
      <input type="checkbox" data-group="${group}" value="${o.id}" ${values[o.id] ? 'checked' : ''}>
      <span>${esc(o.label)}${o.hint ? ` <em>(${esc(o.hint)})</em>` : ''}</span>
    </label>`).join('')}</div>`;
}

function renderOptions() {
  const loc = getLoc();
  const showAgents = state.chemo && loc.chemoAgents;
  app.innerHTML = `
    <form class="panel narrow" id="form-options" novalidate>
      <h1>${esc(locLabel())} <span class="muted">– options</span></h1>
      <p class="lead">${esc(rtTypeLabel())} · ${esc(state.totalSessions)} séance(s) · ${state.daysPerWeek} j/semaine${state.chemo ? ` · chimiothérapie ${esc(rhythmLabel())}` : ''}</p>

      ${loc.options.length ? `
        <fieldset class="field">
          <legend class="label">${esc(loc.optionsLabel || 'Sélection (choix multiples possibles)')}</legend>
          ${checkboxList('opts', loc.options, state.opts)}
        </fieldset>` : `
        <p class="note">Aucune option spécifique n’est encore définie pour cette localisation.
        Les examens, effets secondaires et consignes pourront être complétés manuellement sur l’écran du PPS.</p>`}

      ${loc.freeExams ? `
        <fieldset class="field">
          <legend class="label">Examens avant le début du traitement</legend>
          <div class="free-list">
            ${state.freeExams.map((e, i) => `
              <div class="free-row">
                <input type="text" data-free="${i}" value="${esc(e)}" placeholder="ex. : IRM, bilan dentaire…" aria-label="Examen ${i + 1}">
                <button type="button" class="icon-btn" data-action="del-free" data-i="${i}" title="Supprimer">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" class="btn ghost small" data-action="add-free">+ Ajouter un examen</button>
        </fieldset>` : ''}

      ${showAgents ? `
        <fieldset class="field">
          <legend class="label">Chimiothérapie concomitante (choix multiples possibles)</legend>
          ${checkboxList('agents', loc.chemoAgents, state.agents)}
        </fieldset>` : ''}

      <p id="form-errors" class="errors" role="alert"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-action="go" data-view="form">Retour</button>
        <button type="submit" class="btn primary">Valider et afficher le PPS</button>
      </div>
    </form>`;
}

function validateOptions() {
  const loc = getLoc();
  if (state.chemo && loc.chemoAgents && !loc.chemoAgents.some((a) => state.agents[a.id])) {
    return ['Choisir au moins un traitement de chimiothérapie concomitante.'];
  }
  return [];
}

/* ---------- 4. PPS ---------- */

function buildContent() {
  const loc = getLoc();
  const r = loc.build({
    rtType: state.rtType, chemo: state.chemo, opts: state.opts, agents: state.agents, freeExams: state.freeExams,
  });
  const exams = [...r.exams];
  if (state.dai) {
    exams.push('Contrôle du DAI avant radiothérapie', 'Contrôle du DAI après la première séance', 'Contrôle du DAI en fin de traitement');
  }
  return { ...r, exams };
}

function apptRows(content, sched) {
  const rows = [{ id: 'scanner', name: 'Scanner dosimétrique', placeholder: 'Service de radiothérapie' }];
  content.exams.forEach((e) => rows.push({ id: `exam-${e.replace(/\./g, '')}`, name: e }));
  state.extraAppts.forEach((a, i) => rows.push({ id: `extra-${i}`, name: a.name, extra: i }));
  rows.push({ id: 'start', name: 'Première séance de radiothérapie', placeholder: 'Service de radiothérapie', fixedDate: 'startDate' });
  if (state.chemo) {
    const agents = chemoAgentsLabel();
    rows.push({
      id: 'chemo',
      name: `Chimiothérapie concomitante${agents ? ` (${agents})` : ''} – ${rhythmLabel()}, à partir du 1er jour de radiothérapie`,
      derived: sched.hasDates ? `à partir du ${formatDate(sched.start)}` : 'J1 de la radiothérapie',
    });
    rows.push({
      id: 'blood',
      name: 'Prise de sang hebdomadaire, 48 h avant chaque chimiothérapie',
      derived: sched.firstBlood && sched.hasDates ? `1re le ${formatDate(sched.firstBlood)}` : '48 h avant J1',
      placeholder: 'Laboratoire',
    });
  }
  return rows;
}

function apptValue(id) {
  if (!state.appts[id]) state.appts[id] = { date: '', time: '', lieu: '' };
  return state.appts[id];
}

function scheduleParams() {
  const r = rhythm();
  return {
    totalSessions: Number(state.totalSessions),
    daysPerWeek: Number(state.daysPerWeek),
    bifract: state.rtType === 'bifract',
    startDate: apptValue('start').date,
    chemo: !!state.chemo,
    chemoInterval: r ? r.interval : null,
  };
}

function renderPps() {
  app.innerHTML = `
    <div class="pps-layout">
      <aside class="editor no-print" id="editor"></aside>
      <section class="preview-wrap">
        <div class="toolbar no-print">
          <button type="button" class="btn ghost" data-action="go" data-view="options">← Modifier les choix</button>
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-action="print">Imprimer</button>
          <button type="button" class="btn primary" data-action="pdf">Télécharger le PDF</button>
        </div>
        <div class="preview" id="preview"></div>
      </section>
    </div>`;
  renderEditor();
  renderDocument();
}

function renderEditor() {
  const content = buildContent();
  const sched = computeSchedule(scheduleParams());
  const rows = apptRows(content, sched);
  const ed = document.getElementById('editor');
  ed.innerHTML = `
    <h2>Patient</h2>
    <div class="grid2">
      <label>Nom<input data-path="patient.nom" value="${esc(state.patient.nom)}"></label>
      <label>Prénom<input data-path="patient.prenom" value="${esc(state.patient.prenom)}"></label>
      <label>Date de naissance<input type="date" data-path="patient.ddn" value="${esc(state.patient.ddn)}"></label>
      <label>Médecin référent<input data-path="medecin" value="${esc(state.medecin)}"></label>
    </div>
    <label>Établissement / service<input data-path="etablissement" value="${esc(state.etablissement)}"></label>

    <h2>Rendez-vous</h2>
    ${rows.map((r) => {
      const v = r.extra !== undefined ? state.extraAppts[r.extra] : apptValue(r.id);
      const path = r.extra !== undefined ? `extraAppts.${r.extra}` : `appts.${r.id}`;
      return `
      <div class="appt">
        <div class="appt-head">
          ${r.extra !== undefined
            ? `<input data-path="${path}.name" value="${esc(v.name)}" placeholder="Intitulé du rendez-vous" aria-label="Intitulé">
               <button type="button" class="icon-btn" data-action="del-appt" data-i="${r.extra}" title="Supprimer">✕</button>`
            : `<strong>${esc(r.name)}</strong>`}
        </div>
        ${r.derived ? `<p class="muted small">Date : ${esc(r.derived)}</p>` : `
        <div class="grid2">
          <label>Date<input type="date" data-path="${path}.date" value="${esc(v.date)}"></label>
          <label>Heure<input type="time" data-path="${path}.time" value="${esc(v.time)}"></label>
        </div>`}
        <label>Lieu<input data-path="${path}.lieu" value="${esc(v.lieu)}" placeholder="${esc(r.placeholder || '')}"></label>
      </div>`;
    }).join('')}
    <button type="button" class="btn ghost small" data-action="add-appt">+ Ajouter un rendez-vous avant traitement</button>
    ${content.curie ? `
    <div class="appt curie-appt">
      <div class="appt-head"><strong>Curiethérapie</strong></div>
      <div class="grid2">
        <label>Date<input type="date" data-path="appts.curie.date" value="${esc(apptValue('curie').date)}"></label>
        <label>Heure<input type="time" data-path="appts.curie.time" value="${esc(apptValue('curie').time)}"></label>
      </div>
      <label>Lieu<input data-path="appts.curie.lieu" value="${esc(apptValue('curie').lieu)}"></label>
    </div>` : ''}

    <h2>Effets secondaires complémentaires</h2>
    ${state.extraEffects.map((e, i) => `
      <div class="appt">
        <div class="grid2">
          <label>Type
            <select data-path="extraEffects.${i}.kind">
              <option value="acute" ${e.kind === 'acute' ? 'selected' : ''}>Aigu</option>
              <option value="late" ${e.kind === 'late' ? 'selected' : ''}>Tardif</option>
            </select>
          </label>
          <label>Effet<input data-path="extraEffects.${i}.effect" value="${esc(e.effect)}"></label>
        </div>
        <label>Explication<input data-path="extraEffects.${i}.explain" value="${esc(e.explain)}"></label>
        <button type="button" class="btn ghost small" data-action="del-effect" data-i="${i}">Supprimer</button>
      </div>`).join('')}
    <button type="button" class="btn ghost small" data-action="add-effect">+ Ajouter un effet secondaire</button>

    <h2>Conduite à tenir complémentaire</h2>
    <textarea data-path="extraConduct" rows="3" placeholder="Une consigne par ligne">${esc(state.extraConduct)}</textarea>`;
}

function setPath(path, value) {
  const keys = path.split('.');
  let obj = state;
  keys.slice(0, -1).forEach((k) => { obj = obj[k]; });
  obj[keys[keys.length - 1]] = value;
}

/* ---------- Document imprimable ---------- */

function apptCell(v, derived) {
  if (derived) return esc(derived);
  const d = parseISODate(v.date);
  if (!d) return '<span class="blank"></span>';
  return `${esc(formatDate(d, true))}${v.time ? ` à ${esc(v.time.replace(':', 'h'))}` : ''}`;
}

function scheduleHtml(sched) {
  const bifract = state.rtType === 'bifract';
  const cells = (w) => w.days.map((d) => {
    const marks = [];
    if (d.rt) {
      const label = d.rt.sessions === 2 ? `RT ×2` : 'RT';
      const nums = d.rt.first === d.rt.last ? `n°${d.rt.first}` : `n°${d.rt.first}-${d.rt.last}`;
      marks.push(`<span class="mk rt">${label}<small>${nums}</small></span>`);
    }
    if (d.chemo) marks.push('<span class="mk ct">Chimio</span>');
    if (d.blood) marks.push('<span class="mk ps">Prise de sang</span>');
    return `<td class="${d.weekend ? 'we' : ''}">
      ${sched.hasDates ? `<span class="dt">${formatShort(d.date)}</span>` : ''}
      ${marks.join('')}
    </td>`;
  }).join('');

  return `
    <table class="sched">
      <thead><tr><th></th>${[1, 2, 3, 4, 5, 6, 0].map((i) => `<th>${WEEKDAYS_SHORT[i]}</th>`).join('')}<th>Séances</th></tr></thead>
      <tbody>
        ${sched.weeks.map((w) => `<tr><th>${w.label}</th>${cells(w)}<td class="cnt">${w.count || '–'}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="legend">
      <span><i class="sw rt"></i>Radiothérapie${bifract ? ' (RT ×2 = 2 séances dans la journée)' : ''}</span>
      ${state.chemo ? '<span><i class="sw ct"></i>Chimiothérapie</span><span><i class="sw ps"></i>Prise de sang (48 h avant la chimiothérapie)</span>' : ''}
    </div>`;
}

function fxRows(kindLabel, keys, extra) {
  const items = keys.map((k) => fx(k)).concat(extra || []);
  return items.map((it, i) => `
    <tr>
      ${i === 0 ? `<th rowspan="${items.length}" class="kind">${kindLabel}</th>` : ''}
      <td class="fx">${esc(it.effect)}</td>
      <td>${esc(it.explain)}</td>
    </tr>`).join('');
}

function systemicTable(type, title, groups) {
  const list = groups.filter((g) => g.type === type);
  if (!list.length) return '';
  return `
      <h2>${title}</h2>
      <table class="fx-table ${type}">
        <thead><tr><th>Aigus / tardifs</th><th>Effet secondaire</th><th>En pratique</th></tr></thead>
        <tbody>
          ${list.map((g) => `
            <tr class="grp"><td colspan="3">${esc(g.name)}</td></tr>
            ${fxRows(g.acuteLabel || 'Aigus', g.acute)}
            ${fxRows('Tardifs', g.late)}`).join('')}
        </tbody>
      </table>`;
}

function renderDocument() {
  const content = buildContent();
  const params = scheduleParams();
  const sched = computeSchedule(params);
  const rows = apptRows(content, sched);
  const p = state.patient;
  const ddn = parseISODate(p.ddn);
  const extraAcute = state.extraEffects.filter((e) => e.kind === 'acute' && e.effect.trim());
  const extraLate = state.extraEffects.filter((e) => e.kind === 'late' && e.effect.trim());
  const conduct = content.conduct.concat(state.extraConduct.split('\n').map((s) => s.trim()).filter(Boolean));
  const hasRtFx = content.acute.length + content.late.length + extraAcute.length + extraLate.length > 0;
  const nDaysLabel = params.bifract
    ? `${params.daysPerWeek} jour(s) par semaine, 2 séances par jour`
    : `${params.daysPerWeek} jour(s) par semaine`;

  const header = (pageNo) => `
    <div class="doc-banner">
      <img src="${LOGO}" alt="HCL – Hôpital Lyon Sud">
      <span>Service de Radiothérapie</span>
    </div>
    <header class="doc-head">
      <div>
        <div class="doc-title">Programme Personnalisé de Soins – Radiothérapie</div>
        ${state.etablissement ? `<div class="doc-sub">${esc(state.etablissement)}</div>` : ''}
      </div>
      <div class="doc-patient">
        <div><b>${esc(p.nom.toUpperCase())} ${esc(p.prenom)}</b>${!p.nom && !p.prenom ? '<span class="blank wide"></span>' : ''}</div>
        <div>Né(e) le ${ddn ? esc(formatDate(ddn)) : '<span class="blank"></span>'}</div>
        <div class="muted">Page ${pageNo}/2</div>
      </div>
    </header>`;

  const page1 = `
    <div class="page"><div class="page-inner">
      ${header(1)}
      <div class="summary">
        <div><span>Localisation</span><b>${esc(locLabel())}</b></div>
        <div><span>Technique</span><b>${esc(rtTypeLabel())}</b></div>
        <div><span>Nombre de séances</span><b>${params.totalSessions}</b></div>
        <div><span>Rythme</span><b>${esc(nDaysLabel)}</b></div>
        <div><span>Chimiothérapie</span><b>${state.chemo ? `Oui – ${esc(rhythmLabel())}` : 'Non'}</b></div>
        <div><span>DAI</span><b>${state.dai ? 'Oui' : 'Non'}</b></div>
        ${state.medecin ? `<div><span>Médecin référent</span><b>${esc(state.medecin)}</b></div>` : ''}
      </div>

      <h2>Mes rendez-vous</h2>
      <table class="rdv">
        <thead><tr><th>Rendez-vous</th><th>Date</th><th>Lieu</th></tr></thead>
        <tbody>
          ${rows.map((r) => {
            const v = r.extra !== undefined ? state.extraAppts[r.extra] : apptValue(r.id);
            const cls = r.id === 'start' ? 'hl-rt' : (r.id === 'chemo' || r.id === 'blood') ? 'hl-ct' : '';
            return `<tr class="${cls}">
              <td>${esc(r.name || '')}</td>
              <td>${apptCell(v, r.derived)}</td>
              <td>${v.lieu ? esc(v.lieu) : '<span class="blank"></span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <h2>Mon plan de traitement</h2>
      <p class="plan-sum">
        <b>${params.totalSessions} séance(s)</b> de radiothérapie, ${esc(nDaysLabel)}
        – sur ${sched.treatmentWeeks} semaine(s)${sched.hasDates ? `, du ${esc(formatDate(sched.start))} au ${esc(formatDate(sched.lastDay))}` : ''}.
        ${state.chemo ? `<br>Chimiothérapie ${esc(rhythmLabel())}${chemoAgentsLabel() ? ` (${esc(chemoAgentsLabel())})` : ''}, débutant le premier jour de la radiothérapie.` : ''}
      </p>
      ${content.instructions.length ? `
      <div class="instructions">
        <b>Consignes pour le traitement</b>
        ${content.instructions.map((c) => `<p>${esc(c)}</p>`).join('')}
      </div>` : ''}
      ${scheduleHtml(sched)}
      ${content.curie ? `<p class="curie"><b>Curiethérapie :</b> ${apptCell(apptValue('curie'))}${apptValue('curie').lieu ? ` – ${esc(apptValue('curie').lieu)}` : ''}</p>` : ''}
      ${state.pause ? `<p class="pause"><b>Pause prévue dans le traitement :</b> ${esc(state.pauseDetails || 'modalités à préciser')}</p>` : ''}
      <p class="foot-note">Schéma indicatif : les dates peuvent être modifiées (jours fériés, maintenance des appareils, tolérance du traitement).</p>
    </div></div>`;

  const page2 = `
    <div class="page"><div class="page-inner">
      ${header(2)}
      <h2>Les effets secondaires possibles de la radiothérapie</h2>
      ${hasRtFx ? `
      <table class="fx-table">
        <thead><tr><th>Aigus / tardifs</th><th>Effet secondaire</th><th>En pratique</th></tr></thead>
        <tbody>
          ${fxRows('Aigus<small>pendant le traitement et quelques semaines après</small>', content.acute, extraAcute)}
          ${fxRows('Tardifs<small>plusieurs mois ou années après</small>', content.late, extraLate)}
        </tbody>
      </table>` : '<p class="blank-box">Effets secondaires expliqués lors de la consultation.</p>'}

      ${systemicTable('chimio', 'Les effets secondaires possibles de la chimiothérapie', content.systemic)}
      ${systemicTable('hormono', 'Les effets secondaires possibles de l’hormonothérapie', content.systemic)}

      <h2>Conduite à tenir</h2>
      <div class="conduct">
        ${conduct.length ? `<ul>${conduct.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        <p>Pour toute question ou en cas de symptôme inhabituel, n’hésitez pas à en parler à l’équipe de radiothérapie.</p>
      </div>

      <div class="sign">
        <div class="sign-box"><span>Date</span><b>${esc(formatDate(new Date()))}</b></div>
        <div class="sign-box big"><span>Signature du patient</span></div>
      </div>
    </div></div>`;

  document.getElementById('preview').innerHTML = page1 + page2;
  fitPages();
}

// Réduit la taille de police de chaque page jusqu'à ce que le contenu tienne sur une feuille A4.
function fitPages() {
  document.querySelectorAll('.page-inner').forEach((inner) => {
    let size = 13;
    inner.style.fontSize = `${size}px`;
    while (inner.scrollHeight > inner.clientHeight + 1 && size > 6) {
      size -= 0.25;
      inner.style.fontSize = `${size}px`;
    }
  });
}

async function exportPdf(btn) {
  if (!window.html2canvas || !window.jspdf) {
    window.print();
    return;
  }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Génération…';
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pages = document.querySelectorAll('#preview .page');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    }
    const who = [state.patient.nom, state.patient.prenom].filter(Boolean).join('_').replace(/\s+/g, '_');
    const today = new Date().toISOString().slice(0, 10);
    pdf.save(`PPS_${who || 'patient'}_${today}.pdf`);
  } catch (e) {
    console.error(e);
    window.print();
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ---------- événements ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'home') {
    state = newState();
    render();
  } else if (action === 'pick-loc') {
    state = newState();
    state.loc = el.dataset.loc;
    state.view = 'form';
    render();
  } else if (action === 'go') {
    if (!state.loc) return;
    state.view = el.dataset.view;
    render();
  } else if (action === 'print') {
    window.print();
  } else if (action === 'pdf') {
    exportPdf(el);
  } else if (action === 'add-appt') {
    state.extraAppts.push({ name: '', date: '', time: '', lieu: '' });
    renderEditor();
    renderDocument();
  } else if (action === 'del-appt') {
    state.extraAppts.splice(Number(el.dataset.i), 1);
    renderEditor();
    renderDocument();
  } else if (action === 'add-free') {
    state.freeExams.push('');
    renderOptions();
    document.querySelector(`[data-free="${state.freeExams.length - 1}"]`).focus();
  } else if (action === 'del-free') {
    state.freeExams.splice(Number(el.dataset.i), 1);
    if (!state.freeExams.length) state.freeExams.push('');
    renderOptions();
  } else if (action === 'add-effect') {
    state.extraEffects.push({ kind: 'acute', effect: '', explain: '' });
    renderEditor();
  } else if (action === 'del-effect') {
    state.extraEffects.splice(Number(el.dataset.i), 1);
    renderEditor();
    renderDocument();
  }
});

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.type === 'radio') {
    const v = t.value;
    if (['chemo', 'pause', 'dai'].includes(t.name)) state[t.name] = v === 'oui';
    else if (t.name === 'daysPerWeek') state.daysPerWeek = Number(v);
    else state[t.name] = v;
    renderForm();
  } else if (t.type === 'checkbox' && t.dataset.group) {
    state[t.dataset.group][t.value] = t.checked;
    t.closest('.check').classList.toggle('checked', t.checked);
  } else if (t.tagName === 'SELECT' && t.dataset.path) {
    setPath(t.dataset.path, t.value);
    renderDocument();
  }
});

app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.bind) {
    state[t.dataset.bind] = t.value;
  } else if (t.dataset.free !== undefined) {
    state.freeExams[Number(t.dataset.free)] = t.value;
  } else if (t.dataset.path) {
    setPath(t.dataset.path, t.value);
    renderDocument();
  }
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  const errs = e.target.id === 'form-main' ? validateForm() : validateOptions();
  const box = document.getElementById('form-errors');
  if (errs.length) {
    box.innerHTML = errs.map(esc).join('<br>');
    return;
  }
  state.view = e.target.id === 'form-main' ? 'options' : 'pps';
  render();
});

window.addEventListener('resize', () => { if (state.view === 'pps') fitPages(); });

render();

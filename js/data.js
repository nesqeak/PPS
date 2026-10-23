/*
 * Données médicales du PPS : localisations, options spécifiques,
 * examens pré-thérapeutiques, effets secondaires et conduites à tenir.
 *
 * Pour compléter une localisation, renseigner `options`, `chemoAgents`
 * (facultatif) et la fonction `build(s)` qui reçoit l'état du formulaire :
 *   s.rtType       'stereo' | 'hypo' | 'conv' | 'bifract'
 *   s.chemo        booléen (chimiothérapie concomitante)
 *   s.opts         { idOption: true/false }
 *   s.agents       { idAgent: true/false }
 * et renvoie { exams: [], acute: [], late: [], chemo: [], conduct: [] }.
 */

const RT_TYPES = [
  { id: 'stereo', label: 'Stéréotaxie' },
  { id: 'hypo', label: 'Hypo-fractionnement' },
  { id: 'conv', label: 'Fractionnement conventionnel' },
  { id: 'bifract', label: 'Traitement bi-fractionné', onlyFor: ['poumon', 'thyroide'] },
];

const CHEMO_RHYTHMS = [
  { id: 'quotidienne', label: 'Quotidienne', interval: 1 },
  { id: 'hebdo', label: 'Hebdomadaire', interval: 7 },
  { id: 'q2w', label: 'Q2W', long: 'toutes les 2 semaines (Q2W)', interval: 14 },
  { id: 'q3w', label: 'Q3W', long: 'toutes les 3 semaines (Q3W)', interval: 21 },
  { id: 'q4w', label: 'Q4W', long: 'toutes les 4 semaines (Q4W)', interval: 28 },
  { id: 'autre', label: 'Autre', interval: null },
];

// Jours de traitement (0 = dimanche ... 6 = samedi) selon le nombre de jours par semaine
const DAY_PATTERNS = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

// Effets secondaires : [libellé médical, explication en langage courant]
const FX = {
  // ORL / thyroïde
  xerostomie: ['Xérostomie', 'Sécheresse de la bouche, due à la diminution de la production de salive.'],
  mucite: ['Mucite', 'Inflammation de l’intérieur de la bouche et de la gorge : rougeurs, aphtes, douleurs, gêne pour manger.'],
  dysgueusie: ['Dysgueusie', 'Modification ou perte du goût des aliments.'],
  dysphagie: ['Dysphagie', 'Difficulté ou douleur pour avaler.'],
  denutrition: ['Risque de dénutrition (pouvant nécessiter la pose d’une sonde d’alimentation)',
    'Perte de poids liée aux difficultés pour manger. Une sonde d’alimentation peut parfois être nécessaire de façon temporaire.'],
  glaires: ['Glaires', 'Sécrétions épaisses et collantes dans la bouche et la gorge.'],
  dermite: ['Dermite', 'Rougeur de la peau dans la zone traitée, comme un coup de soleil, pouvant aller jusqu’à de petites plaies.'],
  alopecieNuque: ['Alopécie de la nuque', 'Chute des cheveux et des poils au niveau de la nuque (zone traitée), le plus souvent temporaire.'],
  dysphonie: ['Dysphonie', 'Modification de la voix : voix enrouée, cassée ou plus faible.'],
  toux: ['Toux', 'Toux, souvent sèche, liée à l’irritation de la gorge ou des bronches.'],
  conjonctivite: ['Conjonctivite', 'Irritation de l’œil : rougeur, picotements, larmoiement.'],
  nezSec: ['Nez sec', 'Sécheresse de l’intérieur du nez, avec parfois des croûtes.'],
  epistaxis: ['Épistaxis', 'Saignements de nez, en général peu abondants.'],
  hypothyroidie: ['Hypothyroïdie', 'Baisse du fonctionnement de la glande thyroïde (fatigue, frilosité, prise de poids). Elle se dépiste par une prise de sang et se traite par un comprimé.'],
  fluoro: ['Fragilité dentaire avec nécessité de fluoroprophylaxie', 'Les dents deviennent plus fragiles (caries) : il faudra appliquer du fluor, à vie, à l’aide de gouttières.'],
  xerodermie: ['Xérodermie', 'Sécheresse durable de la peau dans la zone traitée.'],
  dysgueusieTard: ['Dysgueusie', 'Le goût peut rester modifié de façon prolongée.'],
  xerostomieTard: ['Xérostomie', 'La sécheresse de la bouche peut persister de façon durable.'],
  osteoradionecrose: ['Ostéoradionécrose', 'Fragilisation de l’os de la mâchoire, qui peut s’abîmer, notamment après une extraction dentaire. Toujours signaler la radiothérapie à son dentiste.'],
  fatigueVoix: ['Fatigabilité de la voix', 'La voix se fatigue plus vite, notamment quand on parle longtemps.'],
  cataracte: ['Cataracte', 'Le cristallin de l’œil devient opaque, ce qui baisse la vue. Elle peut être opérée.'],
  secheresseNasale: ['Sécheresse nasale', 'La sécheresse du nez peut persister de façon durable.'],
  dysphagieTard: ['Dysphagie', 'Une gêne pour avaler peut persister de façon durable.'],
  dysphonieTard: ['Dysphonie', 'La voix peut rester modifiée (enrouée, plus faible) de façon durable.'],
  // Poumon
  touxPoumon: ['Toux', 'Toux, souvent sèche, liée à l’irritation des bronches.'],
  dyspnee: ['Dyspnée', 'Essoufflement, sensation de manquer d’air, surtout à l’effort.'],
  oesophagite: ['Œsophagite', 'Inflammation de l’œsophage : douleur ou brûlure en avalant, sensation de blocage des aliments.'],
  efr: ['Dégradation des EFR', 'Diminution de la capacité respiratoire (le « souffle »), mesurée par les explorations fonctionnelles respiratoires.'],
  pneumopathieRadique: ['Pneumopathie radique', 'Inflammation du poumon dans la zone traitée : toux, essoufflement, parfois fièvre. Elle peut survenir pendant ou dans les semaines qui suivent le traitement.'],
  hemoptysie: ['Hémoptysie', 'Crachats de sang.'],
  fractureCote: ['Fracture de côte', 'Une côte proche de la zone traitée peut se fragiliser et se fissurer, parfois sans choc.'],
  douleurParietale: ['Douleur pariétale', 'Douleur de la paroi du thorax (côtes, muscles) dans la zone traitée.'],
  // Chimiothérapie
  nausees: ['Nausées', 'Envie de vomir, prévenue et traitée par des médicaments.'],
  toxRenale: ['Toxicité rénale', 'Les reins peuvent être fatigués par le traitement : surveillance par prises de sang et bonne hydratation nécessaires.'],
  toxAuditive: ['Toxicité auditive (acouphènes et baisse de l’audition)', 'Bourdonnements ou sifflements dans les oreilles, baisse de l’audition.'],
  degradRenale: ['Dégradation de la fonction rénale', 'Diminution durable du fonctionnement des reins.'],
  ototoxicite: ['Ototoxicité', 'La baisse de l’audition ou les bourdonnements d’oreille peuvent persister.'],
  majorationDermite: ['Majoration de la dermite et de la mucite', 'Les réactions de la peau et de l’intérieur de la bouche peuvent être plus marquées.'],
  rash: ['Rash acnéiforme', 'Éruption de boutons ressemblant à de l’acné, surtout sur le visage, le cou et le haut du tronc.'],
  immuno: ['Effets variables (dysthyroïdie, colite, pneumopathie interstitielle, hépatite, …)',
    'Le système immunitaire, stimulé, peut s’attaquer à certains organes : thyroïde, intestin (diarrhée), poumons (toux, essoufflement), foie… Tout symptôme inhabituel doit être signalé.'],
};

const fx = (key) => ({ effect: FX[key][0], explain: FX[key][1] });

const CISPLATINE_FX = {
  acute: ['nausees', 'toxRenale', 'toxAuditive'],
  late: ['degradRenale', 'ototoxicite'],
};

const CONDUCT = {
  alimentation: 'En cas de difficultés à vous alimenter ou de perte de poids, prévenir le médecin.',
  cisplatine: 'Boire 2 L par jour. Prévenir en cas de nausées résistantes aux traitements.',
  pneumopathie: 'En cas de symptômes évocateurs de pneumopathie radique (grosse toux, essoufflement, fièvre) survenant dans le mois suivant la radiothérapie, contacter le service de radiothérapie ou de pneumologie en urgence. Si besoin, contacter le 15.',
};

const emptyBuild = () => ({ exams: [], acute: [], late: [], chemo: [], conduct: [] });

const LOCALISATIONS = [
  { id: 'crane', label: 'Crâne', options: [], build: emptyBuild },

  {
    id: 'orl',
    label: 'ORL',
    options: [
      { id: 'edente', label: 'Patient édenté' },
      { id: 'gastro', label: 'Gastrostomie prophylactique' },
      { id: 'picc', label: 'Pose de PICC' },
      { id: 'larynx', label: 'Traitement du larynx' },
      { id: 'bouche', label: 'Traitement de la cavité buccale ou de l’oropharynx' },
      { id: 'sinus', label: 'Traitement des sinus ou du nasopharynx' },
    ],
    chemoAgents: [
      { id: 'cisHebdo', label: 'Cisplatine hebdomadaire' },
      { id: 'cisQ3w', label: 'Cisplatine Q3W' },
      { id: 'cetuximab', label: 'Cetuximab' },
      { id: 'immuno', label: 'Immunothérapie' },
    ],
    build(s) {
      const o = s.opts;
      const a = s.chemo ? s.agents : {};
      const cis = a.cisHebdo || a.cisQ3w;
      const r = emptyBuild();

      if (!o.edente) r.exams.push('Bilan dentaire');
      if (o.gastro) r.exams.push('Gastrostomie prophylactique');
      if (cis) r.exams.push('Échographie cardiaque');
      if (o.picc) r.exams.push('Pose de PICC line');

      r.acute = ['xerostomie', 'mucite', 'dysgueusie', 'dysphagie', 'denutrition', 'glaires', 'dermite', 'alopecieNuque'];
      if (o.larynx) r.acute.push('dysphonie', 'toux');
      if (o.sinus) r.acute.push('conjonctivite', 'nezSec', 'epistaxis');

      r.late = ['hypothyroidie'];
      if (!o.edente) r.late.push('fluoro');
      r.late.push('xerodermie');
      if (o.bouche) r.late.push('dysgueusieTard', 'xerostomieTard', 'osteoradionecrose');
      if (o.larynx) r.late.push('fatigueVoix');
      if (o.sinus) r.late.push('cataracte', 'secheresseNasale');

      if (cis) r.chemo.push({ name: 'Cisplatine', ...CISPLATINE_FX });
      if (a.cetuximab) r.chemo.push({ name: 'Cetuximab', acute: ['majorationDermite', 'rash'], late: [] });
      if (a.immuno) r.chemo.push({ name: 'Immunothérapie', acute: ['immuno'], late: [] });

      r.conduct.push(CONDUCT.alimentation);
      if (cis) r.conduct.push(CONDUCT.cisplatine);
      return r;
    },
  },

  {
    id: 'thyroide',
    label: 'Thyroïde',
    options: [
      { id: 'gastro', label: 'Gastrostomie prophylactique' },
      { id: 'picc', label: 'Pose de PICC' },
    ],
    build(s) {
      const o = s.opts;
      const r = emptyBuild();
      if (o.gastro) r.exams.push('Gastrostomie prophylactique');
      if (o.picc) r.exams.push('Pose de PICC line');

      r.acute = ['toux', 'dysphagie', 'denutrition', 'glaires', 'dermite', 'dysphonie'];
      r.late = ['dysphagieTard', 'dysphonieTard'];

      if (s.chemo) r.chemo.push({ name: 'Chimiothérapie', ...CISPLATINE_FX });

      r.conduct.push(CONDUCT.alimentation);
      if (s.chemo) r.conduct.push(CONDUCT.cisplatine);
      return r;
    },
  },

  { id: 'oesophage', label: 'Œsophage', options: [], build: emptyBuild },

  {
    id: 'poumon',
    label: 'Poumon',
    options: [
      { id: 'mediastin', label: 'Traitement du médiastin' },
      { id: 'efr', label: 'EFR à faire' },
      { id: 'ultracentrale', label: 'Tumeur ultra-centrale', hint: 'stéréotaxie' },
      { id: 'parietal', label: 'Contact pariétal', hint: 'stéréotaxie' },
    ],
    build(s) {
      const o = s.opts;
      const stereo = s.rtType === 'stereo';
      const r = emptyBuild();
      if (o.efr) r.exams.push('EFR (explorations fonctionnelles respiratoires)');

      r.acute = ['touxPoumon', 'dyspnee'];
      if (o.mediastin) r.acute.push('oesophagite');
      r.late = ['efr'];

      if (stereo) {
        r.acute.push('pneumopathieRadique');
        if (o.ultracentrale) r.acute.push('hemoptysie');
        if (o.parietal) r.late.push('fractureCote', 'douleurParietale');
        r.conduct.push(CONDUCT.pneumopathie);
      }
      return r;
    },
  },

  { id: 'foie', label: 'Foie', options: [], build: emptyBuild },
  { id: 'pancreas', label: 'Pancréas', options: [], build: emptyBuild },
  { id: 'rectum', label: 'Rectum', options: [], build: emptyBuild },
  { id: 'prostate', label: 'Prostate', options: [], build: emptyBuild },
  { id: 'col', label: 'Col de l’utérus', options: [], build: emptyBuild },
  { id: 'endometre', label: 'Endomètre', options: [], build: emptyBuild },
  { id: 'autre', label: 'Autre', options: [], build: emptyBuild },
];

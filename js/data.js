/*
 * Données médicales du PPS : localisations, options spécifiques,
 * examens pré-thérapeutiques, effets secondaires et conduites à tenir.
 *
 * Pour compléter une localisation, renseigner `options`, `chemoAgents`
 * (facultatif ; options : chemoAgentsWhen, chemoAgentsExclusive, chemoAgentsOptional,
 * cycleDays par molécule) et la fonction `build(s)` qui reçoit l'état du formulaire :
 *   s.rtType       'stereo' | 'hypo' | 'conv' | 'bifract'
 *   s.chemo        booléen (chimiothérapie concomitante)
 *   s.opts         { idOption: true/false }
 *   s.agents       { idAgent: true/false }
 *   s.freeExams    examens saisis librement (localisation « Autre »)
 * et renvoie l'objet décrit au-dessus de `emptyBuild`.
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
  // Crâne
  htic: ['HTIC (hypertension intracrânienne)', 'Augmentation de la pression à l’intérieur du crâne : maux de tête, nausées ou vomissements, surtout le matin.'],
  alopecie: ['Alopécie', 'Chute des cheveux dans la zone traitée, le plus souvent temporaire.'],
  asthenie: ['Asthénie', 'Fatigue, qui peut s’accentuer au fil des séances.'],
  aggravationNeuro: ['Aggravation des signes neurologiques', 'Les symptômes présents avant le traitement (troubles de la parole, de la marche, de la mémoire…) peuvent s’aggraver temporairement.'],
  asthenieTard: ['Asthénie', 'La fatigue peut persister plusieurs mois après la fin du traitement.'],
  alopecieTard: ['Alopécie', 'Les cheveux peuvent repousser moins denses, voire ne pas repousser dans certaines zones.'],
  lymphopenie: ['Lymphopénie', 'Baisse de certains globules blancs (lymphocytes), qui augmente le risque d’infection. Elle est surveillée par prise de sang.'],
  // Sein
  oedemeSein: ['Œdème du sein', 'Le sein peut gonfler, devenir plus lourd et plus sensible.'],
  fibrose: ['Fibrose', 'Le sein peut devenir plus ferme, plus dur, et parfois diminuer de volume.'],
  hyperpigmentation: ['Hyperpigmentation', 'La peau de la zone traitée peut rester plus foncée.'],
  lymphoedeme: ['Lymphœdème', 'Gonflement du bras du côté traité, lié à une moins bonne circulation de la lymphe. Éviter les blessures, piqûres et prises de tension de ce côté.'],
  hyperplasieEndometre: ['Hyperplasie endométriale', 'Épaississement de la muqueuse de l’utérus : signaler tout saignement vaginal.'],
  thrombose: ['Risque de thrombose', 'Formation d’un caillot dans une veine (phlébite) : signaler une douleur ou un gonflement du mollet, ou un essoufflement brutal.'],
  bouffees: ['Bouffées de chaleur', 'Sensations soudaines de chaleur, avec rougeur et transpiration.'],
  priseDePoids: ['Prise de poids', 'Tendance à prendre du poids : une alimentation équilibrée et une activité physique régulière sont conseillées.'],
  douleursArticulaires: ['Douleurs articulaires', 'Douleurs et raideurs des articulations, souvent plus marquées le matin.'],
  fragiliteOsseuse: ['Fragilité osseuse', 'Les os deviennent plus fragiles (ostéoporose) : une surveillance par ostéodensitométrie peut être proposée.'],
  // Digestif
  denutritionSimple: ['Risque de dénutrition', 'Perte de poids liée aux difficultés pour manger.'],
  douleursAbdo: ['Douleurs abdominales', 'Douleurs ou crampes dans le ventre.'],
  rild: ['RILD (atteinte hépatique radio-induite)', 'Atteinte du foie liée aux rayons, pouvant survenir dans les semaines ou mois suivant le traitement (fatigue, ventre gonflé, jaunisse). Surveillance par prise de sang.'],
  degradHepatique: ['Dégradation de la fonction hépatique', 'Diminution durable du fonctionnement du foie, surveillée par prise de sang.'],
  diarrhee: ['Diarrhée', 'Selles plus fréquentes et plus liquides.'],
  diarrheeTard: ['Diarrhée', 'Les selles peuvent rester plus fréquentes ou plus molles de façon durable.'],
  bilanHepatique: ['Altération du bilan hépatique', 'Anomalies des analyses du foie sur la prise de sang, surveillées pendant le traitement.'],
  // Pelvis
  cystite: ['Cystite', 'Irritation de la vessie : envies fréquentes d’uriner, brûlures en urinant.'],
  cystiteTard: ['Cystite', 'Des troubles urinaires (envies fréquentes, brûlures, parfois sang dans les urines) peuvent persister ou apparaître à distance.'],
  dermiteSevere: ['Dermite pouvant être sévère', 'Rougeur de la peau du pli des fesses et de la région anale, comme une brûlure, pouvant être intense avec des plaies. Des soins locaux seront prescrits.'],
  alopecieLocale: ['Alopécie locale', 'Chute des poils dans la zone traitée.'],
  alopecieLocaleTard: ['Alopécie locale', 'Les poils de la zone traitée peuvent ne pas repousser.'],
  secheresseVaginale: ['Sécheresse vaginale', 'Sécheresse du vagin pouvant rendre les rapports sexuels inconfortables ; des gels lubrifiants peuvent aider.'],
  synechies: ['Synéchies vaginales', 'Les parois du vagin peuvent se coller ou se rétrécir : l’utilisation de dilatateurs vaginaux est conseillée.'],
  anite: ['Anite', 'Inflammation de l’anus : brûlures, démangeaisons, gêne pour aller à la selle.'],
  anitetard: ['Anite', 'Une gêne ou une irritation de l’anus peut persister.'],
  rectite: ['Rectite', 'Inflammation du rectum : envies fréquentes ou pressantes d’aller à la selle, glaires, parfois saignements.'],
  rectiteTard: ['Rectite', 'Des troubles du rectum (saignements, envies pressantes) peuvent apparaître à distance.'],
  dysfonctionErectile: ['Dysfonction érectile', 'Difficultés à obtenir ou à maintenir une érection, pouvant apparaître progressivement. Des traitements existent.'],
  risqueCV: ['Augmentation du risque cardiovasculaire', 'Le risque de maladies du cœur et des vaisseaux augmente : surveillance de la tension, du cholestérol et du poids.'],
  muciteVaginale: ['Mucite vaginale', 'Inflammation de l’intérieur du vagin : irritation, brûlures, pertes.'],
  menopause: ['Ménopause induite', 'Arrêt du fonctionnement des ovaires : arrêt des règles, bouffées de chaleur, sécheresse vaginale.'],
  malabsorption: ['Malabsorption', 'L’intestin peut moins bien absorber certains aliments ou vitamines, ce qui peut entraîner diarrhée et carences.'],
  fauxBesoins: ['Faux besoins', 'Envies pressantes d’aller à la selle sans résultat, alors que le rectum est vide.'],
  muciteXeloda: ['Mucite', 'Inflammation de l’intérieur de la bouche : rougeurs, aphtes, douleurs.'],
  mainPied: ['Syndrome main-pied', 'Rougeur, gonflement, sécheresse ou douleur de la paume des mains et de la plante des pieds. Hydrater la peau et prévenir le médecin si cela devient gênant.'],
  troublesDigestifs: ['Troubles digestifs', 'Selles irrégulières, ballonnements ou envies pressantes pouvant persister.'],
};

const fx = (key) => ({ effect: FX[key][0], explain: FX[key][1] });

const CISPLATINE_FX = {
  acute: ['nausees', 'toxRenale', 'toxAuditive'],
  late: ['degradRenale', 'ototoxicite'],
};
const IMMUNO_FX = { acute: ['immuno'], late: [] };
const XELODA_FX = { acute: ['nausees', 'diarrhee', 'bilanHepatique', 'muciteXeloda', 'mainPied'], late: [] };

const CONDUCT = {
  alimentation: 'En cas de difficultés à vous alimenter ou de perte de poids, prévenir le médecin.',
  cisplatine: 'Boire 2 L par jour. Prévenir en cas de nausées résistantes aux traitements.',
  cisplatinePelvis: 'Boire 2 L par jour. Prévenir en cas de nausées ou de diarrhées résistantes aux traitements.',
  pneumopathie: 'En cas de symptômes évocateurs de pneumopathie radique (grosse toux, essoufflement, fièvre) survenant dans le mois suivant la radiothérapie, contacter le service de radiothérapie ou de pneumologie en urgence. Si besoin, contacter le 15.',
  neuro: 'En cas de céphalées résistant au traitement ou d’aggravation des symptômes neurologiques, prévenir le médecin.',
  urines: 'En cas de difficultés à uriner, prévenir le médecin.',
};

// Consignes affichées dans un encart au-dessus du schéma de traitement
const INSTRUCTIONS = {
  temodal: 'Le Temodal doit être pris 1 h avant chaque séance de radiothérapie, au moins 1 heure avant un repas ou au moins 2 heures après. En l’absence de séance, il doit être pris à heure fixe. Le Zophren doit être pris 30 minutes avant le Temodal.',
  xeloda: 'Le Xeloda doit être pris uniquement les jours de séance de radiothérapie. Il doit être pris matin et soir, à 12 heures d’intervalle, dans les 30 minutes suivant un repas.',
  preparation: 'Avant le scanner dosimétrique et chaque séance de traitement : aller à la selle et vider la vessie 30 minutes avant le traitement, puis boire 2 grands verres d’eau et ne plus uriner avant la séance.',
  preparationStereo: 'Avant le scanner dosimétrique et chaque séance de traitement : faire un Microlax et vider la vessie 30 minutes avant le traitement, puis boire 2 grands verres d’eau et ne plus uriner avant la séance.',
};

/*
 * Résultat de build(s) :
 *   exams         examens avant traitement (libellés)
 *   acute, late   clés FX des effets de la radiothérapie
 *   systemic      [{ type: 'chimio'|'hormono', name, acute: [], late: [], acuteLabel? }]
 *   conduct       consignes « conduite à tenir »
 *   instructions  encart de consignes au-dessus du schéma
 *   curie         true → ligne « curiethérapie » après le schéma
 */
const emptyBuild = () => ({ exams: [], acute: [], late: [], systemic: [], conduct: [], instructions: [], curie: false });

const PICC = { id: 'picc', label: 'Pose de PICC' };
const IRM = { id: 'irm', label: 'IRM' };
const XELODA = { id: 'xeloda', label: 'Xeloda' };

// Col de l'utérus et endomètre : même structure, effets aigus différents
function gynecoLoc(id, label, acute) {
  return {
    id,
    label,
    options: [PICC, { id: 'curie', label: 'Curiethérapie' }],
    chemoAgents: [
      { id: 'cisHebdo', label: 'Cisplatine hebdomadaire' },
      { id: 'immuno', label: 'Immunothérapie' },
    ],
    build(s) {
      const o = s.opts;
      const a = s.chemo ? s.agents : {};
      const r = emptyBuild();
      if (o.picc) r.exams.push('Pose de PICC line');
      r.curie = !!o.curie;
      r.acute = acute;
      r.late = ['alopecieLocaleTard', 'synechies', 'menopause', 'malabsorption', 'troublesDigestifs'];
      if (a.cisHebdo) r.systemic.push({ type: 'chimio', name: 'Cisplatine', ...CISPLATINE_FX });
      if (a.immuno) r.systemic.push({ type: 'chimio', name: 'Immunothérapie', ...IMMUNO_FX });
      r.conduct.push(CONDUCT.alimentation);
      if (a.cisHebdo) r.conduct.push(CONDUCT.cisplatinePelvis);
      r.instructions.push(INSTRUCTIONS.preparation);
      return r;
    },
  };
}

const LOCALISATIONS = [
  {
    id: 'crane',
    label: 'Crâne',
    // Temodal quotidien : 7 jours sur 7 entre la 1re et la dernière séance
    dailyChemoEveryDay: true,
    options: [IRM],
    build(s) {
      const r = emptyBuild();
      if (s.opts.irm) r.exams.push('IRM');
      r.acute = ['htic', 'alopecie', 'asthenie', 'aggravationNeuro'];
      r.late = ['asthenieTard', 'alopecieTard'];
      if (s.chemo) {
        r.systemic.push({ type: 'chimio', name: 'Temodal', acute: ['nausees', 'lymphopenie'], late: [] });
        r.instructions.push(INSTRUCTIONS.temodal);
      }
      r.conduct.push(CONDUCT.neuro);
      return r;
    },
  },

  {
    id: 'orl',
    label: 'ORL',
    options: [
      { id: 'edente', label: 'Patient édenté' },
      { id: 'gastro', label: 'Gastrostomie prophylactique' },
      PICC,
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

      if (cis) r.systemic.push({ type: 'chimio', name: 'Cisplatine', ...CISPLATINE_FX });
      if (a.cetuximab) r.systemic.push({ type: 'chimio', name: 'Cetuximab', acute: ['majorationDermite', 'rash'], late: [] });
      if (a.immuno) r.systemic.push({ type: 'chimio', name: 'Immunothérapie', ...IMMUNO_FX });

      r.conduct.push(CONDUCT.alimentation);
      if (cis) r.conduct.push(CONDUCT.cisplatine);
      return r;
    },
  },

  {
    id: 'thyroide',
    label: 'Thyroïde',
    options: [{ id: 'gastro', label: 'Gastrostomie prophylactique' }, PICC],
    build(s) {
      const o = s.opts;
      const r = emptyBuild();
      if (o.gastro) r.exams.push('Gastrostomie prophylactique');
      if (o.picc) r.exams.push('Pose de PICC line');

      r.acute = ['toux', 'dysphagie', 'denutrition', 'glaires', 'dermite', 'dysphonie'];
      r.late = ['dysphagieTard', 'dysphonieTard'];

      if (s.chemo) r.systemic.push({ type: 'chimio', name: 'Chimiothérapie', ...CISPLATINE_FX });

      r.conduct.push(CONDUCT.alimentation);
      if (s.chemo) r.conduct.push(CONDUCT.cisplatine);
      return r;
    },
  },

  {
    id: 'sein',
    label: 'Sein',
    options: [
      { id: 'tamoxifene', label: 'Hormonothérapie par Tamoxifène' },
      { id: 'antiAromatase', label: 'Hormonothérapie par anti-aromatase' },
      { id: 'susClav', label: 'Traitement sus-claviculaire' },
      { id: 'axillaire', label: 'Traitement axillaire' },
    ],
    build(s) {
      const o = s.opts;
      const r = emptyBuild();
      r.acute = ['dermite', 'oedemeSein'];
      if (o.susClav) r.acute.push('dysphagie');
      r.late = ['fibrose', 'hyperpigmentation'];
      if (o.axillaire) r.late.push('lymphoedeme');
      const during = 'Pendant l’hormonothérapie';
      if (o.tamoxifene) {
        r.systemic.push({ type: 'hormono', name: 'Tamoxifène', acute: ['hyperplasieEndometre', 'thrombose'], late: [], acuteLabel: during });
      }
      if (o.antiAromatase) {
        r.systemic.push({ type: 'hormono', name: 'Anti-aromatase', acute: ['bouffees', 'priseDePoids', 'douleursArticulaires', 'fragiliteOsseuse'], late: [], acuteLabel: during });
      }
      return r;
    },
  },

  {
    id: 'oesophage',
    label: 'Œsophage',
    options: [],
    build() {
      const r = emptyBuild();
      r.acute = ['touxPoumon', 'dyspnee', 'dysphagie', 'denutritionSimple'];
      r.late = ['dysphagieTard'];
      r.conduct.push(CONDUCT.alimentation);
      return r;
    },
  },

  {
    id: 'poumon',
    label: 'Poumon',
    options: [
      { id: 'mediastin', label: 'Traitement du médiastin' },
      { id: 'efr', label: 'EFR à faire' },
      { id: 'ultracentrale', label: 'Tumeur ultra-centrale', hint: 'stéréotaxie' },
      { id: 'parietal', label: 'Contact pariétal', hint: 'stéréotaxie' },
    ],
    // Protocole de chimiothérapie, proposé seulement pour un rythme Q3W ; sans choix = J1 tous les 21 jours
    chemoAgentsWhen: (s) => s.chemoRhythm === 'q3w',
    chemoAgentsExclusive: true,
    chemoAgentsOptional: true,
    chemoAgents: [
      { id: 'platPemetrexed', label: 'Platine Pemetrexed', cycleDays: [0] },
      { id: 'platNavelbine', label: 'Platine Navelbine', cycleDays: [0, 7] },
      { id: 'platEtoposide', label: 'Platine Etoposide', cycleDays: [0, 1, 2] },
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

  {
    id: 'foie',
    label: 'Foie',
    options: [{ id: 'fiduciaires', label: 'Pose de fiduciaires' }],
    build(s) {
      const r = emptyBuild();
      if (s.opts.fiduciaires) r.exams.push('Pose de fiduciaires');
      r.acute = ['nausees', 'douleursAbdo'];
      if (s.rtType === 'stereo') r.acute.push('rild');
      r.late = ['degradHepatique'];
      return r;
    },
  },

  {
    id: 'pancreas',
    label: 'Pancréas',
    options: [IRM, XELODA],
    build(s) {
      const r = emptyBuild();
      if (s.opts.irm) r.exams.push('IRM');
      r.acute = ['nausees', 'diarrhee', 'douleursAbdo'];
      r.late = ['diarrheeTard'];
      if (s.opts.xeloda) {
        r.systemic.push({ type: 'chimio', name: 'Xeloda', ...XELODA_FX });
        r.instructions.push(INSTRUCTIONS.xeloda);
      }
      return r;
    },
  },

  {
    id: 'rectum',
    label: 'Rectum',
    options: [IRM],
    build(s) {
      const r = emptyBuild();
      if (s.opts.irm) r.exams.push('IRM');
      r.acute = ['diarrhee', 'cystite', 'rectite', 'fauxBesoins'];
      r.late = ['diarrheeTard'];
      if (s.chemo) {
        r.systemic.push({ type: 'chimio', name: 'Xeloda', ...XELODA_FX });
        r.instructions.push(INSTRUCTIONS.xeloda);
      }
      return r;
    },
  },

  {
    id: 'canalAnal',
    label: 'Canal anal',
    options: [IRM, XELODA, { id: 'femme', label: 'Femme' }],
    build(s) {
      const o = s.opts;
      const r = emptyBuild();
      if (o.irm) r.exams.push('IRM');
      r.acute = ['diarrhee', 'cystite', 'dermiteSevere', 'rectite', 'fauxBesoins'];
      r.late = ['diarrheeTard', 'alopecieLocaleTard'];
      if (o.femme) r.late.push('secheresseVaginale', 'synechies');
      if (o.xeloda) {
        r.systemic.push({ type: 'chimio', name: 'Xeloda', ...XELODA_FX });
      } else if (s.chemo) {
        r.systemic.push({ type: 'chimio', name: 'Chimiothérapie', acute: ['nausees', 'diarrhee', 'bilanHepatique'], late: [] });
      }
      if (o.xeloda) r.instructions.push(INSTRUCTIONS.xeloda);
      return r;
    },
  },

  {
    id: 'prostate',
    label: 'Prostate',
    options: [
      { id: 'hormono', label: 'Hormonothérapie' },
      IRM,
      { id: 'grains', label: 'Pose de grains d’or' },
    ],
    build(s) {
      const o = s.opts;
      const r = emptyBuild();
      if (o.irm) r.exams.push('IRM');
      if (o.grains) r.exams.push('Pose de grains d’or');
      r.acute = ['cystite', 'anite', 'rectite', 'diarrhee', 'alopecieLocale'];
      r.late = ['cystiteTard', 'anitetard', 'rectiteTard', 'dysfonctionErectile'];
      if (o.hormono) {
        r.systemic.push({ type: 'hormono', name: 'Hormonothérapie', acute: ['asthenie', 'bouffees', 'priseDePoids', 'risqueCV'], late: [] });
      }
      r.conduct.push(CONDUCT.urines);
      r.instructions.push(s.rtType === 'stereo' ? INSTRUCTIONS.preparationStereo : INSTRUCTIONS.preparation);
      return r;
    },
  },

  gynecoLoc('col', 'Col de l’utérus',
    ['cystite', 'muciteVaginale', 'anite', 'rectite', 'diarrhee', 'alopecieLocale', 'dermite']),
  gynecoLoc('endometre', 'Endomètre',
    ['cystite', 'muciteVaginale', 'diarrhee', 'alopecieLocale', 'dermite']),

  {
    id: 'autre',
    label: 'Autre',
    optionsLabel: 'Localisation anatomique traitée (choix multiples possibles)',
    options: [
      { id: 'zCrane', label: 'Crâne', base: 'crane' },
      { id: 'zOrl', label: 'ORL', base: 'orl' },
      { id: 'zThorax', label: 'Thorax', base: 'poumon' },
      { id: 'zAbdomen', label: 'Abdomen', base: 'pancreas' },
      { id: 'zPelvis', label: 'Pelvis', base: 'rectum' },
    ],
    freeExams: true,
    // Effets de la radiothérapie repris des localisations de référence de chaque zone,
    // sans chimiothérapie ni hormonothérapie.
    build(s) {
      const r = emptyBuild();
      r.exams = (s.freeExams || []).map((e) => e.trim()).filter(Boolean);
      this.options.filter((z) => s.opts[z.id]).forEach((z) => {
        const ref = LOCALISATIONS.find((l) => l.id === z.base)
          .build({ rtType: s.rtType, chemo: false, opts: {}, agents: {} });
        // Dédoublonnage sur le libellé (ex. « Toux » existe en version ORL et poumon)
        const add = (list, k) => { if (!list.some((x) => FX[x][0] === FX[k][0])) list.push(k); };
        ref.acute.forEach((k) => add(r.acute, k));
        ref.late.forEach((k) => add(r.late, k));
      });
      return r;
    },
  },
];

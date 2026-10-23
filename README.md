# Éditeur de PPS – Radiothérapie

Application web (HTML/CSS/JavaScript, sans installation ni serveur) pour éditer le
Programme Personnalisé de Soins d’un patient traité par radiothérapie.

## Utilisation

Ouvrir `index.html` dans un navigateur (ou publier le dossier sur un serveur web / GitHub Pages).

1. Choisir la localisation tumorale.
2. Renseigner le type de radiothérapie, le nombre de jours par semaine, le nombre de séances,
   la chimiothérapie concomitante (et son rythme), une éventuelle pause et le DAI → **Valider la fiche**.
3. Cocher les options spécifiques à la localisation → **Valider et afficher le PPS**.
4. Compléter l’identité du patient et les dates / lieux des rendez-vous dans le panneau de gauche :
   le document se met à jour en direct.
5. **Télécharger le PDF** (A4, 2 pages) ou **Imprimer**.

Aucune donnée n’est enregistrée ni envoyée : tout reste dans la page du navigateur.

## Organisation

| Fichier | Rôle |
|---|---|
| `js/data.js` | Localisations, options, examens, effets secondaires, conduites à tenir |
| `js/schedule.js` | Calcul du calendrier (séances, chimiothérapie, prises de sang) |
| `js/app.js` | Écrans, formulaire et rendu du document |
| `js/vendor/` | html2canvas 1.4.1 et jsPDF 2.5.1 (licence MIT), embarqués pour fonctionner hors ligne |

### Modifier une localisation

Chaque localisation est décrite dans `js/data.js` : liste `options` (menu de sélection),
`chemoAgents` (choix des molécules si chimiothérapie, facultatif) et fonction `build(s)` qui
renvoie les examens, les effets secondaires (radiothérapie, chimiothérapie, hormonothérapie),
la conduite à tenir, l’encart de consignes affiché au-dessus du schéma et la ligne de
curiethérapie. Les libellés et explications des effets secondaires sont regroupés dans `FX`.

La localisation « Autre » reprend les effets de la radiothérapie (hors chimiothérapie et
hormonothérapie) des localisations de référence de chaque zone cochée : Crâne → Crâne,
ORL → ORL, Thorax → Poumon, Abdomen → Pancréas, Pelvis → Rectum.

### Règles du calendrier

- Jours traités selon le nombre de jours par semaine : 1 = lun ; 2 = lun, jeu ; 3 = lun, mer, ven ;
  4 = lun, mar, jeu, ven ; 5 = lun → ven. La 1re séance est toujours le jour choisi.
- Bi-fractionné : 2 séances par jour.
- Chimiothérapie : débute le jour de la 1re séance, puis selon le rythme (quotidienne = chaque jour
  de radiothérapie ; hebdomadaire / Q2W / Q3W / Q4W = tous les 7 / 14 / 21 / 28 jours), jusqu’à la
  dernière séance. Prise de sang hebdomadaire, 48 h avant chaque échéance hebdomadaire.
- Les jours fériés ne sont pas exclus (mention « schéma indicatif » sur le document).

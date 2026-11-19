// Fabrique de « grilles » FICTIVES pour les tests : un onglet Excel décrit à la main,
// ligne par ligne, sans fichier Excel. Aucune donnée réelle.
//   grille('Valves', [
//     ['Etudes', 'ETUDE-A', 'ETUDE-B'],
//     ['Design', 'randomisé', null],
//   ])
export function grille(nom, lignes, fusions = []) {
  const largeur = Math.max(...lignes.map((l) => l.length));
  const cellules = lignes.map((l) => Array.from({ length: largeur }, (_, i) => (l[i] === undefined ? null : l[i])));
  return { nom, cellules, fusions };
}

// Une fusion décrite comme dans Excel : fusion('B2', 'C2').
export function fusion(debut, fin) {
  const lire = (a) => {
    const [, lettres, chiffres] = a.match(/^([A-Z]+)(\d+)$/);
    let c = 0;
    for (const x of lettres) c = c * 26 + (x.charCodeAt(0) - 64);
    return { l: Number(chiffres) - 1, c: c - 1 };
  };
  const d = lire(debut);
  const f = lire(fin);
  return { premiereLigne: d.l, premiereColonne: d.c, derniereLigne: f.l, derniereColonne: f.c };
}

// Un onglet « pôle » fictif complet et SAIN (aucune alerte de décalage attendue).
export function ongletSain(nom = 'Valves') {
  return grille(nom, [
    [null, 'note sans importance'],
    ['Etudes', 'ALPHA-HF', 'BETA (Labo X)'],
    ['Thématique', 'IC', 'Valves'],
    ['Design', 'randomisé 1:1', 'registre'],
    ['Critères d\'inclusion principaux', 'FEVG ≥ 40 %', 'IM ≥ 3+'],
    [null, 'âge ≥ 18 ans', null],
    ['Début d\'inclusion', { date: '2025-03-01' }, 'novembre 2025'],
    ['Investigateur Principal', 'Jean TESTEUR', 'Dr DURAND Paul'],
    ['ARC n°1', 'Alice FICTIVE 91234', 'Bob EXEMPLE'],
    ['ARC back-up', 'Bob EXEMPLE / Alice FICTIVE', null],
    ['Faire apparaître dans e-Cardioscope (1=oui; 0=non)', 1, 0],
    ['Filtre âge', '18-80', null],
    ['Filtre FEVG', '≥ 40', null],
    ['Tag InnovaCoeur', 'Hypertension artérielle', null],
    ['Faire apparaître dans InnovaCoeur (1=oui; 0=non)', 1, 0],
    ['Phrase', 'Une phrase patient fictive.', null],
    ['Filtre âge', '18-80', null],
  ]);
}

// L'annuaire fictif correspondant.
export function annuaireFictif() {
  return grille('Coordonnées des ARC', [
    [null, null, 'DECT', 'mail'],
    ['Pôle fictif'],
    ['Alice', 'FICTIVE', '91234', 'alice.fictive@chu-nantes.fr'],
    ['Bob', 'EXEMPLE', '95678', 'bob.exemple@chu-nantes.fr'],
  ]);
}

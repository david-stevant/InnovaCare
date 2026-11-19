// Tests de la lecture par libellés (src/lecture-ancien.js) et des contrôles (src/controles.js),
// sur des onglets FICTIFS fabriqués à la main (tests/fabrique.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerInnovaCare, correspondances, parametres } from './charger.js';
import { grille, fusion, ongletSain, annuaireFictif } from './fabrique.js';

const IC = chargerInnovaCare();
const CORR = correspondances();
const PARAM = parametres();
const lire = (grilles) => IC.lectureAncien.lireAncienExcel(grilles, CORR);
const controler = (grilles) => IC.controles.controler(lire(grilles), PARAM, CORR);
const types = (rapport) => rapport.alertes.map((a) => a.type);

test('lecture : une fiche par colonne, valeurs rangées par libellé', () => {
  const lecture = lire([ongletSain(), annuaireFictif()]);
  const [alpha, beta] = IC.lectureAncien.toutesLesEtudes(lecture);
  assert.equal(alpha.nomBrut, 'ALPHA-HF');
  assert.equal(beta.colonne, 'C');
  assert.equal(lecture.onglets[0].ligneEntete, 2);
  // Une ligne sans libellé prolonge le libellé précédent.
  assert.deepEqual(alpha.champs.inclusion.map((v) => v.valeur), ['FEVG ≥ 40 %', 'âge ≥ 18 ans']);
  assert.equal(alpha.champs.inclusion[1].adresse, 'B6');
  // Les deux « Filtre âge » sont distingués selon la section (avant / après « Tag InnovaCoeur »).
  assert.equal(alpha.champs.filtre_age[0].adresse, 'B12');
  assert.equal(alpha.champs.patient_filtre_age[0].adresse, 'B17');
  assert.equal(lecture.annuaire.length, 2);
  assert.equal(lecture.annuaire[0].poleAncien, 'Pôle fictif');
});

test('lecture : en-tête en ligne 1, libellé inconnu, ligne sans libellé après le nom (titre)', () => {
  const lecture = lire([grille('Hémodynamique', [
    ['Etudes', 'GAMMA'],
    [null, 'Titre complet fictif'],
    ['Libellé inventé', 'valeur orpheline'],
    ['Design', 'ouvert'],
  ])]);
  const onglet = lecture.onglets[0];
  assert.equal(onglet.ligneEntete, 1);
  assert.equal(onglet.etudes[0].champs.titre[0].valeur, 'Titre complet fictif');
  assert.deepEqual(onglet.libellesInconnus.map((l) => l.adresse), ['A3']);
  assert.equal(onglet.etudes[0].horsFiche[0].adresse, 'B3');
  assert.ok(onglet.champsPresents.includes('design'));
  assert.ok(!onglet.champsPresents.includes('synopsis'), 'les lignes absentes sont repérables');
});

test('lecture : colonnes fusionnées lues comme une seule étude ; colonne vide ignorée', () => {
  const lecture = lire([grille('HTA', [
    ['Etudes', 'DELTA', null, 'Colonne1'],
    ['Critères d\'inclusion principaux', 'critère 1', null],
    [null, 'critère 2a', 'critère 2b'],
  ], [fusion('B1', 'C1'), fusion('B2', 'C2')])]);
  const onglet = lecture.onglets[0];
  assert.equal(onglet.etudes.length, 1);
  assert.deepEqual(onglet.etudes[0].colonnes, ['B', 'C']);
  assert.deepEqual(onglet.etudes[0].champs.inclusion.map((v) => v.adresse), ['B2', 'B3', 'C3']);
  assert.deepEqual(onglet.colonnesVides.map((c) => c.valeur), ['Colonne1']);
});

test('lecture : blocs annexes ignorés (liste d\'ARC), jusqu\'à « Tag InnovaCoeur »', () => {
  const lecture = lire([grille('Valves', [
    ['Etudes', 'EPSILON'],
    ['ARC Valves'],
    ['Alice FICTIVE', 'valeur annexe'],
    ['Tag InnovaCoeur', 'Essoufflement'],
  ])]);
  const onglet = lecture.onglets[0];
  assert.deepEqual(onglet.libellesInconnus, [], 'les noms du bloc annexe ne sont pas des libellés inconnus');
  assert.deepEqual(onglet.horsFiche.map((h) => h.adresse), ['B3']);
  assert.equal(onglet.etudes[0].champs.tag_innovacoeur[0].valeur, 'Essoufflement');
});

test('lecture : onglets inconnus, ignorés et absents sont signalés', () => {
  const lecture = lire([grille('Onglet surprise', [['x']]), grille('Synthétique ++ pour mémo', [['Etudes', 'X']])]);
  assert.deepEqual(lecture.ongletsInconnus, ['Onglet surprise']);
  assert.equal(lecture.ongletsIgnores[0].nom, 'Synthétique ++ pour mémo');
  assert.ok(lecture.ongletsAbsents.includes('Valves'));
});

test('contrôles : un onglet sain ne lève aucune alerte rouge ni de décalage', () => {
  const rapport = controler([ongletSain(), annuaireFictif()]);
  assert.equal(rapport.nombreEtudes, 2);
  assert.equal(rapport.compteurs.corriger, 0, JSON.stringify(rapport.alertes.filter((a) => a.gravite === 'corriger')));
  assert.ok(!types(rapport).includes('indice_decalage'), JSON.stringify(rapport.alertes.filter((a) => a.type === 'indice_decalage')));
  assert.ok(!types(rapport).includes('arc_absent_annuaire'));
  assert.ok(!types(rapport).includes('filtre_illisible'));
  // Constats attendus pour information : DECT collé, borne non stricte (aucune ici), date en texte reconnue.
  assert.ok(types(rapport).includes('dect_colle'));
  assert.ok(!types(rapport).includes('date_texte'), '« novembre 2025 » est une date reconnue');
  assert.equal(rapport.statuts.find((s) => s.etude === 'ALPHA-HF').statut, 'ouvert');
});

test('contrôles : une colonne décalée (comme dans « suivi ou terminées ») est repérée', () => {
  const decalee = grille('Etudes en suivi ou terminées', [
    [null],
    ['Etudes', 'ZETA'],
    ['Critères d\'inclusion principaux', 'Étude randomisée en double aveugle'],
    [null, 300],
    ['Début d\'inclusion', 1],
    ['Investigateur Principal', 'Alice FICTIVE 91234'],
    ['Filtres e-Cardioscope', 0],
    ['Filtre âge', 'Bloc de branche fictif'],
  ]);
  const rapport = controler([decalee, annuaireFictif()]);
  const alerte = rapport.alertes.find((a) => a.type === 'colonne_decalee');
  assert.ok(alerte, JSON.stringify(rapport.alertes));
  assert.equal(alerte.etude, 'ZETA');
  assert.equal(rapport.statuts[0].statut, 'clos aux inclusions (suivi)');
});

test('contrôles : doublon entre onglets, avec les lignes qui diffèrent', () => {
  const a = grille('Valves', [['Etudes', 'OMEGA'], ['Filtre DFG', '> 20']]);
  const b = grille('Rythmologie', [['Etudes', 'OMEGA '], ['Filtre DFG', '< 20'], ['Faire apparaître dans InnovaCoeur (1=oui; 0=non)', '1 oui mais déjà mentionné, ne pas faire doublon']]);
  const rapport = controler([a, b]);
  assert.equal(rapport.doublons.length, 1);
  assert.deepEqual(rapport.doublons[0].divergents, ['Filtre DFG', 'Faire apparaître dans InnovaCoeur (1=oui; 0=non)']);
  assert.ok(rapport.alertes.find((x) => x.type === 'doublon').message.includes('ne pas faire doublon'));
  assert.ok(!types(rapport).includes('drapeau_illisible'), 'la mention « ne pas faire doublon » n\'est pas une erreur');
});

test('contrôles : filtres divergents, côté patient seul, illisibles, bornes strictes', () => {
  const onglet = grille('Valves', [
    ['Etudes', 'E1', 'E2', 'E3'],
    ['Filtre Nt pro BNP', '> 100', null, null],
    ['Filtre FEVG', '> 50', null, '< 35'],
    ['Filtre Diabète', null, null, '> 30'],
    ['Tag InnovaCoeur'],
    ['Filtre Nt pro BNP', '> 30', '> 150', null],
    ['Filtre Force de contraction cardiaque normale (= valeur de "FEVG" sur dernière échographie cardiaque > 40%)', 'oui', null, 'oui'],
  ]);
  const rapport = controler([onglet]);
  const de = (type) => rapport.alertes.filter((a) => a.type === type).map((a) => a.etude);
  assert.deepEqual(de('filtre_divergent'), ['E1', 'E3'], '« oui » côté patient est cohérent avec FEVG > 50, pas avec FEVG < 35');
  assert.deepEqual(de('filtre_patient_seul'), ['E2']);
  assert.deepEqual(de('filtre_illisible'), ['E3'], 'un filtre « diabète » doit valoir oui ou non');
  assert.ok(de('borne_stricte').length >= 3);
});

test('contrôles : annuaire (ARC absents, e-mails hors format, corrections validées)', () => {
  const onglet = grille('Valves', [
    ['Etudes', 'E1'],
    ['ARC n°1', 'Inconnu PERSONNE'],
    ['ARC back-up', 'Hors CIC'],
  ]);
  const annuaire = grille('Coordonnées des ARC', [
    [null, null, 'DECT', 'mail'],
    ['Alice', 'FICTIVE', '91234', 'afictive@chu-nantes.fr'],
  ]);
  const rapport = controler([onglet, annuaire]);
  assert.deepEqual(rapport.alertes.filter((a) => a.type === 'arc_absent_annuaire').map((a) => a.etude), ['Inconnu PERSONNE']);
  assert.ok(types(rapport).includes('non_personne'));
  assert.ok(rapport.alertes.find((a) => a.type === 'email_hors_format').message.includes('alice.fictive@chu-nantes.fr'));
  assert.ok(types(rapport).includes('correction_validee'));
});

test('résumé des compteurs : aucun nom d\'étude ni de personne', () => {
  const rapport = controler([ongletSain(), annuaireFictif()]);
  const resume = IC.controles.resumeCompteurs(rapport);
  for (const interdit of ['ALPHA', 'BETA', 'FICTIVE', 'EXEMPLE', 'TESTEUR', '91234']) {
    assert.ok(!resume.includes(interdit), 'le résumé ne doit pas contenir « ' + interdit + ' »');
  }
  assert.match(resume, /Études lues : 2/);
});

test('chaque type d\'alerte a une gravité connue et une explication', () => {
  for (const [type, [gravite, titre, explication]] of Object.entries(IC.controles.TYPES)) {
    assert.ok(['corriger', 'verifier', 'info'].includes(gravite), type);
    assert.ok(titre && explication, type);
  }
});

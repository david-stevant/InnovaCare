// Tests de la migration (src/migration.js) sur des onglets FICTIFS.
// Règle vérifiée partout : rien n'est deviné, rien n'est perdu, une case vide reste vide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerInnovaCare, correspondances, parametres } from './charger.js';
import { grille, ongletSain, annuaireFictif } from './fabrique.js';

const IC = chargerInnovaCare();
const CORR = correspondances();
const PARAM = parametres();
const migrer = (grilles) => IC.migration.migrer(IC.lectureAncien.lireAncienExcel(grilles, CORR), PARAM, CORR);
const toutes = (m) => Object.values(m.fichesParPole).flat();
const fiche = (m, nom) => toutes(m).find((f) => f.valeurs.nom === nom);

test('onglet sain : chaque valeur va dans son champ, sans rien inventer', () => {
  const m = migrer([ongletSain(), annuaireFictif()]);
  const alpha = fiche(m, 'ALPHA-HF').valeurs;
  assert.equal(alpha.thematique, 'IC');
  assert.equal(alpha.design, 'randomisé 1:1');
  assert.equal(alpha.inclusion_1, 'FEVG ≥ 40 %');
  assert.equal(alpha.inclusion_2, 'âge ≥ 18 ans');
  assert.deepEqual(alpha.debut_inclusion, { date: '2025-03-01' });
  assert.equal(alpha.statut, 'ouvert');
  assert.equal(alpha.age_min, 18);
  assert.equal(alpha.age_max, 80);
  assert.equal(alpha.fevg_min, 40);
  assert.equal(alpha.afficher_ecardioscope, 'oui');
  assert.equal(alpha.afficher_innovacteur, 'oui');
  assert.equal(alpha.afficher_innovaction, 'non');
  assert.equal(alpha.phrase_patient, 'Une phrase patient fictive.', 'phrase patient reprise mot pour mot');
  assert.equal(alpha.vignette_1, 'Hypertension artérielle', 'tag reconnu par son synonyme');
  // Rien d'inventé : ces champs n'existaient pas dans l'ancien Excel.
  for (const id of ['titre', 'promoteur', 'phase', 'intervention', 'registre', 'centres', 'fin_recrutement', 'recrutes', 'objectif', 'remarques']) {
    assert.equal(alpha[id], undefined, id + ' doit rester vide');
  }
  const beta = fiche(m, 'BETA (Labo X)').valeurs;
  assert.deepEqual(beta.debut_inclusion, { date: '2025-11' }, '« novembre 2025 » reconnu');
  assert.equal(beta.afficher_ecardioscope, 'non');
  assert.equal(m.resume.etudesMigrees, 2);
});

test('personnes : DECT retiré de la fiche, annuaire complété, co-investigateurs, back-up', () => {
  const m = migrer([ongletSain(), annuaireFictif()]);
  const alpha = fiche(m, 'ALPHA-HF').valeurs;
  assert.equal(alpha.arc_1, 'Alice FICTIVE', 'le DECT ne reste pas dans la fiche');
  assert.equal(alpha.arc_backup_1, 'Bob EXEMPLE');
  assert.equal(alpha.arc_backup_2, undefined, 'Alice, déjà ARC n° 1, n\'est pas recopiée en back-up');
  assert.equal(alpha.investigateur, 'Jean TESTEUR');
  const ajoute = m.annuaire.find((p) => p.nom === 'TESTEUR');
  assert.equal(ajoute.prenom, 'Jean');
  assert.equal(ajoute.fonction, 'investigateur');
  assert.equal(ajoute.email, '', 'aucune adresse inventée');
  assert.ok(m.rapport.some((r) => r.message.includes('Personne ajoutée à l\'annuaire : Jean TESTEUR')));
  assert.equal(fiche(m, 'BETA (Labo X)').valeurs.investigateur, 'Paul DURAND', '« Dr DURAND Paul » normalisé');
  assert.equal(m.annuaire.find((p) => p.nom === 'FICTIVE').dect, '91234');
});

test('personnes : deux homonymes de prénoms différents ne sont jamais confondus', () => {
  const onglet = grille('Valves', [
    ['Etudes', 'E1', 'E2', 'E3'],
    ['Investigateur Principal', 'Nicolas HOMONYME', 'Dr HOMONYME Pierre-Paul', 'N HOMONYME'],
  ]);
  const m = migrer([onglet]);
  assert.equal(fiche(m, 'E1').valeurs.investigateur, 'Nicolas HOMONYME');
  assert.equal(fiche(m, 'E2').valeurs.investigateur, 'Pierre-Paul HOMONYME');
  assert.equal(fiche(m, 'E3').valeurs.investigateur, 'Nicolas HOMONYME', 'une initiale compatible et un seul candidat de même prénom');
  assert.ok(m.rapport.some((r) => r.message.includes('« N HOMONYME » rapproché de Nicolas HOMONYME')));
});

test('statut écrit dans le nom : retiré du nom, gardé en Remarques ; annulée → terminé', () => {
  const onglet = grille('USIC', [
    ['Etudes', 'GAMMA  (non ouverte aux inclusions pour le moment)', 'DELTA \nAnnulée en phase de lancement'],
    ['Design', 'randomisé', 'ouvert'],
  ]);
  const m = migrer([onglet]);
  const gamma = fiche(m, 'GAMMA').valeurs;
  assert.equal(gamma.statut, 'à venir');
  assert.match(gamma.remarques, /\[migration\] Mention dans le nom d'origine : « non ouverte aux inclusions pour le moment »/);
  assert.equal(fiche(m, 'DELTA').valeurs.statut, 'terminé');
  assert.match(fiche(m, 'DELTA').valeurs.remarques, /Annulée en phase de lancement/);
});

test('dates, recrutés/objectif et valeurs non convertibles : gardées en Remarques', () => {
  const onglet = grille('Valves', [
    ['Etudes', 'E1', 'E2', 'E3'],
    ['Début d\'inclusion', 'fin 2025', '11/2025', 'terminé'],
    ['Durée de recrutement prévisible', '18 mois', { date: '2027-02-03' }, null],
    ['Recrutés / Objectif Nantes', '3/10', 12, 'environ 20'],
    ['Remarques', 'remarque d\'origine', null, null],
  ]);
  const m = migrer([onglet]);
  const [e1, e2, e3] = ['E1', 'E2', 'E3'].map((n) => fiche(m, n).valeurs);
  assert.equal(e1.debut_inclusion, undefined);
  assert.match(e1.remarques, /^remarque d'origine\n\[migration\] Début d'inclusion d'origine : « fin 2025 »/);
  assert.match(e1.remarques, /Durée de recrutement prévisible : « 18 mois »/);
  assert.deepEqual([e1.recrutes, e1.objectif], [3, 10]);
  assert.deepEqual(e2.debut_inclusion, { date: '2025-11' });
  assert.deepEqual(e2.fin_recrutement, { date: '2027-02-03' });
  assert.deepEqual([e2.recrutes, e2.objectif], [undefined, 12]);
  assert.equal(e3.statut, 'terminé');
  assert.match(e3.remarques, /Recrutés \/ objectif : « environ 20 »/);
  assert.ok(!m.rapport.some((r) => r.etude === 'E3' && r.champ === 'Début d\'inclusion'), '« terminé » sert au statut, pas d\'alerte de date en plus');
});

test('critères : 5 principaux, puis « autres », surplus regroupé ; exclusions au-delà de 12 regroupées', () => {
  const lignes = [['Etudes', 'E1'], ['Critères d\'inclusion principaux', 'i1']];
  for (let i = 2; i <= 12; i++) lignes.push([null, 'i' + i]);
  lignes.push(['Critères d\'exclusion principaux', 'x1']);
  for (let i = 2; i <= 14; i++) lignes.push([null, 'x' + i]);
  const v = fiche(migrer([grille('Valves', lignes)]), 'E1').valeurs;
  assert.deepEqual([v.inclusion_1, v.inclusion_5, v.inclusion_autre_1], ['i1', 'i5', 'i6']);
  assert.equal(v.inclusion_autre_5, 'i10\ni11\ni12');
  assert.equal(v.exclusion_11, 'x11');
  assert.equal(v.exclusion_12, 'x12\nx13\nx14');
});

test('filtres : e-Cardioscope fait foi, côté patient repris, « oui », traitements, bornes strictes', () => {
  const onglet = grille('Valves', [
    ['Etudes', 'E1', 'E2', 'E3'],
    ['Filtre âge', '> 65', null, '12-35'],
    ['Filtre Nt pro BNP', '> 100', null, null],
    ['Filtre Diabète', 'oui', null, null],
    ['Tag InnovaCoeur'],
    ['Filtre âge', null, '18-80', null],
    ['Filtre Nt pro BNP', '> 30', null, null],
    ['Filtre Force de contraction cardiaque normale (= valeur de "FEVG" sur dernière échographie cardiaque > 40%)', null, 'oui', null],
    ['Filtre Traitements', 'entresto ET MRA', 'potion magique', null],
  ]);
  const m = migrer([onglet]);
  const [e1, e2, e3] = ['E1', 'E2', 'E3'].map((n) => fiche(m, n).valeurs);
  assert.equal(e1.age_min, 65, '« > 65 » devient minimum 65 (borne incluse)');
  assert.ok(m.rapport.some((r) => r.etude === 'E1' && r.champ === 'Âge' && /borne incluse/.test(r.message)));
  assert.equal(e1.ntprobnp_min, 100, 'valeur e-Cardioscope retenue');
  assert.match(e1.remarques, /Filtre InnovaCoeur différent pour NT-proBNP : « > 30 »/);
  assert.equal(e1.diabete, 'requis');
  assert.equal(e1.ttt_arni, 'requis');
  assert.equal(e1.ttt_arm, 'requis');
  assert.deepEqual([e2.age_min, e2.age_max], [18, 80], 'repris du côté patient');
  assert.equal(e2.fevg_min, 40, '« force de contraction normale » → FEVG minimum 40');
  assert.match(e2.remarques, /Traitements non reconnus : « potion magique »/);
  assert.deepEqual([e3.age_min, e3.age_max], [12, 35]);
  assert.ok(m.rapport.some((r) => /borne\(s\) stricte\(s\)/.test(r.message)));
});

test('doublons : une seule colonne gardée, l\'autre pôle noté, divergences au rapport', () => {
  const a = grille('Insuff Cardiaque', [['Etudes', 'OMEGA'], ['Filtre DFG', '> 20'], ['Faire apparaître dans InnovaCoeur (1=oui; 0=non)', 1]]);
  const b = grille('Rythmologie', [['Etudes', 'OMEGA'], ['Filtre DFG', '< 20'], ['Faire apparaître dans InnovaCoeur (1=oui; 0=non)', '1 oui mais déjà mentionné, ne pas faire doublon']]);
  const m = migrer([b, a]);
  assert.equal(toutes(m).length, 1);
  const omega = m.fichesParPole.ic[0].valeurs;
  assert.equal(omega.dfg_min, 20, 'colonne de l\'onglet non marqué « ne pas faire doublon »');
  assert.equal(omega.autre_pole_1, 'Rythmologie');
  assert.ok(m.rapport.some((r) => r.champ === 'Doublon' && /Filtre DFG/.test(r.message)));
});

test('onglet « suivi ou terminées » : pôle d\'après la table d\'affectation ; colonne décalée signalée et masquée', () => {
  const suivi = grille('Etudes en suivi ou terminées', [
    [null],
    ['Etudes', 'REVERSE-MR', 'INCONNUE-X'],
    ['Critères d\'inclusion principaux', 'critère fictif', 'Étude randomisée en double aveugle'],
    [null, null, 300],
    ['Début d\'inclusion', null, 1],
    ['Investigateur Principal', null, 'Alice FICTIVE 91234'],
    ['Filtres e-Cardioscope', null, 0],
  ]);
  const m = migrer([suivi, annuaireFictif()]);
  assert.equal(m.fichesParPole.valves[0].valeurs.nom, 'REVERSE-MR');
  assert.equal(m.fichesParPole.valves[0].valeurs.statut, 'clos aux inclusions (suivi)');
  const inconnue = m.fichesParPole.transversales[0];
  assert.equal(inconnue.valeurs.nom, 'INCONNUE-X');
  assert.ok(m.rapport.some((r) => r.etude === 'INCONNUE-X' && r.champ === 'Pôle'));
  assert.equal(inconnue.suspecte, true);
  assert.deepEqual([inconnue.valeurs.afficher_ecardioscope, inconnue.valeurs.afficher_innovaction, inconnue.valeurs.afficher_innovacteur], ['non', 'non', 'non']);
  assert.ok(m.rapport.some((r) => r.gravite === 'corriger' && r.etude === 'INCONNUE-X'));
  assert.equal(m.resume.colonnesDecalees, 1);
});

test('résumé transmissible : aucun nom d\'étude ni de personne', () => {
  const texte = IC.migration.resumeCompteurs(migrer([ongletSain(), annuaireFictif()]).resume);
  for (const interdit of ['ALPHA', 'BETA', 'FICTIVE', 'TESTEUR', 'DURAND', '91234']) assert.ok(!texte.includes(interdit), interdit);
  assert.match(texte, /migrées \(après fusion des doublons\) : 2/);
});

test('decouperNom : NOM en majuscules, prénom en minuscules, initiales', () => {
  assert.deepEqual(IC.migration.decouperNom('Thibaut MANIGOLD'), { prenom: 'Thibaut', nom: 'MANIGOLD' });
  assert.deepEqual(IC.migration.decouperNom('LE RUZ Robin'), { prenom: 'Robin', nom: 'LE RUZ' });
  assert.deepEqual(IC.migration.decouperNom('JC ROUSSEL'), { prenom: 'JC', nom: 'ROUSSEL' });
  assert.deepEqual(IC.migration.decouperNom('GUERIN'), { prenom: '', nom: 'GUERIN' });
});

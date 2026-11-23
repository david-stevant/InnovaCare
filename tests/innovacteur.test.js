// Tests de la phase 4.1 : page patients (InnovActeur) — vignettes, questions posées aux patients,
// traduction des réponses (IMC, force de contraction, traitements cochés), message à l'équipe,
// confidentialité. Données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chargerInnovaCare, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const PU = IC.public, E = IC.eligibilite;
const PARAM = JSON.parse(JSON.stringify(parametres()));
const [V1, V2] = PARAM.vignettes.map((v) => v.nom);
const FEVG = PARAM.filtres.find((f) => f.id === 'fevg');
const SEUIL = FEVG.seuil_patient;
const donnees = { protocoles: [
  { id: 'a', pole: PARAM.poles[0].id, modules: ['patient'], valeurs: { nom: 'ALPHA', statut: 'ouvert', vignette_1: V1, fevg_min: SEUIL, age_max: 80, ttt_arm: 'exclu', phrase_patient: 'Phrase fictive, mot pour mot.' }, contacts: { arc: [{ nom: 'Alice FICTIVE', email: 'alice.fictive@exemple.fr' }] } },
  { id: 'b', pole: PARAM.poles[0].id, modules: ['patient'], valeurs: { nom: 'BETA', statut: 'ouvert', vignette_1: V2, fevg_max: SEUIL - 5, imc_min: 30 }, contacts: {} },
  { id: 'c', pole: PARAM.poles[0].id, modules: ['professionnel'], valeurs: { nom: 'PRO-SEULEMENT', statut: 'ouvert', vignette_1: V1 }, contacts: {} },
] };
const etudes = E.candidates(PU.preparer(donnees, PARAM, 'patient'));
const filtres = PU.questionsPatient(PARAM).map((q) => q.filtre);
const eligibles = (saisies, liste = etudes) => liste.filter((e) => E.evaluer(e, filtres, PU.reponsesPatient(saisies, PARAM)).eligible).map((e) => e.nom);

test('vignettes : celles des paramètres qui ont une étude publiée pour les patients ; sélection', () => {
  assert.deepEqual(etudes.map((e) => e.nom), ['ALPHA', 'BETA']);
  assert.deepEqual(PU.vignettes(etudes, PARAM).map((v) => [v.nom, v.nombre]), [[V1, 1], [V2, 1]].sort((a, b) => PARAM.vignettes.findIndex((v) => v.nom === a[0]) - PARAM.vignettes.findIndex((v) => v.nom === b[0])));
  assert.deepEqual(PU.selonVignettes(etudes, [V2]).map((e) => e.nom), ['BETA']);
});

test('questions posées aux patients : seulement celles qui ont une question rédigée, ou un traitement à cocher', () => {
  const q = PU.questionsPatient(PARAM);
  assert.ok(q.every(({ filtre: f }) => f.modules.includes('patient') && (f.question_patient || f.libelle_patient)));
  assert.equal(q.find((x) => x.filtre.id === 'imc').forme, 'taille_poids');
  assert.equal(q.find((x) => x.filtre.id === 'fevg').forme, 'choix');
  assert.ok(!q.some((x) => x.filtre.id === 'ntprobnp'), 'jamais demandé aux patients');
  const sansQuestion = JSON.parse(JSON.stringify(PARAM));
  sansQuestion.filtres.find((f) => f.id === 'diabete').question_patient = null;
  assert.ok(!PU.questionsPatient(sansQuestion).some((x) => x.filtre.id === 'diabete'), 'question non rédigée : pas posée');
});

test('IMC calculé à partir de la taille et du poids ; valeurs invraisemblables ignorées', () => {
  assert.equal(PU.calculerImc(172, 78), 26.4);
  assert.equal(PU.calculerImc('', 78), null);
  assert.equal(PU.calculerImc(17, 78), null);
  assert.deepEqual(eligibles({ imc_taille: 170, imc_poids: 70 }, [etudes[1]]), [], 'IMC 24,2 < 30 : écartée');
  assert.deepEqual(eligibles({ imc_taille: 170, imc_poids: 95 }, [etudes[1]]), ['BETA']);
});

test('force de contraction : « oui » = au moins le seuil, « non » = en dessous, « je ne sais pas » n\'écarte rien', () => {
  assert.deepEqual(eligibles({ fevg: 'oui' }), ['ALPHA']);
  assert.deepEqual(eligibles({ fevg: 'non' }), ['BETA']);
  assert.deepEqual(eligibles({ fevg: 'nsp' }), ['ALPHA', 'BETA']);
  assert.deepEqual(eligibles({}), ['ALPHA', 'BETA']);
});

test('traitements : une case cochée peut écarter une étude qui exclut ce traitement ; non cochée, jamais', () => {
  assert.deepEqual(eligibles({ ttt_arm: true }), ['BETA']);
  assert.deepEqual(eligibles({ ttt_arm: false }), ['ALPHA', 'BETA']);
});

test('message à l\'équipe : modèle des paramètres, blancs remplis seulement si saisis, destinataire = ARC n° 1', () => {
  const saisies = { age: '66', fevg: 'oui', ttt_arm: true, imc_taille: 172, imc_poids: 78 };
  const lignes = PU.lignesReponses(saisies, PARAM);
  assert.ok(lignes.some((l) => /^Âge : 66/.test(l)));
  assert.ok(lignes.some((l) => /26,4 \(172 cm, 78 kg\)/.test(l)));
  assert.ok(lignes.some((l) => l.startsWith('Traitements : ') && l.includes(PARAM.filtres.find((f) => f.id === 'ttt_arm').libelle_patient)));
  const m = PU.messagePatient(etudes[0], PARAM, { situations: [V1], reponses: lignes, nom: 'Jean Fictif', naissance: '1950-04-02' });
  assert.equal(m.destinataire, 'alice.fictive@exemple.fr');
  assert.ok(m.objet.includes('ALPHA'));
  assert.ok(m.corps.includes('Jean Fictif') && m.corps.includes('02/04/1950'));
  assert.ok(m.corps.includes(V1) && m.corps.includes('Âge : 66'));
  assert.ok(!m.corps.includes('{'), 'aucun repère {…} oublié');
  assert.ok(m.mailto.startsWith('mailto:alice.fictive@exemple.fr?subject='));
  const vierge = PU.messagePatient(etudes[0], PARAM, {});
  assert.match(vierge.corps, /_{4,}/, 'sans saisie, les blancs du modèle restent');
  assert.equal(PU.messagePatient(etudes[1], PARAM, {}).destinataire, null, 'sans e-mail d\'ARC publié : pas de bouton « Contacter »');
});

test('règle n° 1 : la page patients ne garde rien et n\'envoie rien', () => {
  const code = readFileSync(join(RACINE, 'site/js/innovacteur.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon|XMLHttpRequest|WebSocket/.test(code));
  const appels = [...code.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(appels, ['chemin, { cache: \'no-store\' }'], 'un seul fetch, celui des fichiers publics');
  assert.ok([...code.matchAll(/lireJson\('([^']+)'\)/g)].every((m) => /^\.\.\/donnees\/(parametres|protocoles)\.json$/.test(m[1])));
  assert.ok(!/<form/i.test(readFileSync(join(RACINE, 'site/innovacteur/index.html'), 'utf8')), 'aucun formulaire');
});

// --- Phase 4.2 : FEVG saisie en % avec « Je ne sais pas » ; mascotte -------------------------

test('mode « nombre + Je ne sais pas » : la valeur saisie compte, « Je ne sais pas » n\'écarte rien', () => {
  const p = JSON.parse(JSON.stringify(PARAM));
  p.filtres.find((f) => f.id === 'fevg').saisie_patient = 'nombre';
  assert.equal(PU.questionsPatient(p).find((q) => q.filtre.id === 'fevg').forme, 'nombre_nsp');
  const ok = (saisies) => etudes.filter((e) => E.evaluer(e, PU.questionsPatient(p).map((q) => q.filtre), PU.reponsesPatient(saisies, p)).eligible).map((e) => e.nom);
  assert.deepEqual(ok({ fevg: String(SEUIL - 5) }), ['BETA'], 'sous le seuil : l\'étude « FEVG ≥ seuil » est écartée');
  assert.deepEqual(ok({ fevg: String(SEUIL) }), ['ALPHA'], 'bornes incluses');
  assert.deepEqual(ok({ fevg: 'nsp' }), ['ALPHA', 'BETA']);
  assert.deepEqual(ok({ fevg: '' }), ['ALPHA', 'BETA']);
  assert.ok(PU.lignesReponses({ fevg: '35' }, p).includes('FEVG : 35 %'));
  assert.ok(PU.lignesReponses({ fevg: 'nsp' }, p).includes('FEVG : ne sait pas'));
});

test('mascotte : dessinée dans la page (aucune image extérieure), animations coupées si « réduire les animations »', () => {
  const code = readFileSync(join(RACINE, 'site/js/innovacteur.js'), 'utf8');
  const css = readFileSync(join(RACINE, 'site/style.css'), 'utf8');
  assert.match(code, /createElementNS\(ns, 'svg'\)/);
  assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(code), 'aucune adresse extérieure');
  const avant = css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.ok(!/animation\s*:/.test(avant.slice(avant.indexOf('InnovActeur 4.2'))), 'les animations ne sont définies que si le mouvement est permis');
});

// Tests de la phase 2.2 : moteur d'éligibilité partagé (src/eligibilite.js), sur des études FICTIVES,
// puis sur la copie de développement migrée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, correspondances, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const E = IC.eligibilite;
const PARAM = parametres();
const FILTRES = E.filtresDuModule(PARAM, 'interne');
const filtre = (id) => FILTRES.find((f) => f.id === id);
const [PATHO_A, PATHO_B] = PARAM.pathologies.map((p) => p.nom);
const etude = (nom, valeurs, autres) => Object.assign({ nom, statut: 'ouvert', masquee: false, pathologies: [PATHO_A], valeurs: Object.assign({ nom }, valeurs) }, autres);

test('filtresDuModule : seuls les filtres posés dans ce module', () => {
  assert.ok(FILTRES.length > 5 && FILTRES.every((f) => f.modules.includes('interne')));
  const sansInterne = { filtres: [{ id: 'x', type: 'bornes', modules: ['patient'] }] };
  assert.deepEqual(E.filtresDuModule(sansInterne, 'interne'), []);
});

test('bornes incluses ; valeur non renseignée = « à vérifier », jamais exclue', () => {
  const v = { age_min: 18, age_max: 80 };
  assert.equal(E.verifier(v, filtre('age'), { age: 18 }).statut, 'ok');
  assert.equal(E.verifier(v, filtre('age'), { age: 80 }).statut, 'ok');
  assert.equal(E.verifier(v, filtre('age'), { age: 81 }).statut, 'exclu');
  assert.equal(E.verifier(v, filtre('age'), {}).statut, 'a_verifier');
  assert.equal(E.verifier(v, filtre('age'), { age: '' }).statut, 'a_verifier');
  assert.equal(E.verifier({}, filtre('age'), { age: 50 }).statut, 'sans_objet');
  assert.equal(E.verifier({ fevg_min: 40 }, filtre('fevg'), { fevg: 39 }).statut, 'exclu');
  assert.equal(E.verifier({ fevg_min: 40 }, filtre('fevg'), {}).seuil, '≥ 40 %');
  assert.equal(E.verifier({ fevg_max: 40 }, filtre('fevg'), {}).seuil, '≤ 40 %');
  assert.equal(E.verifier(v, filtre('age'), {}).seuil, '18 à 80 ans');
});

test('requis / exclu / indifférent', () => {
  const d = filtre('diabete');
  assert.equal(E.verifier({ diabete: 'requis' }, d, { diabete: 'oui' }).statut, 'ok');
  assert.equal(E.verifier({ diabete: 'requis' }, d, { diabete: 'non' }).statut, 'exclu');
  assert.equal(E.verifier({ diabete: 'exclu' }, d, { diabete: 'oui' }).statut, 'exclu');
  assert.equal(E.verifier({ diabete: 'exclu' }, d, { diabete: 'non' }).statut, 'ok');
  assert.equal(E.verifier({ diabete: 'indifférent' }, d, { diabete: 'non' }).statut, 'sans_objet');
  assert.equal(E.verifier({}, d, { diabete: 'non' }).statut, 'sans_objet');
  assert.equal(E.verifier({ diabete: 'Requis' }, d, {}).statut, 'a_verifier');
});

test('question propre à l\'étude : « non » exclut, « oui » ou pas de réponse n\'exclut pas', () => {
  const e = etude('Q', { question_specifique: 'Porteur d\'un stimulateur double chambre ?' });
  const id = E.idQuestion('Porteur d\'un stimulateur double chambre ?');
  assert.equal(E.evaluer(e, FILTRES, {}).eligible, true);
  assert.equal(E.evaluer(e, FILTRES, { [id]: 'oui' }).eligible, true);
  assert.equal(E.evaluer(e, FILTRES, { [id]: 'non' }).eligible, false);
});

test('evaluer : liste des critères de l\'étude, éligible tant qu\'aucun n\'exclut', () => {
  const e = etude('A', { age_min: 40, fevg_max: 40, ttt_arm: 'requis' });
  const r = E.evaluer(e, FILTRES, { age: 65 });
  assert.equal(r.eligible, true);
  assert.deepEqual(r.criteres.map((c) => [c.id, c.statut]), [['age', 'ok'], ['fevg', 'a_verifier'], ['ttt_arm', 'a_verifier']]);
  assert.equal(E.evaluer(e, FILTRES, { age: 65, fevg: 55 }).eligible, false);
});

test('filtresUtiles (règle de la v4) : un filtre disparaît quand plus aucune étude possible n\'en dépend', () => {
  const etudes = [etude('JEUNE', { age_max: 50, fevg_max: 40 }), etude('AGEE', { age_min: 70 })];
  const ids = (r) => E.filtresUtiles(etudes, FILTRES, r).filtres.map((f) => f.id).sort();
  assert.deepEqual(ids({}), ['age', 'fevg']);
  // 75 ans : JEUNE est exclue, donc la FEVG (qui ne concerne que JEUNE) ne sert plus ; l'âge, répondu, reste.
  assert.deepEqual(ids({ age: 75 }), ['age']);
  assert.deepEqual(ids({ age: 30 }), ['age', 'fevg']);
});

test('filtresUtiles : questions propres aux études regroupées quand le texte est le même', () => {
  const etudes = [etude('X', { question_specifique: 'Question fictive ?' }), etude('Y', { question_specifique: 'question fictive ?' }), etude('Z', {})];
  const { questions } = E.filtresUtiles(etudes, FILTRES, {});
  assert.equal(questions.length, 1);
  assert.deepEqual(questions[0].etudes, ['X', 'Y']);
});

test('candidates et contextes : études ouvertes et affichées seulement, comptées par pathologie, sans doublon', () => {
  const etudes = [
    etude('A', {}, { pathologies: [PATHO_A, PATHO_B] }),
    etude('B', {}, { pathologies: [PATHO_B] }),
    etude('C', {}, { statut: 'à venir' }),
    etude('D', {}, { masquee: true }),
    etude('E', {}, { pathologies: ['Pathologie hors paramètres'] }),
  ];
  const c = E.candidates(etudes);
  assert.deepEqual(c.map((e) => e.nom), ['A', 'B', 'E']);
  const groupes = E.contextes(c, PARAM);
  const tous = groupes.flatMap((g) => g.pathologies);
  assert.equal(tous.find((p) => p.nom === PATHO_A).nombre, 1);
  assert.equal(tous.find((p) => p.nom === PATHO_B).nombre, 2);
  assert.equal(groupes.at(-1).groupe, 'Autres');
  assert.deepEqual(groupes.map((g) => g.groupe).slice(0, PARAM.groupes_pathologies.length), PARAM.groupes_pathologies.map((g) => g.nom));
  assert.deepEqual(E.selon(c, [PATHO_A, PATHO_B]).map((e) => e.nom), ['A', 'B'], 'A n\'apparaît qu\'une fois');
});

test('copie de dev migrée : un âge hors bornes retire bien les études qui le fixent', async () => {
  const C = correspondances();
  const g = await IC.excel.lireClasseur(ExcelJS, readFileSync(join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx')));
  const migre = IC.migration.migrer(IC.lectureAncien.lireAncienExcel(g, C), PARAM, C);
  const grilles = await IC.excel.lireClasseur(ExcelJS, await IC.gabarit.creerClasseur(ExcelJS, PARAM, migre).xlsx.writeBuffer());
  const cat = IC.catalogue.preparer(IC.lecture.lireGabarit(grilles, PARAM), PARAM);
  const ic = E.selon(E.candidates(cat.etudes), [PARAM.pathologies[0].nom]);
  assert.ok(ic.length >= 3, 'plusieurs études ouvertes dans le premier contexte');
  const avecMin = ic.filter((e) => typeof e.valeurs.age_min === 'number');
  assert.ok(avecMin.length >= 1);
  const tropJeune = Math.min(...avecMin.map((e) => e.valeurs.age_min)) - 1;
  const restantes = ic.filter((e) => E.evaluer(e, FILTRES, { age: tropJeune }).eligible);
  assert.equal(restantes.length, ic.length - avecMin.length);
  assert.ok(E.filtresUtiles(ic, FILTRES, {}).filtres.some((f) => f.id === 'age'));
});

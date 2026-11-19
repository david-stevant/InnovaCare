// Tests du nouveau gabarit Excel (src/gabarit.js) : le classeur est fabriqué, écrit,
// puis relu avec ExcelJS, comme le ferait Excel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, parametres } from './charger.js';

const IC = chargerInnovaCare();
const PARAM = parametres();
const CHAMPS = IC.schema.champsFiche(PARAM);

async function ecrireEtRelire(contenu) {
  const tampon = await IC.gabarit.creerClasseur(ExcelJS, PARAM, contenu).xlsx.writeBuffer();
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(tampon);
  return { classeur, tampon };
}

const vierge = await ecrireEtRelire();
const poles = PARAM.poles.map((p) => vierge.classeur.getWorksheet(p.nom));

test('onglets : Lisez-moi, un par pôle des paramètres, Annuaire, Listes — dans cet ordre', () => {
  assert.deepEqual(vierge.classeur.worksheets.map((f) => f.name), ['Lisez-moi'].concat(PARAM.poles.map((p) => p.nom), ['Annuaire', 'Listes']));
});

test('tous les onglets de pôle ont exactement les lignes du schéma, dans le même ordre', () => {
  for (const f of poles) {
    const libelles = CHAMPS.map((_, i) => f.getCell(i + 1, 1).value);
    assert.deepEqual(libelles, CHAMPS.map((c) => c.libelle), f.name);
    assert.equal(f.getCell(CHAMPS.length + 1, 1).value, null, f.name + ' : aucune ligne en trop');
  }
  assert.equal(CHAMPS.length, 88);
});

test('le gabarit vierge ne contient aucune étude (colonnes C et suivantes vides)', () => {
  for (const f of poles) {
    f.eachRow((ligne) => ligne.eachCell((cellule, col) => {
      if (col >= 3) assert.equal(cellule.value, null, f.name + '!' + cellule.address);
    }));
  }
  assert.equal(vierge.classeur.getWorksheet('Annuaire').getCell('A2').value, null);
});

test('chaque ligne a un message d\'aide conforme aux limites d\'Excel', () => {
  const f = poles[0];
  CHAMPS.forEach((champ, i) => {
    const v = f.getCell(i + 1, 3).dataValidation;
    assert.ok(v, champ.id + ' : pas de règle de saisie');
    assert.ok(v.promptTitle.length <= 32, champ.id + ' : titre d\'aide trop long');
    assert.ok((v.prompt || '').length <= 255, champ.id + ' : aide trop longue');
    assert.equal(f.getCell(i + 1, 27).dataValidation.promptTitle, v.promptTitle, 'la règle couvre les 25 colonnes d\'études');
  });
});

test('listes déroulantes et contrôles de saisie', () => {
  const f = poles[0];
  const regle = (id) => f.getCell(CHAMPS.findIndex((c) => c.id === id) + 1, 3).dataValidation;
  assert.equal(regle('statut').type, 'list');
  assert.match(regle('statut').formulae[0], /^Listes!\$[A-Z]+\$2:\$[A-Z]+\$\d+$/);
  assert.match(regle('arc_1').formulae[0], /^Annuaire!\$I\$2:\$I\$\d+$/);
  assert.equal(regle('ttt_arm').type, 'list');
  assert.equal(regle('age_min').type, 'whole');
  assert.deepEqual(regle('age_min').formulae.map(Number), [0, 120]);
  assert.equal(regle('debut_inclusion').type, 'date');
  assert.equal(regle('pathologie_1').type, 'any', 'pathologies en saisie libre tant que la liste des paramètres est vide');
  // L'onglet Listes contient bien les valeurs des paramètres
  const listes = vierge.classeur.getWorksheet('Listes');
  const colStatut = listes.getRow(1).values.indexOf('statut');
  assert.deepEqual(PARAM.listes.statut.map((_, i) => listes.getCell(i + 2, colStatut).value), PARAM.listes.statut);
  const colVersion = listes.getRow(1).values.indexOf('version_gabarit');
  assert.equal(listes.getCell(2, colVersion).value, IC.gabarit.VERSION_GABARIT);
});

test('protection : feuilles protégées sans mot de passe, colonnes A et B verrouillées, saisie libre ailleurs', () => {
  for (const f of poles.concat([vierge.classeur.getWorksheet('Annuaire')])) {
    assert.equal(f.sheetProtection.sheet, true, f.name);
    assert.equal(f.sheetProtection.hashValue, undefined, f.name + ' : pas de mot de passe');
  }
  const f = poles[0];
  assert.notEqual((f.getCell('A5').protection || {}).locked, false, 'colonne A verrouillée');
  assert.notEqual((f.getCell('B5').protection || {}).locked, false, 'colonne B verrouillée');
  assert.equal(f.getCell('C5').protection.locked, false, 'cellule de saisie libre');
  assert.equal(f.getCell('AA88').protection.locked, false);
  assert.equal(f.views[0].state, 'frozen');
  assert.equal(f.views[0].xSplit, 1);
  assert.equal(f.views[0].ySplit, 1);
});

test('mises en forme conditionnelles : obligatoires vides, statut, mise en avant', () => {
  const regles = poles[0].conditionalFormattings;
  const ligne = (id) => CHAMPS.findIndex((c) => c.id === id) + 1;
  const sur = (id) => regles.filter((r) => r.ref === 'C' + ligne(id) + ':AA' + ligne(id));
  assert.ok(sur('thematique').length, 'champ obligatoire : orange si vide');
  assert.match(sur('phase')[0].rules[0].formulae[0], /OR\(C\$\d+="oui",C\$\d+="oui"\)/, '« si public » dépend des lignes Afficher');
  assert.equal(sur('statut').flatMap((r) => r.rules).filter((r) => r.type === 'cellIs').length, PARAM.listes.statut.length, 'une couleur par statut');
  assert.ok(regles.some((r) => r.ref === 'C1:AA1'), 'nom surligné si « Mettre en avant »');
});

test('fichier rempli : valeurs aux bonnes lignes, colonne décalée signalée, rapport', async () => {
  const contenu = {
    fichesParPole: { [PARAM.poles[0].id]: [
      { valeurs: { nom: 'ETUDE-FICTIVE', statut: 'ouvert', debut_inclusion: { date: '2025-11' }, age_min: 18, phrase_patient: 'Une phrase fictive.' } },
      { valeurs: { nom: 'COLONNE-DECALEE' }, suspecte: true, note: 'à ressaisir' },
    ] },
    annuaire: [{ prenom: 'Alice', nom: 'FICTIVE', fonction: 'ARC', dect: '91234', email: 'alice.fictive@chu-nantes.fr' }],
    rapport: [{ gravite: 'corriger', pole: PARAM.poles[0].nom, etude: 'COLONNE-DECALEE', champ: 'Toute la colonne', message: 'À ressaisir.' }],
  };
  const { classeur } = await ecrireEtRelire(contenu);
  const f = classeur.getWorksheet(PARAM.poles[0].nom);
  const ligne = (id) => CHAMPS.findIndex((c) => c.id === id) + 1;
  assert.equal(f.getCell(1, 3).value, 'ETUDE-FICTIVE');
  assert.equal(f.getCell(ligne('age_min'), 3).value, 18);
  assert.equal(f.getCell(ligne('debut_inclusion'), 3).value.toISOString().slice(0, 10), '2025-11-01');
  assert.equal(f.getCell(ligne('phrase_patient'), 3).value, 'Une phrase fictive.');
  assert.equal(f.getCell(1, 4).note.texts ? f.getCell(1, 4).note.texts.map((t) => t.text).join('') : f.getCell(1, 4).note, 'à ressaisir');
  const annuaire = classeur.getWorksheet('Annuaire');
  assert.equal(annuaire.getCell('A2').value, 'Alice');
  assert.equal(annuaire.getCell('I2').value.result, 'Alice FICTIVE');
  const rapport = classeur.getWorksheet('Rapport de migration');
  assert.equal(rapport.getCell('B2').value, 'à corriger');
  assert.equal(classeur.worksheets[classeur.worksheets.length - 1].name, 'Rapport de migration');
});

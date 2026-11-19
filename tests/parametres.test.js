// Tests de l'étape 1.3 : cohérence de parametres.json, conversion des anciens tags,
// mise à jour d'un Excel harmonisé, et propreté des fichiers de référence (aucun vrai DECT).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, correspondances, parametres, RACINE } from './charger.js';
import { ongletSain, annuaireFictif } from './fabrique.js';

const IC = chargerInnovaCare();
const PARAM = parametres();
const copie = () => JSON.parse(JSON.stringify(PARAM));

test('parametres.json du dépôt : cohérent, complet', () => {
  assert.deepEqual(IC.parametres.verifier(PARAM), []);
  assert.equal(PARAM.pathologies.length, 21, '20 contextes d\'e-CardioScope v4 + Endocardite');
  assert.equal(PARAM.vignettes.length, 7, 'les 7 catégories d\'InnovaCoeur v2');
  for (const f of PARAM.filtres.filter((x) => x.famille === 'traitement' && x.libelle_patient)) {
    // DCI d'abord, nom commercial entre parenthèses (CLAUDE.md § 8)
    for (const nom of f.noms_commerciaux) assert.ok(!f.libelle_patient.startsWith(nom), f.id + ' : le libellé patient doit commencer par la DCI');
  }
});

test('règle 3 : parametres.json (public) ne mentionne pas l\'établissement', () => {
  const texte = readFileSync(join(RACINE, 'site/donnees/parametres.json'), 'utf8').replace(/@chu-nantes(\.mssante)?\.fr/gi, '').replace(/chu-nantes(\.mssante)?\.fr/gi, '');
  assert.ok(!/CHU\s+de\s+Nantes|CHU\s+Nantes|\bCHU\b/i.test(texte));
});

test('verifier : repère les erreurs courantes', () => {
  const p = copie();
  p.couleurs.turquoise = 'bleu';
  p.poles.push({ id: 'ic', nom: 'Doublon' });
  p.pathologies[1].synonymes.push('ICFEP'); // déjà synonyme de « Insuffisance cardiaque »
  p.filtres[0].visibilite = 'interne';
  p.poles[0].nom = 'Nom beaucoup trop long pour un onglet Excel, vraiment';
  const messages = IC.parametres.verifier(p).map((x) => x.rubrique + ' : ' + x.message).join('\n');
  assert.match(messages, /Couleurs : Couleur « turquoise » invalide/);
  assert.match(messages, /Identifiant « ic » en double/);
  assert.match(messages, /synonyme « ICFEP » désigne à la fois/);
  assert.match(messages, /visibilité « interne » non permise/);
  assert.match(messages, /impossible pour un onglet Excel/);
});

test('migration : les anciens tags sont convertis par leurs synonymes ; les autres sont signalés', () => {
  const m = IC.migration.migrer(IC.lectureAncien.lireAncienExcel([ongletSain(), annuaireFictif()], correspondances()), PARAM, correspondances());
  assert.equal(IC.migration.correspondre('icfep', PARAM.pathologies).nom, 'Insuffisance cardiaque');
  assert.equal(IC.migration.correspondre('CMH obstructive', PARAM.pathologies).nom, 'CMH');
  assert.equal(IC.migration.correspondre('HTAP', PARAM.pathologies), null, 'rien n\'est deviné');
  const alpha = Object.values(m.fichesParPole).flat().find((f) => f.valeurs.nom === 'ALPHA-HF').valeurs;
  assert.equal(alpha.vignette_1, 'Hypertension artérielle');
});

test('copie de dev : seuls les tags ambigus CMI, HTAP et PM restent à choisir à la main', async () => {
  const grilles = await IC.excel.lireClasseur(ExcelJS, readFileSync(join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx')));
  const m = IC.migration.migrer(IC.lectureAncien.lireAncienExcel(grilles, correspondances()), PARAM, correspondances());
  const nonReconnus = m.rapport.filter((r) => /^Tag /.test(r.champ)).map((r) => r.message.match(/« (.*?) »/)[1]).sort();
  assert.deepEqual(nonReconnus, ['CMI', 'HTAP', 'PM']);
});

test('mise à jour d\'un Excel : aller-retour sans perte (valeurs, annuaire, notes, rapport)', async () => {
  const grilles = await IC.excel.lireClasseur(ExcelJS, readFileSync(join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx')));
  const migre = IC.migration.migrer(IC.lectureAncien.lireAncienExcel(grilles, correspondances()), PARAM, correspondances());
  const lireTampon = async (tampon) => IC.lecture.lireGabarit(await IC.excel.lireClasseur(ExcelJS, tampon), PARAM);
  const avant = await lireTampon(await IC.gabarit.creerClasseur(ExcelJS, PARAM, migre).xlsx.writeBuffer());
  const { contenu, signalements } = IC.lecture.versContenu(avant, PARAM);
  const apres = await lireTampon(await IC.gabarit.creerClasseur(ExcelJS, PARAM, contenu).xlsx.writeBuffer());
  assert.deepEqual(signalements, []);
  assert.deepEqual(apres.etudes.map((e) => [e.pole, e.valeurs]), avant.etudes.map((e) => [e.pole, e.valeurs]));
  assert.deepEqual(apres.annuaire, avant.annuaire);
  assert.equal(apres.etudes.filter((e) => e.note).length, migre.resume.colonnesDecalees, 'les notes « à ressaisir » sont conservées');
  assert.equal(apres.rapport.length, migre.rapport.length, 'le rapport de migration est conservé');
});

test('mise à jour d\'un Excel : la valeur d\'une ligne supprimée des paramètres passe en Remarques', async () => {
  const contenu = { fichesParPole: { [PARAM.poles[0].id]: [{ valeurs: { nom: 'ETUDE-X', ntprobnp_min: 125, remarques: 'déjà là' } }] }, annuaire: [] };
  const tampon = await IC.gabarit.creerClasseur(ExcelJS, PARAM, contenu).xlsx.writeBuffer();
  const sansNt = copie();
  sansNt.filtres = sansNt.filtres.filter((f) => f.id !== 'ntprobnp');
  const lu = IC.lecture.lireGabarit(await IC.excel.lireClasseur(ExcelJS, tampon), sansNt);
  const { contenu: nouveau, signalements } = IC.lecture.versContenu(lu, sansNt);
  const v = nouveau.fichesParPole[PARAM.poles[0].id][0].valeurs;
  assert.equal(v.ntprobnp_min, undefined);
  assert.match(v.remarques, /^déjà là\n\[mise à jour\] Ligne « NT-proBNP minimum \(pg\/mL\) » supprimée du gabarit, valeur : « 125 »/);
  assert.equal(signalements.length, 1);
});

test('règle 2 : aucun vrai numéro DECT dans les fichiers texte de reference/ (fictifs 9xxxx seulement)', () => {
  for (const nom of readdirSync(join(RACINE, 'reference')).filter((n) => /\.(html|md|txt|json)$/i.test(n))) {
    const texte = readFileSync(join(RACINE, 'reference', nom), 'utf8');
    const numeros = [...texte.matchAll(/DECT\s*:?\s*(\d{5})|dect"?\s*:\s*"(\d{5})"/gi)].map((m) => m[1] || m[2]);
    const reels = numeros.filter((n) => !n.startsWith('9'));
    assert.deepEqual(reels, [], nom + ' contient des DECT non fictifs');
    assert.ok(!/W:\\/.test(texte), nom + ' contient un chemin du disque partagé');
  }
});

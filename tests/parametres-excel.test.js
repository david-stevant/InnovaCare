// Tests de l'étape 1.5 : les paramètres rangés dans l'Excel (onglet très masqué « Paramètres »),
// leur mise à jour sans perte (ajout d'une pathologie, pôle renommé), les contrôles avant de les
// publier, l'écriture du fichier à sa place, et les numéros de version des outils.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, parametres, RACINE } from './charger.js';
import { construireTout, versionDe } from '../outils-src/construire.mjs';

const IC = chargerInnovaCare();
const PARAM = parametres();
const copie = (x) => JSON.parse(JSON.stringify(x));
const ecrire = async (p, contenu) => IC.gabarit.creerClasseur(ExcelJS, p, contenu).xlsx.writeBuffer();
const grillesDe = async (tampon) => IC.excel.lireClasseur(ExcelJS, tampon);

const ETUDE = { nom: 'ETUDE-FICTIVE', statut: 'ouvert', thematique: 'thématique fictive', pathologie_1: PARAM.pathologies[0].nom, phrase_patient: 'Phrase fictive, mot pour mot.', afficher_innovaction: 'oui' };
const contenuFictif = () => ({ fichesParPole: { [PARAM.poles[0].id]: [{ valeurs: copie(ETUDE) }] }, annuaire: [{ prenom: 'Jean', nom: 'TESTEUR', fonction: 'investigateur', nom_affiche: 'Jean TESTEUR' }] });

/** Reproduit « Enregistrer dans l'Excel » de l'outil Paramètres (outils-src/parametres-ui.js). */
async function enregistrer(tampon, nouveaux) {
  const grilles = await grillesDe(tampon);
  const anciens = IC.lecture.lireParametres(grilles).parametres || PARAM;
  const noms = new Set(nouveaux.poles.map((x) => x.nom));
  const lecture = Object.assign({}, nouveaux, { poles: nouveaux.poles.concat(anciens.poles.filter((x) => !noms.has(x.nom))) });
  const lu = IC.lecture.lireGabarit(grilles, lecture);
  const { contenu, signalements } = IC.lecture.versContenu(lu, nouveaux);
  return { tampon: await ecrire(nouveaux, contenu), signalements };
}

test('les paramètres écrits dans l\'Excel sont relus à l\'identique', async () => {
  const lus = IC.lecture.lireParametres(await grillesDe(await ecrire(PARAM)));
  assert.equal(lus.probleme, null);
  assert.deepEqual(lus.parametres, PARAM);
});

test('paramètres de plus de 30 000 caractères : découpés en morceaux, relus à l\'identique', async () => {
  const gros = copie(PARAM);
  gros.textes.site.long = 'é'.repeat(70000);
  const classeur = IC.gabarit.creerClasseur(ExcelJS, gros);
  assert.ok(classeur.getWorksheet('Paramètres').getCell('A4').value, 'au moins trois morceaux');
  const lus = IC.lecture.lireParametres(await grillesDe(await classeur.xlsx.writeBuffer()));
  assert.deepEqual(lus.parametres, gros);
});

test('l\'onglet Paramètres n\'est ni un pôle, ni une anomalie', async () => {
  const lu = IC.lecture.lireGabarit(await grillesDe(await ecrire(PARAM, contenuFictif())), PARAM);
  assert.deepEqual(lu.anomalies, []);
  assert.equal(lu.etudes.length, 1);
  assert.equal(lu.version, IC.gabarit.VERSION_GABARIT);
});

test('Excel sans onglet Paramètres (produit avant l\'étape 1.5) : « absent », les études restent lisibles', async () => {
  const classeur = IC.gabarit.creerClasseur(ExcelJS, PARAM, contenuFictif());
  classeur.removeWorksheet(classeur.getWorksheet('Paramètres').id);
  const grilles = await grillesDe(await classeur.xlsx.writeBuffer());
  assert.deepEqual(IC.lecture.lireParametres(grilles), { parametres: null, probleme: 'absent' });
  assert.equal(IC.lecture.lireGabarit(grilles, PARAM).etudes.length, 1);
});

test('onglet Paramètres abîmé (morceau manquant) : signalé, jamais à moitié lu', async () => {
  const classeur = IC.gabarit.creerClasseur(ExcelJS, Object.assign(copie(PARAM), { long: 'x'.repeat(40000) }));
  classeur.getWorksheet('Paramètres').getCell('A3').value = null;
  const lus = IC.lecture.lireParametres(await grillesDe(await classeur.xlsx.writeBuffer()));
  assert.equal(lus.parametres, null);
  assert.equal(lus.probleme, 'incomplet');
});

test('ajout d\'une pathologie fictive : rangée dans l\'Excel, ajoutée à la liste déroulante, aucune valeur perdue', async () => {
  const avant = await ecrire(PARAM, contenuFictif());
  const nouveaux = copie(PARAM);
  nouveaux.pathologies.push({ id: 'patho_fictive', nom: 'Pathologie fictive', groupe: PARAM.pathologies[0].groupe, synonymes: [] });
  const { tampon, signalements } = await enregistrer(avant, nouveaux);
  assert.deepEqual(signalements, []);
  const grilles = await grillesDe(tampon);
  assert.deepEqual(IC.lecture.lireParametres(grilles).parametres, nouveaux);
  const listes = grilles.find((g) => g.nom === 'Listes');
  const col = listes.cellules[0].indexOf('pathologies');
  assert.ok(listes.cellules.some((l) => l[col] === 'Pathologie fictive'), 'nouvelle valeur dans l\'onglet Listes');
  const relu = IC.lecture.lireGabarit(grilles, nouveaux);
  assert.deepEqual(relu.etudes[0].valeurs, (await (async () => IC.lecture.lireGabarit(await grillesDe(avant), PARAM).etudes[0].valeurs)()));
  // La plage de la liste déroulante « Pathologie » couvre la nouvelle valeur.
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(tampon);
  const ligne = IC.schema.champsFiche(nouveaux).findIndex((c) => c.id === 'pathologie_1') + 1;
  const regle = classeur.getWorksheet(PARAM.poles[0].nom).getCell(ligne, 3).dataValidation;
  const derniere = Number(/\$(\d+)$/.exec(regle.formulae[0])[1]);
  assert.equal(derniere, nouveaux.pathologies.length + 1);
  // Le Publieur accepte ensuite une étude classée dans cette pathologie.
  const lu = IC.lecture.lireGabarit(grilles, nouveaux);
  lu.etudes[0].valeurs.pathologie_1 = 'Pathologie fictive';
  assert.deepEqual(IC.publication.controler(lu, nouveaux).filter((c) => c.gravite === 'bloquant'), []);
});

test('pôle renommé dans les paramètres : ses études sont retrouvées dans l\'onglet renommé', async () => {
  const avant = await ecrire(PARAM, contenuFictif());
  const nouveaux = copie(PARAM);
  nouveaux.poles[0].nom = 'Pôle renommé';
  const { tampon } = await enregistrer(avant, nouveaux);
  const lu = IC.lecture.lireGabarit(await grillesDe(tampon), nouveaux);
  assert.equal(lu.etudes.length, 1);
  assert.equal(lu.etudes[0].onglet, 'Pôle renommé');
  assert.equal(lu.etudes[0].valeurs.phrase_patient, ETUDE.phrase_patient);
});

test('nom de pôle réservé à un onglet technique : refusé', () => {
  const p = copie(PARAM);
  p.poles[0].nom = 'Paramètres';
  assert.ok(IC.parametres.verifier(p).some((x) => /réservé/.test(x.message)));
});

test('avant publication des paramètres : DECT, contenu interne et nom de l\'établissement refusés ; e-mails permis', () => {
  const avec = (texte) => { const p = copie(PARAM); p.textes.site.bandeau_test = texte; return IC.parametres.verifierPourPublication(p); };
  assert.deepEqual(IC.parametres.verifierPourPublication(PARAM), []);
  assert.deepEqual(avec('Écrire à prenom.nom@' + PARAM.annuaire.format_email.split('@')[1]), [], 'adresse e-mail permise (règle 3)');
  assert.equal(avec('DECT 91234').length, 1);
  assert.equal(avec('[interne – masqué]').length, 1);
  // Le motif est déduit du format des e-mails de l'annuaire : sigle seul, sigle + ville.
  const [sigle, ville] = PARAM.annuaire.format_email.split('@')[1].split('.')[0].split('-');
  assert.equal(avec('Suivi au ' + sigle.toUpperCase()).length, 1);
  assert.equal(avec(sigle.toUpperCase() + ' de ' + ville).length, 1);
  assert.deepEqual(avec('Un mot qui contient ' + sigle + 'choter'), [], 'pas de faux positif au milieu d\'un mot');
});

test('identiques : ne dépend pas de l\'ordre des clés', () => {
  const a = { x: 1, y: { b: [1, 2], a: 'é' } };
  assert.ok(IC.parametres.identiques(a, { y: { a: 'é', b: [1, 2] }, x: 1 }));
  assert.ok(!IC.parametres.identiques(a, { x: 1, y: { a: 'é', b: [2, 1] } }));
});

test('écriture à sa place : réussite, fichier verrouillé (ouvert dans Excel), autre erreur', async () => {
  const ecrits = [];
  const poignee = (erreurALaFermeture) => ({
    async createWritable() {
      return { async write(d) { ecrits.push(d); }, async close() { if (erreurALaFermeture) { const e = new Error('occupé'); e.name = erreurALaFermeture; throw e; } }, async abort() {} };
    },
  });
  assert.deepEqual(await IC.memoireFichier.ecrire(poignee(null), 'contenu'), { ok: true });
  assert.equal((await IC.memoireFichier.ecrire(poignee('NoModificationAllowedError'), 'x')).raison, 'verrouille');
  assert.equal((await IC.memoireFichier.ecrire(poignee('QuotaExceededError'), 'x')).raison, 'autre');
  assert.equal(await IC.memoireFichier.autoriserEcriture({}), false, 'sans écriture possible : repli par téléchargement');
});

test('versions des outils : outils/versions.json à jour, chaque outil affiche sa version', () => {
  const attendu = Object.fromEntries(Object.entries(construireTout()).map(([nom, html]) => [nom, versionDe(html)]));
  for (const v of Object.values(attendu)) assert.match(v, /^[0-9a-f]{8}$/);
  assert.deepEqual(JSON.parse(readFileSync(join(RACINE, 'outils/versions.json'), 'utf8')), attendu, 'lancer « npm run construire »');
  for (const html of Object.values(construireTout())) assert.ok(!html.includes('@@VERSION_OUTIL@@'));
});

test('règle 5 : aucun nom d\'instance écrit en dur dans les sources des outils', () => {
  for (const nom of ['Publieur.html', 'Parametres.html', 'eCardioScope.html', 'publieur-ui.js', 'parametres-ui.js', 'migration-ui.js', 'ecardioscope-ui.js']) {
    assert.ok(!/InnovaCoeur/.test(readFileSync(join(RACINE, 'outils-src', nom), 'utf8')), nom);
  }
});

// --- Brouillon automatique de l'outil Paramètres (src/brouillon.js) ----------------------

function stockageFictif() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('brouillon : gardé, retrouvé à l\'identique avec sa date, puis effacé', () => {
  const s = stockageFictif();
  assert.equal(IC.brouillon.retrouver(s), null);
  const p = copie(PARAM);
  p.textes.site.bandeau_test = 'Phrase modifiée, non enregistrée.';
  const date = new Date(2026, 10, 19, 21, 34);
  assert.ok(IC.brouillon.garder(s, p, date));
  const b = IC.brouillon.retrouver(s);
  assert.deepEqual(b.parametres, p);
  assert.equal(IC.brouillon.quand(b.date), '19/11 à 21:34');
  IC.brouillon.effacer(s);
  assert.equal(IC.brouillon.retrouver(s), null);
});

test('brouillon illisible ou stockage refusé : ignoré sans erreur', () => {
  const s = stockageFictif();
  s.setItem(IC.brouillon.CLE, '{pas du json');
  assert.equal(IC.brouillon.retrouver(s), null);
  s.setItem(IC.brouillon.CLE, JSON.stringify({ date: 'n\'importe quoi', parametres: PARAM }));
  assert.equal(IC.brouillon.retrouver(s), null);
  const refuse = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('refusé'); }, removeItem() { throw new Error('refusé'); } };
  assert.equal(IC.brouillon.garder(refuse, PARAM), false);
  assert.equal(IC.brouillon.retrouver(refuse), null);
  assert.doesNotThrow(() => IC.brouillon.effacer(refuse));
});

test('nom daté du parametres.json téléchargé (plus de « (1) », « (2) »)', () => {
  assert.equal(IC.brouillon.nomDate('parametres', '.json', new Date(2026, 10, 19, 9, 5)), 'parametres_2026-11-19_09h05.json');
});

test('avant publication : chaque message dit OÙ se trouve le texte en cause et en montre un extrait', () => {
  const p = copie(PARAM);
  const sigle = PARAM.annuaire.format_email.split('@')[1].split('.')[0].split('-')[0].toUpperCase();
  p.textes.adressage.corps = ['Bonjour,', '', 'Merci d\'adresser votre patient au ' + sigle + ' pour un bilan.'];
  p.textes.mentions = [{ titre: 'Contact', texte: 'Écrire à prenom.nom@' + PARAM.annuaire.format_email.split('@')[1] }];
  p.filtres.find((f) => f.id === 'fevg').question_patient = 'Question fictive avec DECT 91234 ?';
  const messages = IC.parametres.verifierPourPublication(p);
  assert.equal(messages.length, 2, 'l\'adresse e-mail des Mentions reste permise');
  const adressage = messages.find((m) => m.startsWith('Messages types'));
  assert.match(adressage, /^Messages types › Adressage \(libéraux\) › corps › ligne 3 : nom ou sigle de l'établissement/);
  assert.ok(/« …[^»]*patient au /.test(adressage) && adressage.includes(sigle + ' pour un bilan. »'), adressage);
  assert.ok(messages.some((m) => /^Filtres d'éligibilité et traitements › FEVG › Question posée au patient : le mot « DECT »/.test(m)));
  assert.deepEqual(IC.parametres.verifierPourPublication(PARAM), []);
});

test('règle 3 : pas de faux positif sur les mots accentués (« échu », « déchu »), le sigle reste refusé', () => {
  const avec = (texte) => { const p = copie(PARAM); p.textes.site.bandeau_test = texte; return IC.parametres.verifierPourPublication(p).length; };
  const sigle = PARAM.annuaire.format_email.split('@')[1].split('.')[0].split('-')[0];
  for (const t of ['Paiement à terme échu', 'Un statut déchu', 'Fichu temps']) assert.equal(avec(t), 0, t);
  for (const t of ['Suivi au ' + sigle.toUpperCase(), '(' + sigle.toUpperCase() + ')', sigle.toUpperCase() + '.', sigle + '-Ville']) assert.equal(avec(t), 1, t);
});

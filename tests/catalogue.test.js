// Tests de la phase 2.1 : catalogue de l'outil interne (src/catalogue.js), sur des études FICTIVES,
// puis sur la copie de développement migrée. Vérifie aussi que l'outil interne n'envoie rien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, correspondances, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const PARAM = parametres();
const [P1, P2] = PARAM.poles;
const [PATHO_A, PATHO_B] = PARAM.pathologies.map((p) => p.nom);

const annuaire = [
  { prenom: 'Jean', nom: 'TESTEUR', fonction: 'investigateur', nom_affiche: 'Jean TESTEUR', email: 'jean.testeur@exemple.fr' },
  { prenom: 'Alice', nom: 'FICTIVE', fonction: 'ARC', dect: '91234', email: 'alice.fictive@exemple.fr', nom_affiche: 'Alice FICTIVE' },
];
const etude = (pole, valeurs, note) => ({ pole: pole.id, onglet: pole.nom, colonne: 'C', id: IC.normalisation.identifiant(valeurs.nom), valeurs, horsSchema: [], note: note || null });
const lu = {
  annuaire,
  etudes: [
    etude(P1, { nom: 'ALPHA', statut: 'ouvert', thematique: 'Thématique fictive éèà', pathologie_1: PATHO_A, investigateur: 'Jean TESTEUR', arc_1: 'Alice FICTIVE', recrutes: 3, objectif: 12, afficher_ecardioscope: 'oui', exclusion_1: 'Critère d\'exclusion fictif' }),
    etude(P2, { nom: 'BETA', statut: 'à venir', thematique: 'Autre', pathologie_1: PATHO_B, autre_pole_1: P1.nom, arc_1: 'Personne INCONNUE', afficher_ecardioscope: 'oui' }),
    etude(P2, { nom: 'GAMMA', statut: 'terminé', afficher_ecardioscope: 'non' }, 'Colonne décalée : à ressaisir'),
  ],
};
const cat = IC.catalogue.preparer(lu, PARAM);
const noms = (liste) => liste.map((e) => e.nom);

test('preparer : contacts tirés de l\'annuaire (avec DECT), personne hors annuaire gardée telle quelle', () => {
  const alpha = cat.etudes[0];
  assert.deepEqual(alpha.contacts.arc_1, { nom: 'Alice FICTIVE', connu: true, dect: '91234', email: 'alice.fictive@exemple.fr', fonction: 'ARC' });
  assert.deepEqual(cat.etudes[1].contacts.arc_1, { nom: 'Personne INCONNUE', connu: false });
  assert.deepEqual(cat.arcs, ['Alice FICTIVE', 'Personne INCONNUE']);
});

test('preparer : jauge recrutés / objectif, rien d\'inventé quand c\'est vide', () => {
  assert.deepEqual(cat.etudes[0].recrutement, { recrutes: 3, objectif: 12, pourcentage: 25 });
  assert.equal(cat.etudes[1].recrutement, null);
  assert.deepEqual(IC.catalogue.recrutement({ recrutes: 4 }), { recrutes: 4, objectif: null, pourcentage: null });
  assert.equal(cat.etudes[1].thematique, 'Autre');
  assert.equal(cat.etudes[2].thematique, '', 'un champ vide reste vide');
});

test('preparer : étude masquée (« Afficher dans l\'outil interne » ≠ oui) et colonne à ressaisir repérées', () => {
  assert.equal(cat.masquees, 1);
  assert.ok(cat.etudes[2].masquee && cat.etudes[2].aRessaisir);
  assert.ok(!cat.etudes[0].masquee && !cat.etudes[0].aRessaisir);
});

test('filtrer : masquées exclues par défaut, statut, pôle (y compris « autre pôle »), pathologie, ARC', () => {
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, {})), ['ALPHA', 'BETA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { masquees: true })), ['ALPHA', 'BETA', 'GAMMA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { statuts: ['ouvert'] })), ['ALPHA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { poles: [P1.nom] })), ['ALPHA', 'BETA'], 'BETA concerne aussi ce pôle');
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { pathologies: [PATHO_B] })), ['BETA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { arc: 'alice fictive' })), ['ALPHA']);
});

test('recherche plein texte : sans accents ni majuscules, tous les mots, y compris critères internes et contacts', () => {
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { texte: 'THEMATIQUE eea' })), ['ALPHA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { texte: 'exclusion fictif' })), ['ALPHA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { texte: 'testeur' })), ['ALPHA']);
  assert.deepEqual(noms(IC.catalogue.filtrer(cat.etudes, { texte: 'alpha inexistant' })), []);
});

test('trier : par nom, par statut dans l\'ordre des paramètres, par recrutement', () => {
  const tous = cat.etudes;
  assert.deepEqual(noms(IC.catalogue.trier(tous, 'nom')), ['ALPHA', 'BETA', 'GAMMA']);
  assert.deepEqual(noms(IC.catalogue.trier(tous, 'nom', null, 'desc')), ['GAMMA', 'BETA', 'ALPHA']);
  const ordre = PARAM.listes.statut;
  const parStatut = IC.catalogue.trier(tous, 'statut', ordre).map((e) => ordre.indexOf(e.statut));
  assert.deepEqual(parStatut, parStatut.slice().sort((a, b) => a - b));
  assert.equal(IC.catalogue.trier(tous, 'recrutement', null, 'desc')[0].nom, 'ALPHA');
});

test('fiche : ordre du schéma, champs vides omis, critères internes inclus et marqués, contact enrichi', () => {
  const blocs = IC.catalogue.fiche(cat.etudes[0], PARAM);
  assert.deepEqual(blocs.map((b) => b.bloc), IC.schema.BLOCS.filter((b) => blocs.some((x) => x.bloc === b)), 'blocs dans l\'ordre du schéma');
  const lignes = blocs.flatMap((b) => b.lignes);
  const exclusion = lignes.find((l) => l.id === 'exclusion_1');
  assert.equal(exclusion.texte, 'Critère d\'exclusion fictif');
  assert.ok(exclusion.interne);
  assert.equal(lignes.find((l) => l.id === 'arc_1').contact.dect, '91234');
  assert.ok(!lignes.some((l) => l.id === 'titre'), 'titre vide : absent de la fiche');
});

test('copie de dev migrée : 62 études lues, contacts retrouvés, recherche et filtres cohérents', async () => {
  const C = correspondances();
  const g = await IC.excel.lireClasseur(ExcelJS, readFileSync(join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx')));
  const migre = IC.migration.migrer(IC.lectureAncien.lireAncienExcel(g, C), PARAM, C);
  const tampon = await IC.gabarit.creerClasseur(ExcelJS, PARAM, migre).xlsx.writeBuffer();
  const grilles = await IC.excel.lireClasseur(ExcelJS, tampon);
  const c = IC.catalogue.preparer(IC.lecture.lireGabarit(grilles, IC.lecture.lireParametres(grilles).parametres), PARAM);
  assert.equal(c.etudes.length, 62);
  assert.ok(c.etudes.filter((e) => e.contacts.arc_1 && e.contacts.arc_1.connu).length > 30, 'la plupart des ARC sont dans l\'annuaire');
  assert.equal(c.etudes.filter((e) => e.aRessaisir).length, migre.resume.colonnesDecalees);
  const ouvertes = IC.catalogue.filtrer(c.etudes, { statuts: ['ouvert'] });
  assert.ok(ouvertes.length > 10 && ouvertes.every((e) => e.statut === 'ouvert' && !e.masquee));
  const branch = IC.catalogue.filtrer(c.etudes, { texte: 'branch', masquees: true });
  assert.ok(branch.length >= 1 && branch.every((e) => /branch/i.test(e.recherche)));
});

test('confidentialité : l\'outil interne n\'envoie rien et ne garde aucune donnée dans le navigateur', () => {
  for (const nom of ['outils-src/ecardioscope-ui.js', 'src/catalogue.js']) {
    const code = readFileSync(join(RACINE, nom), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|document\.cookie/.test(code), nom);
  }
  const html = readFileSync(join(RACINE, 'outils-src/eCardioScope.html'), 'utf8');
  assert.ok(!/<script[^>]*\ssrc=|<link[^>]*href="http/i.test(html));
  const site = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? site(join(d, x.name)) : [x.name]));
  assert.ok(!site(join(RACINE, 'site')).some((n) => /ecardioscope|catalogue/i.test(n)), 'jamais dans le site public');
});

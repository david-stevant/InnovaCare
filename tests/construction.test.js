// Tests de l'étape 1.0 : le script de construction et les règles du dépôt.
// Lancement : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembler, construireTout } from '../outils-src/construire.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

test('assembler : un fichier .css est placé dans une balise <style>', () => {
  const html = assembler('<!DOCTYPE html>\n<!--@inclure outils-src/style-commun.css-->\n<p>fin</p>\n');
  assert.match(html, /<style>\n[\s\S]*--turquoise: #00bac6[\s\S]*<\/style>/);
  assert.ok(!html.includes('@inclure'), 'le marqueur doit avoir disparu');
  assert.ok(html.includes('Fichier GÉNÉRÉ'), 'le bandeau « fichier généré » doit être présent');
});

test('assembler : une police .woff2 est intégrée au fichier', () => {
  const html = assembler('<!DOCTYPE html>\n<!--@inclure outils-src/bibliotheques/dm-sans/dm-sans-latin.woff2 "DM Sans"-->\n');
  assert.match(html, /@font-face\{font-family:"DM Sans";src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{1000,}\)/);
});

test('assembler : un fichier introuvable provoque une erreur claire', () => {
  assert.throws(() => assembler('<!DOCTYPE html>\n<!--@inclure outils-src/inexistant.js-->\n'));
});

test('les fichiers de outils/ sont à jour par rapport à leurs sources', () => {
  for (const [nom, attendu] of Object.entries(construireTout())) {
    const chemin = join(RACINE, 'outils', nom);
    assert.ok(existsSync(chemin), 'outils/' + nom + ' est absent : lancer « npm run construire »');
    assert.equal(readFileSync(chemin, 'utf8'), attendu, 'outils/' + nom + ' est périmé : lancer « npm run construire »');
  }
});

test('chaque outil est autonome : aucun fichier ni script chargé depuis l\'extérieur', () => {
  for (const [nom, html] of Object.entries(construireTout())) {
    assert.ok(!/<script[^>]*\ssrc=/i.test(html), nom + ' : script externe interdit');
    assert.ok(!/<link[^>]*\shref=/i.test(html), nom + ' : feuille de style ou police externe interdite');
    assert.ok(!/@import/i.test(html), nom + ' : @import interdit');
    assert.ok(!/url\((?!data:)/i.test(html), nom + ' : ressource externe dans le style interdite');
  }
});

test('règle 3 : aucune mention de l\'établissement dans les outils', () => {
  for (const [nom, html] of Object.entries(construireTout())) {
    // Les adresses e-mail @chu-nantes.fr et @chu-nantes.mssante.fr restent autorisées.
    const sansAdresses = html.replace(/@chu-nantes(\.mssante)?\.fr/gi, '');
    assert.ok(!/CHU\s+de\s+Nantes|chu[- ]nantes|\bCHU\b/i.test(sansAdresses), nom + ' mentionne l\'établissement');
  }
});

test('règle 2 : un seul fichier Excel dans le dépôt, la copie de développement', () => {
  const suivis = execFileSync('git', ['ls-files'], { cwd: RACINE, encoding: 'utf8' }).split('\n');
  const classeurs = suivis.filter((chemin) => /\.(xlsx|xlsm|xls)$/i.test(chemin));
  // Le fichier du dossier « modele/ » (gabarit vierge, étape 1.2) sera ajouté ici le moment venu.
  assert.deepEqual(classeurs, ['reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx']);
});

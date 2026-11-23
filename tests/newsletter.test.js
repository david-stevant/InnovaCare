// Tests de la phase 5.2 : brouillon de newsletter du lundi (src/newsletter.js, outils-src/newsletter.mjs).
// Données FICTIVES ; aucun ticket réel n'est créé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chargerInnovaCare, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const NL = IC.newsletter;
const PARAM = JSON.parse(JSON.stringify(parametres()));
PARAM.newsletter = Object.assign({}, PARAM.newsletter, { nombre_etudes_min: 2, nombre_etudes_max: 3, delai_alerte_maj_mois: 6, rappel: 'Rappel fictif : pensez à publier.' });
const pole = PARAM.memos.sections[0].poles[0];
const p = (id, valeurs, extra) => Object.assign({ id, pole, modules: ['professionnel'], maj: '2026-11-01', valeurs: Object.assign({ nom: id.toUpperCase(), statut: 'ouvert' }, valeurs), contacts: {} }, extra);
const donnees = { genere_le: '2026-11-23', protocoles: [
  p('ancienne', {}), p('jamais', {}), p('avant', { en_avant: 'oui' }), p('nouvelle', { debut_inclusion: '2026-11-15' }),
  p('recente', {}), p('fermee', { statut: 'terminé', en_avant: 'oui' }),
  p('depassee', { fin_recrutement: '2026-10-31' }, { maj: '2026-02-01' }),
] };
const AUJ = '2026-11-23';
const etudes = NL.candidates(donnees, PARAM);
const historique = { etudes: { ancienne: '2026-01-05', recente: '2026-11-16', depassee: '2026-11-16', nouvelle: '2026-11-16' } };

test('choix : mises en avant, puis nouvellement ouvertes, puis rotation (jamais présentée d\'abord), au plus 3', () => {
  const choix = NL.choisir(etudes, PARAM, historique, AUJ);
  assert.deepEqual(choix.map((x) => [x.etude.id, x.raison]), [['avant', 'mise en avant'], ['nouvelle', 'nouvellement ouverte'], ['jamais', 'rotation']]);
  assert.ok(!choix.some((x) => x.etude.id === 'fermee'), 'une étude non ouverte n\'est jamais proposée');
});

test('rotation : la semaine suivante, d\'autres études passent en premier', () => {
  const h2 = NL.majHistorique(historique, NL.choisir(etudes, PARAM, historique, AUJ), AUJ);
  assert.equal(h2.etudes.jamais, AUJ);
  const suivante = NL.choisir(etudes, PARAM, h2, '2026-11-30').map((x) => x.etude.id);
  assert.equal(suivante[0], 'avant', 'la mise en avant reste prioritaire');
  assert.ok(suivante.includes('ancienne'), 'la moins récemment présentée revient');
});

test('contrôles : fin de recrutement dépassée encore « ouvert », mise à jour de plus de 6 mois', () => {
  const c = NL.controles(etudes, PARAM, AUJ);
  assert.deepEqual(c.fins.map((e) => e.id), ['depassee']);
  assert.deepEqual(c.anciennes.map((e) => e.id), ['depassee']);
});

test('ticket : titre daté, brouillon au format des mémos, rappel, contrôles, aucun numéro de poste', () => {
  const { texte } = NL.corps(donnees, PARAM, historique, AUJ);
  assert.equal(NL.titre(AUJ), 'Brouillon de newsletter — semaine du 23/11/2026');
  assert.match(texte, /## 1\. Brouillon prêt à copier-coller/);
  assert.match(texte, /### 🔬 AVANT/);
  assert.match(texte, /Rappel fictif : pensez à publier\./);
  assert.match(texte, /- DEPASSEE \(fin prévue le 31\/10\/2026\)/);
  assert.ok(!/DECT/.test(texte));
});

test('script : en essai, affiche le brouillon sans rien créer ; charge seulement le code public', () => {
  const sortie = execFileSync(process.execPath, [join(RACINE, 'outils-src/newsletter.mjs'), '--essai'], { encoding: 'utf8' });
  assert.match(sortie, /^# Brouillon de newsletter — semaine du \d{2}\/\d{2}\/\d{4}/);
  const code = readFileSync(join(RACINE, 'outils-src/newsletter.mjs'), 'utf8');
  assert.ok(!/catalogue/.test(code.replace(/\/\/.*$/gm, '')), 'le code de l\'outil interne n\'est pas chargé');
  assert.match(code, /site\/donnees\/protocoles\.json/);
  const flux = readFileSync(join(RACINE, '.github/workflows/newsletter.yml'), 'utf8');
  assert.match(flux, /cron: '\d+ \d+ \* \* 1'/, 'chaque lundi');
  assert.match(flux, /workflow_dispatch/);
});

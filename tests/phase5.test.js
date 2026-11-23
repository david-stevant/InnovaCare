// Tests de la phase 5.1 : « mettre en avant » publié, mémos publics (toutes les études publiées,
// sans numéro de poste interne), mesure d'audience sans cookie ni donnée personnelle. Données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chargerInnovaCare, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const PU = IC.public, M = IC.memos, A = IC.audience;
const PARAM = JSON.parse(JSON.stringify(parametres()));
const S1 = PARAM.memos.sections[0];

test('« mettre en avant » est exporté dans protocoles.json (oui / non)', () => {
  const lu = { annuaire: [], etudes: [{ pole: PARAM.poles[0].id, onglet: PARAM.poles[0].nom, colonne: 'C', id: 'x', valeurs: { nom: 'X', statut: 'ouvert', en_avant: 'oui', afficher_innovaction: 'oui', synopsis: 'SECRET' }, horsSchema: [] }] };
  const p = IC.exportPublic.exporter(lu, PARAM).protocoles[0];
  assert.equal(p.valeurs.en_avant, 'oui');
  assert.equal(p.valeurs.synopsis, undefined, 'les autres champs internes restent bloqués');
});

test('mémos publics : toutes les études publiées et ouvertes, mises en avant d\'abord, contact = e-mail de l\'ARC', () => {
  const donnees = { protocoles: [
    { id: 'a', pole: S1.poles[0], modules: ['patient'], valeurs: { nom: 'PATIENTS', statut: 'ouvert', inclusion_1: 'Critère fictif' }, contacts: { arc: [{ nom: 'Alice FICTIVE', email: 'alice.fictive@exemple.fr' }] } },
    { id: 'b', pole: S1.poles[0], modules: ['professionnel'], valeurs: { nom: 'MEDECINS', statut: 'ouvert', en_avant: 'oui' }, contacts: {} },
    { id: 'c', pole: S1.poles[0], modules: ['professionnel'], valeurs: { nom: 'FERMEE', statut: 'terminé' }, contacts: {} },
  ] };
  const etudes = PU.preparer(donnees, PARAM, null);
  assert.equal(etudes.length, 3, 'sans module : toutes les études publiées');
  const memo = M.construire(etudes, PARAM);
  assert.deepEqual(memo.sections[0].etudes.map((e) => e.nom), ['MEDECINS', 'PATIENTS']);
  const md = M.versMarkdown(memo);
  assert.match(md, /Alice FICTIVE — alice\.fictive@exemple\.fr/);
  assert.ok(!/DECT/.test(md + M.versHtml(memo)));
});

test('site/ : le code des mémos copié dans le site ne contient rien qui permette d\'afficher un numéro de poste', () => {
  const code = readFileSync(join(RACINE, 'site/js/commun/memos.js'), 'utf8');
  assert.ok(!/\bDECT\b|\.dect\b|"dect"/i.test(code));
  const fichiers = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
  assert.ok(!fichiers(join(RACINE, 'site')).some((c) => /catalogue\.js$/.test(c)), 'le code de l\'outil interne n\'est jamais dans le site');
});

test('audience : rien sans code GoatCounter ; adresse correcte ; seuls les événements prévus', () => {
  assert.equal(A.adresse(PARAM, '/innovacteur/'), null);
  const p = JSON.parse(JSON.stringify(PARAM));
  p.publication.goatcounter = 'compte-fictif';
  assert.match(A.adresse(p, '/innovacteur/?x=1#y'), /^https:\/\/compte-fictif\.goatcounter\.com\/count\?p=%2Finnovacteur%2F&rnd=/);
  assert.match(A.adresse(p, '/', 'test-termine'), /\?p=test-termine&e=true&rnd=/);
  assert.equal(A.adresse(p, '/', 'age-72-ans'), null, 'un événement non prévu n\'est jamais envoyé');
  p.publication.goatcounter = 'code invalide/../';
  assert.equal(A.adresse(p, '/'), null);
});

test('audience : les pages n\'envoient que des noms d\'événements fixes, jamais une saisie', () => {
  const fichiers = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
  for (const chemin of fichiers(join(RACINE, 'site/js')).filter((c) => !c.includes('/commun/'))) {
    const code = readFileSync(chemin, 'utf8');
    for (const m of code.matchAll(/audience\.compter\(([^)]*)\)/g)) {
      const args = m[1].split(',').map((x) => x.trim());
      assert.ok(args.length === 1 || (args.length === 2 && /^'([a-z-]+)'$/.test(args[1]) && A.EVENEMENTS.includes(args[1].slice(1, -1))), relative(RACINE, chemin) + ' : ' + m[0]);
    }
  }
});

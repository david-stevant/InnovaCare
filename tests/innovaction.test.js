// Tests de la phase 3.1 : pages publiques pour les médecins libéraux (InnovAction) —
// préparation des études publiées (src/public.js), moteur restreint au module « professionnel »,
// lien d'adressage, et contenu du dossier site/. Données FICTIVES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chargerInnovaCare, parametres, parametresDuSite, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const PU = IC.public, E = IC.eligibilite;
const PARAM = parametres();
const PATHO = PARAM.pathologies[0].nom;
const donnees = {
  format: 1, genere_le: '2026-11-22',
  protocoles: [
    { id: 'pro', pole: PARAM.poles[0].id, modules: ['professionnel'], maj: '2026-11-20', valeurs: { nom: 'PRO-OUVERTE', statut: 'ouvert', pathologie_1: PATHO, age_min: 18, age_max: 80, debut_inclusion: '2025-03-01' }, contacts: { investigateur: { nom: 'Jean TESTEUR', mssante: 'jean.testeur@exemple.mssante.fr' } } },
    { id: 'patient', pole: PARAM.poles[0].id, modules: ['patient'], valeurs: { nom: 'PATIENT-SEULEMENT', statut: 'ouvert', pathologie_1: PATHO }, contacts: {} },
    { id: 'avenir', pole: PARAM.poles[0].id, modules: ['professionnel'], valeurs: { nom: 'A-VENIR', statut: 'à venir', pathologie_1: PATHO }, contacts: {} },
    { id: 'sans', pole: PARAM.poles[0].id, modules: ['professionnel', 'patient'], valeurs: { nom: 'SANS-MSSANTE', statut: 'ouvert', pathologie_1: PATHO }, contacts: {} },
  ],
};
const etudes = E.candidates(PU.preparer(donnees, PARAM, 'professionnel'));

test('études proposées aux libéraux : publiées pour ce module et « ouvert » seulement', () => {
  assert.deepEqual(etudes.map((e) => e.nom), ['PRO-OUVERTE', 'SANS-MSSANTE']);
  assert.equal(etudes[0].poleNom, PARAM.poles[0].nom);
  assert.deepEqual(etudes[0].pathologies, [PATHO]);
});

test('dates du fichier public au format français ; recherche sans accents', () => {
  assert.equal(PU.dateFr('2025-03-01'), '01/03/2025');
  assert.equal(PU.dateFr('2025-03'), '03/2025');
  assert.equal(PU.dateFr(''), '');
  assert.deepEqual(PU.rechercher(etudes, 'testeur').map((e) => e.nom), ['PRO-OUVERTE']);
});

test('profil patient : même moteur, seulement les filtres du module « professionnel »', () => {
  const filtres = E.filtresDuModule(PARAM, 'professionnel');
  assert.ok(filtres.every((f) => f.modules.includes('professionnel')));
  const horsModule = PARAM.filtres.filter((f) => !f.modules.includes('professionnel')).map((f) => f.id);
  assert.ok(!filtres.some((f) => horsModule.includes(f.id)));
  assert.equal(E.evaluer(etudes[0], filtres, { age: 85 }).eligible, false);
  assert.equal(E.evaluer(etudes[0], filtres, {}).eligible, true, 'valeur non renseignée : jamais écartée');
});

test('adressage : MSSanté de l\'investigateur, objet des paramètres, corps vide = rien d\'inventé', () => {
  const a = PU.adressage(etudes[0], PARAM);
  assert.equal(a.mssante, 'jean.testeur@exemple.mssante.fr');
  assert.equal(a.objet, PARAM.textes.adressage.objet.split('{protocole}').join('PRO-OUVERTE'));
  assert.equal(a.corps, '');
  assert.equal(a.mailto, 'mailto:jean.testeur@exemple.mssante.fr?subject=' + encodeURIComponent(a.objet));
  assert.equal(PU.adressage(etudes[1], PARAM), null, 'sans MSSanté publiée : pas de bouton « Adresser »');
});

test('adressage : corps rédigé dans les paramètres, {protocole} remplacé, encodé dans le lien', () => {
  const p = JSON.parse(JSON.stringify(PARAM));
  p.textes.adressage.corps = ['Bonjour,', 'Je vous adresse un patient pour {protocole} & co.'];
  const a = PU.adressage(etudes[0], p);
  assert.equal(a.corps, 'Bonjour,\nJe vous adresse un patient pour PRO-OUVERTE & co.');
  assert.ok(a.mailto.includes('&body=' + encodeURIComponent(a.corps)));
});

test('site/ : les pages publiques ne nomment ni ne lient jamais l\'outil interne', () => {
  const interne = parametresDuSite().modules.interne;
  const fichiers = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
  for (const chemin of fichiers(join(RACINE, 'site')).filter((c) => /\.(html|js|css)$/.test(c))) {
    const texte = readFileSync(chemin, 'utf8');
    // Ni son nom (paramètres), ni un lien vers le dossier des outils locaux.
    assert.ok(!texte.includes(interne) && !/ecardioscope|href="[^"]*outils\//i.test(texte), relative(RACINE, chemin));
  }
});

// --- Phase 3.2 : « Nouveautés » et « Mentions » --------------------------------------------

const avec = (nom, valeurs) => ({ nom, valeurs });

test('nouveautés : ouvertes depuis 30 jours au plus (la plus récente d\'abord), dates futures exclues', () => {
  const etudes = [
    avec('IL-Y-A-30-JOURS', { debut_inclusion: '2026-10-23' }),
    avec('IL-Y-A-31-JOURS', { debut_inclusion: '2026-10-22' }),
    avec('HIER', { debut_inclusion: '2026-11-21' }),
    avec('DANS-UNE-SEMAINE', { debut_inclusion: '2026-11-29' }),
    avec('MOIS-SEUL', { debut_inclusion: '2026-11' }),
    avec('SANS-DATE', {}),
  ];
  const n = PU.nouveautes(etudes, '2026-11-22');
  assert.deepEqual(n.recentes.map((e) => e.nom), ['HIER', 'MOIS-SEUL', 'IL-Y-A-30-JOURS']);
  assert.equal(n.jours, 30);
});

test('nouveautés : fins de recrutement à venir, la plus proche d\'abord ; passées et absentes exclues', () => {
  const etudes = [
    avec('LOIN', { fin_recrutement: '2027-06-30' }),
    avec('AUJOURDHUI', { fin_recrutement: '2026-11-22' }),
    avec('PASSEE', { fin_recrutement: '2026-11-21' }),
    avec('BIENTOT', { fin_recrutement: '2026-12-15' }),
    avec('SANS', {}),
  ];
  assert.deepEqual(PU.nouveautes(etudes, '2026-11-22').fins.map((e) => e.nom), ['AUJOURDHUI', 'BIENTOT', 'LOIN']);
});

test('mentions : texte tiré des paramètres, texte de départ avec les parties à compléter signalées', () => {
  const code = readFileSync(join(RACINE, 'site/js/mentions.js'), 'utf8');
  assert.match(code, /textes\)?\s*\|\|\s*\{\}\)\.mentions|textes\.mentions/);
  assert.match(code, /\[à compléter\]/);
  assert.match(code, /\[à confirmer\]/);
  for (const page of ['site/index.html', 'site/innovaction/index.html', 'site/innovaction/nouveautes.html']) {
    assert.match(readFileSync(join(RACINE, page), 'utf8'), /href="(\.\.\/)?mentions\.html"/, page + ' : lien vers les mentions');
  }
});

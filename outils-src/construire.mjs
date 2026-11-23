// =============================================================================
// construire.mjs — fabrique les outils locaux « prêts à l'emploi »
// =============================================================================
// À quoi sert ce script ?
//   Les outils locaux (Diagnostic, puis Migration, Publieur…) doivent chacun tenir
//   dans UN SEUL fichier HTML, ouvrable par double-clic, sans connexion.
//   Pour ne pas écrire dix fois le même style ou le même code, on les rédige en
//   plusieurs petits fichiers dans « outils-src/ » et « src/ », et ce script les
//   recolle en un seul fichier dans « outils/ ».
//
// Comment ça marche ?
//   Dans un gabarit HTML (outils-src/NomOutil.html), une ligne de la forme
//       <!--@inclure chemin/du/fichier.css-->
//   est remplacée par le contenu du fichier, selon son extension :
//       .css   → placé dans une balise <style>
//       .js    → placé dans une balise <script>
//       .woff2 → police intégrée au fichier (texte « base64 »)
//       .json  → données placées dans une balise <script type="application/json">
//   Les chemins sont donnés depuis la racine du dépôt.
//
// Numéro de version : le texte @@VERSION_OUTIL@@ d'un gabarit est remplacé par une
//   « empreinte » de 8 caractères calculée sur le contenu du fichier (hors paramètres de
//   départ). Elle change dès que le code de l'outil change, et seulement dans ce cas.
//   La liste des versions est écrite dans outils/versions.json : le Publieur la lit en
//   ligne pour signaler qu'un outil a une nouvelle version.
//
// Qui le lance ?  Claude, à chaque modification (commande : npm run construire).
//                 David n'a jamais à le faire.
// =============================================================================

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_SOURCES = join(RACINE, 'outils-src');
const DOSSIER_SORTIE = join(RACINE, 'outils');

const MARQUEUR = /^[ \t]*<!--@inclure\s+(\S+?)(?:\s+"([^"]*)")?\s*-->[ \t]*$/gm;

const BANDEAU =
  '<!-- Fichier GÉNÉRÉ automatiquement par outils-src/construire.mjs : ne pas le modifier à la main.\n' +
  '     Les sources sont dans outils-src/ et src/. -->\n';

/** Transforme le contenu d'un fichier en morceau de HTML, selon son extension. */
function morceauHtml(chemin, nomPolice) {
  const absolu = join(RACINE, chemin);
  const extension = extname(chemin).toLowerCase();

  if (extension === '.woff2') {
    const base64 = readFileSync(absolu).toString('base64');
    return (
      '<style>@font-face{font-family:"' + (nomPolice || 'Police') + '";' +
      'src:url(data:font/woff2;base64,' + base64 + ') format("woff2");' +
      'font-weight:100 1000;font-style:normal;}</style>'
    );
  }

  const texte = readFileSync(absolu, 'utf8');
  if (extension === '.css') return '<style>\n' + texte + '</style>';
  // « </script » à l'intérieur d'un script fermerait la balise trop tôt : on le neutralise.
  const sansFermeture = texte.replace(/<\/script/gi, '<\\/script');
  if (extension === '.js') return '<script>\n' + sansFermeture + '</script>';
  if (extension === '.json') {
    const identifiant = basename(chemin, '.json');
    return '<script type="application/json" id="donnees-' + identifiant + '">\n' + sansFermeture + '</script>';
  }
  throw new Error('Extension non prise en charge pour une inclusion : ' + chemin);
}

const VERSION = '@@VERSION_OUTIL@@';
const BLOC_PARAMETRES = /<script type="application\/json" id="donnees-parametres">[\s\S]*?<\/script>/;

/** Empreinte du contenu (hors paramètres de départ, qui peuvent changer sans que le code change). */
export function empreinte(html) {
  return createHash('sha256').update(html.replace(BLOC_PARAMETRES, '')).digest('hex').slice(0, 8);
}

/** Assemble un gabarit : renvoie le texte complet du fichier HTML autonome. */
export function assembler(texteGabarit) {
  const corps = texteGabarit.replace(MARQUEUR, (ligne, chemin, nomPolice) => morceauHtml(chemin, nomPolice));
  // Le bandeau se place juste après la première ligne (<!DOCTYPE html>).
  const finPremiereLigne = corps.indexOf('\n') + 1;
  const complet = corps.slice(0, finPremiereLigne) + BANDEAU + corps.slice(finPremiereLigne);
  return complet.split(VERSION).join(empreinte(complet));
}

/** Version d'un outil assemblé (lue dans son pied de page), ou null. */
export function versionDe(html) {
  const m = /data-version="([0-9a-f]{8})"/.exec(html);
  return m ? m[1] : null;
}

/** Liste des gabarits : tous les fichiers .html de outils-src/. */
export function listerGabarits() {
  return readdirSync(DOSSIER_SOURCES).filter((nom) => nom.endsWith('.html')).sort();
}

// Code partagé avec le site public : seul le dossier site/ est publié, on y place donc une
// COPIE de ces fichiers de src/ (avec une ligne d'avertissement). Un test vérifie qu'elle est à jour.
const COPIES_SITE = ['src/texte.js', 'src/eligibilite.js', 'src/public.js', 'src/memos.js', 'src/audience.js'];
const DOSSIER_COPIES = 'site/js/commun';

/** Copies pour le site : { "site/js/commun/x.js": contenu }. */
export function copiesSite() {
  const resultat = {};
  for (const chemin of COPIES_SITE) {
    resultat[DOSSIER_COPIES + '/' + basename(chemin)] =
      '// Copie automatique de ' + chemin + ' (outils-src/construire.mjs) : ne pas modifier ici.\n' + readFileSync(join(RACINE, chemin), 'utf8');
  }
  return resultat;
}

/** Construit tous les outils. Renvoie { nomDuFichier: contenu }. */
export function construireTout() {
  const resultats = {};
  for (const nom of listerGabarits()) {
    resultats[nom] = assembler(readFileSync(join(DOSSIER_SOURCES, nom), 'utf8'));
  }
  return resultats;
}

// Lancement direct (« node outils-src/construire.mjs ») : on écrit les fichiers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(DOSSIER_SORTIE, { recursive: true });
  const versions = {};
  for (const [nom, contenu] of Object.entries(construireTout())) {
    writeFileSync(join(DOSSIER_SORTIE, nom), contenu);
    versions[nom] = versionDe(contenu);
    console.log('✔ outils/' + nom + ' (' + Math.round(contenu.length / 1024) + ' Ko, version ' + versions[nom] + ')');
  }
  writeFileSync(join(DOSSIER_SORTIE, 'versions.json'), JSON.stringify(versions, null, 2) + '\n');
  console.log('✔ outils/versions.json');
  mkdirSync(join(RACINE, DOSSIER_COPIES), { recursive: true });
  for (const [chemin, contenu] of Object.entries(copiesSite())) {
    writeFileSync(join(RACINE, chemin), contenu);
    console.log('✔ ' + chemin + ' (copie pour le site public)');
  }
}

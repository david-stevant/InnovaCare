// =============================================================================
// newsletter.mjs — dépose chaque lundi le brouillon de newsletter dans un ticket GitHub
// =============================================================================
// Lancé par .github/workflows/newsletter.yml (GitHub Actions), jamais par le porteur.
// Ne lit que les données PUBLIQUES du site : site/donnees/protocoles.json et parametres.json.
// Le code interne (src/catalogue.js) n'est pas chargé : aucun numéro de poste possible.
//   node outils-src/newsletter.mjs --essai   → affiche le brouillon, ne crée rien
//   node outils-src/newsletter.mjs           → crée le ticket (GITHUB_TOKEN, GITHUB_REPOSITORY)
//                                              et met à jour newsletter/historique.json
// =============================================================================
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (chemin) => JSON.parse(readFileSync(join(RACINE, chemin), 'utf8'));

export function charger() {
  for (const nom of ['texte', 'eligibilite', 'public', 'memos', 'newsletter']) {
    const chemin = join(RACINE, 'src', nom + '.js');
    vm.runInThisContext(readFileSync(chemin, 'utf8'), { filename: chemin });
  }
  return globalThis.InnovaCare;
}

/** Date du jour à Paris, « AAAA-MM-JJ ». */
export function aujourdhuiParis(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function principal() {
  const essai = process.argv.includes('--essai');
  const IC = charger();
  const donnees = lire('site/donnees/protocoles.json');
  const parametres = lire('site/donnees/parametres.json');
  const historique = lire('newsletter/historique.json');
  const date = aujourdhuiParis();
  const brouillon = IC.newsletter.corps(donnees, parametres, historique, date);
  const titre = IC.newsletter.titre(date);
  if (essai) { console.log('# ' + titre + '\n\n' + brouillon.texte); return; }

  const jeton = process.env.GITHUB_TOKEN, depot = process.env.GITHUB_REPOSITORY;
  if (!jeton || !depot) throw new Error('GITHUB_TOKEN et GITHUB_REPOSITORY sont nécessaires (lancé par GitHub Actions).');
  const reponse = await fetch('https://api.github.com/repos/' + depot + '/issues', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jeton, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titre, body: brouillon.texte }),
  });
  if (!reponse.ok) throw new Error('Création du ticket refusée (code ' + reponse.status + ') : ' + await reponse.text());
  const ticket = await reponse.json();
  console.log('Ticket créé : ' + ticket.html_url);
  writeFileSync(join(RACINE, 'newsletter/historique.json'), JSON.stringify(IC.newsletter.majHistorique(historique, brouillon.choix, date), null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((erreur) => { console.error(erreur.message); process.exit(1); });
}

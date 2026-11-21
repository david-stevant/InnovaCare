// Utilitaire de test : charge les fichiers de src/ exactement comme dans les outils HTML
// (chaque fichier ajoute ses fonctions à l'objet global InnovaCare), et lit les JSON.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Ordre de chargement : chaque fichier peut utiliser ceux qui le précèdent.
const ORDRE = ['normalisation', 'excel-vers-grille', 'lecture-ancien', 'controles', 'schema', 'gabarit', 'migration', 'lecture', 'parametres', 'export-public', 'publication', 'memoire-fichier', 'brouillon', 'catalogue'];

export function chargerInnovaCare() {
  if (!globalThis.InnovaCare) {
    for (const nom of ORDRE) {
      const chemin = join(RACINE, 'src', nom + '.js');
      vm.runInThisContext(readFileSync(chemin, 'utf8'), { filename: chemin });
    }
  }
  return globalThis.InnovaCare;
}

export const lireJson = (chemin) => JSON.parse(readFileSync(join(RACINE, chemin), 'utf8'));
// Paramètres FIGÉS pour les tests (copie de site/donnees/parametres.json au 19/11/2026) : les tests
// ne dépendent pas des réglages que le porteur du projet modifie et publie lui-même (étape 1.5).
export const parametres = () => lireJson('tests/donnees/parametres-test.json');
// Paramètres EN LIGNE (ceux du site) : seules des RÈGLES y sont vérifiées, jamais leur contenu.
export const parametresDuSite = () => lireJson('site/donnees/parametres.json');
export const correspondances = () => lireJson('outils-src/donnees/correspondances-ancien-excel.json');

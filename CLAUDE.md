# CLAUDE.md — InnovaCoeur (plateforme InnovaCare)

Ce fichier est relu au début de chaque session. Il fixe les règles du projet.
Le détail fonctionnel est dans `docs/CAHIER_DES_CHARGES.md` : **lis-le en entier avant toute tâche
nouvelle** et considère-le comme la référence. En cas de contradiction entre ce fichier et le cahier
des charges, signale-la et demande, ne tranche pas seul.

## 1. Le projet en bref

Outil web qui regroupe tout ce qui sert le recrutement dans les protocoles de recherche clinique
d'un service hospitalier, à partir d'une source unique (un Excel partagé, rempli par les ARC).
Instance de départ : cardiologie (« InnovaCoeur »). Plateforme générique : « InnovaCare ».

| Module | Public | Où il tourne | Données |
| --- | --- | --- | --- |
| eCardioScope | médecins du service | **local** (fichier HTML posé à côté de l'Excel) | complètes |
| Publieur | porteur du projet | **local** | lit tout, n'exporte que le public |
| Paramètres | porteur du projet | **local** | `parametres.json` |
| InnovActeur | patients (smartphone) | GitHub Pages | publiques, niveau patient |
| InnovAction | cardiologues libéraux | GitHub Pages | publiques, niveau professionnel |
| Mémos, newsletter | médecins du service | générés | publiques (DECT seulement en local) |

Architecture : Excel (disque partagé du CHU) → eCardioScope (local, données complètes)
et → Publieur (local) → `site/donnees/protocoles.json` (champs publics seulement) → pages publiques.

## 2. Le porteur du projet

David, cardiologue praticien hospitalier, **sans formation en développement**, seul à maintenir l'outil.

- Réponds en **français**. Explique chaque choix technique en termes simples, sans jargon non défini.
- Avant de coder une étape, propose un plan court et attends sa validation (il travaille en mode Plan).
- À la fin de chaque étape, dis-lui **exactement comment tester** (quel fichier ouvrir, quoi cliquer,
  ce qu'il doit voir) et ce qui reste à faire.
- En cas de doute sur une donnée ou un besoin, **pose la question** plutôt que de supposer.
  Toute donnée non sourcée est marquée `[à confirmer]`.
- Préfère toujours la solution la plus simple qu'il pourra comprendre et maintenir seul.

## 3. Règles absolues (ne jamais enfreindre)

1. **Aucune donnée patient** n'est transmise, stockée, journalisée ni mise en cache. Aucun formulaire
   n'envoie de données. Pas de cookie. Ce qu'un patient saisit reste dans sa page et disparaît à la fermeture.
2. **Aucune donnée confidentielle sur GitHub** : le dépôt est public. Ne jamais committer de fichier
   `.xlsx`, sauf la copie de développement `reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx`.
   Les champs de visibilité « interne » (synopsis, critères d'exclusion, CJP, NSN, recrutés/objectif,
   remarques, DECT) ne doivent **jamais** apparaître dans `site/` ni dans `protocoles.json`.
   Un test automatique doit le vérifier.
3. **Aucune mention du CHU de Nantes** (ni logo, ni nom) dans les pages et outils. Les adresses
   e-mail `@chu-nantes.fr` restent autorisées.
4. **Ne rien inventer** : noms d'études, phrases patient, critères, contacts viennent de l'Excel.
   Un champ vide reste vide. Ne jamais reformuler une phrase patient.
5. **Rien de propre à la cardiologie dans le code** : pathologies, vignettes, filtres, noms des
   modules, couleurs, textes passent par `parametres.json`.
6. **Coût nul, aucune installation** sur les postes du CHU : pas de serveur, pas de base de données.

## 4. Choix techniques

- HTML, CSS, JavaScript « vanilla ». Pas de framework (React, Vue…). Pas de TypeScript.
- **Outils locaux** (eCardioScope, Publieur, Paramètres, Migration) : chacun est **un seul fichier HTML
  autonome** qui marche par double-clic (`file://`), hors ligne, dans Edge 157 et Chrome.
  Conséquence : pas d'`import` de modules ni de `fetch` de fichiers locaux dans ces outils ;
  les bibliothèques et la police sont intégrées dans le fichier.
- Pour produire ces fichiers autonomes, un petit script Node (`outils-src/construire.mjs`, sans
  dépendance ou presque) assemble les sources de `src/` et des bibliothèques. **C'est toi qui le lances
  à chaque modification et qui commits les fichiers produits** dans `outils/` : David n'a jamais
  à exécuter de commande.
- Lecture et écriture Excel : **ExcelJS** (nécessaire pour les listes déroulantes, messages de saisie,
  mises en forme conditionnelles et regroupements de lignes). Pas de macro VBA.
- Mémorisation du fichier Excel : File System Access API (Edge 157 la prend en charge), avec repli
  sur un simple sélecteur de fichier.
- Publication : API GitHub (jeton à portée limitée au dépôt, saisi par David dans le Publieur et
  conservé dans le navigateur). Repli obligatoire : téléchargement du JSON pour dépôt manuel.
- **Site public** dans `site/`, déployé sur GitHub Pages **par GitHub Actions** (seul `site/` est publié).
  Les pages publiques lisent `donnees/protocoles.json` et `parametres.json` au chargement.
- Mesure d'audience : GoatCounter, pages publiques uniquement, sans cookie.
- Police DM Sans (fichiers intégrés localement), palette par défaut :
  turquoise #00bac6, or #fab316, rose #ef4d89, vert #23cd4b (modifiable dans les paramètres).

## 5. Le schéma de données : une seule définition

Tous les champs d'une fiche protocole sont décrits **une seule fois**, dans `src/schema.js` :
identifiant, libellé exact de la ligne Excel, bloc, type, valeurs autorisées, obligatoire ou non,
niveau de visibilité (`interne` / `pro` / `patient`), message d'aide pour l'ARC.
Le gabarit Excel, l'import, les contrôles, l'export public et les affichages **dérivent de ce schéma**.
Ajouter un champ = modifier le schéma, pas cinq fichiers.

Même principe pour les filtres d'éligibilité : définis dans `parametres.json`, une seule valeur par
protocole, utilisée par tous les modules (voir le cahier des charges, § 4).

## 6. Organisation du dépôt

```
CLAUDE.md                 ce fichier
docs/                     cahier des charges, guide du porteur, tutoriels, CHANGELOG.md
reference/                fichiers d'origine (non publiés) : copie dev de l'Excel, anciens outils
src/                      code partagé (schéma, lecture Excel, moteur d'éligibilité, rendu des mémos…)
outils-src/               sources des outils locaux + script de construction
outils/                   outils locaux PRÊTS À L'EMPLOI (fichiers HTML autonomes, générés)
site/                     site public (GitHub Pages) : accueil, innovacteur/, innovaction/, memos/
site/donnees/             protocoles.json (public), parametres.json
tests/                    tests automatiques (node --test) + jeux de protocoles FICTIFS
.github/workflows/        déploiement Pages, brouillon de newsletter du lundi
```

## 7. Façon de travailler

- Une étape = une branche = une pull request, de taille raisonnable, avec une description en français
  qui dit ce qui change et **comment tester**.
- Lance les tests avant chaque push ; ajoute des tests pour toute logique d'éligibilité, d'import,
  de migration et de filtrage public/interne. Utilise des protocoles fictifs dans les tests.
- Code et commentaires en français, noms de variables lisibles (le français est accepté).
- Tiens `docs/CHANGELOG.md` à jour (date, version, changements en langage simple).
- Pour une interface, décris ce que David verra et propose si utile une capture ou une maquette
  avant de tout construire.
- Ne supprime ni ne réécris un fichier de `reference/`.

## 8. Terminologie et style

- Médicaments : **DCI** systématique ; nom commercial une seule fois entre parenthèses, côté patient
  surtout (ex. « spironolactone (Aldactone) »).
- Typographie française : espaces insécables avant « : ; ? ! », guillemets « ».
- Vocabulaire : « HTA », « DAVD/CAVD », « ACR / mort subite » ; côté patient, la FEVG est
  la « force de contraction cardiaque ».
- Patients âgés (60 à 85 ans) : grands caractères (18 px minimum), contrastes forts, gros boutons.

## 9. Repères sur les données actuelles

- L'Excel actuel a une colonne par étude et un onglet par pôle, mais les lignes diffèrent d'un onglet
  à l'autre. Exemple d'erreur réelle : la colonne VICTORION Rides, collée de l'onglet USIC vers
  « Études en suivi ou terminées », a ses informations décalées d'une ligne à l'autre.
- Le statut est parfois écrit dans le nom (« PINNACLE (non ouverte aux inclusions pour le moment) »).
- Les DECT sont collés aux noms ; les filtres sont en texte libre (« 18-80 », « > 40 ») ;
  les traitements sont parfois en noms commerciaux (« entresto »).
- Dans la copie de développement, le contenu interne est remplacé par « [interne – masqué] » et
  les DECT par des numéros fictifs 9xxxx. Le vrai fichier n'est jamais dans le dépôt : la migration
  réelle sera faite par David, en local, avec l'outil de migration.
- Annuaire : e-mails au format prenom.nom@chu-nantes.fr ; MSSanté des investigateurs au format
  prenom.nom@chu-nantes.mssante.fr (format paramétrable, adresse explicite prioritaire).

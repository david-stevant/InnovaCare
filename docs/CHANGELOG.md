# Journal des modifications

Les changements sont décrits en langage simple, du plus récent au plus ancien.

## Version 0.6.0 — 19 novembre 2026 — Étape 1.5 : simplification pour le porteur du projet

- **Les réglages sont rangés dans l'Excel des études**, dans un onglet invisible (« très masqué » : les ARC
  ne le voient pas). L'Excel devient la source unique : études, annuaire et réglages.
- **Outil Paramètres** : « Ouvrir l'Excel », modifier, puis **« Enregistrer dans l'Excel »**.
  - Le fichier est réécrit à sa place, après le téléchargement automatique d'une copie de sauvegarde.
  - Si l'Excel est ouvert ailleurs, l'enregistrement est refusé sans rien abîmer.
  - Si le navigateur ne sait pas écrire dans le fichier, l'outil télécharge le fichier mis à jour.
  - Les problèmes qui bloqueraient la publication (DECT, nom de l'établissement…) sont signalés dès la saisie.
- **Publieur** :
  - il lit les réglages dans l'Excel ;
  - s'ils ont changé, il publie aussi `parametres.json`, après contrôle, et **avant** les études ;
  - sa dernière section affiche les versions en ligne des outils, avec un lien de téléchargement.
- **Plus besoin de moi pour ajouter une pathologie** ou changer un texte. Je ne reconstruis les outils que
  si leur code change.
- **Noms de fichiers sans ambiguïté** :
  - la migration produit `InnovaCoeur_ETUDES.xlsx` (nom tiré du nom de l'instance) ;
  - le gabarit vierge s'appelle `…_ETUDES_gabarit_vierge.xlsx`, la sauvegarde `…_sauvegarde_AAAA-MM-JJ.xlsx` ;
  - chaque outil affiche son numéro de version en bas de page ; la liste est dans `outils/versions.json`.
- **Guide du porteur réécrit** : tableau « quel fichier, où, pour quoi faire », récupération d'un outil
  (bouton « Download raw file »), ajout d'une pathologie clic par clic, colonnes rouges de la migration.
- **Tests** : 100 tests.
  - Les tests utilisent une copie figée des réglages (`tests/donnees/parametres-test.json`) : un réglage
    publié par le porteur ne peut plus bloquer la mise en ligne.
  - Sur les réglages en ligne, seules des règles sont vérifiées.
  - Nouveaux tests : aller-retour des réglages dans l'Excel, ajout d'une pathologie, pôle renommé, contrôles
    avant publication, écriture du fichier, syntaxe de chaque outil.

## Version 0.5.0 — 19 novembre 2026 — Étape 1.4 : Publieur, site public minimal, GitHub Pages

- **Nouvel outil `outils/Publieur.html`** :
  - il lit l'Excel harmonisé, puis contrôle sa cohérence ;
  - une erreur rouge (nom en double, statut hors liste, ligne manquante) bloque la publication ; les
    avertissements orange ne la bloquent pas ;
  - il compare avec la version en ligne et affiche les études ajoutées, modifiées ou retirées ;
  - il publie `protocoles.json` sur GitHub en un clic, avec un jeton limité au dépôt ;
  - en secours, il propose le téléchargement du fichier pour un dépôt manuel.
- **Liste blanche** (`src/export-public.js`) : seuls les champs du schéma de niveau professionnel ou
  patient, et non verrouillés, sont exportés.
- **Contacts publiés** (décision du 19/11) : seulement le nom de l'investigateur principal et son
  adresse MSSanté, si elle est vérifiée. Aucune donnée d'ARC ; le DECT n'est jamais publié.
- **Date de mise à jour automatique** : elle ne change que si une information publique change.
- **Site public minimal** (`site/`) : les études ouvertes, regroupées par pôle. Il est **discret** :
  non référencé (`noindex`, `robots.txt`), avec un bandeau « Version de test ». Aucun cookie, aucune
  mesure d'audience.
- **Déploiement GitHub Pages** (`.github/workflows/pages.yml`) : il publie le seul dossier `site/`,
  **après** avoir relancé tous les tests.
- **`docs/GUIDE_PORTEUR.md`** : activer le site, créer le jeton, publier, dépôt manuel, procédure de
  bascule vers l'Excel harmonisé, gestes courants.
- **Tests** : 85 tests. Le test « sentinelle » vérifie que **aucun champ interne n'est publié** ; le
  contenu du dossier `site/` est analysé à chaque test.

## Version 0.4.0 — 19 novembre 2026 — Étape 1.3 : paramètres complets et formulaire d'édition

- **Nouvel outil `outils/Parametres.html`** : modification de tous les réglages de l'instance (identité,
  couleurs, pôles, pathologies, vignettes patient, filtres et traitements, textes, mémos, newsletter),
  avec aperçu en direct et vérification permanente. Le résultat se télécharge en `parametres.json`.
  Le même outil **met à jour un Excel harmonisé** après un changement de paramètres, sans perte :
  une valeur dont la ligne a disparu est gardée en Remarques ; les notes « à ressaisir » et le rapport
  de migration sont conservés.
- **`parametres.json` complet** :
  - 20 contextes cliniques d'e-CardioScope v4, dans le même ordre, plus « Endocardite », tag de l'Excel
    (à confirmer) ;
  - 7 vignettes patient d'InnovaCoeur v2 ;
  - questions et textes patient d'InnovaCoeur v2 repris mot pour mot ;
  - en-tête et sections des mémos ; réglages de la newsletter.
- **Mentions de l'établissement retirées des textes repris** (règle 3) : bandeau de la page patient,
  début du sous-titre, deuxième ligne du pied de page, titre des mémos.
- **Libellés patient des traitements** : la DCI d'abord, puis le nom commercial entre parenthèses
  (correction : la v2 commençait par le nom commercial).
- **Correction de vocabulaire** : « DAVD / CAVG » d'e-CardioScope v4 devient « DAVD / CAVD ».
- **Excel harmonisé** : listes déroulantes de pathologies et de vignettes. La migration convertit les
  anciens tags grâce à des synonymes. Sur la copie de développement, seuls « CMI », « HTAP » et « PM »
  restent à choisir à la main.
- **`reference/`** : anciens outils ajoutés (mémos v3, e-CardioScope v4, InnovaCoeur v2), avec des DECT
  fictifs et sans chemin du disque partagé ; un test le vérifie. Provenance dans `reference/SOURCES.md`.
- **Tests** : 73 tests.

## Version 0.3.0 — 19 novembre 2026 — Étape 1.2 : gabarit Excel harmonisé et migration

- **Nouvel outil `outils/Migration.html`** : on y dépose l'ancien Excel, il fabrique le **nouvel Excel
  harmonisé** rempli avec les études existantes, à télécharger. L'ancien fichier n'est pas modifié.
  Un bouton fournit aussi un **gabarit vierge**.
- **Nouvel Excel** : un onglet par pôle, tous avec exactement les mêmes 88 lignes ; listes déroulantes
  (statut, phase, pôles, personnes de l'annuaire, requis/exclu…) ; message d'aide sur chaque ligne ;
  champs obligatoires vides en orange ; statut en couleur ; colonne « Exemple » ; feuilles protégées
  sans mot de passe ; onglets Annuaire, Listes et « Rapport de migration » (ce qu'il reste à vérifier).
- **Règles de migration** : rien n'est deviné. Toute valeur non convertible est gardée en Remarques,
  précédée de « [migration] ». Les doublons sont fusionnés en une seule colonne, l'autre pôle étant noté.
  Les colonnes décalées sont reprises telles quelles, surlignées en rouge, et masquées de tous les
  affichages. Les DECT passent dans l'annuaire, et les personnes absentes de l'annuaire y sont ajoutées.
- **Décisions du 19/11** : les classes « IEC ou ARA2 » et « inhibiteur de la myosine » sont gardées ;
  une étude annulée prend le statut « terminé ». Le pôle des études de l'onglet « suivi ou terminées »
  est proposé dans `correspondances-ancien-excel.json` (à valider).
- **Règle 5** : les exemples propres à la cardiologie des messages d'aide passent dans `parametres.json`
  (rubrique `champs`) ; le schéma ne contient plus que des textes génériques.
- **Tests** : 65 tests, dont un aller-retour complet sur la copie de développement : ancien Excel →
  migration → nouvel Excel → relecture. Plus de 300 textes d'origine vérifiés, aucun perdu.
- Sur le vrai fichier, la lecture de 1.1 a fonctionné : 66 études ; les 8 colonnes signalées comme
  décalées le sont toutes réellement.

## Version 0.2.0 — 19 novembre 2026 — Étape 1.1 : schéma, lecture de l'Excel actuel, rapport de contrôle

- **Nouvel outil `outils/Controle.html`** : on y dépose l'Excel actuel (ou on le recharge d'un clic, le
  navigateur s'en souvient). Il affiche un rapport de tout ce que la migration devra traiter : colonnes
  décalées, statuts écrits dans les noms, doublons entre onglets, DECT collés aux noms, ARC absents de
  l'annuaire, dates et filtres en texte libre, noms commerciaux… Le fichier n'est pas modifié ; rien n'est
  envoyé ni enregistré. Un bouton copie **uniquement les compteurs** (sans aucun contenu), à transmettre.
- **Schéma de données** (`src/schema.js`) : la liste unique de tous les champs d'une fiche et de l'annuaire,
  avec leur visibilité. Les champs internes (synopsis, critères d'exclusion, CJP, NSN, recrutés/objectif,
  remarques, DECT…) portent un verrou « jamais public » qu'aucun paramètre ne peut lever.
- **Paramètres minimaux** (`site/donnees/parametres.json`) : pôles, listes (phase, statut…), filtres
  d'éligibilité et classes de traitements (DCI, noms commerciaux). Pathologies et vignettes : étape 1.3.
- **Description de l'ancien Excel** (`outils-src/donnees/correspondances-ancien-excel.json`) : onglets,
  libellés et corrections déjà validées, hors du code.
- **Bibliothèque ExcelJS 4.4.0** (licence MIT) intégrée aux outils. Un petit correctif lui permet de lire
  aussi les fichiers réenregistrés par d'autres logiciels qu'Excel (cas de la copie de développement).
- **Tests automatiques** : 42 tests, dont un test d'ensemble sur la copie de développement.
- **Diagnostic du 19/11 sous Edge 157, sur un poste du CHU, réseau du CHU** : GitHub entièrement joignable
  (API en lecture et en envoi, site, Pages). La publication en un clic sera possible depuis le CHU.

## Version 0.1.0 — 17 novembre 2026 — Étape 1.0 : diagnostic et mise en place

- **Nouvel outil `outils/Diagnostic.html`** : à ouvrir par double-clic sur un poste hospitalier. Il vérifie
  en deux minutes si le poste peut joindre GitHub (publication en un clic ou dépôt manuel) et si le
  navigateur retient un fichier d'une session à l'autre. Il produit un compte rendu à copier-coller,
  sans aucune donnée personnelle.
- **Script de construction** (`outils-src/construire.mjs`) : assemble les sources en fichiers HTML autonomes
  dans `outils/`. Lancé par Claude, jamais par le porteur du projet.
- **Tests automatiques** (`npm test`), relancés par GitHub à chaque pull request : outils à jour, aucun
  chargement extérieur, aucune mention de l'établissement, un seul fichier Excel dans le dépôt.
- **Police DM Sans** intégrée aux outils (licence libre OFL, fournie dans le dépôt).
- **Diagnostic du 19/11** (Chrome 158 sous Windows) : mémorisation du fichier **validée** (fichier retrouvé
  après fermeture du navigateur, relu après un seul clic d'autorisation) ; stockage local et copie
  automatique fonctionnent. **Accès à GitHub depuis un poste hospitalier : reste à tester.**
- **Ménage** : suppression du doublon de la copie de développement de l'Excel à la racine du dépôt
  (seule la copie de `reference/` est conservée, conformément aux règles du projet).

# Journal des modifications

Les changements sont décrits en langage simple, du plus récent au plus ancien.

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

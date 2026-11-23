# Journal des modifications

Les changements sont décrits en langage simple, du plus récent au plus ancien.

## Version 0.13.0 — 23 novembre 2026 — Phase 4.2 : InnovActeur, mascotte et FEVG en %

- **Mascotte** : un petit cœur souriant dessiné dans la page (aucune image extérieure), aux couleurs des
  paramètres, qui accompagne chaque écran d'une bulle (textes réglables, textes de départ à confirmer),
  salue, réagit aux réponses, se réjouit des résultats ou encourage s'il n'y en a pas.
- **Conclusion** « Devenez InnovActeur ! » en bas des résultats ; **transitions douces** entre les étapes ;
  animations coupées si le téléphone demande de réduire les animations.
- **Confort sur smartphone** : « Étape n sur 3 », bouton « Continuer » toujours visible, zones tactiles
  d'au moins 48 px. Emplacement prévu (caché) pour une vidéo, à déposer dans le site (pas de vidéo
  hébergée ailleurs : cookies).
- **FEVG saisie en %** : nouveau mode de réponse « nombre + « Je ne sais pas » » pour les filtres à bornes
  (outil Paramètres, colonne « Réponse du patient ») ; « Je ne sais pas » n'écarte aucune étude.
- **Outil Paramètres** : rubrique « Mascotte et conclusion », colonne « Réponse du patient ».
- `docs/A_FAIRE_PORTEUR.md` mis à jour. **Tests** : 151 tests.

## Version 0.12.2 — 22 novembre 2026 — Correctif urgent : publication bloquée à la mise en ligne

- La publication des études du 22/11 (« 17 modifiée(s) ») n'a pas été mise en ligne : un test vérifiait
  le fichier publié avec les **réglages de test** (e-mails des ARC non publiés) au lieu des **réglages en
  ligne** (publication des e-mails des ARC activée le 22/11). Le test utilise désormais les réglages en
  ligne, comme prévu à l'étape 1.5 ; le test « sentinelle » garde les réglages de test.
- La mise en ligne se relance aussi quand les tests ou le code partagé changent.

## Version 0.12.1 — 22 novembre 2026 — Correctif : dire où se trouve le texte refusé

- Avant de publier les réglages, le contrôle de la règle 3 (aucun nom ni sigle de l'établissement) et
  ceux du DECT et du contenu interne indiquent désormais **l'endroit** (rubrique et champ de l'outil
  Paramètres, par exemple « Messages types › Adressage (libéraux) › corps › ligne 3 ») et **un extrait**
  du texte en cause. Les messages apparaissent dans le Publieur et en haut de l'outil Paramètres.
- **Faux positif corrigé** : un mot dont les dernières lettres suivent une lettre accentuée (« à terme
  échu », « déchu ») était pris à tort pour le sigle de l'établissement. Le sigle seul, ou suivi de la
  ville, reste refusé. Même correction dans le test qui analyse le dossier `site/`.
- **Tests** : 149 tests.

## Version 0.12.0 — 22 novembre 2026 — Phase 4.1 : page des patients (InnovActeur)

- **Page InnovActeur** (`site/innovacteur/`), base InnovaCoeur v2, textes repris des paramètres :
  page d'accueil (bénéfices, témoignages), puis test en 3 étapes — vignettes, précisions (seulement les
  questions rédigées pour les patients et utiles ; IMC calculé à partir de la taille et du poids ;
  traitements à cocher), résultats (phrase patient et détails pratiques mot pour mot).
- **« Contacter l'équipe de recherche »** : message type des paramètres, nom et date de naissance
  facultatifs (ils remplissent les blancs du modèle), « Ouvrir ma messagerie » vers l'ARC n° 1 et
  « Copier ». Visible seulement si les e-mails des ARC sont publiés. Rien n'est envoyé par le site.
- **Moteur d'éligibilité** : accepte une réponse en fourchette (« force de contraction normale » = au
  moins le seuil) ; une étude n'est écartée que si sa fourchette ne peut pas convenir.
- Accueil : l'entrée « Je suis patient » est active.
- **Cahier des charges § 10** : feuille de route validée (phases 1 à 6) ; **`docs/A_FAIRE_PORTEUR.md`** :
  vos tâches en attente.
- **Tests** : 147 tests.

## Version 0.11.0 — 22 novembre 2026 — Phase 3.2 : « Nouveautés » et « Mentions »

- **Page « Nouveautés »** des médecins libéraux : études ouvertes depuis moins de 30 jours (début
  d'inclusion) et fins de recrutement annoncées, avec un lien qui ouvre directement la fiche dans
  InnovAction. Une étude sans date n'y figure pas (rien n'est deviné).
- **Page « Mentions »** (lien en bas de chaque page) : texte réglable dans l'outil Paramètres (nouvelle
  rubrique « Page Mentions ») ; tant qu'il est vide, un texte de départ s'affiche, avec l'éditeur et le
  contact « [à compléter] » et la finalité « [à confirmer] ». Aucune mention de l'établissement.
- **Guide** : Nouveautés, Mentions, rappel sur « MSSanté vérifiée ».
- **Tests** : 140 tests.

## Version 0.10.0 — 22 novembre 2026 — Phase 3.1 : accueil public et InnovAction (médecins libéraux)

- **Accueil du site** : deux entrées, « Je suis médecin » (InnovAction) et « Je suis patient » (InnovActeur,
  bientôt). Noms des modules tirés des paramètres ; l'outil interne n'est jamais lié.
- **Page InnovAction** (`site/innovaction/`) : études publiées pour les libéraux et ouvertes ; tuiles par
  pathologie, recherche, profil du patient facultatif (même moteur que le screening interne, critères du
  module « médecins libéraux »), fiche détaillée, **« Adresser un patient »** vers la MSSanté vérifiée de
  l'investigateur principal (« Ouvrir ma messagerie », « Copier l'adresse », « Copier le message »).
  Le corps du message vient des paramètres ; tant qu'il n'est pas rédigé, seul l'objet est prérempli.
- **Code partagé avec le site** : `src/texte.js` (fonctions de base, séparées de `normalisation.js`),
  `src/eligibilite.js` et le nouveau `src/public.js` sont recopiés automatiquement dans `site/js/commun/` ;
  un test vérifie que les copies sont à jour.
- **Outil Paramètres** : réglages du site (sous-titre, bandeau, avertissement de la page des médecins).
- Aucun cookie, aucun formulaire qui envoie, pas de mesure d'audience (site discret).
- **Tests** : 137 tests.

## Version 0.9.0 — 21 novembre 2026 — Phase 2.3 : mémos générés par l'outil interne

- **Onglet « Mémos »** dans `outils/eCardioScope.html` : le mémo des études ouvertes, au format des
  mémos CardioScope v3 (sections par pôles, nom — thématique, intervention et design, critères
  d'inclusion principaux, ARC avec DECT et e-mail), toujours à jour à partir de l'Excel.
  - « Tout le mémo » ou une section ; case « Sans DECT » pour une diffusion hors du service.
  - « Copier pour un mail » (texte mis en forme pour Outlook) et « Copier en texte brut » (Markdown).
  - Encadré « À compléter dans l'Excel » : études ouvertes sans critère principal ou sans ARC.
- **Contenu repris tel quel de l'Excel** : seuls les seuils chiffrés passent en gras et le tiret tapé en
  début de critère est retiré ; tout texte de l'Excel est « échappé » (il ne peut pas casser la mise en page).
  Les études mises en avant viennent en tête de leur section.
- **Code partagé** `src/memos.js`, qui servira aussi à la version publique (sans DECT) et à la newsletter.
- **Tests** : 130 tests, dont 9 pour les mémos.

## Version 0.8.0 — 21 novembre 2026 — Phase 2.2 : screening dans l'outil interne

- **Onglet « Screening »** dans `outils/eCardioScope.html` (ouvert par défaut ; « Catalogue » à côté).
  Même logique qu'e-CardioScope v4, sur une seule page au lieu de trois étapes :
  - contexte clinique en un clic (la liste se replie ensuite ; plusieurs contextes possibles) ;
  - seuls les critères utiles s'affichent, et disparaissent quand plus aucune étude possible n'en dépend ;
  - résultats en direct : critères d'inclusion, pastilles « ✓ vérifié » / « à vérifier », ARC avec DECT,
    fiche complète ; liste des études écartées avec la raison ;
  - « Nouveau patient » efface tout ; les valeurs saisies ne sont jamais enregistrées.
- **Moteur d'éligibilité partagé** (`src/eligibilite.js`), qui servira aussi aux pages pour les libéraux
  et pour les patients : bornes incluses, requis / exclu / indifférent, question propre à une étude ;
  une valeur non renseignée n'écarte jamais une étude. Les filtres viennent des paramètres.
- **Tests** : 121 tests, dont 9 pour le moteur (études fictives et copie de développement).

## Version 0.7.0 — 19 novembre 2026 — Phase 2.1 : outil interne, catalogue des études

- **Nouvel outil `outils/eCardioScope.html`** (nom affiché tiré des paramètres) : le catalogue des études,
  version « présentable » de l'Excel, pour les médecins du service.
  - Cartes ou tableau triable ; recherche plein texte sans accents ni majuscules ; filtres par statut
    (« ouvert » par défaut), pôle (y compris « autre pôle concerné »), pathologie et ARC.
  - Fiche détaillée : tous les champs remplis, critères d'exclusion compris (mention « interne »),
    contacts avec DECT et e-mail tirés de l'annuaire, jauge recrutés / objectif. Impression sur une page.
  - Les études « non affichées dans l'outil interne » sont cachées par défaut (case pour les montrer) ;
    les colonnes à ressaisir après migration sont signalées.
  - Lit les réglages rangés dans l'Excel ; mémorise le fichier comme le Publieur et l'outil Paramètres.
  - **Aucun appel réseau, aucune donnée gardée dans le navigateur** ; un test le vérifie. Jamais publié.
- **Compléments de l'étape 1.5** (arrivés après la fusion de la PR n° 6) : brouillon automatique de
  l'outil Paramètres, `parametres.json` téléchargé avec un nom daté, sauvegarde nommée
  `ANCIENNE_VERSION_…` (voir 0.6.0).
- **Guide** : quand utiliser « Déposer le protocoles.json actuel » ; quand retélécharger les outils
  (seulement quand leur code change) ; mode d'emploi de l'outil interne.
- **Tests** : 112 tests (catalogue sur études fictives et sur la copie de développement, confidentialité
  de l'outil interne).

## Version 0.6.0 — 19 novembre 2026 — Étape 1.5 : simplification pour le porteur du projet

- **Les réglages sont rangés dans l'Excel des études**, dans un onglet invisible (« très masqué » : les ARC
  ne le voient pas). L'Excel devient la source unique : études, annuaire et réglages.
- **Outil Paramètres** : « Ouvrir l'Excel », modifier, puis **« Enregistrer dans l'Excel »**.
  - Le fichier est réécrit à sa place, après le téléchargement automatique d'une copie de sauvegarde.
  - Si l'Excel est ouvert ailleurs, l'enregistrement est refusé sans rien abîmer.
  - Si le navigateur ne sait pas écrire dans le fichier, l'outil télécharge le fichier mis à jour.
  - Les problèmes qui bloqueraient la publication (DECT, nom de l'établissement…) sont signalés dès la saisie.
- **Brouillon automatique dans l'outil Paramètres** :
  - une modification non enregistrée n'est plus perdue si la page se ferme ;
  - à la réouverture, un bandeau propose « Reprendre ces modifications » ;
  - le brouillon est gardé sur ce poste seulement (mémoire locale du navigateur, pas de cookie) et ne
    contient que des réglages ;
  - il est effacé après un enregistrement réussi dans l'Excel.
- **Nom daté du parametres.json téléchargé** (`parametres_AAAA-MM-JJ_HHhMM.json`) : fini les
  « parametres (1).json » qu'on confond avec l'ancien.
- **Publieur** :
  - il lit les réglages dans l'Excel ;
  - s'ils ont changé, il publie aussi `parametres.json`, après contrôle, et **avant** les études ;
  - sa dernière section affiche les versions en ligne des outils, avec un lien de téléchargement.
- **Plus besoin de moi pour ajouter une pathologie** ou changer un texte. Je ne reconstruis les outils que
  si leur code change.
- **Noms de fichiers sans ambiguïté** :
  - la migration produit `InnovaCoeur_ETUDES.xlsx` (nom tiré du nom de l'instance) ;
  - le gabarit vierge s'appelle `…_ETUDES_gabarit_vierge.xlsx`, la sauvegarde `ANCIENNE_VERSION_…_ETUDES_AAAA-MM-JJ_HHhMM.xlsx`, pour ne jamais la confondre avec le bon fichier ;
  - chaque outil affiche son numéro de version en bas de page ; la liste est dans `outils/versions.json`.
- **Guide du porteur réécrit** : tableau « quel fichier, où, pour quoi faire », récupération d'un outil
  (bouton « Download raw file »), ajout d'une pathologie clic par clic, colonnes rouges de la migration.
- **Tests** : 103 tests.
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

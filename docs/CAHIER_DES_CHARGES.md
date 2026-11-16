# Cahier des charges — InnovaCare / InnovaCoeur

Nov 16, 2026 · @David STEVANT

## 1. Contexte, objectif et contraintes

Objectif : regrouper dans un seul outil web tout ce qui sert le recrutement dans les protocoles de recherche clinique d'un service, à partir d'une source de données unique. Chaque modification d'un protocole (amendement, fin de recrutement, nouvel ARC) doit se répercuter automatiquement dans toutes les sorties.

L'outil remplace et fusionne trois outils existants, livrés et validés : les mémos CardioScope (Markdown/HTML publiés sur GitHub Pages), e-CardioScope v4 (aide au screening pour cliniciens, HTML monofichier) et InnovaCoeur v2 (auto-test patient, HTML monofichier). Ces fichiers sont fournis dans `reference/` et servent de base fonctionnelle et visuelle.

**Porteur** : un cardiologue praticien hospitalier, sans formation en développement ni équipe dédiée. Il maintient l'outil seul. Toute explication technique doit être pédagogique.

**Utilisateurs** : environ 15 ARC (saisie), les médecins et internes du service (consultation, screening), les patients (auto-test), les cardiologues libéraux (consultation, adressage). Environ 20 à 30 protocoles actifs, 40 avec les études en suivi ou terminées.

### Contraintes non négociables

1. **Aucune donnée patient** n'est transmise, stockée ou journalisée par l'outil. Tout ce qui concerne un patient s'exécute dans son navigateur et disparaît à la fermeture de la page.
2. **Aucun document confidentiel** (synopsis, protocole, critères d'exclusion détaillés, chiffres de recrutement) n'est déposé sur GitHub ni publié.
3. **Coût nul et aucune installation** sur les postes du CHU : hébergement GitHub Pages, pas de serveur, pas de base de données, pas de logiciel à installer.
4. **Maintenable par un non-informaticien** : HTML/CSS/JavaScript sans framework lourd ni étape de compilation complexe. Chaque fichier doit être lisible et commenté en français.
5. **Générique dès le départ** : rien de propre à la cardiologie n'est codé en dur. Tout passe par un fichier de paramètres, pour pouvoir dupliquer l'outil dans une autre spécialité.
6. **Pas de mention explicite du CHU de Nantes** tant que l'outil n'est pas validé institutionnellement : ni logo, ni nom dans les en-têtes. Les adresses de contact @chu-nantes.fr restent nécessaires.
7. **Minimum de manipulations** pour le porteur : chaque étape répétitive (publication, newsletter, date de mise à jour) est automatisée autant que possible.

## 2. Nomenclature des modules

InnovaCare désigne la plateforme générique ; chaque spécialité en déploie une instance (InnovaCoeur pour la cardiologie). Les noms des modules sont des paramètres, pas des chaînes codées en dur.

| Module | Public | Support prioritaire | Données utilisées | Où il tourne |
| --- | --- | --- | --- | --- |
| **InnovaCare** | — | — | Plateforme générique, modèle à dupliquer | Dépôt GitHub « modèle » |
| **InnovaCoeur** | Toute l'instance de cardiologie | — | Toutes | — |
| **eCardioScope** | Médecins et internes du service | Ordinateur (smartphone apprécié) | **Complètes** (internes + publiques) | En local, à côté de l'Excel sur le disque partagé, jamais en ligne |
| **InnovActeur** | Patients | **Smartphone** | Publiques, version patient | GitHub Pages |
| **InnovAction** | Cardiologues libéraux | Ordinateur (smartphone apprécié) | Publiques, version professionnelle | GitHub Pages |
| **Mémos** | Médecins du service | Copier-coller dans un mail | Publiques, version professionnelle | Générés par l'outil |
| **Newsletter** | Médecins du service (puis libéraux volontaires) | Copier-coller dans un mail | Publiques + champ « mettre en avant » | Générée chaque semaine |
| **Publieur** | Porteur du projet | Ordinateur | Lit l'Excel complet, n'exporte que le public | En local |

Pour une autre spécialité, eCardioScope devient eDermatoScope, eHématoScope, etc. : le nom suit le paramètre de spécialité.

## 3. Architecture

L'Excel harmonisé, sur le disque partagé, reste la seule source de vérité. Deux flux en partent : un flux interne qui ne quitte jamais le CHU, et un flux public qui ne transporte que les champs autorisés.

&#91;embedded content: Architecture · flux interne et flux public\]

Seul le Publieur franchit la frontière, et il n'emporte que les champs marqués « public ».

### Flux interne (données complètes)

1. Les ARC modifient l'Excel comme aujourd'hui.
2. eCardioScope est un fichier HTML posé à côté de l'Excel. Il lit le classeur directement dans le navigateur (bibliothèque SheetJS intégrée au fichier, sans connexion réseau). L'utilisateur sélectionne le fichier une première fois ; sur Edge ou Chrome, l'outil mémorise le fichier et propose un bouton « Recharger ».
3. Rien n'est envoyé nulle part : les données complètes restent sur le réseau du CHU.

### Flux public (extrait non confidentiel)

1. Le **Publieur** (fichier HTML local) lit l'Excel et contrôle sa cohérence (champs obligatoires vides, valeurs hors liste, e-mail ARC inconnu).
2. Il compare avec la version actuellement en ligne et affiche un **résumé des changements** protocole par protocole. La date de dernière mise à jour de chaque protocole modifié est fixée automatiquement à ce moment.
3. Il exporte **uniquement les champs marqués « public »** dans un fichier `donnees/protocoles.json`.
4. Un clic sur « Publier » envoie ce fichier sur GitHub via l'API, avec un jeton d'accès limité à ce seul dépôt et mémorisé dans le navigateur du porteur.
5. GitHub Pages sert le site ; InnovActeur, InnovAction et les mémos lisent `protocoles.json` à l'ouverture. Aucune page n'est à reconstruire : toutes les sorties sont à jour dès la publication.
6. **Solution de repli**, si le réseau du CHU bloque l'API GitHub : le Publieur télécharge le fichier JSON, que le porteur dépose dans l'éditeur web de GitHub.

### Principes techniques

- Site statique : HTML, CSS et JavaScript, sans framework ni compilation. Une bibliothèque est acceptable si elle tient dans un fichier local (pas de CDN obligatoire pour les outils locaux).
- Un fichier de paramètres `parametres.json` décrit la spécialité (§ 8). Les pages lisent les paramètres et les protocoles ; elles ne contiennent aucune donnée.
- Les outils locaux (eCardioScope, Publieur) fonctionnent par double-clic, sans serveur.
- Code commenté en français, tests automatiques sur la logique d'éligibilité et sur l'import de l'Excel.

## 4. Modèle de données d'une fiche protocole

Une fiche unique et complète par protocole, dont chaque champ porte un niveau de visibilité ; chaque sortie ne prend que les champs de son niveau. Il n'y a donc pas trois versions des textes à maintenir, seulement deux textes propres aux patients (phrase et détails pratiques).

**Niveaux de visibilité** : **I** = interne (eCardioScope seulement, jamais publié) · **P** = professionnel (mémos, newsletter, InnovAction) · **Pt** = patient (InnovActeur). Un champ P est aussi visible en interne ; un champ Pt aussi en P et I. Les niveaux par défaut ci-dessous sont modifiables dans les paramètres.

### Champs

| Bloc | Champ | Format | Visibilité | Saisie |
| --- | --- | --- | --- | --- |
| Identification | Nom court de l'étude | Texte | Pt | ARC |
| Identification | Titre complet | Texte | P | ARC |
| Identification | Promoteur | Texte | P | ARC |
| Identification | Coordinateur national | Texte | P | ARC |
| Identification | Phase | Liste : I, II, III, IV, étude observationnelle, registre, dispositif médical | P | ARC |
| Identification | N° NCT ou EU CT | Texte, facultatif (sert au préremplissage, § 6.6) | P | ARC |
| Identification | Statut | Liste : à venir, ouvert, suspendu, clos aux inclusions (suivi), terminé | P | ARC |
| Identification | Mettre en avant | Oui / non | I | ARC ou investigateur |
| Identification | Dernière mise à jour | Date, **calculée automatiquement** par le Publieur | P | Automatique |
| Classement | Pathologies | Liste multiple (définie dans les paramètres) | Pt | ARC |
| Classement | Thématique courte | Texte (ex. « ICFEP + surpoids ou DT2 ») | P | ARC |
| Science | Synopsis | Texte long | I | ARC |
| Science | Intervention vs comparateur | Texte court, DCI | P | ARC |
| Science | Design | Texte court (randomisation, aveugle, ratio) | P | ARC |
| Science | Critères d'inclusion principaux | 3 à 5 lignes | P | ARC |
| Science | Autres critères d'inclusion | Lignes | I | ARC |
| Science | Critères d'exclusion principaux | Lignes | I | ARC |
| Science | Critère de jugement principal | Texte | I | ARC |
| Science | NSN global, nombre de centres | Texte | I | ARC |
| Organisation | Début d'inclusion | Date | P | ARC |
| Organisation | Fin de recrutement prévue | Date | P | ARC |
| Organisation | Durée de suivi | Texte | P | ARC |
| Organisation | Rythme des visites | Texte | P | ARC |
| Organisation | Recrutés Nantes / objectif Nantes | Deux nombres | I | ARC |
| Organisation | Remarques | Texte | I | ARC |
| Contacts | Investigateur principal | Liste (onglet « Annuaire ») | P | ARC |
| Contacts | ARC n° 1, ARC back-up | Liste (onglet « Annuaire ») | Pt (e-mail), I (DECT) | ARC |
| Patient | Phrase patient | 1 à 2 phrases, reprises telles quelles | Pt | ARC ou investigateur |
| Patient | Détails pratiques | Texte court (posologie, visites, indemnités) | Pt | ARC ou investigateur |
| Patient | Vignettes patient | Liste multiple (paramètres) | Pt | ARC |
| Patient | Lien vers une note d'information vulgarisée | URL, facultatif \[à valider réglementairement\] | Pt | ARC |
| Affichage | Afficher dans eCardioScope / InnovAction / InnovActeur | Oui / non, trois champs | I | ARC |

L'annuaire (nom, fonction, DECT, e-mail, adresse MSSanté) est saisi une seule fois ; les fiches s'y réfèrent par une liste déroulante. Le DECT n'est jamais publié. L'adresse MSSanté est déduite du nom selon un format paramétrable (prenom.nom@chu-nantes.mssante.fr), sauf si une adresse est saisie explicitement dans l'annuaire.

### Filtres d'éligibilité paramétrables

La liste des filtres est définie dans les paramètres de la spécialité, pas dans le code. Chaque filtre est décrit par :

- un identifiant, un libellé professionnel et, s'il est posé aux patients, une question vulgarisée ;
- un type : bornes numériques (min et max), « requis / exclu / indifférent », ou liste ;
- les modules qui le posent (eCardioScope, InnovAction, InnovActeur) ;
- pour la version patient, la règle de traduction (ex. « FEVG min ≥ 40 % » devient la question « La force de contraction de votre cœur est-elle normale ? »).

Une seule valeur par protocole sert à tous les modules : la distinction actuelle entre filtres e-CardioScope et filtres InnovaCoeur disparaît de l'Excel.

**Liste initiale pour InnovaCoeur** : âge, FEVG, DFG, IMC, NT-proBNP, diabète, HTA, porteur de PM ou de DAI, hospitalisation pour insuffisance cardiaque récente (délai en mois), et traitements par classe (bêtabloquant, antagoniste des récepteurs minéralocorticoïdes, sacubitril/valsartan, gliflozine, diurétique de l'anse, anticoagulant), chacun « requis / exclu / indifférent ».

Les questions patient sur les traitements affichent la DCI suivie des noms commerciaux usuels, définis une fois dans les paramètres (ex. « spironolactone (Aldactone) ou éplérénone (Inspra) ») : le patient reconnaît ainsi sa boîte.

## 5. Fichier Excel harmonisé

L'Excel reste l'outil de saisie des ARC, avec la même logique qu'aujourd'hui (une colonne par étude, un onglet par pôle). En revanche, sa structure devient strictement identique d'un onglet à l'autre, et il est rendu plus ergonomique. Aucun nouvel outil n'est imposé aux ARC.

### Structure

| Onglet | Rôle |
| --- | --- |
| Lisez-moi | Mode d'emploi en une page : ajouter un protocole, changer un statut, règles de saisie |
| Un onglet par pôle (IC, Cardiomyopathies-Amyloses, Valves, Rythmologie, Hémodynamique, USIC, HTA, Endocardites, Transversales) | Une colonne par étude ; **mêmes lignes, même ordre, mêmes libellés** dans tous les onglets |
| Annuaire | Investigateurs et ARC : nom, pôle, DECT, e-mail, MSSanté |
| Listes | Valeurs autorisées des listes déroulantes (pathologies, vignettes, statuts, phases), générées depuis les paramètres ; protégé |

L'onglet « Études en suivi ou terminées » disparaît : une étude reste dans son pôle et change simplement de statut, ce qui conserve l'historique. L'onglet « Synthétique ++ pour mémo » disparaît aussi, puisque les mémos sont générés.

### Ergonomie (sans macro)

- Colonne A figée, avec les libellés ; blocs de lignes repérés par une bande de couleur et repliables (fonction Plan d'Excel).
- Listes déroulantes pour toutes les valeurs fermées (statut, phase, pathologies, ARC, filtres « requis / exclu / indifférent »).
- **Message d'aide** sur chaque cellule (fonction « message de saisie » d'Excel) : la consigne et un exemple apparaissent quand l'ARC clique sur la cellule. C'est la saisie guidée, champ par champ, sans outil supplémentaire.
- Mise en forme conditionnelle : champ obligatoire vide en orange, statut en couleur, étude « mise en avant » signalée.
- Une colonne modèle « Nouveau protocole », à copier.
- Colonne A et structure protégées (sans mot de passe ou avec un mot de passe simple), pour qu'on ne puisse pas casser les lignes.
- Pas de macro VBA : elles sont souvent bloquées sur les postes hospitaliers et fragilisent un fichier partagé.

### Migration

Un script de migration, exécuté une seule fois, convertit l'Excel actuel vers le nouveau gabarit. Il produit un rapport des valeurs à vérifier manuellement :

- dates saisies en texte (ex. « novembre 2025 ») ;
- DECT collé au nom (« Océane SALOMON 65717 »), à séparer et rattacher à l'annuaire ;
- filtres au format libre (« 18-80 », « > 40 ») à convertir en min/max ;
- traitements en noms commerciaux (« entresto ET MRA ET beta-bloquant ») à convertir en classes ;
- doublons entre onglets (étude présente dans plusieurs pôles) ;
- ARC de l'onglet Valves listés en Hémodynamique dans l'annuaire (§ 11).

## 6. Spécifications fonctionnelles par module

Toutes les sorties appliquent les mêmes règles : seules les études au statut « ouvert » sont proposées (les autres restent visibles en interne) ; une étude présente dans plusieurs pathologies n'apparaît qu'une fois ; aucun texte n'est inventé ni reformulé (un champ vide s'affiche vide ou masqué, jamais complété).

### 6.1 Page d'accueil publique

Deux entrées, « Je suis patient » (InnovActeur) et « Je suis médecin » (InnovAction). eCardioScope n'est jamais lié depuis le site public.

### 6.2 eCardioScope (interne, local)

Remplace à la fois la consultation de l'Excel brut et e-CardioScope v4. Deux vues :

- **Catalogue** : toutes les études en cartes ou en tableau, triables et filtrables par pôle, pathologie, statut et ARC, avec une recherche plein texte. Une fiche détaillée affiche tous les champs, critères d'exclusion compris, les contacts avec DECT et une jauge recrutés / objectif. Impression d'une fiche en une page. C'est la version « présentable » de l'Excel.
- **Screening** : la logique de la v4 est conservée (contexte clinique, puis filtres qui n'apparaissent que s'ils discriminent les études restantes, compteur en direct, puis cartes avec contact ARC). **L'interface et l'ergonomie sont à retravailler** : moins de clics, lecture plus rapide, affichage correct sur smartphone.

Le configurateur actuel (`eCardioscope_configurateur.html`) est remplacé par les paramètres (§ 8) : l'ordre des boutons de contexte clinique y est défini.

### 6.3 InnovAction (cardiologues libéraux, public)

Présentation sobre et professionnelle, même moteur que le screening.

- Navigation par pathologie (tuiles), recherche, et un mode « profil patient » qui filtre par critères.
- Fiche : nom, phase, promoteur, thématique, intervention vs comparateur, design, critères d'inclusion principaux, durée et rythme de suivi, investigateur principal, date de dernière mise à jour.
- **Adresser un patient** : l'adressage se fait vers l'**adresse MSSanté de l'investigateur principal** (les ARC n'ont pas de MSSanté), qui transfère ensuite à l'ARC.
  - Un lien `mailto:` préremplit le destinataire, l'objet (« Adressage protocole \[NOM\] ») et un corps de message modèle, que le libéral complète.
  - Ce lien n'ouvre la messagerie sécurisée que si elle est l'application de messagerie par défaut du poste, ce qui est rarement le cas (webmail MSSanté, logiciel métier). Deux boutons sont donc toujours affichés : **« Copier l'adresse »** et **« Copier le message »**, à coller dans n'importe quelle messagerie.
  - Aucune donnée patient ne transite par l'outil.
- Page **« Nouveautés »** : études ouvertes depuis moins de 30 jours, fins de recrutement annoncées.

### 6.4 InnovActeur (patients, public, smartphone d'abord)

Base fonctionnelle : InnovaCoeur v2 (parcours, textes éditoriaux validés, témoignages, messages de résultat et pied de page repris de la passation). Le nom de l'outil patient devient InnovActeur.

- **Parcours** : page éditoriale, puis bouton « Faites le test (< 1 min) », puis trois étapes (vignettes cliniques ; précisions affichées seulement si elles discriminent ; résultats).
- **Résultat** : nom du protocole, phrase patient, détails pratiques, puis deux issues. **Contacter l'équipe** : le patient peut saisir nom et date de naissance dans la page, uniquement pour préremplir le mail ; le mail part depuis sa propre messagerie vers l'ARC, avec une zone de texte à copier en secours. Ou bien **« Parlez-en à votre cardiologue »**. Rien n'est envoyé ni conservé par l'outil.
- **Design** : c'est ici que l'ambition visuelle est la plus forte. Le public est âgé (60 à 85 ans) : grands caractères, forts contrastes, gros boutons, peu de texte par écran. Pistes : une **mascotte interactive** (petit personnage cœur animé en SVG qui guide le parcours et réagit aux réponses), des transitions douces, et une conclusion « **Devenez InnovActeur !** ». Un emplacement est prévu pour une courte vidéo de vulgarisation sur la recherche clinique (phase ultérieure).
- Pas de lien vers les notes d'information à ce stade (champ prévu, activable après validation réglementaire).

### 6.5 Mémos

Une page générée reprend le format validé : `### 🔬 NOM — thématique`, puis 📌 intervention vs comparateur et design, puis ✅ 3 à 5 critères d'inclusion avec seuils en gras, puis 📞 ARC, DECT et e-mail. Sections par pathologie, en-tête `#TeamCoeur - #ChaqueInclusionCompte` (paramétrable). Le DECT étant interne, les mémos sont générés par eCardioScope (local) ; la version publique omet le DECT.

Boutons **« Copier pour un mail »** (texte mis en forme) et **« Copier en texte brut »**, pour tout le mémo ou un seul pôle. Pas de DOCX.

### 6.6 Assistant « nouveau protocole » (phase ultérieure)

Outil local qui guide la saisie champ par champ. Si un numéro NCT est fourni, il préremplit les champs publics depuis l'API de ClinicalTrials.gov (titre, promoteur, phase, design, intervention, critère de jugement principal, critères bruts à résumer). L'ARC vérifie, puis clique sur « Copier la colonne » et la colle dans une colonne vide de l'Excel. Le préremplissage depuis EU CT (CTIS) est à étudier \[à confirmer\].

### 6.7 Dictionnaire de vulgarisation (phase ultérieure, non prioritaire)

Proposition automatique d'une phrase patient à partir des champs complets et d'un dictionnaire paramétrable (« randomisé » devient « tiré au sort », « double aveugle » devient « ni vous ni votre médecin ne savez quel traitement vous recevez », « placebo » devient « traitement sans principe actif »). La proposition est toujours relue et validée par un humain avant d'être recopiée dans l'Excel.

## 7. Automatisations

Un seul geste manuel subsiste : le clic sur « Publier », car GitHub ne peut pas lire un fichier situé sur le disque partagé du CHU. Tout le reste est automatique, et un rappel hebdomadaire signale quand ce clic est utile.

### 7.1 Publication

- Un clic dans le Publieur (§ 3) suffit. Les pages publiques sont à jour en une à deux minutes.
- La date de dernière mise à jour de chaque protocole est calculée à ce moment : elle reflète la dernière modification d'un champ public. Aucune saisie de date n'est demandée aux ARC.
- Les ARC modifient en autonomie ; il n'y a **pas de circuit de validation** préalable. Le résumé des changements affiché avant publication permet au porteur un contrôle d'un coup d'œil, sans revalider chaque virgule.

### 7.2 Brouillon de newsletter et rappel hebdomadaire

Chaque lundi matin, une tâche planifiée de GitHub (GitHub Actions, gratuite) génère un brouillon à partir des données publiques. Elle le dépose sous forme de ticket (« issue ») dans le dépôt. **GitHub envoie automatiquement un e-mail de notification** à chaque personne qui suit le dépôt : le porteur, et la responsable de la newsletter si elle crée un compte gratuit. Il n'y a ni serveur d'envoi ni mot de passe de messagerie à gérer.

Contenu du ticket :

1. **Brouillon prêt à copier-coller** : 2 à 3 protocoles à mettre en lumière. Ordre de priorité : études « mises en avant », puis études nouvellement ouvertes, puis rotation des autres (la moins récemment présentée d'abord, historique conservé dans le dépôt).
2. **Rappel au porteur** : « Si l'Excel a changé cette semaine, pensez à publier. »
3. **Contrôles** : études dont la fin de recrutement prévue est dépassée mais toujours au statut « ouvert », et études non mises à jour depuis plus de 6 mois.

Le ticket ne contient que des données déjà publiques : il peut rester visible dans un dépôt public.

### 7.3 Newsletter pour les libéraux (phase ultérieure)

Une liste d'abonnés implique de stocker des adresses e-mail (RGPD : consentement, désinscription, registre de traitement). Première étape sans donnée personnelle : la page « Nouveautés » d'InnovAction et un flux RSS. Un abonnement par e-mail sera étudié si l'usage le justifie.

## 8. Paramétrage et duplication

Un médecin non informaticien doit pouvoir créer l'instance d'une autre spécialité en une demi-journée, sans écrire de code.

### 8.1 Page « Paramètres »

Un formulaire local, avec aperçu en direct, produit le fichier `parametres.json`. Il contient :

- l'identité : nom de la spécialité, noms des modules (InnovaCoeur, InnovActeur, InnovAction, eCardioScope), logo, signatures, textes éditoriaux et témoignages ;
- les couleurs et la police ;
- les pôles, pathologies et vignettes patient, ainsi que l'ordre des boutons de contexte clinique ;
- les filtres d'éligibilité (§ 4) et la correspondance DCI / noms commerciaux ;
- les niveaux de visibilité par champ ;
- les modèles de texte : e-mail patient, message d'adressage, en-tête des mémos, messages « aucun résultat » et mentions de pied de page ;
- les paramètres de newsletter : jour d'envoi, nombre de protocoles mis en lumière.

Le même formulaire régénère l'onglet « Listes » de l'Excel quand les pathologies ou les filtres changent.

### 8.2 Duplication

- Le dépôt InnovaCare est un **dépôt modèle** GitHub (bouton « Use this template »). Les données de cardiologie vivent dans un dossier séparé, pour pouvoir partir d'un modèle vide.
- Un Excel vierge, de même structure, est fourni avec le modèle.
- Un **tutoriel pas à pas** (`TUTORIEL_NOUVELLE_SPECIALITE.md`, avec captures d'écran) couvre six étapes : dupliquer le dépôt, activer GitHub Pages, remplir les paramètres, créer l'Excel (vierge ou copie), relier le Publieur au nouveau dépôt avec son jeton, et faire la première publication.
- Un second tutoriel, `GUIDE_PORTEUR.md`, décrit les gestes courants : publier, ajouter un ARC, ajouter un filtre, et que faire si la publication échoue.

## 9. Exigences transverses

| Domaine | Exigence |
| --- | --- |
| Identité visuelle | Aucun logo ni nom du CHU. Palette par défaut reprise d'InnovaCoeur v2 (turquoise #00bac6, or #fab316, rose #ef4d89, vert #23cd4b), modifiable dans les paramètres. Police DM Sans, embarquée localement pour les outils hors ligne. |
| Design | InnovActeur : ambition visuelle forte (§ 6.4). InnovAction : sobre et professionnel. eCardioScope : dense mais lisible, orienté vers l'efficacité. Une même grammaire visuelle pour les trois. |
| Supports | InnovActeur pensé d'abord pour le smartphone. InnovAction et eCardioScope pensés pour l'ordinateur, mais utilisables sur smartphone. Navigateurs : Edge et Chrome (postes CHU), Safari iOS, Chrome Android. |
| Accessibilité | Contrastes suffisants (niveau AA), navigation au clavier, textes agrandissables. Pour le public âgé : corps 18 px minimum côté patient. |
| Terminologie | DCI systématique (nom commercial une seule fois entre parenthèses). Typographie française : espaces insécables, guillemets « ». Vocabulaire standardisé : « HTA », « DAVD/CAVD », « ACR / mort subite » ; côté patient, la FEVG devient la « force de contraction cardiaque ». |
| Fidélité aux données | Noms, phrases patient, filtres et contacts proviennent de l'Excel, jamais inventés ni reformulés. Une donnée absente reste absente. |
| RGPD | Aucune donnée patient, aucun cookie, aucun formulaire qui envoie quoi que ce soit. Page « Mentions » : éditeur, finalité, absence de collecte, avertissement « l'éligibilité définitive sera confirmée par votre cardiologue et l'équipe de recherche ». Les noms et e-mails professionnels des ARC et investigateurs sont publiés : les intéressés en sont informés au préalable. |
| Mesure d'audience | GoatCounter (gratuit, sans cookie, sans donnée personnelle) sur les seules pages publiques : visites par page, nombre de tests réalisés, clics sur « Contacter » et « Adresser » (comptage anonyme d'événements). Rien sur les outils locaux. |
| Propriété | Aucune licence ouverte à ce stade (tous droits réservés), en attente de l'avis de la cellule de valorisation. Le dépôt est public, car c'est la condition de la gratuité de GitHub Pages : le code est donc visible, mais pas réutilisable librement. |
| Qualité | Tests automatiques sur l'import de l'Excel et sur la logique d'éligibilité, avec des jeux de protocoles fictifs. Code commenté en français. Versions numérotées et journal des modifications (`CHANGELOG.md`). |

## 10. Phasage et critères de validation

Six phases successives, chacune livrée, testée et validée par le porteur avant la suivante. Aucune échéance n'est imposée. La phase 0, ce cahier des charges, se fait en conversation ; les phases 1 à 6 se déroulent dans Claude Code, avec Fable.

&#91;embedded content: Feuille de route · 6 phases et leurs critères de passage\]

Le socle (phase 1) conditionne tout le reste. eCardioScope vient ensuite, car il ne publie rien et peut être utilisé en interne sans aucun avis institutionnel.

**Méthode dans chaque phase** : proposition de plan et de maquette, validation par le porteur, développement, tests automatiques, démonstration en local, corrections ciblées, puis publication. Fable explique chaque choix technique en termes simples et met à jour `CHANGELOG.md`.

## 11. Points ouverts et données à confirmer

Aucun de ces points ne bloque le démarrage : la phase 1 peut commencer, et ils seront traités au fil des phases.

### Données

- [ ] ARC non renseigné : Dyna-MI, LEVOHEARTSHOCK ; à confirmer : MULTIVALVE, ATA-301, LA-HCM
- [ ] Résolu le 16/11 : audrey.ernould@chu-nantes.fr (POLARIS), emilie.conan@chu-nantes.fr (ARCADIA), guenola.coste@chu-nantes.fr ; orthographes confirmées « Guénola » et « Helena » Fettre. À corriger lors de la migration
- [ ] Rattachement d'Alexandra Auvrignon, Marine Renard et Helena Fettre : listées « ARC Valves » dans l'onglet Valves, mais en Hémodynamique dans l'annuaire
- [ ] Phrase patient d'EDEARLY-AF, rédigée provisoirement, à valider
- [ ] VICTORION Rides : vérifier que la version publiée indique bien l'inclisiran
- [ ] Adresses MSSanté des investigateurs : format prenom.nom@chu-nantes.mssante.fr ; vérifier dans l'annuaire MSSanté les noms composés ou accentués
- [ ] Concevoir le logo définitif InnovaCoeur

Constats sur l'Excel du 16/11, à traiter par la migration :

- Dans l'onglet « Études en suivi ou terminées », la colonne VICTORION Rides a été collée depuis l'onglet USIC, dont les lignes diffèrent : son design se retrouve en ligne « critères d'inclusion », son NSN (300) et ses dates parmi les critères, et ses ARC sont perdus. C'est l'illustration du besoin d'une structure identique dans tous les onglets.
- Le statut est parfois écrit dans le nom de l'étude (« PINNACLE (non ouverte aux inclusions pour le moment) », « ENITH-MACE (non ouverte… ) ») : la migration doit l'extraire vers le champ Statut.

### Décisions proposées par défaut (modifiables)

- NT-proBNP : jamais demandé aux patients, qui connaissent rarement leur valeur ; utilisé seulement dans eCardioScope et InnovAction.
- Liens vers les notes d'information : champ prévu mais désactivé jusqu'à l'avis réglementaire.

### Réglementaire et institutionnel (avant la mise en ligne patient)

- [ ] Avis de la DRCI sur la diffusion publique d'une liste d'études et de questions d'éligibilité : certains supports de recrutement relèvent du promoteur ou du CPP \[à confirmer\]
- [ ] Information du DPO (outil sans collecte de données)
- [ ] Information des ARC et investigateurs dont le nom et l'e-mail professionnel sont publiés
- [ ] Contact avec la cellule de valorisation (propriété intellectuelle, licence)

### Techniques, à vérifier en début de phase 1

- [ ] Le réseau du CHU laisse-t-il passer l'API GitHub depuis un poste ? Sinon, la solution de repli par dépôt manuel s'applique.
- [ ] Résolu : Edge 157 est installé au CHU et prend en charge la mémorisation du fichier Excel ; une autorisation d'un clic sera redemandée à chaque nouvelle session du navigateur.

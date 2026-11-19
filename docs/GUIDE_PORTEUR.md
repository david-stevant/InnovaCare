# Guide du porteur du projet — gestes courants

Ce guide décrit, clic par clic, ce que le porteur du projet fait lui-même. Aucune commande à taper.

## 0. Quel fichier, où, pour quoi faire

**Règle simple : on travaille toujours sur le disque partagé, dans le dossier « Innovacoeur - outils ».
GitHub ne sert qu'à récupérer les outils et à héberger le site public.**

| Fichier | Où il vit | À quoi il sert | Qui l'ouvre |
| --- | --- | --- | --- |
| `InnovaCoeur_ETUDES.xlsx` | dossier « Innovacoeur - outils » | **le seul Excel de travail** : études, annuaire et (dans un onglet invisible) les réglages | les ARC et vous |
| `Publieur.html` | dossier « Innovacoeur - outils » | mettre le site à jour | vous |
| `Parametres.html` | dossier « Innovacoeur - outils » | changer les listes (pathologies, vignettes…), filtres, textes, couleurs | vous |
| `eCardioScope.html` (phase 2) | dossier « Innovacoeur - outils » | consulter les études, screener un patient | les médecins |
| `ARCHIVE_ancien_Excel_NE_PLUS_MODIFIER.xlsx` | ailleurs, en lecture seule | l'ancien Excel, gardé pour mémoire | personne |
| `Migration.html`, `Controle.html`, `Diagnostic.html` | **pas** dans le dossier des outils | ont servi une fois ; la migration ne doit plus être relancée | — |
| `…_sauvegarde_AAAA-MM-JJ.xlsx` | dossier « Téléchargements » de votre PC | copie automatique faite avant chaque enregistrement par l'outil Paramètres | à garder quelques semaines |

Sur GitHub (dépôt InnovaCare), vous ne trouverez **jamais** l'Excel des études : le dépôt est public.
On n'y voit que la copie de développement, sans contenu confidentiel, qui sert aux tests automatiques.

**Chrome ou Edge ?** Les deux conviennent. Gardez toujours le même : le fichier mémorisé et le jeton
GitHub ne sont retenus que dans le navigateur où vous les avez donnés.

Sommaire
1. Récupérer (ou mettre à jour) un outil
2. Activer le site public (une seule fois)
3. Créer le jeton de publication (une fois par an)
4. Publier les études
5. Si la publication échoue : dépôt manuel
6. Changer une liste, un filtre, un texte (ex. ajouter la pathologie « CMD »)
7. Basculer vers l'Excel harmonisé (une seule fois)
8. Gestes courants dans l'Excel
9. Ce qui est publié, et ce qui ne l'est jamais

---

## 1. Récupérer (ou mettre à jour) un outil

Un outil est un fichier `.html` : il s'ouvre **depuis votre disque**, par double-clic, comme un document
Word. Sur GitHub, il ne s'affiche que sous forme de code : c'est normal.

1. Sur github.com, ouvrir le dépôt **InnovaCare**, puis le dossier **outils**.
2. Cliquer sur le nom du fichier, par exemple `Publieur.html`.
3. En haut à droite du contenu, cliquer sur le bouton **« Download raw file »** (flèche vers le bas).
4. Le fichier arrive dans « Téléchargements ». Le **déplacer** dans le dossier « Innovacoeur - outils »
   (en remplaçant l'ancienne version s'il y en a une).
5. Double-cliquer dessus : il s'ouvre dans le navigateur.

**Savoir si un outil est à jour** : son numéro de version est écrit tout en bas de sa page. Le Publieur
affiche, dans sa dernière section, les numéros des versions en ligne. S'ils diffèrent, refaire les étapes
1 à 4 pour cet outil.

## 2. Activer le site public (une seule fois — déjà fait)

Settings → Pages → Source : **GitHub Actions**. Le site est à l'adresse
`https://david-stevant.github.io/InnovaCare/`.

> Avant chaque mise en ligne, GitHub relance automatiquement tous les tests, dont celui qui vérifie
> qu'aucun champ interne n'est présent. Si un test échoue, **rien n'est mis en ligne** : l'onglet
> **Actions** du dépôt affiche alors une croix rouge, avec l'explication.

Le site est pour l'instant **discret** : il n'est pas référencé par les moteurs de recherche et affiche
un bandeau « Version de test ». Ne pas diffuser son adresse avant l'avis de la DRCI et l'information
du DPO.

## 3. Créer le jeton de publication (une fois par an)

Le jeton est une sorte de mot de passe limité : il permet **seulement** de modifier les fichiers de ce
dépôt, rien d'autre sur votre compte.

1. Sur github.com : votre photo (en haut à droite) → **Settings** → tout en bas à gauche
   **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Remplir :
   - **Token name** : « Publieur » ;
   - **Expiration** : 1 an au plus (GitHub enverra un rappel avant l'expiration) ;
   - **Repository access** : **Only select repositories** → choisir **InnovaCare** ;
   - **Permissions** → **Repository permissions** → **Contents** : **Read and write**. Ne rien cocher d'autre.
3. Cliquer sur **Generate token** et copier le jeton affiché (il commence par `github_pat_`).
   Il ne sera plus jamais affiché : s'il est perdu, il suffit d'en créer un nouveau.
4. Le coller dans le Publieur (section 4). Il y reste mémorisé dans ce navigateur ; le bouton
   « Oublier le jeton » l'efface.

Ne jamais envoyer ce jeton par e-mail ni le coller dans une conversation.

## 4. Publier les études

1. Dans le dossier « Innovacoeur - outils », double-cliquer sur **`Publieur.html`**.
2. Section 1 : cliquer sur **« Choisir l'Excel »** et sélectionner `InnovaCoeur_ETUDES.xlsx`.
   Les fois suivantes, cliquer simplement sur **« Recharger « InnovaCoeur_ETUDES.xlsx » »** (un clic
   d'autorisation peut être demandé).
3. Section 2, **Contrôles** : une erreur rouge empêche la publication (par exemple un statut mal écrit) ;
   la corriger dans l'Excel, enregistrer l'Excel, puis « Recharger ». Les avertissements orange
   n'empêchent pas de publier.
4. Section 3, **Changements** : études ajoutées, modifiées ou retirées, et, si vous les avez changés avec
   l'outil Paramètres, « Réglages modifiés… ils seront publiés aussi ».
5. Section 4 : cliquer sur **Publier** (le jeton n'est demandé que la première fois). Le site est à jour
   en 1 à 2 minutes.

La date « Mise à jour » de chaque étude est calculée automatiquement : elle ne change que si une
information publique de l'étude a changé.

## 5. Si la publication échoue : dépôt manuel

1. Dans le Publieur, section 5 : **Télécharger protocoles.json** (dossier « Téléchargements »).
2. Sur github.com, ouvrir le dépôt, puis les dossiers **site** → **donnees**.
3. **Add file** → **Upload files** ; déposer le fichier `protocoles.json` téléchargé.
4. En bas : laisser « Commit directly to the main branch », écrire par exemple « Publication manuelle
   du 19/11 », puis **Commit changes**. Le site se met à jour comme d'habitude.

## 6. Changer une liste, un filtre, un texte (ex. ajouter la pathologie « CMD »)

**Ne jamais modifier l'onglet « Listes » de l'Excel à la main** : il est verrouillé et recalculé à partir
des réglages ; un ajout manuel serait perdu et refusé par le Publieur.

1. Demander aux ARC de **fermer l'Excel** quelques minutes (l'outil ne peut pas écrire dans un fichier ouvert).
2. Double-cliquer sur **`Parametres.html`**, puis **« Ouvrir l'Excel »** (ou « Recharger ») et choisir
   `InnovaCoeur_ETUDES.xlsx`. La ligne « Réglages affichés : ceux de l'Excel… » le confirme.
3. Ouvrir la rubrique voulue. Pour une pathologie : **« Pathologies (contextes cliniques) »** →
   **« + Ajouter une pathologie »** → remplir *Identifiant* (ex. `cmd`, minuscules sans accent), *Nom*
   (ex. « Cardiomyopathie dilatée (CMD) ») et *Groupe*.
   - Questions posées aux patients (PM/DAI, hospitalisation pour IC…) : rubrique **« Filtres d'éligibilité
     et traitements »**, champ « Question posée au patient » du filtre concerné ;
   - libellé patient d'un traitement : même rubrique, champ « Libellé patient (traitement) » ;
   - message d'adressage aux libéraux : rubrique **« Messages types »**.
4. Vérifier, en haut des rubriques : « ✔ Paramètres cohérents ».
5. Section 2 : cliquer sur **« Enregistrer dans l'Excel »** (accepter l'autorisation d'écrire).
   - Une copie de sauvegarde de l'ancienne version arrive dans « Téléchargements ».
   - Message « ✔ Enregistré » : c'est fait. Message « L'Excel est ouvert » : le fermer partout et recommencer.
6. Ouvrir le **Publieur**, « Recharger », puis **Publier** : le site utilise désormais les nouveaux réglages.

Je n'ai plus besoin d'intervenir pour ces changements.

## 7. Basculer vers l'Excel harmonisé (une seule fois)

1. **Choisir une date** et prévenir les ARC : à partir de cette date, **plus aucune modification dans
   l'ancien fichier**.
2. Ouvrir `Migration.html` (depuis « Téléchargements », pas depuis le dossier des outils), déposer l'ancien
   fichier, cliquer **Télécharger le nouvel Excel** : il s'appelle `InnovaCoeur_ETUDES.xlsx`. Le placer
   dans le dossier « Innovacoeur - outils ».
3. Traiter l'onglet **Rapport de migration** ligne par ligne (colonne « Fait ? ») :
   - **colonnes au nom surligné en rouge** : elles étaient déjà décalées dans l'ancien Excel. Elles sont
     reprises telles quelles et **masquées de tous les affichages** (rien ne sera publié de travers). Les
     ressaisir à la main, en commençant par les études ouvertes ; pour une étude close ou terminée, le nom,
     le statut, l'investigateur et l'ARC suffisent. Chaque ARC peut corriger les siennes. Une fois une
     colonne corrigée, remettre les lignes « Afficher… » à « oui » si besoin ;
   - **tags non reconnus** (ex. CMI, HTAP, PM) : dans l'onglet du pôle, colonne de l'étude, cliquer sur la
     cellule « Pathologie 1 » (ou 2, 3, 4), puis sur la petite flèche à droite, et choisir. Si la bonne
     pathologie manque, l'ajouter d'abord (§ 6) ;
   - dates en texte, personnes ajoutées à l'annuaire (e-mails à compléter), statuts proposés, etc.
4. Le jour de la bascule :
   - renommer l'ancien fichier `ARCHIVE_ancien_Excel_NE_PLUS_MODIFIER.xlsx`, le passer en lecture seule
     et le ranger hors du dossier des outils ;
   - supprimer l'onglet « Rapport de migration » du nouveau fichier ;
   - ouvrir une fois le nouvel Excel avec `Parametres.html` et cliquer « Enregistrer dans l'Excel »
     (seulement s'il a été produit avant la version 0.6 : le Publieur le signale) ;
   - republier avec le Publieur (§ 4) ;
   - informer les ARC ; l'onglet **Lisez-moi** du nouveau fichier sert de mode d'emploi.
5. **Ne plus jamais relancer la migration** : elle repartirait de l'ancien fichier et écraserait les
   corrections.

## 8. Gestes courants dans l'Excel

- **Ajouter une personne** (investigateur, ARC) : remplir une ligne libre de l'onglet **Annuaire**.
  Elle apparaît aussitôt dans les listes déroulantes. Pour qu'un investigateur soit publié comme contact,
  vérifier son adresse dans l'annuaire MSSanté, puis mettre « oui » dans la colonne « MSSanté vérifiée »
  (et son adresse dans « MSSanté » si elle ne suit pas le format habituel).
- **Ajouter une étude** : première colonne libre de l'onglet du pôle (voir l'onglet Lisez-moi).

## 9. Ce qui est publié, et ce qui ne l'est jamais

- **Publié** (fichier `site/donnees/protocoles.json`, visible par tous) : les études affichées aux
  libéraux ou aux patients et non terminées ; seulement les champs de niveau « professionnel » ou
  « patient » (nom, thématique, phase, design, critères d'inclusion principaux, suivi, phrase patient…).
- **Réglages publiés** (`site/donnees/parametres.json`) : listes, filtres, textes, couleurs. Avant
  l'envoi, le Publieur refuse tout réglage contenant un DECT, un contenu interne ou le nom de
  l'établissement (les adresses e-mail restent permises).
- **Contacts publiés aujourd'hui** : le nom de l'investigateur principal et son adresse MSSanté, **si**
  elle est marquée vérifiée. Aucune donnée d'ARC (décision du 19/11/2026, en attendant l'information
  des intéressés ; réglage « Publier les e-mails des ARC » dans l'outil Paramètres).
- **Jamais publié**, quels que soient les réglages : synopsis, critères d'exclusion, autres critères
  d'inclusion, critère de jugement principal, NSN, nombre de centres, recrutés et objectif, remarques,
  mise en avant, DECT, co-investigateurs. Un test automatique le vérifie avant chaque mise en ligne.

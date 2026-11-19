# Guide du porteur du projet — gestes courants

Ce guide décrit, pas à pas, ce que le porteur du projet fait lui-même. Aucune commande à taper :
tout se fait avec les outils du dossier `outils/` (double-clic, dans Edge) et sur le site github.com.

Sommaire
1. Activer le site public (une seule fois)
2. Créer le jeton de publication (une fois par an)
3. Publier les études
4. Si la publication échoue : dépôt manuel
5. Basculer vers l'Excel harmonisé (une seule fois)
6. Gestes courants : ajouter une personne, changer une liste, ajouter un filtre
7. Ce qui est publié, et ce qui ne l'est jamais

---

## 1. Activer le site public (une seule fois)

1. Sur github.com, ouvrir le dépôt **InnovaCare**.
2. Cliquer sur **Settings** (roue dentée, en haut), puis sur **Pages** dans le menu de gauche.
3. Dans « Build and deployment », à la ligne **Source**, choisir **GitHub Actions**.
4. C'est tout. À chaque publication, le site se met à jour tout seul en 1 à 2 minutes, à l'adresse
   affichée sur cette même page (`https://david-stevant.github.io/InnovaCare/`).

> Avant chaque mise en ligne, GitHub relance automatiquement tous les tests, dont celui qui vérifie
> qu'aucun champ interne n'est présent. Si un test échoue, **rien n'est mis en ligne** : l'onglet
> **Actions** du dépôt affiche alors une croix rouge, avec l'explication.

Le site est pour l'instant **discret** : il n'est pas référencé par les moteurs de recherche et affiche
un bandeau « Version de test ». Ne pas diffuser son adresse avant l'avis de la DRCI et l'information
du DPO. Pour le rendre normal plus tard : outil Paramètres → « Publication » → « Site discret » : non.

## 2. Créer le jeton de publication (une fois par an)

Le jeton est une sorte de mot de passe limité : il permet **seulement** de modifier les fichiers de ce
dépôt, rien d'autre sur votre compte.

1. Sur github.com : votre photo (en haut à droite) → **Settings** → tout en bas à gauche
   **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Remplir :
   - **Token name** : « Publieur InnovaCoeur » ;
   - **Expiration** : 1 an au plus (GitHub enverra un rappel avant l'expiration) ;
   - **Repository access** : **Only select repositories** → choisir **InnovaCare** ;
   - **Permissions** → **Repository permissions** → **Contents** : **Read and write**. Ne rien cocher d'autre.
3. Cliquer sur **Generate token** et copier le jeton affiché (il commence par `github_pat_`).
   Il ne sera plus jamais affiché : s'il est perdu, il suffit d'en créer un nouveau.
4. Le coller dans le Publieur (section 4). Il y reste mémorisé dans ce navigateur ; le bouton
   « Oublier le jeton » l'efface.

Ne jamais envoyer ce jeton par e-mail ni le coller dans une conversation.

## 3. Publier les études

1. Ouvrir `outils/Publieur.html` et choisir l'Excel harmonisé (ou cliquer « Recharger »).
2. **Contrôles** : une erreur rouge empêche la publication (par exemple un statut mal écrit) ; la
   corriger dans l'Excel, enregistrer, puis « Recharger ». Les avertissements orange n'empêchent pas
   de publier.
3. **Changements** : vérifier d'un coup d'œil les études ajoutées, modifiées ou retirées.
4. Cliquer sur **Publier**. Le site est à jour en 1 à 2 minutes.

La date « Mise à jour » de chaque étude est calculée automatiquement : elle ne change que si une
information publique de l'étude a changé.

## 4. Si la publication échoue : dépôt manuel

1. Dans le Publieur, section 5 : **Télécharger protocoles.json** (dossier « Téléchargements »).
2. Sur github.com, ouvrir le dépôt, puis les dossiers **site** → **donnees**.
3. **Add file** → **Upload files** ; déposer le fichier `protocoles.json` téléchargé.
4. En bas : laisser « Commit directly to the main branch », écrire par exemple « Publication manuelle
   du 19/11 », puis **Commit changes**. Le site se met à jour comme d'habitude.

## 5. Basculer vers l'Excel harmonisé (une seule fois)

1. **Choisir une date** et prévenir les ARC : à partir de cette date, **plus aucune modification dans
   l'ancien fichier**.
2. Ouvrir `outils/Migration.html`, déposer l'ancien fichier, cliquer **Télécharger le nouvel Excel**.
   Enregistrer le fichier sur le disque partagé, à côté de l'ancien.
3. Traiter l'onglet **Rapport de migration** ligne par ligne (colonne « Fait ? ») : colonnes rouges à
   ressaisir, dates en texte, personnes ajoutées à compléter (e-mails), statuts proposés, etc.
   Compter une à deux semaines.
4. Le jour de la bascule :
   - renommer l'ancien fichier, par exemple « ARCHIVE_… — ne plus modifier », et le passer en lecture seule ;
   - supprimer l'onglet « Rapport de migration » du nouveau fichier ;
   - informer les ARC ; l'onglet **Lisez-moi** du nouveau fichier sert de mode d'emploi.
5. **Ne plus jamais relancer la migration** : elle repartirait de l'ancien fichier et écraserait les
   corrections. L'outil Migration ne sert plus qu'à fournir un gabarit vierge.

## 6. Gestes courants

- **Ajouter une personne** (investigateur, ARC) : remplir une ligne libre de l'onglet **Annuaire** de
  l'Excel. Elle apparaît aussitôt dans les listes déroulantes. Pour qu'un investigateur soit publié
  comme contact, vérifier son adresse dans l'annuaire MSSanté, puis mettre « oui » dans la colonne
  « MSSanté vérifiée » (et son adresse dans « MSSanté » si elle ne suit pas le format habituel).
- **Changer une liste** (pathologies, vignettes, pôles) ou **ajouter un filtre** :
  1. ouvrir `outils/Parametres.html`, faire la modification, vérifier « ✔ Paramètres cohérents » ;
  2. **Télécharger parametres.json** ;
  3. dans le même outil, « Mettre à jour un Excel » : déposer l'Excel harmonisé, enregistrer le fichier
     rendu à la place de l'ancien (après en avoir gardé une copie) ;
  4. déposer le nouveau `parametres.json` sur github.com, dans **site** → **donnees**, comme au § 4
     (ou me l'envoyer : je reconstruirai aussi les outils, qui en contiennent une copie).

## 7. Ce qui est publié, et ce qui ne l'est jamais

- **Publié** (fichier `site/donnees/protocoles.json`, visible par tous) : les études affichées aux
  libéraux ou aux patients et non terminées ; seulement les champs de niveau « professionnel » ou
  « patient » (nom, thématique, phase, design, critères d'inclusion principaux, suivi, phrase patient…).
- **Contacts publiés aujourd'hui** : le nom de l'investigateur principal et son adresse MSSanté, **si**
  elle est marquée vérifiée. Aucune donnée d'ARC (décision du 19/11/2026, en attendant l'information
  des intéressés ; réglage « Publier les e-mails des ARC » dans l'outil Paramètres).
- **Jamais publié**, quels que soient les réglages : synopsis, critères d'exclusion, autres critères
  d'inclusion, critère de jugement principal, NSN, nombre de centres, recrutés et objectif, remarques,
  mise en avant, DECT, co-investigateurs. Un test automatique le vérifie avant chaque mise en ligne.

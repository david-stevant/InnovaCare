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
| `ANCIENNE_VERSION_…_ETUDES_AAAA-MM-JJ_HHhMM.xlsx` | dossier « Téléchargements » de votre PC | **ancienne** version, copiée automatiquement avant chaque enregistrement par l'outil Paramètres : ne pas la remettre dans le dossier des outils (sauf pour annuler un enregistrement) | à garder quelques semaines |

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
10. Consulter les études : l'outil interne (eCardioScope)
11. Le site public : accueil et page des médecins libéraux (InnovAction)
12. La page des patients (InnovActeur)

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

**Faut-il retélécharger les outils après chaque publication ?** Non. Une publication ne change que les
données du site, jamais les outils. Un outil n'est à retélécharger que lorsque son **code** a changé,
c'est-à-dire après la fusion d'une de mes pull requests : sa description dit quels outils sont concernés,
et la section « Versions des outils » du Publieur le signale.

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
   - Le bouton **« Déposer le protocoles.json actuel »** n'apparaît que si le Publieur n'a pas pu lire la
     version en ligne (message « Version en ligne inaccessible… », par exemple GitHub momentanément
     injoignable). Il sert seulement à comparer et à garder les bonnes dates de mise à jour. Le fichier
     à déposer : sur github.com, `site/donnees/protocoles.json`, bouton « Download raw file ». En temps
     normal, il n'y a rien à déposer.
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
   - L'Excel du dossier est mis à jour directement : rien à déplacer. Dans « Téléchargements » arrive
     seulement `ANCIENNE_VERSION_…xlsx`, l'ancienne version, gardée par précaution.
   - Message « ✔ Enregistré » : c'est fait. Message « L'Excel est ouvert » : le fermer partout et recommencer.
6. Ouvrir le **Publieur**, « Recharger », puis **Publier** : le site utilise désormais les nouveaux réglages.

**Page fermée avant d'enregistrer ?** Rien n'est perdu : à la réouverture de `Parametres.html`, un
bandeau jaune propose « Reprendre ces modifications ». Ouvrir d'abord l'Excel, puis cliquer sur
« Reprendre », puis sur « Enregistrer dans l'Excel ». Ce brouillon n'existe que dans le navigateur de ce
poste.

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

## 10. Consulter les études : l'outil interne (eCardioScope)

`eCardioScope.html` se pose dans le dossier « Innovacoeur - outils », à côté de l'Excel. Il sert aux
médecins du service ; il ne publie rien et ne fait **aucun appel réseau** : il peut donc contenir les
informations internes (critères d'exclusion, DECT, recrutement).

1. Double-clic sur `eCardioScope.html`, puis **« Ouvrir l'Excel des études »** et choisir
   `InnovaCoeur_ETUDES.xlsx` (les fois suivantes : « Recharger »). Chaque médecin le fait une fois dans
   son propre navigateur. L'outil lit l'Excel au moment où on l'ouvre : après une modification par un
   ARC, cliquer sur « Recharger ».

### Onglet « Screening » (ouvert par défaut)

1. **Contexte clinique** : cliquer sur une pathologie (le nombre d'études ouvertes est entre
   parenthèses). La liste se replie aussitôt ; « Ajouter ou changer de contexte » la rouvre pour en
   choisir plusieurs.
2. **Patient** : seuls les critères qui comptent pour au moins une étude encore possible s'affichent
   (âge, FEVG, DFG, IMC, NT-proBNP ; Oui / Non pour les antécédents, les traitements et les questions
   propres à certaines études). Un critère devenu inutile disparaît au fur et à mesure.
3. **Résultats en direct**, à droite (sur smartphone : en dessous, bandeau « n études → voir ») :
   critères d'inclusion principaux, pastilles vertes « ✓ » pour ce qui est vérifié et grises « à
   vérifier » pour ce qui n'est pas encore renseigné, ARC avec DECT et e-mail, « Fiche complète ».
   « Études écartées » dit pourquoi chacune l'a été.
4. **Une valeur non renseignée n'écarte jamais une étude.** Bornes incluses (un âge de 80 ans entre
   dans « 18 à 80 »).
5. **« Nouveau patient »** efface tout. Les valeurs saisies ne sont jamais enregistrées : elles
   disparaissent aussi à la fermeture de la page.

Seules les études au statut « ouvert » et affichées dans l'outil interne sont proposées.

### Onglet « Catalogue »

1. Les études « ouvert » s'affichent d'abord ; les puces de statut, les listes (pôle, pathologie, ARC)
   et la recherche (nom, molécule, critère, ARC… sans se soucier des accents) affinent.
   « Tableau » donne une vue en lignes, triable en cliquant sur un titre de colonne.
2. Les études dont « Afficher dans l'outil interne » vaut « non » sont cachées ; la case « inclure les
   études non affichées » les montre.
3. Clic sur une étude : **fiche complète** (tous les champs remplis, contacts avec DECT et e-mail).
   Les informations internes portent la mention « interne ». « Imprimer cette fiche » tient sur une page.

### Onglet « Mémos »

Le mémo des études ouvertes, au format des mémos CardioScope, fabriqué à partir de l'Excel : il est
toujours à jour, sans recopie.

1. **Contenu** : « Tout le mémo » ou une seule section (les sections et leurs pôles se règlent dans
   l'outil Paramètres, rubrique « Sections des mémos »).
2. **« Sans DECT »** : pour envoyer le mémo hors du service ; les numéros de poste disparaissent.
3. **« Copier pour un mail »**, puis Ctrl+V dans un nouveau message Outlook : titres, gras et listes
   sont conservés. **« Copier en texte brut »** donne la version texte (Markdown), comme les anciens mémos.
4. L'encadré **« À compléter dans l'Excel »** liste les études ouvertes sans critère d'inclusion
   principal ou sans ARC : à transmettre aux ARC concernés.

Le texte vient de l'Excel tel quel (nom, thématique, intervention vs comparateur, design, critères
d'inclusion principaux, ARC n° 1). Seuls les seuils chiffrés sont mis en gras automatiquement, et le
tiret tapé en début de critère est retiré (la liste a déjà ses puces). Pour améliorer une phrase du
mémo, on la corrige dans l'Excel.

## 11. Le site public : accueil et page des médecins libéraux (InnovAction)

Adresse : `https://david-stevant.github.io/InnovaCare/` (site encore **discret** : bandeau de test,
non référencé ; ne pas diffuser avant l'avis de la DRCI).

- **Accueil** : deux entrées, « Je suis médecin » (InnovAction) et « Je suis patient » (InnovActeur,
  « bientôt disponible »). L'outil interne n'y est jamais lié.
- **InnovAction** (`…/innovaction/`) : les études publiées pour les libéraux (« Afficher aux médecins
  libéraux » = oui dans l'Excel) et au statut « ouvert ».
  - tuiles par pathologie, recherche plein texte ;
  - « Profil du patient (facultatif) » : le même moteur que le screening interne, limité aux critères
    marqués « médecins libéraux » dans les réglages ; rien n'est enregistré ;
  - fiche détaillée (seulement des informations publiques) ;
  - **« Adresser un patient »** : n'apparaît que si l'adresse MSSanté de l'investigateur principal est
    publiée, c'est-à-dire « MSSanté vérifiée » = oui dans l'Annuaire. Boutons « Ouvrir ma messagerie »,
    « Copier l'adresse » et, si un message type est rédigé, « Copier le message ».

- **Nouveautés** (`…/innovaction/nouveautes.html`, lien en haut d'InnovAction) : études ouvertes depuis
  moins de 30 jours (d'après « Début d'inclusion ») et fins de recrutement annoncées (« Fin de recrutement
  prévue » à venir). Une étude sans ces dates n'y figure pas : les remplir dans l'Excel. « Voir la fiche »
  ouvre directement l'étude dans InnovAction.
- **Mentions** (lien en bas de chaque page) : éditeur, finalité, absence de collecte, hébergement,
  avertissement. Le texte de départ contient des « [à compléter] » (éditeur, contact) et un
  « [à confirmer] » (finalité). Pour le modifier : outil Paramètres → rubrique « Page Mentions »
  (ajouter une rubrique remplace tout le texte de départ : le reprendre en entier, puis l'adapter),
  « Enregistrer dans l'Excel », puis Publier.

**À propos de « MSSanté vérifiée »** : ne mettre « oui » qu'après avoir contrôlé l'adresse dans
l'annuaire santé. L'adresse publiée est sinon **déduite** du nom (prenom.nom@…mssante.fr) et peut être
fausse pour un nom composé ou accentué ; une adresse différente se saisit dans la colonne « MSSanté »
de l'Annuaire (elle est prioritaire).

**À faire pour que l'adressage fonctionne** :
1. Annuaire de l'Excel : vérifier l'adresse MSSanté de chaque investigateur, puis « MSSanté vérifiée » = oui.
2. Outil Paramètres → « Messages types » → « Adressage (libéraux) : corps » : rédiger le message
   (`{protocole}` est remplacé par le nom de l'étude). Facultatif : « Publication » → avertissement de la
   page des médecins.
3. « Enregistrer dans l'Excel », puis Publieur → « Publier ».

## 12. La page des patients (InnovActeur)

Adresse : `…/innovacteur/` (entrée « Je suis patient » de l'accueil). Pensée pour le smartphone et les
patients âgés : grands caractères, gros boutons.

1. **Page d'accueil** : textes de la v2 (titre, bénéfices, témoignages), réglables dans l'outil
   Paramètres (« Textes patient », « Bénéfices », « Témoignages »). Bouton « Faites le test ».
2. **Étape 1** : les **vignettes patient** (outil Paramètres → « Vignettes patient ») qui ont au moins une
   étude affichée aux patients (lignes « Vignette patient » de l'Excel).
3. **Étape 2** : seulement les questions **rédigées pour les patients** (« Question posée au patient »
   des filtres) et utiles pour les études restantes ; taille et poids donnent l'IMC automatiquement ;
   les traitements se cochent (une case non cochée n'écarte jamais une étude). Le NT-proBNP et les
   questions propres aux études (rédigées pour les professionnels) ne sont jamais posés aux patients.
4. **Étape 3** : la **phrase patient** et les **détails pratiques** de l'Excel, mot pour mot ;
   « Contacter l'équipe de recherche » ouvre le message type (outil Paramètres → « Messages types » →
   « E-mail patient ») adressé à l'**ARC n° 1** — seulement si « Publier les e-mails des ARC » est activé.
   Le patient peut y ajouter son nom et sa date de naissance ; **rien n'est envoyé par le site** : il
   envoie le message lui-même depuis sa messagerie.

- **Mascotte** : un petit cœur qui accompagne chaque écran avec une bulle (textes réglables : outil
  Paramètres → « Mascotte et conclusion » ; vides = textes de départ). Elle salue, réagit aux réponses, se
  réjouit quand des études correspondent. Les animations s'arrêtent si le téléphone demande de réduire
  les animations. En bas des résultats : la conclusion (« Devenez InnovActeur ! »).
- **Réponse en chiffre** : pour un filtre à bornes (ex. FEVG), « Réponse du patient » = « nombre +
  « Je ne sais pas » » affiche un champ chiffré et un bouton « Je ne sais pas » (qui n'écarte aucune étude).

Rien de ce que le patient saisit n'est gardé : tout disparaît à la fermeture de la page.
Vos tâches en attente sont listées dans `docs/A_FAIRE_PORTEUR.md`.

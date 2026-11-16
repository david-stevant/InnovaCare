# Consigne de lancement — Phase 1 (socle de données)

> À coller tel quel dans la première session Claude Code, en mode **Plan**.

---

Bonjour. Tu vas développer InnovaCoeur, décrit dans `CLAUDE.md` et `docs/CAHIER_DES_CHARGES.md`.
Commence par lire ces deux fichiers en entier, puis le contenu de `reference/`
(en particulier la copie de développement de l'Excel, onglet par onglet, ligne par ligne).

Nous démarrons la **phase 1 : le socle de données**. Son objectif : que l'Excel harmonisé devienne
une source fiable, et que la chaîne « Excel → Publieur → protocoles.json → GitHub Pages » fonctionne
de bout en bout, même avec une page publique minimale.

## Ce que j'attends de toi maintenant (avant d'écrire du code)

Propose-moi un plan, en français, comprenant :

1. **Ta compréhension du projet** en 10 lignes maximum, et la liste des points du cahier des charges
   qui te paraissent ambigus, contradictoires ou risqués (avec ta recommandation pour chacun).
2. **Le schéma de données complet** : un tableau de tous les champs (identifiant, libellé de ligne
   Excel, bloc, type, valeurs autorisées, obligatoire, visibilité interne/pro/patient, message d'aide
   pour l'ARC), y compris les filtres d'éligibilité et l'annuaire.
3. **Le nouveau gabarit Excel** : ordre exact des lignes, onglets, listes déroulantes, mises en forme.
4. **Le plan de migration** : pour chaque onglet de l'Excel actuel, la correspondance ligne par ligne
   avec le nouveau gabarit, et la liste des cas problématiques que tu as repérés dans la copie de
   développement (décalages de lignes, statut dans le nom, DECT, filtres en texte libre, noms
   commerciaux, doublons entre onglets…).
5. **Le découpage de la phase 1 en étapes**, chacune livrée dans sa propre pull request, avec pour
   chacune ce que je pourrai tester moi-même. Je propose cet ordre, ajuste-le si besoin :
    - **1.0 Diagnostic réseau** : un petit fichier HTML local que j'ouvrirai sur un poste du CHU pour
      vérifier si l'API GitHub est joignable, et si Edge mémorise un fichier choisi.
    - **1.1 Schéma + lecture de l'Excel actuel** + rapport de contrôle, avec tests automatiques.
    - **1.2 Gabarit Excel harmonisé + outil de migration** (`outils/Migration.html`) : je dépose l'ancien
      Excel, je récupère le nouveau et un rapport des valeurs à vérifier.
    - **1.3 Paramètres** : `parametres.json` initial pour la cardiologie + formulaire local d'édition.
    - **1.4 Publieur + protocoles.json + déploiement GitHub Pages**, avec une page publique minimale
      listant les études publiées, et un test qui garantit qu'aucun champ interne n'est publié.
6. **L'arborescence du dépôt** et la liste des bibliothèques que tu comptes intégrer, avec leur rôle.

Attends ma validation avant de coder. Ensuite, réalise **une seule étape à la fois** : à la fin de
chaque étape, ouvre la pull request, explique-moi simplement ce que tu as fait, comment le tester,
et arrête-toi.

Rappels importants :
- Je ne suis pas développeur : explique, sois concret, pose tes questions.
- Le dépôt est public : aucune donnée confidentielle, aucun vrai Excel, aucune donnée patient.
- Fais simple, robuste et maintenable par moi seul.

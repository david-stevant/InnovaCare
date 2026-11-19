// =============================================================================
// schema.js — LA définition unique de tous les champs (plan § 2)
// =============================================================================
// Chaque champ d'une fiche protocole et de l'annuaire est décrit UNE SEULE FOIS ici.
// Le gabarit Excel (étape 1.2), l'import, les contrôles, l'export public et les
// affichages dérivent de cette liste. Ajouter un champ = ajouter une ligne ici.
//
// Pour chaque champ :
//   id            identifiant technique (sans accent ni espace)
//   libelle       libellé EXACT de la ligne dans le nouveau gabarit Excel
//   bloc          groupe de lignes (bande de couleur dans l'Excel)
//   type          texte | texte_long | liste | oui_non | date | entier | url | personne | requis_exclu | borne
//   liste         pour le type « liste » : nom de la liste de valeurs (dans parametres.json)
//   obligatoire   "oui" | "non" | "si_public" | "si_patient"
//   visibilite    "interne" (eCardioScope seulement) | "professionnel" | "patient"
//   jamaisPublic  true = verrou : le champ ne sort JAMAIS du réseau interne, quels que
//                 soient les paramètres (règle absolue n° 2 de CLAUDE.md)
//   aide          message d'aide affiché à l'ARC dans l'Excel (255 caractères au plus)
//   contact       true = nom de personne : jamais exporté tel quel ; le Publieur reconstruit
//                 les contacts publics selon les règles de parametres.publication
//
// Les lignes des filtres d'éligibilité ne sont pas écrites ici : elles sont fabriquées
// à partir de la liste des filtres de parametres.json (fonction champsFiltres).
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  const VISIBILITES = ['interne', 'professionnel', 'patient'];
  const BLOCS = ['Identification', 'Classement', 'Science', 'Organisation', 'Contacts', 'Patient', 'Éligibilité', 'Affichage'];

  /** Répète un champ numéroté : serie(3, n => ({ id: 'x_' + n })) → x_1, x_2, x_3. */
  function serie(nombre, fabrique) {
    return Array.from({ length: nombre }, (_, i) => fabrique(i + 1));
  }

  const INTERNE = { visibilite: 'interne', jamaisPublic: true };

  const CHAMPS_FICHE = [].concat(
    // --- Identification ---
    [
      { id: 'nom', libelle: 'Nom court de l\'étude', bloc: 'Identification', type: 'texte', obligatoire: 'oui', visibilite: 'patient', aide: 'Nom d\'usage seul, sans promoteur ni statut.' },
      { id: 'titre', libelle: 'Titre complet', bloc: 'Identification', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Titre officiel du protocole.' },
      { id: 'promoteur', libelle: 'Promoteur', bloc: 'Identification', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Ex. : laboratoire, établissement promoteur, groupe académique.' },
      { id: 'coordinateur', libelle: 'Coordinateur national', bloc: 'Identification', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Prénom NOM, ville.' },
      { id: 'phase', libelle: 'Phase', bloc: 'Identification', type: 'liste', liste: 'phase', obligatoire: 'si_public', visibilite: 'professionnel', aide: 'Choisir dans la liste.' },
      { id: 'registre', libelle: 'N° NCT ou EU CT', bloc: 'Identification', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Facultatif. Ex. : NCT01234567' },
      { id: 'statut', libelle: 'Statut', bloc: 'Identification', type: 'liste', liste: 'statut', obligatoire: 'oui', visibilite: 'professionnel', aide: 'Seules les études « ouvert » sont proposées aux médecins et aux patients.' },
      Object.assign({ id: 'en_avant', libelle: 'Mettre en avant', bloc: 'Identification', type: 'oui_non', obligatoire: 'non', aide: 'Oui = étude prioritaire pour la newsletter.' }, INTERNE),
    ],
    serie(2, (n) => ({ id: 'autre_pole_' + n, libelle: 'Autre pôle concerné ' + n, bloc: 'Identification', type: 'liste', liste: 'poles', obligatoire: 'non', visibilite: 'professionnel', aide: 'Si l\'étude concerne aussi un autre pôle. Ne pas la recopier dans l\'autre onglet.' })),
    // --- Classement ---
    serie(4, (n) => ({ id: 'pathologie_' + n, libelle: 'Pathologie ' + n, bloc: 'Classement', type: 'liste', liste: 'pathologies', obligatoire: n === 1 ? 'oui' : 'non', visibilite: 'patient', aide: 'Une pathologie par ligne, choisie dans la liste.' })),
    [{ id: 'thematique', libelle: 'Thématique courte', bloc: 'Classement', type: 'texte', obligatoire: 'oui', visibilite: 'professionnel', aide: 'Quelques mots résumant la population étudiée.' }],
    // --- Science ---
    [
      Object.assign({ id: 'synopsis', libelle: 'Synopsis', bloc: 'Science', type: 'texte_long', obligatoire: 'non', aide: 'Résumé interne, jamais publié.' }, INTERNE),
      { id: 'intervention', libelle: 'Intervention vs comparateur (DCI)', bloc: 'Science', type: 'texte', obligatoire: 'si_public', visibilite: 'professionnel', aide: 'Traitement étudié et comparateur, en DCI.' },
      { id: 'design', libelle: 'Design', bloc: 'Science', type: 'texte', obligatoire: 'si_public', visibilite: 'professionnel', aide: 'Randomisation, aveugle, ratio. Ex. : randomisé 1:1, double aveugle' },
    ],
    serie(5, (n) => ({ id: 'inclusion_' + n, libelle: 'Critère d\'inclusion principal ' + n, bloc: 'Science', type: 'texte', obligatoire: n === 1 ? 'oui' : 'non', visibilite: 'professionnel', aide: 'Un critère par ligne, avec les seuils chiffrés.' })),
    serie(5, (n) => Object.assign({ id: 'inclusion_autre_' + n, libelle: 'Autre critère d\'inclusion ' + n, bloc: 'Science', type: 'texte', obligatoire: 'non', aide: 'Critères secondaires, usage interne.' }, INTERNE)),
    serie(12, (n) => Object.assign({ id: 'exclusion_' + n, libelle: 'Critère d\'exclusion ' + n, bloc: 'Science', type: 'texte', obligatoire: 'non', aide: 'Un critère par ligne. Jamais publié.' }, INTERNE)),
    [
      Object.assign({ id: 'cjp', libelle: 'Critère de jugement principal', bloc: 'Science', type: 'texte', obligatoire: 'non', aide: 'Usage interne.' }, INTERNE),
      Object.assign({ id: 'nsn', libelle: 'NSN global', bloc: 'Science', type: 'texte', obligatoire: 'non', aide: 'Ex. : 1 200 patients' }, INTERNE),
      Object.assign({ id: 'centres', libelle: 'Nombre de centres', bloc: 'Science', type: 'texte', obligatoire: 'non', aide: 'Ex. : 45 centres, 12 pays' }, INTERNE),
    ],
    // --- Organisation ---
    [
      { id: 'debut_inclusion', libelle: 'Début d\'inclusion', bloc: 'Organisation', type: 'date', obligatoire: 'non', visibilite: 'professionnel', aide: 'Saisir 01/MM/AAAA. Ex. : 01/11/2025' },
      { id: 'fin_recrutement', libelle: 'Fin de recrutement prévue', bloc: 'Organisation', type: 'date', obligatoire: 'non', visibilite: 'professionnel', aide: 'Saisir 01/MM/AAAA.' },
      { id: 'duree_suivi', libelle: 'Durée de suivi', bloc: 'Organisation', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Ex. : 30 mois' },
      { id: 'rythme_visites', libelle: 'Rythme des visites', bloc: 'Organisation', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Ex. : M3, M6 puis tous les 6 mois' },
      Object.assign({ id: 'recrutes', libelle: 'Recrutés (centre)', bloc: 'Organisation', type: 'entier', obligatoire: 'non', aide: 'Nombre de patients inclus localement.' }, INTERNE),
      Object.assign({ id: 'objectif', libelle: 'Objectif (centre)', bloc: 'Organisation', type: 'entier', obligatoire: 'non', aide: 'Objectif local d\'inclusion.' }, INTERNE),
      Object.assign({ id: 'remarques', libelle: 'Remarques', bloc: 'Organisation', type: 'texte_long', obligatoire: 'non', aide: 'Notes internes.' }, INTERNE),
    ],
    // --- Contacts ---  (le DECT n'est jamais dans la fiche : il vient de l'annuaire, où il est verrouillé)
    [
      { contact: true, id: 'investigateur', libelle: 'Investigateur principal', bloc: 'Contacts', type: 'personne', obligatoire: 'oui', visibilite: 'professionnel', aide: 'Choisir dans la liste. Absent ? L\'ajouter d\'abord dans l\'onglet Annuaire.' },
      { contact: true, id: 'co_investigateurs', libelle: 'Co-investigateur(s)', bloc: 'Contacts', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Prénom NOM, séparés par « ; ».' },
      { contact: true, id: 'arc_1', libelle: 'ARC n° 1', bloc: 'Contacts', type: 'personne', obligatoire: 'oui', visibilite: 'patient', aide: 'Choisir dans la liste. Le DECT vient de l\'annuaire : ne pas l\'écrire ici.' },
    ],
    serie(2, (n) => ({ contact: true, id: 'arc_backup_' + n, libelle: 'ARC back-up ' + n, bloc: 'Contacts', type: 'personne', obligatoire: 'non', visibilite: 'patient', aide: 'Choisir dans la liste.' })),
    // --- Patient ---
    [
      { id: 'phrase_patient', libelle: 'Phrase patient', bloc: 'Patient', type: 'texte', obligatoire: 'si_patient', visibilite: 'patient', aide: 'Reprise telle quelle pour les patients. 1 à 2 phrases, mots simples, sans abréviation.' },
      { id: 'details_pratiques', libelle: 'Détails pratiques', bloc: 'Patient', type: 'texte', obligatoire: 'non', visibilite: 'patient', aide: 'Prises, visites, indemnités. Ex. : 2 comprimés par jour, suivi tous les 6 mois' },
    ],
    serie(3, (n) => ({ id: 'vignette_' + n, libelle: 'Vignette patient ' + n, bloc: 'Patient', type: 'liste', liste: 'vignettes', obligatoire: n === 1 ? 'si_patient' : 'non', visibilite: 'patient', aide: 'Situation dans laquelle le patient se reconnaît, choisie dans la liste.' })),
    [
      { id: 'lien_note', libelle: 'Lien note d\'information', bloc: 'Patient', type: 'url', obligatoire: 'non', visibilite: 'patient', desactive: true, aide: 'Ne pas remplir pour l\'instant (validation réglementaire en attente).' },
      { id: 'question_specifique', libelle: 'Question de screening propre à l\'étude', bloc: 'Éligibilité', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'Ex. : Porteur d\'un stimulateur double chambre ?' },
    ]
  );

  const CHAMPS_AFFICHAGE = [
    Object.assign({ id: 'afficher_ecardioscope', libelle: 'Afficher dans l\'outil interne', bloc: 'Affichage', type: 'oui_non', obligatoire: 'oui', aide: 'Oui = l\'étude apparaît dans l\'outil des médecins du service.' }, INTERNE),
    Object.assign({ id: 'afficher_innovaction', libelle: 'Afficher aux médecins libéraux', bloc: 'Affichage', type: 'oui_non', obligatoire: 'oui', aide: 'Oui = l\'étude est publiée pour les cardiologues libéraux.' }, INTERNE),
    Object.assign({ id: 'afficher_innovacteur', libelle: 'Afficher aux patients', bloc: 'Affichage', type: 'oui_non', obligatoire: 'oui', aide: 'Oui = l\'étude est proposée aux patients. Exige une phrase patient et une vignette.' }, INTERNE),
  ];

  const CHAMPS_ANNUAIRE = [
    { id: 'prenom', libelle: 'Prénom', type: 'texte', obligatoire: 'oui', visibilite: 'patient', aide: '' },
    { id: 'nom', libelle: 'NOM', type: 'texte', obligatoire: 'oui', visibilite: 'patient', aide: 'En majuscules.' },
    { id: 'fonction', libelle: 'Fonction', type: 'liste', liste: 'fonction', obligatoire: 'oui', visibilite: 'professionnel', aide: 'Investigateur, ARC ou autre.' },
    { id: 'pole', libelle: 'Pôle', type: 'liste', liste: 'poles', obligatoire: 'non', visibilite: 'professionnel', aide: 'Pôle de rattachement principal.' },
    Object.assign({ id: 'dect', libelle: 'DECT', type: 'texte', obligatoire: 'non', aide: 'Jamais publié. Plusieurs numéros : séparer par « / ».' }, INTERNE),
    { id: 'email', libelle: 'E-mail', type: 'texte', obligatoire: 'si_arc', visibilite: 'patient', aide: 'Adresse professionnelle.' },
    { id: 'mssante', libelle: 'MSSanté (si différente du format)', type: 'texte', obligatoire: 'non', visibilite: 'professionnel', aide: 'À remplir seulement si l\'adresse ne suit pas le format prenom.nom@… des paramètres.' },
    Object.assign({ id: 'mssante_verifiee', libelle: 'MSSanté vérifiée', type: 'oui_non', obligatoire: 'non', aide: 'Oui après vérification dans l\'annuaire MSSanté. Le bouton « Adresser » n\'apparaît qu\'à cette condition.' }, INTERNE),
    { id: 'nom_affiche', libelle: 'Nom affiché', type: 'calcule', obligatoire: 'non', visibilite: 'patient', aide: 'Calculé automatiquement (Prénom NOM) : alimente les listes déroulantes.' },
  ];

  /**
   * Lignes des filtres d'éligibilité, fabriquées à partir de parametres.json.
   *   type « bornes » → deux lignes : minimum et maximum
   *   type « requis » → une ligne requis / exclu / indifférent (+ délai en mois si demandé)
   * Un filtre ne peut pas être plus que « patient » ; jamais « interne verrouillé ».
   */
  function champsFiltres(parametres) {
    const lignes = [];
    for (const f of (parametres && parametres.filtres) || []) {
      const visibilite = VISIBILITES.includes(f.visibilite) ? f.visibilite : 'professionnel';
      const commun = { bloc: 'Éligibilité', obligatoire: 'non', visibilite, filtre: f.id };
      if (f.type === 'bornes') {
        const unite = f.unite ? ' (' + f.unite + ')' : '';
        lignes.push(Object.assign({ id: f.id + '_min', libelle: f.libelle + ' minimum' + unite, type: 'borne', min: f.valeur_min, max: f.valeur_max, aide: 'Nombre seul, borne incluse. Vide = pas de minimum.' }, commun));
        lignes.push(Object.assign({ id: f.id + '_max', libelle: f.libelle + ' maximum' + unite, type: 'borne', min: f.valeur_min, max: f.valeur_max, aide: 'Nombre seul, borne incluse. Vide = pas de maximum.' }, commun));
      } else {
        lignes.push(Object.assign({ id: f.id, libelle: f.libelle, type: 'requis_exclu', liste: 'requis_exclu', aide: 'Requis, exclu ou indifférent. Vide = indifférent.' }, commun));
        if (f.avec_delai_mois) lignes.push(Object.assign({ id: f.id + '_delai', libelle: f.libelle + ' : délai maximum (mois)', type: 'entier', min: 1, max: 60, aide: 'Nombre de mois. Ex. : 12' }, commun));
      }
    }
    return lignes;
  }

  /**
   * Textes propres à l'instance : parametres.champs peut préciser, pour un champ donné,
   * un message d'aide et une valeur d'exemple (colonne « Exemple » du gabarit).
   *   "champs": { "thematique": { "aide": "…", "exemple": "…" } }
   * Seuls ces deux textes peuvent être changés ici : jamais la visibilité ni le verrou.
   */
  function appliquerTextes(champs, parametres) {
    const textes = (parametres && parametres.champs) || {};
    return champs.map((c) => {
      const t = textes[c.id];
      if (!t) return Object.assign({ exemple: '' }, c);
      return Object.assign({ exemple: '' }, c, {
        aide: typeof t.aide === 'string' ? t.aide : c.aide,
        exemple: t.exemple !== undefined ? t.exemple : '',
      });
    });
  }

  /** Liste complète et ordonnée des lignes d'une fiche protocole. */
  function champsFiche(parametres) {
    return appliquerTextes(CHAMPS_FICHE.concat(champsFiltres(parametres), CHAMPS_AFFICHAGE), parametres);
  }

  /** Colonnes de l'onglet Annuaire, dans l'ordre. */
  function champsAnnuaire(parametres) {
    return appliquerTextes(CHAMPS_ANNUAIRE, parametres);
  }

  /** Identifiants des champs verrouillés (jamais publiés), fiche et annuaire. */
  function champsJamaisPublics(parametres) {
    return champsFiche(parametres).concat(CHAMPS_ANNUAIRE).filter((c) => c.jamaisPublic).map((c) => c.id);
  }

  InnovaCare.schema = {
    VISIBILITES, BLOCS, CHAMPS_ANNUAIRE,
    champsFiche, champsFiltres, champsAnnuaire, champsJamaisPublics,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

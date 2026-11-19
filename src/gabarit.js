// =============================================================================
// gabarit.js — fabrique le NOUVEL Excel harmonisé (plan § 3)
// =============================================================================
// Tout vient du schéma (src/schema.js) et des paramètres (parametres.json) :
// lignes, libellés, listes déroulantes, messages d'aide, couleurs. Rien n'est écrit
// en dur ici sur la spécialité. Le même code fabrique :
//   - le gabarit VIERGE (aucune étude, annuaire vide) ;
//   - le fichier MIGRÉ (études et annuaire remplis par src/migration.js).
//
// Onglets : Lisez-moi · un onglet par pôle (tous identiques) · Annuaire · Listes
//           · Rapport de migration (fichier migré seulement).
// Dans un onglet de pôle : colonne A = libellés, colonne B = exemple fictif,
// colonnes C et suivantes = une étude par colonne ; ligne 1 = nom de l'étude.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  const VERSION_GABARIT = 1;
  const PREMIERE_COLONNE_ETUDE = 3; // colonne C
  const COLONNES_ETUDE_MIN = 25;
  const LIGNES_ANNUAIRE_MIN = 200;
  const NOMS_ONGLETS = { lisezMoi: 'Lisez-moi', annuaire: 'Annuaire', listes: 'Listes', rapport: 'Rapport de migration' };

  // Couleurs (format ARGB d'Excel). Bandes de blocs : teintes très claires, lisibles.
  const COULEURS_BLOCS = ['FFDDF5F7', 'FFFFF1D1', 'FFFDE2EC', 'FFDFF7E5', 'FFE6EEF8', 'FFF1E6F8', 'FFEFF3D9', 'FFEDEDED'];
  const GRIS_EXEMPLE = 'FFF2F2F2';
  const ORANGE_VIDE = 'FFFFD8A8';
  const ROUGE_SUSPECT = 'FFF8C9C9';
  const COULEURS_STATUT = { 'ouvert': 'FFC8F0D2', 'à venir': 'FFFFE9B0', 'suspendu': 'FFFAD1E0', 'clos aux inclusions (suivi)': 'FFE3E3E3', 'terminé': 'FFE3E3E3' };
  const fond = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } });

  const lettre = (n) => InnovaCare.excel.lettreColonne(n - 1); // n commence à 1 (comme ExcelJS)
  const tronquer = (texte, max) => (texte.length <= max ? texte : texte.slice(0, max - 1) + '…');

  /** Valeur prête pour une cellule Excel ({ date } → vraie date Excel). */
  function valeurCellule(valeur) {
    if (valeur === null || valeur === undefined || valeur === '') return null;
    if (typeof valeur === 'object' && typeof valeur.date === 'string') return new Date(valeur.date.length === 7 ? valeur.date + '-01' : valeur.date);
    return valeur;
  }

  // --- Listes de valeurs (onglet « Listes ») ---------------------------------------

  /** Contenu de l'onglet Listes : { nomListe: [valeurs] }, dans un ordre fixe. */
  function listesDeValeurs(parametres) {
    const listes = Object.assign({}, parametres.listes || {});
    delete listes.statut_note;
    listes.poles = (parametres.poles || []).map((p) => p.nom);
    listes.pathologies = (parametres.pathologies || []).map((p) => (typeof p === 'string' ? p : p.nom));
    listes.vignettes = (parametres.vignettes || []).map((v) => (typeof v === 'string' ? v : v.nom || v.libelle));
    return listes;
  }

  /** Plage Excel d'une liste : « Listes!$B$2:$B$6 », ou null si la liste est vide. */
  function plageListe(nomListe, listes) {
    const noms = Object.keys(listes);
    const i = noms.indexOf(nomListe);
    if (i < 0 || !listes[nomListe].length) return null;
    const col = lettre(i + 1);
    return NOMS_ONGLETS.listes + '!$' + col + '$2:$' + col + '$' + (listes[nomListe].length + 1);
  }

  // --- Règles de saisie d'une ligne ---------------------------------------------------

  /** Validation Excel (liste, nombre, date…) + message d'aide pour un champ du schéma. */
  function validation(champ, listes, plagePersonnes) {
    const aide = {
      showInputMessage: true,
      promptTitle: tronquer(champ.libelle, 32),
      prompt: tronquer(champ.aide || '', 255),
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Valeur non acceptée',
    };
    if (champ.type === 'liste' || champ.type === 'requis_exclu' || champ.type === 'oui_non') {
      const plage = plageListe(champ.type === 'oui_non' ? 'oui_non' : champ.liste, listes);
      if (!plage) return Object.assign({ type: 'any' }, aide, { showErrorMessage: false }); // liste encore vide : saisie libre
      return Object.assign({ type: 'list', allowBlank: true, formulae: [plage], error: 'Choisissez une valeur dans la liste déroulante.' }, aide);
    }
    if (champ.type === 'personne') {
      return Object.assign({ type: 'list', allowBlank: true, formulae: [plagePersonnes],
        error: 'Choisissez une personne dans la liste. Si elle n\'y est pas, ajoutez-la d\'abord dans l\'onglet Annuaire.' }, aide);
    }
    if (champ.type === 'borne' || champ.type === 'entier') {
      const min = Number.isFinite(champ.min) ? champ.min : 0;
      const max = Number.isFinite(champ.max) ? champ.max : 1000000;
      return Object.assign({ type: 'whole', operator: 'between', allowBlank: true, formulae: [min, max],
        error: 'Saisissez un nombre entier entre ' + min + ' et ' + max + ', sans unité.' }, aide);
    }
    if (champ.type === 'date') {
      return Object.assign({ type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date('2000-01-01')],
        error: 'Saisissez une date au format JJ/MM/AAAA (ex. 01/11/2025).' }, aide);
    }
    return Object.assign({ type: 'any' }, aide, { showErrorMessage: false });
  }

  // --- Onglets -----------------------------------------------------------------------

  function ongletLisezMoi(classeur, parametres) {
    const f = classeur.addWorksheet(NOMS_ONGLETS.lisezMoi, { properties: { tabColor: { argb: 'FF00BAC6' } } });
    const instance = (parametres.specialite && parametres.specialite.instance) || 'InnovaCare';
    const lignes = [
      [instance + ' — fichier des études', 'titre'],
      ['Ce fichier est la source unique des outils ' + instance + '. Une colonne par étude, un onglet par pôle. Tous les onglets de pôle ont exactement les mêmes lignes : ne pas en ajouter, ne pas en supprimer.'],
      [''],
      ['Ajouter une étude', 'sous-titre'],
      ['1. Aller dans l\'onglet du pôle principal de l\'étude.'],
      ['2. Remplir la première colonne libre, en commençant par la ligne 1 « Nom court de l\'étude ».'],
      ['3. Cliquer sur une cellule fait apparaître une aide. Les cases orange sont obligatoires.'],
      ['4. Une étude qui concerne deux pôles n\'est saisie qu\'une fois : indiquer l\'autre pôle dans « Autre pôle concerné ».'],
      [''],
      ['Changer un statut', 'sous-titre'],
      ['Choisir le nouveau statut dans la liste de la ligne « Statut ». Une étude terminée reste dans son onglet : elle n\'est simplement plus proposée.'],
      [''],
      ['Ajouter une personne (investigateur, ARC)', 'sous-titre'],
      ['Remplir une ligne libre de l\'onglet « Annuaire » (prénom, NOM, fonction, DECT, e-mail). Elle apparaît ensuite dans les listes déroulantes des fiches. Le DECT n\'est jamais publié.'],
      [''],
      ['Règles de saisie', 'sous-titre'],
      ['• Médicaments en DCI (le nom commercial peut suivre entre parenthèses).'],
      ['• Filtres : un nombre seul, sans unité ni signe (borne incluse). Case vide = pas de limite.'],
      ['• Dates au format JJ/MM/AAAA.'],
      ['• La colonne B « Exemple » est un modèle : ne pas la remplir.'],
      ['• Ne jamais écrire de donnée patient dans ce fichier.'],
      [''],
      ['Gabarit version ' + VERSION_GABARIT + ' — généré le ' + new Date().toLocaleDateString('fr-FR') + '.', 'note'],
    ];
    f.getColumn(1).width = 100;
    lignes.forEach(([texte, style], i) => {
      const c = f.getCell(i + 1, 1);
      c.value = texte;
      c.alignment = { wrapText: true, vertical: 'top' };
      if (style === 'titre') c.font = { bold: true, size: 16, color: { argb: 'FF00727A' } };
      if (style === 'sous-titre') c.font = { bold: true, size: 12 };
      if (style === 'note') c.font = { italic: true, color: { argb: 'FF777777' } };
    });
    return f;
  }

  function ongletListes(classeur, listes) {
    const f = classeur.addWorksheet(NOMS_ONGLETS.listes, { properties: { tabColor: { argb: 'FF999999' } } });
    Object.entries(listes).forEach(([nom, valeurs], i) => {
      const col = i + 1;
      f.getColumn(col).width = Math.max(14, ...valeurs.map((v) => String(v).length + 2));
      f.getCell(1, col).value = nom;
      f.getCell(1, col).font = { bold: true };
      valeurs.forEach((v, j) => { f.getCell(j + 2, col).value = v; });
    });
    // Repère technique lu par les outils pour reconnaître le gabarit.
    const colVersion = Object.keys(listes).length + 2;
    f.getCell(1, colVersion).value = 'version_gabarit';
    f.getCell(2, colVersion).value = VERSION_GABARIT;
    f.getColumn(colVersion).width = 16;
    return f;
  }

  /** Nombre de lignes de l'annuaire et plage des « noms affichés » (cible des listes de personnes). */
  function dimensionsAnnuaire(parametres, personnes) {
    const colonnes = InnovaCare.schema.champsAnnuaire(parametres);
    const nbLignes = Math.max(LIGNES_ANNUAIRE_MIN, personnes.length + 100);
    const col = lettre(colonnes.findIndex((c) => c.id === 'nom_affiche') + 1);
    return { colonnes, nbLignes, plagePersonnes: NOMS_ONGLETS.annuaire + '!$' + col + '$2:$' + col + '$' + (nbLignes + 1) };
  }

  function ongletAnnuaire(classeur, parametres, listes, personnes) {
    const f = classeur.addWorksheet(NOMS_ONGLETS.annuaire, {
      properties: { tabColor: { argb: 'FFFAB316' } },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });
    const { colonnes, nbLignes } = dimensionsAnnuaire(parametres, personnes);
    const colPrenom = colonnes.findIndex((c) => c.id === 'prenom') + 1;
    const colNom = colonnes.findIndex((c) => c.id === 'nom') + 1;

    colonnes.forEach((champ, i) => {
      const col = i + 1;
      f.getColumn(col).width = champ.id === 'email' || champ.id === 'mssante' ? 34 : 18;
      const entete = f.getCell(1, col);
      entete.value = champ.libelle;
      entete.font = { bold: true };
      entete.fill = fond('FFFFF1D1');
      entete.alignment = { wrapText: true, vertical: 'top' };
      const lettreCol = lettre(col);
      if (champ.id !== 'nom_affiche') {
        f.dataValidations.add(lettreCol + '2:' + lettreCol + (nbLignes + 1), validation(champ, listes, null));
      }
    });
    for (let l = 2; l <= nbLignes + 1; l++) {
      const p = personnes[l - 2] || {};
      colonnes.forEach((champ, i) => {
        const c = f.getCell(l, i + 1);
        if (champ.id === 'nom_affiche') {
          const a = lettre(colPrenom) + l;
          const b = lettre(colNom) + l;
          c.value = { formula: 'IF(' + b + '="","",TRIM(' + a + '&" "&' + b + '))', result: p.nom ? (String(p.prenom || '') + ' ' + p.nom).trim() : '' };
          c.fill = fond(GRIS_EXEMPLE);
        } else {
          c.value = valeurCellule(p[champ.id]);
          c.protection = { locked: false };
        }
      });
    }
    f.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, sort: true, autoFilter: true });
    return f;
  }

  /** Un onglet de pôle. fiches : [{ valeurs: { idChamp: valeur }, suspecte, note }]. */
  function ongletPole(classeur, pole, parametres, listes, plagePersonnes, fiches) {
    const champs = InnovaCare.schema.champsFiche(parametres);
    const f = classeur.addWorksheet(pole.nom.slice(0, 31), {
      properties: { tabColor: { argb: 'FF23CD4B' } },
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    });
    const nbEtudes = Math.max(COLONNES_ETUDE_MIN, fiches.length + 5);
    const derniere = PREMIERE_COLONNE_ETUDE + nbEtudes - 1;
    const plage = (ligne) => lettre(PREMIERE_COLONNE_ETUDE) + ligne + ':' + lettre(derniere) + ligne;
    const ligneDe = {};
    champs.forEach((c, i) => { ligneDe[c.id] = i + 1; });

    f.getColumn(1).width = 42;
    f.getColumn(2).width = 28;
    for (let col = PREMIERE_COLONNE_ETUDE; col <= derniere; col++) f.getColumn(col).width = 30;

    champs.forEach((champ, i) => {
      const ligne = i + 1;
      const couleur = COULEURS_BLOCS[Math.max(0, InnovaCare.schema.BLOCS.indexOf(champ.bloc)) % COULEURS_BLOCS.length];
      const libelle = f.getCell(ligne, 1);
      libelle.value = champ.libelle;
      libelle.fill = fond(couleur);
      libelle.font = { bold: ligne === 1 || champ.obligatoire === 'oui' };
      libelle.alignment = { wrapText: true, vertical: 'top' };
      const exemple = f.getCell(ligne, 2);
      exemple.value = ligne === 1 ? 'Exemple (ne pas remplir)' : valeurCellule(champ.exemple);
      exemple.fill = fond(GRIS_EXEMPLE);
      exemple.font = { italic: true, color: { argb: 'FF777777' }, bold: ligne === 1 };
      exemple.alignment = { wrapText: true, vertical: 'top' };
      for (let col = PREMIERE_COLONNE_ETUDE; col <= derniere; col++) {
        const c = f.getCell(ligne, col);
        c.protection = { locked: false };
        c.alignment = { wrapText: true, vertical: 'top' };
        if (champ.type === 'date') c.numFmt = 'dd/mm/yyyy';
        if (ligne === 1) c.font = { bold: true };
      }
      f.dataValidations.add(plage(ligne), validation(champ, listes, plagePersonnes));
    });

    // Contenu (fichier migré)
    fiches.forEach((fiche, k) => {
      const col = PREMIERE_COLONNE_ETUDE + k;
      for (const [id, valeur] of Object.entries(fiche.valeurs)) {
        if (ligneDe[id]) f.getCell(ligneDe[id], col).value = valeurCellule(valeur);
      }
      if (fiche.suspecte) f.getCell(1, col).fill = fond(ROUGE_SUSPECT);
      if (fiche.note) f.getCell(1, col).note = fiche.note;
    });

    // Mises en forme conditionnelles
    const c1 = lettre(PREMIERE_COLONNE_ETUDE);
    const condition = {
      oui: () => 'TRUE',
      si_public: () => 'OR(' + c1 + '$' + ligneDe.afficher_innovaction + '="oui",' + c1 + '$' + ligneDe.afficher_innovacteur + '="oui")',
      si_patient: () => c1 + '$' + ligneDe.afficher_innovacteur + '="oui"',
    };
    champs.forEach((champ) => {
      const regle = condition[champ.obligatoire];
      if (!regle || champ.id === 'nom') return;
      const l = ligneDe[champ.id];
      f.addConditionalFormatting({
        ref: plage(l),
        rules: [{ type: 'expression', priority: 10, formulae: ['AND(' + c1 + '$1<>"",' + regle() + ',LEN(' + c1 + l + ')=0)'], style: { fill: fond(ORANGE_VIDE) } }],
      });
    });
    if (ligneDe.statut) {
      f.addConditionalFormatting({
        ref: plage(ligneDe.statut),
        rules: Object.entries(COULEURS_STATUT).map(([statut, argb], i) => ({ type: 'cellIs', operator: 'equal', priority: 1 + i, formulae: ['"' + statut + '"'], style: { fill: fond(argb) } })),
      });
    }
    if (ligneDe.en_avant) {
      f.addConditionalFormatting({
        ref: plage(1),
        rules: [{ type: 'expression', priority: 20, formulae: [c1 + '$' + ligneDe.en_avant + '="oui"'], style: { fill: fond('FFFFE9B0'), font: { bold: true } } }],
      });
    }

    f.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true });
    return f;
  }

  function ongletRapport(classeur, lignes) {
    const f = classeur.addWorksheet(NOMS_ONGLETS.rapport, {
      properties: { tabColor: { argb: 'FFEF4D89' } },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });
    const entetes = ['Fait ?', 'Gravité', 'Pôle', 'Étude', 'Champ', 'Constat'];
    const largeurs = [8, 14, 24, 28, 30, 100];
    entetes.forEach((t, i) => {
      const c = f.getCell(1, i + 1);
      c.value = t;
      c.font = { bold: true };
      c.fill = fond('FFFDE2EC');
      f.getColumn(i + 1).width = largeurs[i];
    });
    const couleur = { corriger: ROUGE_SUSPECT, verifier: 'FFFFF1D1' };
    lignes.forEach((r, i) => {
      const valeurs = ['', { corriger: 'à corriger', verifier: 'à vérifier', info: 'information' }[r.gravite] || r.gravite, r.pole || '', r.etude || '', r.champ || '', r.message || ''];
      valeurs.forEach((v, j) => {
        const c = f.getCell(i + 2, j + 1);
        c.value = v;
        c.alignment = { wrapText: true, vertical: 'top' };
        if (couleur[r.gravite] && j === 1) c.fill = fond(couleur[r.gravite]);
      });
    });
    f.autoFilter = { from: 'A1', to: 'F1' };
    return f;
  }

  /**
   * Fabrique le classeur.
   * contenu (facultatif) : { fichesParPole: { idPole: [fiche] }, annuaire: [personne], rapport: [ligne] }
   * Renvoie un classeur ExcelJS (à écrire avec classeur.xlsx.writeBuffer()).
   */
  function creerClasseur(ExcelJS, parametres, contenu) {
    const donnees = contenu || {};
    const classeur = new ExcelJS.Workbook();
    classeur.creator = (parametres.specialite && parametres.specialite.instance) || 'InnovaCare';
    classeur.created = new Date();
    const listes = listesDeValeurs(parametres);

    const personnes = donnees.annuaire || [];
    const { plagePersonnes } = dimensionsAnnuaire(parametres, personnes);
    ongletLisezMoi(classeur, parametres);
    for (const pole of parametres.poles || []) {
      ongletPole(classeur, pole, parametres, listes, plagePersonnes, (donnees.fichesParPole || {})[pole.id] || []);
    }
    ongletAnnuaire(classeur, parametres, listes, personnes);
    ongletListes(classeur, listes);
    if (donnees.rapport) ongletRapport(classeur, donnees.rapport);
    return classeur;
  }

  InnovaCare.gabarit = { VERSION_GABARIT, NOMS_ONGLETS, PREMIERE_COLONNE_ETUDE, creerClasseur, listesDeValeurs, validation };
})(typeof globalThis !== 'undefined' ? globalThis : this);

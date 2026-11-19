// =============================================================================
// lecture-ancien.js — lit l'Excel ACTUEL (avant harmonisation), onglet par onglet
// =============================================================================
// Principe (plan § 4.1) : chaque ligne est reconnue par le LIBELLÉ de sa colonne A,
// jamais par son numéro (les numéros diffèrent d'un onglet à l'autre). Une ligne sans
// libellé prolonge le libellé précédent (critères sur plusieurs lignes, par exemple).
// Rien n'est corrigé ici : on range les valeurs telles quelles, en notant pour chacune
// son adresse (ex. « Valves!C19 ») pour que le rapport puisse y renvoyer.
//
// La description de l'ancien Excel (noms des onglets, libellés…) vient du fichier
// outils-src/donnees/correspondances-ancien-excel.json : rien n'est écrit en dur ici.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const { texteSimple, estVide, enTexte } = InnovaCare.normalisation;
  const { adresse, lettreColonne, indiceColonne } = InnovaCare.excel;

  const LIGNES_MAX_POUR_ENTETE = 6;

  /** Trouve la ligne d'en-tête (celle dont la colonne A vaut « Etudes »). */
  function trouverEntete(grille, libelleEntete) {
    const cible = texteSimple(libelleEntete);
    const limite = Math.min(grille.cellules.length, LIGNES_MAX_POUR_ENTETE);
    for (let l = 0; l < limite; l++) {
      if (texteSimple(grille.cellules[l][0]) === cible) return l;
    }
    return -1;
  }

  /** Zone fusionnée qui contient une cellule, ou null. */
  function fusionContenant(grille, ligne, colonne) {
    return (grille.fusions || []).find((f) =>
      ligne >= f.premiereLigne && ligne <= f.derniereLigne && colonne >= f.premiereColonne && colonne <= f.derniereColonne
    ) || null;
  }

  /** Cherche la description d'un libellé ; préfère celle de la section en cours. */
  function chercherLibelle(libelle, section, correspondances) {
    const simple = texteSimple(libelle);
    const candidats = correspondances.libelles.filter((e) => texteSimple(e.ancien) === simple);
    return candidats.find((e) => (e.section || 'principal') === section) || candidats[0] || null;
  }

  function estDebutBlocIgnore(libelle, correspondances) {
    const simple = texteSimple(libelle);
    return (correspondances.debuts_blocs_ignores || []).some((b) => texteSimple(b) === simple);
  }

  /** Lit un onglet « pôle » ou « suivi » : une fiche brute par colonne d'étude. */
  function lireOngletEtudes(grille, description, correspondances) {
    const resultat = {
      nom: grille.nom, role: description.role, pole: description.pole || null,
      ligneEntete: null, etudes: [], libellesInconnus: [], champsPresents: [],
      colonnesVides: [], donneesSansNom: [], horsFiche: [], fusions: (grille.fusions || []).length,
    };
    const lEntete = trouverEntete(grille, correspondances.libelle_entete);
    if (lEntete < 0) { resultat.enteteIntrouvable = true; return resultat; }
    resultat.ligneEntete = lEntete + 1;

    const nbColonnes = Math.max(...grille.cellules.map((ligne) => ligne.length));
    const cellule = (l, c) => (grille.cellules[l] ? grille.cellules[l][c] : null);
    const aDesDonnees = (c) => grille.cellules.some((ligne, l) => l > lEntete && !estVide(ligne[c]));

    // 1. Colonnes d'étude, et colonnes rattachées par une fusion (ex. HTA : B:C).
    const etudeParColonne = {};
    for (let c = 1; c < nbColonnes; c++) {
      const entete = cellule(lEntete, c);
      if (!estVide(entete)) {
        if (!aDesDonnees(c)) { resultat.colonnesVides.push({ adresse: adresse(lEntete, c), valeur: enTexte(entete) }); continue; }
        const etude = {
          onglet: grille.nom, pole: description.pole || null, suivi: description.role === 'suivi',
          colonne: lettreColonne(c), colonnes: [lettreColonne(c)], nomBrut: entete, champs: {}, horsFiche: [],
        };
        resultat.etudes.push(etude);
        etudeParColonne[c] = etude;
        continue;
      }
      const fusion = fusionContenant(grille, lEntete, c);
      if (fusion && etudeParColonne[fusion.premiereColonne]) {
        etudeParColonne[c] = etudeParColonne[fusion.premiereColonne];
        etudeParColonne[c].colonnes.push(lettreColonne(c));
      } else if (aDesDonnees(c)) {
        resultat.donneesSansNom.push({ colonne: lettreColonne(c) });
      }
    }

    // 2. Lignes, lues par libellé.
    let section = 'principal';
    let courante = null; // description du libellé en cours
    let champCourant = null;
    for (let l = lEntete; l < grille.cellules.length; l++) {
      const libelle = cellule(l, 0);
      if (!estVide(libelle)) {
        const trouve = chercherLibelle(libelle, section === 'ignore' ? 'principal' : section, correspondances);
        if (estDebutBlocIgnore(libelle, correspondances)) {
          section = 'ignore'; courante = null; champCourant = null;
        } else if (trouve && trouve.debut_section) {
          section = trouve.debut_section; courante = trouve; champCourant = trouve.champ;
        } else if (section === 'ignore') {
          courante = null; champCourant = null; // libellé à l'intérieur d'un bloc ignoré
        } else if (trouve) {
          courante = trouve; champCourant = trouve.champ;
        } else {
          courante = null; champCourant = null;
          resultat.libellesInconnus.push({ adresse: adresse(l, 0), libelle: enTexte(libelle) });
        }
        if (courante && !resultat.champsPresents.includes(courante.champ)) resultat.champsPresents.push(courante.champ);
      } else if (courante && courante.suite && champCourant === courante.champ) {
        champCourant = courante.suite; // ligne sans libellé juste après le nom : titre complet
      }

      for (const [indice, etude] of Object.entries(etudeParColonne)) {
        const c = Number(indice);
        const valeur = cellule(l, c);
        if (l === lEntete || estVide(valeur)) continue; // le nom est déjà dans etude.nomBrut
        const element = { valeur, adresse: adresse(l, c), ligne: l + 1 };
        if (section === 'ignore') resultat.horsFiche.push(Object.assign({ etude: enTexte(etude.nomBrut) }, element));
        else if (!champCourant) etude.horsFiche.push(element);
        else (etude.champs[champCourant] || (etude.champs[champCourant] = [])).push(element);
      }
      // Valeurs dans des colonnes sans étude, à l'intérieur d'un bloc ignoré (ex. noms d'ARC en H62).
      if (section === 'ignore') {
        for (let c = 1; c < nbColonnes; c++) {
          if (!etudeParColonne[c] && !estVide(cellule(l, c))) resultat.horsFiche.push({ valeur: cellule(l, c), adresse: adresse(l, c), ligne: l + 1 });
        }
      }
    }
    return resultat;
  }

  /** Lit l'onglet des coordonnées : une personne par ligne, titres de pôle intercalés. */
  function lireOngletAnnuaire(grille, correspondances) {
    const reglage = correspondances.annuaire;
    const col = {};
    for (const [cle, lettre] of Object.entries(reglage.colonnes)) col[cle] = indiceColonne(lettre);
    const personnes = [];
    let poleAncien = null;
    for (let l = reglage.premiere_ligne - 1; l < grille.cellules.length; l++) {
      const ligne = grille.cellules[l] || [];
      const lire = (cle) => (ligne[col[cle]] === undefined ? null : ligne[col[cle]]);
      if (estVide(lire('prenom')) && estVide(lire('nom'))) continue;
      if (estVide(lire('nom')) && estVide(lire('dect')) && estVide(lire('email'))) { poleAncien = enTexte(lire('prenom')); continue; }
      personnes.push({
        prenom: enTexte(lire('prenom')), nom: enTexte(lire('nom')), dect: enTexte(lire('dect')),
        email: enTexte(lire('email')), poleAncien, ligne: l + 1, adresse: adresse(l, 0),
      });
    }
    return { nom: grille.nom, role: 'annuaire', personnes };
  }

  /**
   * Lit tout le classeur.
   * grilles : résultat de InnovaCare.excel.lireClasseur ; correspondances : le fichier JSON.
   */
  function lireAncienExcel(grilles, correspondances) {
    const resultat = { onglets: [], annuaire: [], ongletsInconnus: [], ongletsIgnores: [] };
    for (const grille of grilles) {
      const description = correspondances.onglets.find((o) => texteSimple(o.nom) === texteSimple(grille.nom));
      if (!description) { resultat.ongletsInconnus.push(grille.nom); continue; }
      if (description.role === 'ignore') { resultat.ongletsIgnores.push({ nom: grille.nom, raison: description.raison || '' }); continue; }
      if (description.role === 'annuaire') {
        const annuaire = lireOngletAnnuaire(grille, correspondances);
        resultat.annuaire = resultat.annuaire.concat(annuaire.personnes);
        resultat.onglets.push({ nom: grille.nom, role: 'annuaire', nbPersonnes: annuaire.personnes.length });
        continue;
      }
      resultat.onglets.push(lireOngletEtudes(grille, description, correspondances));
    }
    resultat.ongletsAbsents = correspondances.onglets
      .filter((o) => o.role !== 'ignore' && !grilles.some((g) => texteSimple(g.nom) === texteSimple(o.nom)))
      .map((o) => o.nom);
    return resultat;
  }

  /** Toutes les études de tous les onglets, à plat. */
  function toutesLesEtudes(lecture) {
    return lecture.onglets.reduce((liste, onglet) => liste.concat(onglet.etudes || []), []);
  }

  InnovaCare.lectureAncien = { trouverEntete, lireOngletEtudes, lireOngletAnnuaire, lireAncienExcel, toutesLesEtudes };
})(typeof globalThis !== 'undefined' ? globalThis : this);

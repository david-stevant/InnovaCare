// =============================================================================
// lecture.js — lit le NOUVEL Excel harmonisé (celui fabriqué par gabarit.js)
// =============================================================================
// Chaque onglet de pôle est lu par LIBELLÉ de la colonne A, d'après le schéma :
// une ligne déplacée ou un libellé modifié est donc repéré, au lieu de décaler les
// données en silence. La colonne B (exemple) est ignorée ; une étude par colonne à
// partir de la colonne C. Servira au Publieur (étape 1.4) et à l'outil interne.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;
  const { adresse } = InnovaCare.excel;

  function lireGabarit(grilles, parametres) {
    const { NOMS_ONGLETS, PREMIERE_COLONNE_ETUDE } = InnovaCare.gabarit;
    const champs = InnovaCare.schema.champsFiche(parametres);
    const parLibelle = new Map(champs.map((c) => [N.texteSimple(c.libelle), c]));
    const resultat = { version: null, etudes: [], annuaire: [], anomalies: [] };
    const trouver = (nom) => grilles.find((g) => N.texteSimple(g.nom) === N.texteSimple(nom));

    // Version du gabarit (onglet Listes, colonne « version_gabarit »)
    const listes = trouver(NOMS_ONGLETS.listes);
    if (listes) {
      const col = (listes.cellules[0] || []).findIndex((v) => N.texteSimple(v) === 'version_gabarit');
      if (col >= 0 && listes.cellules[1]) resultat.version = listes.cellules[1][col];
    }

    for (const pole of parametres.poles || []) {
      const grille = trouver(pole.nom.slice(0, 31));
      if (!grille) { resultat.anomalies.push({ type: 'onglet_absent', onglet: pole.nom, message: 'Onglet du pôle introuvable.' }); continue; }
      const ligneDe = {};
      grille.cellules.forEach((ligne, l) => {
        const libelle = ligne[0];
        if (N.estVide(libelle)) return;
        const champ = parLibelle.get(N.texteSimple(libelle));
        if (champ) ligneDe[champ.id] = l;
        else resultat.anomalies.push({ type: 'libelle_inconnu', onglet: grille.nom, adresse: adresse(l, 0), message: 'Libellé « ' + N.enTexte(libelle) + ' » inconnu.' });
      });
      for (const champ of champs) {
        if (ligneDe[champ.id] === undefined) resultat.anomalies.push({ type: 'libelle_absent', onglet: grille.nom, message: 'Ligne « ' + champ.libelle + ' » absente.' });
      }
      if (ligneDe.nom === undefined) continue;
      const largeur = Math.max(...grille.cellules.map((l) => l.length));
      for (let c = PREMIERE_COLONNE_ETUDE - 1; c < largeur; c++) {
        const nom = grille.cellules[ligneDe.nom][c];
        if (N.estVide(nom)) continue;
        const valeurs = {};
        for (const champ of champs) {
          const l = ligneDe[champ.id];
          if (l === undefined) continue;
          const valeur = grille.cellules[l] ? grille.cellules[l][c] : null;
          if (!N.estVide(valeur)) valeurs[champ.id] = typeof valeur === 'string' ? valeur.trim() : valeur;
        }
        resultat.etudes.push({ pole: pole.id, onglet: grille.nom, colonne: InnovaCare.excel.lettreColonne(c), id: N.identifiant(valeurs.nom), valeurs });
      }
    }

    const annuaire = trouver(NOMS_ONGLETS.annuaire);
    if (annuaire) {
      const colonnes = InnovaCare.schema.champsAnnuaire(parametres);
      const entete = (annuaire.cellules[0] || []).map((v) => N.texteSimple(v));
      const colDe = Object.fromEntries(colonnes.map((c) => [c.id, entete.indexOf(N.texteSimple(c.libelle))]));
      for (let l = 1; l < annuaire.cellules.length; l++) {
        const ligne = annuaire.cellules[l];
        const p = {};
        for (const c of colonnes) if (colDe[c.id] >= 0 && !N.estVide(ligne[colDe[c.id]])) p[c.id] = N.enTexte(ligne[colDe[c.id]]);
        if (p.nom || p.prenom) {
          if (!p.nom_affiche) p.nom_affiche = ((p.prenom || '') + ' ' + (p.nom || '')).trim();
          resultat.annuaire.push(p);
        }
      }
    }
    return resultat;
  }

  InnovaCare.lecture = { lireGabarit };
})(typeof globalThis !== 'undefined' ? globalThis : this);

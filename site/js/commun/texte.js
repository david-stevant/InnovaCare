// Copie automatique de src/texte.js (outils-src/construire.mjs) : ne pas modifier ici.
// =============================================================================
// texte.js — fonctions de base sur les textes et les cellules
// =============================================================================
// Partagées par les outils locaux ET par le site public (une copie automatique est
// placée dans site/js/commun/ par outils-src/construire.mjs). Elles ne connaissent
// rien à la spécialité.
// Une cellule vaut : null (vide), un texte, un nombre, ou { date: "AAAA-MM-JJ" }.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  /** Vrai si la cellule est une date ({ date: "AAAA-MM-JJ" }). */
  function estDate(valeur) {
    return valeur !== null && typeof valeur === 'object' && typeof valeur.date === 'string';
  }

  /** Vrai si la cellule est vide (rien, ou seulement des espaces). */
  function estVide(valeur) {
    return valeur === null || valeur === undefined || (typeof valeur === 'string' && valeur.trim() === '');
  }

  /** Transforme une cellule en texte lisible (dates au format JJ/MM/AAAA). */
  function enTexte(valeur) {
    if (estVide(valeur)) return '';
    if (estDate(valeur)) {
      const [annee, mois, jour] = valeur.date.split('-');
      return jour + '/' + mois + '/' + annee;
    }
    return String(valeur).trim();
  }

  /**
   * Version « simplifiée » d'un texte pour les comparaisons : minuscules, sans
   * accents, apostrophes et espaces uniformisés. « Début  d’inclusion » et
   * « debut d'inclusion » donnent le même résultat.
   */
  function texteSimple(texte) {
    return enTexte(texte)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’‘`´]/g, "'")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Identifiant stable d'une étude : « BRANCH-HF - PFIZER » → « branch-hf-pfizer ». */
  function identifiant(nom) {
    return texteSimple(nom).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  InnovaCare.texte = { estDate, estVide, enTexte, texteSimple, identifiant };
})(typeof globalThis !== 'undefined' ? globalThis : this);

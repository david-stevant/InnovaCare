// =============================================================================
// brouillon.js — garder les modifications de l'outil Paramètres en cours de route
// =============================================================================
// Une modification non enregistrée était perdue si la page se fermait. Le brouillon
// est rangé dans la mémoire locale du navigateur (« localStorage », sur ce poste
// seulement ; ce n'est pas un cookie, rien n'est envoyé). Il ne contient que des
// réglages, jamais de donnée patient. Il est effacé après un enregistrement réussi
// dans l'Excel. Toutes les fonctions reçoivent le « stockage » en argument : on peut
// ainsi les tester sans navigateur.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  const CLE = 'innovacare-brouillon-parametres';

  /** Range le brouillon. Renvoie true si c'est fait (le navigateur peut refuser). */
  function garder(stockage, parametres, date) {
    try {
      stockage.setItem(CLE, JSON.stringify({ date: (date || new Date()).toISOString(), parametres }));
      return true;
    } catch (erreur) { return false; }
  }

  /** Renvoie { date: Date, parametres } ou null (aucun brouillon, ou brouillon illisible). */
  function retrouver(stockage) {
    try {
      const brut = stockage.getItem(CLE);
      if (!brut) return null;
      const lu = JSON.parse(brut);
      const date = new Date(lu.date);
      if (!lu.parametres || typeof lu.parametres !== 'object' || !Array.isArray(lu.parametres.poles) || isNaN(date)) return null;
      return { date, parametres: lu.parametres };
    } catch (erreur) { return null; }
  }

  function effacer(stockage) {
    try { stockage.removeItem(CLE); } catch (erreur) { /* rien à faire */ }
  }

  /** « 19/11 à 21:34 » */
  function quand(date) {
    const deux = (n) => String(n).padStart(2, '0');
    return deux(date.getDate()) + '/' + deux(date.getMonth() + 1) + ' à ' + deux(date.getHours()) + ':' + deux(date.getMinutes());
  }

  /** Nom daté d'un fichier téléchargé : parametres_2026-11-19_21h34.json (évite les « (1) », « (2) »). */
  function nomDate(base, extension, date) {
    const d = date || new Date();
    const deux = (n) => String(n).padStart(2, '0');
    return base + '_' + d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()) + '_' + deux(d.getHours()) + 'h' + deux(d.getMinutes()) + extension;
  }

  InnovaCare.brouillon = { CLE, garder, retrouver, effacer, quand, nomDate };
})(typeof globalThis !== 'undefined' ? globalThis : this);

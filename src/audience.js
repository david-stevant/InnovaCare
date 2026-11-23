// =============================================================================
// audience.js — mesure d'audience des pages PUBLIQUES (GoatCounter), sans cookie
// =============================================================================
// Copié automatiquement dans site/js/commun/ (outils-src/construire.mjs). Jamais utilisé
// par les outils locaux (cahier des charges § 9 : rien sur les outils locaux).
// Aucun script extérieur : une simple demande de comptage est envoyée au compte GoatCounter
// dont le code est réglé dans parametres.json (publication.goatcounter ; vide = rien n'est
// compté). On n'envoie QUE le chemin de la page ou un NOM D'ÉVÉNEMENT FIXE (liste ci-dessous) :
// jamais une saisie du patient, jamais un nom d'étude. GoatCounter ne pose pas de cookie.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  const EVENEMENTS = ['test-termine', 'contacter-equipe', 'adresser-patient'];
  const CODE_VALIDE = /^[a-z0-9][a-z0-9-]{1,40}$/;

  /** Adresse de comptage, ou null si aucun compte n'est réglé (ou événement non prévu). */
  function adresse(parametres, chemin, evenement) {
    const code = String(((parametres || {}).publication || {}).goatcounter || '').trim().toLowerCase();
    if (!CODE_VALIDE.test(code)) return null;
    if (evenement && !EVENEMENTS.includes(evenement)) return null;
    const p = evenement ? evenement : String(chemin || '/').split('?')[0].split('#')[0];
    return 'https://' + code + '.goatcounter.com/count?p=' + encodeURIComponent(p) + (evenement ? '&e=true' : '') + '&rnd=' + Math.random().toString(36).slice(2, 8);
  }

  /** Compte une visite (sans événement) ou un événement de la liste. Ne fait rien sans compte réglé. */
  function compter(parametres, evenement) {
    try {
      const url = adresse(parametres, racine.location ? racine.location.pathname : '/', evenement);
      if (!url || typeof racine.Image !== 'function') return false;
      const img = new racine.Image(); // simple demande d'image : ni cookie, ni script tiers
      img.referrerPolicy = 'no-referrer';
      img.src = url;
      return true;
    } catch (erreur) { return false; }
  }

  InnovaCare.audience = { EVENEMENTS, adresse, compter };
})(typeof globalThis !== 'undefined' ? globalThis : this);

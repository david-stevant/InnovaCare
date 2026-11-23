// =============================================================================
// nouveautes.js — page « Nouveautés » des médecins libéraux (cahier des charges § 6.3)
// =============================================================================
// Études publiées pour les libéraux et ouvertes : récemment ouvertes (début d'inclusion
// dans les 30 derniers jours) et fins de recrutement annoncées. Lit les fichiers publics.
// Aucun cookie, aucune donnée envoyée. Valeurs insérées comme du texte.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const T = IC.texte, E = IC.eligibilite, PU = IC.public;
  const $ = (id) => document.getElementById(id);

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined && e !== false) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }

  async function lireJson(chemin) {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) throw new Error(chemin + ' : code ' + reponse.status);
    return reponse.json();
  }

  function carte(e, date) {
    return el('article', { className: 'etude' },
      el('h3', null, e.nom),
      e.thematique ? el('p', { className: 'thematique' }, e.thematique) : null,
      el('p', { className: 'meta' }, date),
      el('p', null, el('a', { href: './#etude-' + e.id }, 'Voir la fiche')));
  }

  function aujourdhui() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function demarrer() {
    try {
      const [P, donnees] = await Promise.all([lireJson('../donnees/parametres.json'), lireJson('../donnees/protocoles.json')]);
      for (const [nom, valeur] of Object.entries(P.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textes = (P.textes && P.textes.site) || {};
      const nomModule = (P.modules && P.modules.professionnel) || '';
      document.title = 'Nouveautés' + (nomModule ? ' — ' + nomModule : '');
      $('titre').textContent = 'Nouveautés' + (nomModule ? ' — ' + nomModule : '');
      if (P.publication && P.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textes.bandeau_test || 'Version de test'; }
      $('genere').textContent = donnees.genere_le ? 'Données publiées le ' + PU.dateFr(donnees.genere_le) + '.' : '';
      const etudes = E.candidates(PU.preparer(donnees, P, 'professionnel'));
      const n = PU.nouveautes(etudes, aujourdhui());
      $('t-recentes').textContent = 'Ouvertes depuis moins de ' + n.jours + ' jours';
      for (const e of n.recentes) $('recentes').appendChild(carte(e, 'Début des inclusions : ' + PU.dateFr(e.valeurs.debut_inclusion)));
      for (const e of n.fins) $('fins').appendChild(carte(e, 'Fin de recrutement prévue : ' + PU.dateFr(e.valeurs.fin_recrutement)));
      $('bloc-recentes').hidden = !n.recentes.length;
      $('bloc-fins').hidden = !n.fins.length;
      $('etat').textContent = n.recentes.length || n.fins.length ? '' : 'Rien de nouveau pour le moment : aucune étude ouverte récemment, aucune fin de recrutement annoncée.';
      $('etat').hidden = !$('etat').textContent;
      IC.audience.compter(P);
    } catch (erreur) {
      $('etat').textContent = 'Les données n\'ont pas pu être chargées (' + erreur.message + ').';
    }
  }

  demarrer();
})();

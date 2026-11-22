// =============================================================================
// accueil.js — page d'accueil publique : deux entrées, médecin et patient
// =============================================================================
// Lit donnees/parametres.json (noms des modules, textes) et donnees/protocoles.json
// (nombre d'études ouvertes). Aucun cookie, aucune donnée envoyée, aucune mesure
// d'audience. L'outil interne n'est jamais lié depuis le site.
// =============================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const enDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

  async function lireJson(chemin) {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) throw new Error(chemin + ' : code ' + reponse.status);
    return reponse.json();
  }

  async function demarrer() {
    try {
      const [parametres, donnees] = await Promise.all([lireJson('donnees/parametres.json'), lireJson('donnees/protocoles.json')]);
      for (const [nom, valeur] of Object.entries(parametres.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textes = (parametres.textes && parametres.textes.site) || {};
      const modules = parametres.modules || {};
      const instance = (parametres.specialite && parametres.specialite.instance) || '';
      document.title = (instance ? instance + ' — ' : '') + (textes.titre_liste || 'Études cliniques');
      $('titre').textContent = instance || 'Études cliniques';
      $('sous-titre').textContent = textes.titre_liste || '';
      if (parametres.publication && parametres.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textes.bandeau_test || 'Version de test'; }
      $('nom-pro').textContent = modules.professionnel || '';
      $('nom-patient').textContent = modules.patient || '';
      const ouvertes = (donnees.protocoles || []).filter((p) => (p.modules || []).includes('professionnel') && String((p.valeurs || {}).statut || '').toLowerCase() === 'ouvert');
      $('texte-pro').textContent = ouvertes.length + ' étude' + (ouvertes.length > 1 ? 's' : '') + ' ouverte' + (ouvertes.length > 1 ? 's' : '') + ' : critères, contact, adressage.';
      $('avertissement').textContent = ((parametres.textes || {}).patient || {}).avertissement || '';
      $('genere').textContent = donnees.genere_le ? 'Données publiées le ' + enDate(donnees.genere_le) + '.' : '';
      $('etat').textContent = '';
      $('etat').hidden = true;
    } catch (erreur) {
      $('etat').textContent = 'Les données n\'ont pas pu être chargées (' + erreur.message + ').';
    }
  }

  demarrer();
})();

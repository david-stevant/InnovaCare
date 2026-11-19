// =============================================================================
// accueil.js — page publique minimale : liste des études ouvertes, par pôle
// =============================================================================
// Lit donnees/parametres.json et donnees/protocoles.json (fichier public produit par
// le Publieur). Aucun cookie, aucune donnée envoyée, aucune mesure d'audience.
// Toutes les valeurs sont affichées comme du texte (jamais interprétées comme du HTML).
// =============================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }

  const enDate = (iso) => { if (!iso) return ''; const [a, m, j] = String(iso).split('-'); return (j ? j + '/' : '') + m + '/' + a; };

  async function lireJson(chemin) {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) throw new Error(chemin + ' : code ' + reponse.status);
    return reponse.json();
  }

  function carte(p, parametres) {
    const v = p.valeurs || {};
    const textes = (parametres.textes && parametres.textes.site) || {};
    const pathologies = [1, 2, 3, 4].map((n) => v['pathologie_' + n]).filter(Boolean);
    const lignes = [];
    const ajouter = (libelle, valeur) => { if (valeur) lignes.push(el('dt', null, libelle), el('dd', null, valeur)); };
    ajouter('Phase', v.phase);
    ajouter('Intervention', v.intervention);
    ajouter('Design', v.design);
    ajouter('Suivi', [v.duree_suivi, v.rythme_visites].filter(Boolean).join(' — '));
    const pi = p.contacts && p.contacts.investigateur;
    if (pi) lignes.push(el('dt', null, textes.contact || 'Contact'), el('dd', null, pi.nom + ' — ', el('a', { href: 'mailto:' + pi.mssante, textContent: pi.mssante })));
    ajouter(textes.mise_a_jour || 'Mise à jour', enDate(p.maj));
    return el('article', { className: 'etude' },
      el('h3', null, v.nom || ''),
      v.thematique ? el('p', { className: 'thematique' }, v.thematique) : null,
      pathologies.length ? el('ul', { className: 'puces' }, ...pathologies.map((x) => el('li', null, x))) : null,
      lignes.length ? el('dl', null, ...lignes) : null);
  }

  async function demarrer() {
    try {
      const [parametres, donnees] = await Promise.all([lireJson('donnees/parametres.json'), lireJson('donnees/protocoles.json')]);
      for (const [nom, valeur] of Object.entries(parametres.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textes = (parametres.textes && parametres.textes.site) || {};
      const patient = (parametres.textes && parametres.textes.patient) || {};
      const instance = (parametres.specialite && parametres.specialite.instance) || '';
      document.title = (textes.titre_liste || 'Études ouvertes') + (instance ? ' — ' + instance : '');
      $('titre').textContent = instance || 'Études cliniques';
      $('sous-titre').textContent = textes.titre_liste || '';
      if (parametres.publication && parametres.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textes.bandeau_test || 'Version de test'; }
      $('avertissement').textContent = patient.avertissement || '';
      $('genere').textContent = donnees.genere_le ? 'Données publiées le ' + enDate(donnees.genere_le) + '.' : '';

      // Seules les études « ouvert » sont proposées.
      const ouvertes = (donnees.protocoles || []).filter((p) => String((p.valeurs || {}).statut || '').toLowerCase() === 'ouvert');
      const liste = $('liste');
      liste.textContent = '';
      for (const pole of parametres.poles || []) {
        const etudes = ouvertes.filter((p) => p.pole === pole.id).sort((a, b) => String(a.valeurs.nom).localeCompare(String(b.valeurs.nom), 'fr'));
        if (!etudes.length) continue;
        liste.appendChild(el('h2', { className: 'pole' }, pole.nom + ' (' + etudes.length + ')'));
        for (const p of etudes) liste.appendChild(carte(p, parametres));
      }
      $('etat').textContent = ouvertes.length ? ouvertes.length + ' étude(s) ouverte(s).' : (textes.aucune_etude || 'Aucune étude publiée.');
    } catch (erreur) {
      $('etat').textContent = 'Les données n\'ont pas pu être chargées (' + erreur.message + ').';
    }
  }

  demarrer();
})();

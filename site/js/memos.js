// =============================================================================
// memos.js (site) — mémos publics des études ouvertes (cahier des charges § 6.5)
// =============================================================================
// Toutes les études publiées et « ouvert », au format des mémos v3, à partir du fichier
// public protocoles.json : aucun numéro de poste interne (le site n'en a pas), contact =
// e-mail de l'ARC s'il est publié. Le mémo est fabriqué par js/commun/memos.js, qui échappe
// tout le texte venu de l'Excel avant de l'afficher. Aucun cookie, rien d'envoyé.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const PU = IC.public, M = IC.memos, E = IC.eligibilite;
  const $ = (id) => document.getElementById(id);
  let P = null, etudes = [], memo = null;

  async function lireJson(chemin) {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) throw new Error(chemin + ' : code ' + reponse.status);
    return reponse.json();
  }

  function dessiner() {
    memo = M.construire(etudes, P, { section: $('section').value });
    // versHtml échappe tout le texte de l'Excel : affichage sans risque.
    $('apercu').innerHTML = memo.sections.length ? M.versHtml(memo) : '<p>Aucune étude ouverte publiée.</p>';
    $('message').textContent = '';
  }

  async function copier(enHtml) {
    if (!memo || !memo.sections.length) return;
    const brut = M.versMarkdown(memo);
    try {
      if (enHtml && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([M.versHtml(memo)], { type: 'text/html' }), 'text/plain': new Blob([brut], { type: 'text/plain' }) })]);
      } else { await navigator.clipboard.writeText(brut); }
      $('message').textContent = '✔ Copié : collez-le dans votre message (Ctrl+V).';
    } catch (erreur) {
      const plage = document.createRange();
      plage.selectNodeContents($('apercu'));
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(plage);
      $('message').textContent = 'Le mémo est sélectionné : faites Ctrl+C.';
    }
  }

  async function demarrer() {
    try {
      const [parametres, donnees] = await Promise.all([lireJson('../donnees/parametres.json'), lireJson('../donnees/protocoles.json')]);
      P = parametres;
      for (const [nom, valeur] of Object.entries(P.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textes = (P.textes && P.textes.site) || {};
      if (P.publication && P.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textes.bandeau_test || 'Version de test'; }
      $('genere').textContent = donnees.genere_le ? 'Données publiées le ' + PU.dateFr(donnees.genere_le) + '.' : '';
      // Toutes les études publiées (décision du 23/11/2026), « ouvert » seulement (memos.construire).
      etudes = PU.preparer(donnees, P, null);
      const tout = M.construire(etudes, P);
      $('titre').textContent = tout.titre || 'Mémos des études';
      $('sous-titre').textContent = tout.hashtags || '';
      for (const t of tout.sectionsDisponibles) { const o = document.createElement('option'); o.value = t; o.textContent = t; $('section').appendChild(o); }
      $('etat').hidden = true;
      $('contenu').hidden = false;
      dessiner();
      $('section').addEventListener('change', dessiner);
      $('copier-mail').addEventListener('click', () => copier(true));
      $('copier-brut').addEventListener('click', () => copier(false));
      IC.audience.compter(P);
    } catch (erreur) {
      $('etat').textContent = 'Les données n\'ont pas pu être chargées (' + erreur.message + ').';
    }
  }

  demarrer();
})();

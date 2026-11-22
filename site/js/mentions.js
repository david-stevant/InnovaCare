// =============================================================================
// mentions.js — page « Mentions » (cahier des charges § 9 : éditeur, finalité,
// absence de collecte, avertissement)
// =============================================================================
// Le texte vient de parametres.json (textes.mentions : [{ titre, texte }]), modifiable
// dans l'outil Paramètres, rubrique « Page Mentions ». Tant que cette rubrique est vide,
// le texte de départ ci-dessous s'affiche ; ses parties à valider sont marquées
// « [à confirmer] » ou « [à compléter] ». Aucun cookie, aucune donnée envoyée.
// =============================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function depart(parametres) {
    const avertissement = ((parametres.textes || {}).patient || {}).avertissement || '';
    return [
      { titre: 'Éditeur', texte: '[à compléter]' },
      { titre: 'Finalité', texte: 'Ce site présente les études de recherche clinique ouvertes aux inclusions, pour les faire connaître aux patients et aux médecins. [à confirmer]' },
      { titre: 'Données personnelles', texte: 'Ce site ne collecte aucune donnée personnelle. Il n\'utilise aucun cookie et aucun formulaire n\'envoie d\'information. Ce que vous saisissez (par exemple dans un profil) reste dans votre navigateur et disparaît à la fermeture de la page.' },
      { titre: 'Mesure d\'audience', texte: 'Aucune mesure d\'audience n\'est réalisée pour le moment.' },
      { titre: 'Hébergement', texte: 'Site hébergé par GitHub Pages (GitHub, Inc.).' },
      avertissement ? { titre: 'Avertissement', texte: avertissement } : null,
      { titre: 'Contact', texte: '[à compléter]' },
    ].filter(Boolean);
  }

  async function demarrer() {
    try {
      const reponse = await fetch('donnees/parametres.json', { cache: 'no-store' });
      if (!reponse.ok) throw new Error('code ' + reponse.status);
      const P = await reponse.json();
      for (const [nom, valeur] of Object.entries(P.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textes = (P.textes && P.textes.site) || {};
      if (P.publication && P.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textes.bandeau_test || 'Version de test'; }
      const rubriques = Array.isArray((P.textes || {}).mentions) && P.textes.mentions.length ? P.textes.mentions : depart(P);
      const zone = $('mentions');
      for (const r of rubriques) {
        if (!r || !r.titre) continue;
        const h = document.createElement('h2'); h.className = 'pole'; h.textContent = r.titre;
        const p = document.createElement('p'); p.textContent = r.texte || ''; p.style.whiteSpace = 'pre-line';
        zone.appendChild(h); zone.appendChild(p);
      }
      $('etat').hidden = true;
    } catch (erreur) {
      $('etat').textContent = 'La page n\'a pas pu être chargée (' + erreur.message + ').';
    }
  }

  demarrer();
})();

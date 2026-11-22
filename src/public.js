// =============================================================================
// public.js — prépare les études PUBLIÉES (protocoles.json) pour les pages publiques
// =============================================================================
// Utilisé par InnovAction (libéraux) et plus tard InnovActeur (patients). Une copie
// automatique est placée dans site/js/commun/ (outils-src/construire.mjs).
// Ne lit que le fichier public : il ne peut donc rien afficher d'interne.
// Les études ont la même forme que dans l'outil interne, pour réutiliser le moteur
// d'éligibilité (src/eligibilite.js). Rien n'est envoyé ni enregistré.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const T = InnovaCare.texte;

  /** « 2025-03-01 » → « 01/03/2025 » (dates du fichier public). */
  function dateFr(iso) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(iso || ''));
    if (!m) return T.enTexte(iso);
    return (m[3] ? m[3] + '/' : '') + m[2] + '/' + m[1];
  }

  /**
   * Études d'un module (« professionnel » ou « patient »), prêtes à afficher et à filtrer.
   * Seules celles dont le module figure dans « modules » sont gardées ; le statut est
   * filtré ensuite par eligibilite.candidates (« ouvert » seulement).
   */
  function preparer(donnees, parametres, module) {
    const nomPole = Object.fromEntries((parametres.poles || []).map((p) => [p.id, p.nom]));
    return ((donnees && donnees.protocoles) || [])
      .filter((p) => (p.modules || []).includes(module))
      .map((p) => {
        const v = p.valeurs || {};
        const pathologies = [1, 2, 3, 4].map((n) => v['pathologie_' + n]).filter((x) => !T.estVide(x)).map(T.enTexte);
        const recherche = T.texteSimple(Object.values(v).map(T.enTexte).concat(nomPole[p.pole] || '', p.contacts && p.contacts.investigateur ? p.contacts.investigateur.nom : '').join(' '));
        return {
          id: p.id, pole: p.pole, poleNom: nomPole[p.pole] || '', nom: T.enTexte(v.nom), statut: T.enTexte(v.statut),
          thematique: T.enTexte(v.thematique), pathologies, valeurs: v, contacts: p.contacts || {}, maj: p.maj || '',
          masquee: false, enAvant: false, recherche,
        };
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }

  /** Recherche plein texte (tous les mots, sans accents ni majuscules). */
  function rechercher(etudes, texte) {
    const mots = T.texteSimple(texte || '').split(' ').filter(Boolean);
    return etudes.filter((e) => mots.every((m) => e.recherche.includes(m)));
  }

  /**
   * Adressage à l'investigateur principal, par sa messagerie sécurisée (MSSanté) — cahier des charges § 6.3.
   * Renvoie null si aucune adresse MSSanté n'est publiée (elle ne l'est que si elle a été vérifiée).
   * Objet et corps viennent des paramètres (textes.adressage) ; {protocole} = nom de l'étude.
   * Un corps vide reste vide : rien n'est inventé.
   */
  function adressage(etude, parametres) {
    const pi = etude.contacts && etude.contacts.investigateur;
    if (!pi || !pi.mssante) return null;
    const textes = ((parametres.textes || {}).adressage) || {};
    const remplacer = (t) => String(t || '').split('{protocole}').join(etude.nom);
    const objet = remplacer(textes.objet);
    const corps = remplacer([].concat(textes.corps || []).join('\n'));
    const parametresLien = [objet ? 'subject=' + encodeURIComponent(objet) : '', corps ? 'body=' + encodeURIComponent(corps) : ''].filter(Boolean).join('&');
    return { nom: pi.nom, mssante: pi.mssante, objet, corps, mailto: 'mailto:' + pi.mssante + (parametresLien ? '?' + parametresLien : '') };
  }

  // --- Nouveautés (cahier des charges § 6.3) -----------------------------------------------

  const JOURS_NOUVEAUTE = 30;

  /** « 2025-03-01 » ou « 2025-03 » (1er du mois) → nombre de jours depuis 1970, ou null. */
  function jour(iso) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(iso || ''));
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) / 86400000) : null;
  }

  /**
   * Études récemment ouvertes (début d'inclusion dans les 30 derniers jours, la plus récente d'abord)
   * et fins de recrutement annoncées (date future, la plus proche d'abord). Une étude sans date ne
   * figure dans aucune liste : rien n'est deviné. aujourdhui : « AAAA-MM-JJ ».
   */
  function nouveautes(etudes, aujourdhui) {
    const j = jour(aujourdhui);
    const recentes = etudes.filter((e) => { const d = jour(e.valeurs.debut_inclusion); return d !== null && d <= j && j - d <= JOURS_NOUVEAUTE; })
      .sort((a, b) => jour(b.valeurs.debut_inclusion) - jour(a.valeurs.debut_inclusion));
    const fins = etudes.filter((e) => { const d = jour(e.valeurs.fin_recrutement); return d !== null && d >= j; })
      .sort((a, b) => jour(a.valeurs.fin_recrutement) - jour(b.valeurs.fin_recrutement));
    return { recentes, fins, jours: JOURS_NOUVEAUTE };
  }

  InnovaCare.public = { preparer, rechercher, adressage, dateFr, nouveautes };
})(typeof globalThis !== 'undefined' ? globalThis : this);

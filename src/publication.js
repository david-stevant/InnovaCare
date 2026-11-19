// =============================================================================
// publication.js — contrôles avant publication, comparaison avec la version en
// ligne, et date de dernière mise à jour de chaque étude
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;

  /**
   * Contrôles de cohérence de l'Excel harmonisé relu.
   * « bloquant » : la publication est impossible tant que ce n'est pas corrigé.
   * « avertissement » : à regarder, mais la publication reste possible.
   */
  function controler(lu, parametres) {
    const resultat = [];
    const ajouter = (gravite, etude, message) => resultat.push({ gravite, etude, message });
    const champs = InnovaCare.schema.champsFiche(parametres);
    const listes = InnovaCare.gabarit.listesDeValeurs(parametres);
    const nomsAnnuaire = new Set(lu.annuaire.map((p) => N.texteSimple(p.nom_affiche)));

    for (const a of lu.anomalies) {
      ajouter(a.type === 'libelle_inconnu' ? 'avertissement' : 'bloquant', a.onglet, a.message + ' Utilisez l\'outil Paramètres pour remettre l\'Excel à jour.');
    }
    const vus = new Map();
    for (const e of lu.etudes) {
      const v = e.valeurs;
      const ou = e.onglet + ', colonne ' + e.colonne;
      if (vus.has(e.id)) ajouter('bloquant', v.nom, 'Nom d\'étude en double (' + vus.get(e.id) + ' et ' + ou + ').');
      vus.set(e.id, ou);
      const publiee = InnovaCare.exportPublic.estPubliee(v);
      const patient = v.afficher_innovacteur === 'oui';
      for (const c of champs) {
        const valeur = v[c.id];
        const vide = valeur === undefined || valeur === null || valeur === '';
        // Valeur hors liste (le statut décide de la publication : son erreur est bloquante)
        if (!vide && (c.type === 'liste' || c.type === 'oui_non' || c.type === 'requis_exclu')) {
          const permises = listes[c.type === 'oui_non' ? 'oui_non' : c.liste] || [];
          if (permises.length && !permises.some((x) => N.texteSimple(x) === N.texteSimple(valeur))) {
            ajouter(c.id === 'statut' || c.id.startsWith('afficher_') ? 'bloquant' : 'avertissement', v.nom, '« ' + c.libelle + ' » : valeur « ' + valeur + ' » absente de la liste (' + ou + ').');
          }
        }
        if (!vide && c.type === 'personne' && !nomsAnnuaire.has(N.texteSimple(valeur))) {
          ajouter('avertissement', v.nom, '« ' + c.libelle + ' » : « ' + valeur + ' » absent de l\'annuaire.');
        }
        if (vide && publiee && (c.obligatoire === 'oui' || c.obligatoire === 'si_public' || (c.obligatoire === 'si_patient' && patient))) {
          ajouter('avertissement', v.nom, '« ' + c.libelle + ' » est vide alors que l\'étude est publiée.');
        }
      }
      if (publiee && v.investigateur) {
        const pi = lu.annuaire.find((p) => N.texteSimple(p.nom_affiche) === N.texteSimple(v.investigateur));
        if (pi && N.texteSimple(pi.mssante_verifiee) !== 'oui') ajouter('avertissement', v.nom, 'Adresse MSSanté de ' + v.investigateur + ' non vérifiée : aucun contact ne sera publié pour cette étude.');
      }
    }
    return resultat;
  }

  /** Ce qui compte pour la comparaison : tout sauf la date de mise à jour. */
  const empreinte = (p) => JSON.stringify({ pole: p.pole, modules: p.modules, valeurs: p.valeurs, contacts: p.contacts });

  /** Champs publics qui diffèrent entre deux versions d'une étude. */
  function champsModifies(ancien, nouveau) {
    const cles = new Set(Object.keys(ancien.valeurs || {}).concat(Object.keys(nouveau.valeurs || {})));
    const champs = [...cles].filter((c) => JSON.stringify((ancien.valeurs || {})[c]) !== JSON.stringify((nouveau.valeurs || {})[c]));
    if (JSON.stringify(ancien.contacts || {}) !== JSON.stringify(nouveau.contacts || {})) champs.push('contacts');
    if (JSON.stringify(ancien.modules || []) !== JSON.stringify(nouveau.modules || [])) champs.push('modules');
    if (ancien.pole !== nouveau.pole) champs.push('pole');
    return champs;
  }

  /** Compare deux contenus de protocoles.json : ajouts, retraits, modifications. */
  function comparer(ancien, nouveau) {
    const avant = new Map(((ancien && ancien.protocoles) || []).map((p) => [p.id, p]));
    const apres = new Map(((nouveau && nouveau.protocoles) || []).map((p) => [p.id, p]));
    const nom = (p) => (p.valeurs && p.valeurs.nom) || p.id;
    const resultat = { ajoutees: [], retirees: [], modifiees: [], identiques: 0 };
    for (const [id, p] of apres) {
      if (!avant.has(id)) resultat.ajoutees.push({ id, nom: nom(p) });
      else if (empreinte(avant.get(id)) !== empreinte(p)) resultat.modifiees.push({ id, nom: nom(p), champs: champsModifies(avant.get(id), p) });
      else resultat.identiques++;
    }
    for (const [id, p] of avant) if (!apres.has(id)) resultat.retirees.push({ id, nom: nom(p) });
    return resultat;
  }

  /**
   * Date de dernière mise à jour : celle de la version en ligne si rien de public n'a changé,
   * sinon la date du jour. Aucune date n'est demandée aux ARC.
   */
  function dater(nouveau, ancien, aujourdhui) {
    const avant = new Map(((ancien && ancien.protocoles) || []).map((p) => [p.id, p]));
    for (const p of nouveau.protocoles) {
      const precedent = avant.get(p.id);
      p.maj = precedent && precedent.maj && empreinte(precedent) === empreinte(p) ? precedent.maj : aujourdhui;
    }
    return nouveau;
  }

  /** Message de commit lisible : « Publication du 19/11/2026 : 2 ajoutée(s), 1 modifiée(s) ». */
  function messageCommit(difference, aujourdhui) {
    const [a, m, j] = aujourdhui.split('-');
    const morceaux = [];
    if (difference.ajoutees.length) morceaux.push(difference.ajoutees.length + ' ajoutée(s)');
    if (difference.modifiees.length) morceaux.push(difference.modifiees.length + ' modifiée(s)');
    if (difference.retirees.length) morceaux.push(difference.retirees.length + ' retirée(s)');
    return 'Publication du ' + j + '/' + m + '/' + a + ' : ' + (morceaux.join(', ') || 'aucun changement');
  }

  /** Texte → base64 (UTF-8), pour l'API GitHub. */
  function enBase64(texte) {
    const octets = new TextEncoder().encode(texte);
    let binaire = '';
    for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(binaire);
  }
  /** base64 (UTF-8) → texte. */
  function depuisBase64(b64) {
    const binaire = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
  }

  InnovaCare.publication = { controler, comparer, champsModifies, dater, messageCommit, enBase64, depuisBase64 };
})(typeof globalThis !== 'undefined' ? globalThis : this);

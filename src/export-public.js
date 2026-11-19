// =============================================================================
// export-public.js — fabrique protocoles.json, le SEUL fichier qui quitte l'hôpital
// =============================================================================
// Principe de la LISTE BLANCHE : on ne retire pas ce qui est interne, on ne prend
// que ce qui est explicitement public. Un champ est exporté seulement si, dans le
// schéma :
//   - sa visibilité est « professionnel » ou « patient » ;
//   - il ne porte PAS le verrou jamaisPublic (règle absolue n° 2) ;
//   - ce n'est pas un nom de personne (contact: true) ni un champ désactivé.
// Les contacts sont reconstruits à part, selon parametres.publication :
//   - investigateur principal : nom + adresse MSSanté, seulement si l'annuaire la
//     marque « vérifiée » ;
//   - ARC : nom + e-mail, seulement si contacts_arc vaut true (non pour l'instant) ;
//   - le DECT n'est JAMAIS exporté.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;

  const FORMAT = 1;
  const VISIBILITES_PUBLIQUES = ['professionnel', 'patient'];

  /** Champs exportables (liste blanche), d'après le schéma. */
  function champsPublics(parametres) {
    return InnovaCare.schema.champsFiche(parametres).filter((c) =>
      VISIBILITES_PUBLIQUES.includes(c.visibilite) && !c.jamaisPublic && !c.contact && !c.desactive
    );
  }

  /** Vrai si l'étude doit figurer dans protocoles.json. */
  function estPubliee(valeurs) {
    const affichee = valeurs.afficher_innovaction === 'oui' || valeurs.afficher_innovacteur === 'oui';
    return !!valeurs.nom && affichee && N.texteSimple(valeurs.statut) !== N.texteSimple('terminé');
  }

  /** Valeur publiable : les dates deviennent « AAAA-MM-JJ », le texte est gardé tel quel. */
  function valeurPublique(valeur) {
    if (valeur === null || valeur === undefined || valeur === '') return undefined;
    if (N.estDate(valeur)) return valeur.date;
    return valeur;
  }

  /** Contacts publics d'une étude, selon les règles de publication. */
  function contactsPublics(valeurs, annuaire, parametres) {
    const regles = parametres.publication || {};
    const formatMssante = (parametres.annuaire || {}).format_mssante;
    const personne = (nomAffiche) => annuaire.find((p) => N.texteSimple(p.nom_affiche) === N.texteSimple(nomAffiche));
    const contacts = {};
    const pi = valeurs.investigateur && personne(valeurs.investigateur);
    if (pi && N.texteSimple(pi.mssante_verifiee) === 'oui') {
      const mssante = pi.mssante || (formatMssante ? N.emailAttendu(pi.prenom || '', pi.nom || '', formatMssante) : '');
      if (mssante) contacts.investigateur = { nom: pi.nom_affiche, mssante };
    }
    if (regles.contacts_arc === true) {
      const arcs = ['arc_1', 'arc_backup_1', 'arc_backup_2']
        .map((id) => valeurs[id] && personne(valeurs[id]))
        .filter((p) => p && p.email)
        .map((p) => ({ nom: p.nom_affiche, email: p.email }));
      if (arcs.length) contacts.arc = arcs;
    }
    return contacts;
  }

  /**
   * Fabrique le contenu de protocoles.json à partir d'un Excel harmonisé relu (lecture.lireGabarit).
   * Les dates de mise à jour (« maj ») sont calculées ensuite par publication.dater.
   */
  function exporter(lu, parametres, maintenant) {
    const champs = champsPublics(parametres);
    const protocoles = [];
    for (const e of lu.etudes) {
      if (!estPubliee(e.valeurs)) continue;
      const valeurs = {};
      for (const c of champs) {
        const v = valeurPublique(e.valeurs[c.id]);
        if (v !== undefined) valeurs[c.id] = v;
      }
      const modules = [];
      if (e.valeurs.afficher_innovaction === 'oui') modules.push('professionnel');
      if (e.valeurs.afficher_innovacteur === 'oui') modules.push('patient');
      protocoles.push({ id: N.identifiant(e.valeurs.nom), pole: e.pole, modules, valeurs, contacts: contactsPublics(e.valeurs, lu.annuaire, parametres) });
    }
    return {
      format: FORMAT,
      instance: (parametres.specialite && parametres.specialite.instance) || '',
      genere_le: (maintenant || new Date()).toISOString().slice(0, 10),
      protocoles,
    };
  }

  /**
   * Vérifie qu'un contenu de protocoles.json respecte la liste blanche (utilisé avant chaque
   * publication et par les tests sur le fichier du dépôt). Renvoie la liste des problèmes.
   */
  function verifierContenu(contenu, parametres) {
    const problemes = [];
    const permis = new Set(champsPublics(parametres).map((c) => c.id));
    const regles = parametres.publication || {};
    const clesContact = regles.contacts_arc === true ? ['investigateur', 'arc'] : ['investigateur'];
    if (!contenu || !Array.isArray(contenu.protocoles)) return ['Le fichier ne contient pas de liste « protocoles ».'];
    for (const p of contenu.protocoles) {
      const nom = (p.valeurs && p.valeurs.nom) || p.id;
      for (const cle of Object.keys(p)) {
        if (!['id', 'pole', 'modules', 'maj', 'valeurs', 'contacts'].includes(cle)) problemes.push(nom + ' : clé « ' + cle + ' » non prévue.');
      }
      for (const cle of Object.keys(p.valeurs || {})) {
        if (!permis.has(cle)) problemes.push(nom + ' : champ « ' + cle + ' » non public.');
      }
      for (const [cle, valeur] of Object.entries(p.contacts || {})) {
        if (!clesContact.includes(cle)) { problemes.push(nom + ' : contact « ' + cle + ' » non autorisé.'); continue; }
        const liste = Array.isArray(valeur) ? valeur : [valeur];
        for (const c of liste) {
          const autorisees = cle === 'investigateur' ? ['nom', 'mssante'] : ['nom', 'email'];
          for (const k of Object.keys(c)) if (!autorisees.includes(k)) problemes.push(nom + ' : donnée « ' + k + ' » non autorisée dans le contact.');
        }
      }
    }
    if (/dect/i.test(JSON.stringify(contenu))) problemes.push('Le mot « DECT » apparaît dans le fichier.');
    return problemes;
  }

  InnovaCare.exportPublic = { FORMAT, champsPublics, estPubliee, contactsPublics, exporter, verifierContenu };
})(typeof globalThis !== 'undefined' ? globalThis : this);

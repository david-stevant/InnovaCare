// =============================================================================
// catalogue.js — prépare les études pour l'outil interne (catalogue, fiche)
// =============================================================================
// Travaille sur l'Excel harmonisé relu par src/lecture.js. Toutes les données sont
// INTERNES (critères d'exclusion, DECT, recrutement…) : ce code ne sert qu'à l'outil
// local, qui ne fait aucun appel réseau. Rien n'est inventé : un champ vide reste
// absent de la fiche ; une personne absente de l'annuaire est affichée telle quelle,
// signalée « hors annuaire ».
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;

  const CONTACTS = ['investigateur', 'arc_1', 'arc_backup_1', 'arc_backup_2'];
  const deVrai = (v) => N.texteSimple(v) === 'oui';

  /** Personne de l'annuaire retrouvée par son « nom affiché » (Prénom NOM). */
  function contact(nomAffiche, annuaire) {
    if (N.estVide(nomAffiche)) return null;
    const cle = N.texteSimple(nomAffiche);
    const p = annuaire.find((x) => N.texteSimple(x.nom_affiche) === cle);
    if (!p) return { nom: N.enTexte(nomAffiche), connu: false };
    const c = { nom: p.nom_affiche, connu: true };
    if (p.dect) c.dect = p.dect;
    if (p.email) c.email = p.email;
    if (p.fonction) c.fonction = p.fonction;
    return c;
  }

  /** Recrutés / objectif : { recrutes, objectif, pourcentage } ou null si rien n'est saisi. */
  function recrutement(valeurs) {
    const r = typeof valeurs.recrutes === 'number' ? valeurs.recrutes : null;
    const o = typeof valeurs.objectif === 'number' ? valeurs.objectif : null;
    if (r === null && o === null) return null;
    const pourcentage = r !== null && o ? Math.round((100 * r) / o) : null;
    return { recrutes: r, objectif: o, pourcentage };
  }

  /**
   * Études enrichies, prêtes à afficher.
   * Renvoie { etudes, statuts, poles, pathologies, arcs, masquees }.
   */
  function preparer(lu, parametres) {
    const annuaire = lu.annuaire || [];
    const nomPole = Object.fromEntries((parametres.poles || []).map((p) => [p.id, p.nom]));
    const etudes = lu.etudes.map((e) => {
      const v = e.valeurs;
      const contacts = {};
      for (const id of CONTACTS) { const c = contact(v[id], annuaire); if (c) contacts[id] = c; }
      const pathologies = [1, 2, 3, 4].map((n) => v['pathologie_' + n]).filter((x) => !N.estVide(x)).map(N.enTexte);
      const autresPoles = [1, 2].map((n) => v['autre_pole_' + n]).filter((x) => !N.estVide(x)).map(N.enTexte);
      const arcs = ['arc_1', 'arc_backup_1', 'arc_backup_2'].map((id) => contacts[id]).filter(Boolean);
      // Tout le texte de la fiche (et des contacts), sans accents ni majuscules, pour la recherche.
      const morceaux = Object.values(v).map(N.enTexte).concat(Object.values(contacts).map((c) => c.nom), [nomPole[e.pole] || e.onglet]);
      return {
        id: e.id, pole: e.pole, poleNom: nomPole[e.pole] || e.onglet, onglet: e.onglet, colonne: e.colonne,
        nom: N.enTexte(v.nom), statut: N.enTexte(v.statut), thematique: N.enTexte(v.thematique),
        pathologies, autresPoles, contacts, arcs,
        recrutement: recrutement(v),
        enAvant: deVrai(v.en_avant),
        masquee: !deVrai(v.afficher_ecardioscope),
        aRessaisir: !!(e.note && /d[ée]cal|ressaisir/i.test(e.note)),
        note: e.note || null,
        valeurs: v,
        recherche: N.texteSimple(morceaux.join(' ')),
      };
    });
    const tri = (a, b) => a.localeCompare(b, 'fr');
    return {
      etudes,
      statuts: ((parametres.listes || {}).statut || []).slice(),
      poles: (parametres.poles || []).map((p) => p.nom),
      pathologies: (parametres.pathologies || []).map((p) => p.nom),
      arcs: [...new Set(etudes.flatMap((e) => e.arcs.map((c) => c.nom)))].sort(tri),
      masquees: etudes.filter((e) => e.masquee).length,
    };
  }

  /**
   * Filtre les études. criteres : { texte, poles: [noms], pathologies: [noms], statuts: [valeurs],
   * arc: nom, masquees: true pour inclure les études non affichées dans l'outil interne }.
   * Un critère vide ne filtre pas. Le pôle compte aussi les « autres pôles concernés ».
   */
  function filtrer(etudes, criteres) {
    const c = criteres || {};
    const mots = N.texteSimple(c.texte || '').split(' ').filter(Boolean);
    const dans = (liste, valeurs) => !liste || !liste.length || valeurs.some((x) => liste.map(N.texteSimple).includes(N.texteSimple(x)));
    return etudes.filter((e) => (c.masquees || !e.masquee)
      && dans(c.poles, [e.poleNom].concat(e.autresPoles))
      && dans(c.pathologies, e.pathologies)
      && dans(c.statuts, [e.statut])
      && (!c.arc || e.arcs.some((a) => N.texteSimple(a.nom) === N.texteSimple(c.arc)))
      && mots.every((m) => e.recherche.includes(m)));
  }

  /** Trie (copie). cle : nom, statut, pole, recrutement, debut. Statuts dans l'ordre des paramètres. */
  function trier(etudes, cle, ordreStatuts, sens) {
    const signe = sens === 'desc' ? -1 : 1;
    const rang = (s) => { const i = (ordreStatuts || []).indexOf(s); return i < 0 ? 99 : i; };
    const valeur = {
      nom: (e) => e.nom,
      statut: (e) => rang(e.statut),
      pole: (e) => e.poleNom,
      recrutement: (e) => (e.recrutement && e.recrutement.pourcentage !== null ? e.recrutement.pourcentage : -1),
      debut: (e) => (e.valeurs.debut_inclusion && e.valeurs.debut_inclusion.date) || '',
    }[cle] || ((e) => e.nom);
    return etudes.slice().sort((a, b) => {
      const x = valeur(a), y = valeur(b);
      const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'fr');
      return (r || a.nom.localeCompare(b.nom, 'fr')) * signe;
    });
  }

  /** Compte les études par valeur d'un critère (pour afficher « ouvert (12) »). */
  function compter(etudes, cle) {
    const n = {};
    for (const e of etudes) for (const x of [].concat(e[cle])) n[x] = (n[x] || 0) + 1;
    return n;
  }

  /**
   * Fiche détaillée : [{ bloc, lignes: [{ id, libelle, texte, interne, contact? }] }], dans l'ordre du
   * schéma. Les champs vides sont omis. Les personnes sont remplacées par leur fiche d'annuaire.
   */
  function fiche(etude, parametres) {
    const S = InnovaCare.schema;
    const blocs = [];
    for (const champ of S.champsFiche(parametres)) {
      const valeur = etude.valeurs[champ.id];
      if (N.estVide(valeur)) continue;
      const ligne = { id: champ.id, libelle: champ.libelle, texte: N.enTexte(valeur), interne: !!champ.jamaisPublic || champ.visibilite === 'interne' };
      if (etude.contacts[champ.id]) ligne.contact = etude.contacts[champ.id];
      let bloc = blocs.find((b) => b.bloc === champ.bloc);
      if (!bloc) { bloc = { bloc: champ.bloc, lignes: [] }; blocs.push(bloc); }
      bloc.lignes.push(ligne);
    }
    return blocs;
  }

  /** Numéro de poste d'une personne de l'annuaire, pour les mémos de l'outil interne : « DECT 91234 ». */
  const numeroPoste = (c) => (c && c.dect ? 'DECT ' + c.dect : '');

  InnovaCare.catalogue = { numeroPoste, preparer, filtrer, trier, compter, fiche, contact, recrutement };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// =============================================================================
// parametres.js — vérifie qu'un fichier parametres.json est cohérent
// =============================================================================
// Utilisé par l'outil « Paramètres » (avant de télécharger le fichier) et par les
// tests automatiques. Renvoie une liste de problèmes en clair ; liste vide = tout va bien.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;

  const ID_VALIDE = /^[a-z][a-z0-9_]*$/;
  const COULEUR_VALIDE = /^#[0-9a-fA-F]{6}$/;

  function verifier(p) {
    const problemes = [];
    const signaler = (rubrique, message) => problemes.push({ rubrique, message });
    if (!p || typeof p !== 'object') return [{ rubrique: 'Fichier', message: 'Le fichier n\'est pas un objet JSON.' }];

    // Identité
    if (!p.specialite || !p.specialite.nom) signaler('Identité', 'Le nom de la spécialité est vide.');
    if (!p.specialite || !p.specialite.instance) signaler('Identité', 'Le nom de l\'instance est vide.');
    for (const cle of ['interne', 'patient', 'professionnel']) {
      if (!p.modules || !p.modules[cle]) signaler('Identité', 'Le nom du module « ' + cle + ' » est vide.');
    }

    // Couleurs
    for (const [nom, valeur] of Object.entries(p.couleurs || {})) {
      if (!COULEUR_VALIDE.test(valeur)) signaler('Couleurs', 'Couleur « ' + nom + ' » invalide : « ' + valeur + ' » (format attendu : #00bac6).');
    }

    // Listes d'éléments avec identifiant et nom
    const listeAvecIds = (rubrique, liste, obligatoire) => {
      if (!Array.isArray(liste)) { signaler(rubrique, 'La liste est absente.'); return; }
      if (obligatoire && !liste.length) signaler(rubrique, 'La liste est vide.');
      const vus = new Set();
      const noms = new Set();
      liste.forEach((x, i) => {
        if (!x.id || !ID_VALIDE.test(x.id)) signaler(rubrique, 'Ligne ' + (i + 1) + ' : identifiant « ' + (x.id || '') + ' » invalide (minuscules, chiffres et « _ » seulement, sans accent).');
        if (vus.has(x.id)) signaler(rubrique, 'Identifiant « ' + x.id + ' » en double.');
        vus.add(x.id);
        const nom = x.nom || x.libelle;
        if (!nom) signaler(rubrique, 'Ligne ' + (i + 1) + ' : nom vide.');
        else if (noms.has(N.texteSimple(nom))) signaler(rubrique, 'Nom « ' + nom + ' » en double (il apparaîtrait deux fois dans la liste déroulante).');
        noms.add(N.texteSimple(nom || ''));
        if (nom && nom.length > 255) signaler(rubrique, 'Nom « ' + nom.slice(0, 30) + '… » trop long pour une liste Excel (255 caractères au plus).');
      });
    };
    listeAvecIds('Pôles', p.poles, true);
    listeAvecIds('Groupes de pathologies', p.groupes_pathologies || [], false);
    listeAvecIds('Pathologies', p.pathologies, false);
    listeAvecIds('Vignettes patient', p.vignettes, false);
    listeAvecIds('Filtres', p.filtres, false);

    // Pôles : nom d'onglet Excel valide, et différent des onglets techniques
    const reserves = ['Lisez-moi', 'Annuaire', 'Listes', 'Rapport de migration', 'Paramètres'].map(N.texteSimple);
    for (const pole of p.poles || []) {
      if (pole.nom && reserves.includes(N.texteSimple(pole.nom))) signaler('Pôles', 'Nom « ' + pole.nom + ' » réservé à un onglet technique de l\'Excel.');
      if (pole.nom && (pole.nom.length > 31 || /[[\]:*?/\\]/.test(pole.nom))) signaler('Pôles', 'Nom « ' + pole.nom + ' » impossible pour un onglet Excel (31 caractères au plus, sans [ ] : * ? / \\).');
    }

    // Pathologies : groupe connu
    const groupes = new Set((p.groupes_pathologies || []).map((g) => g.id));
    for (const x of p.pathologies || []) {
      if (groupes.size && !groupes.has(x.groupe)) signaler('Pathologies', '« ' + x.nom + ' » : groupe « ' + (x.groupe || '') + ' » inconnu.');
    }

    // Synonymes : un même mot ne doit renvoyer qu'à un seul élément
    const synonymesUniques = (rubrique, liste) => {
      const proprietaire = new Map();
      for (const x of liste || []) {
        for (const s of [x.nom].concat(x.synonymes || [])) {
          const cle = N.texteSimple(s);
          if (!cle) continue;
          if (proprietaire.has(cle) && proprietaire.get(cle) !== x.id) signaler(rubrique, 'Le synonyme « ' + s + ' » désigne à la fois « ' + proprietaire.get(cle) + ' » et « ' + x.id + ' ».');
          proprietaire.set(cle, x.id);
        }
      }
    };
    synonymesUniques('Pathologies', p.pathologies);
    synonymesUniques('Vignettes patient', p.vignettes);

    // Filtres
    const visibilites = ['professionnel', 'patient'];
    for (const f of p.filtres || []) {
      if (!['bornes', 'requis'].includes(f.type)) signaler('Filtres', '« ' + f.libelle + ' » : type « ' + f.type + ' » inconnu (bornes ou requis).');
      if (!visibilites.includes(f.visibilite)) signaler('Filtres', '« ' + f.libelle + ' » : visibilité « ' + f.visibilite + ' » non permise (professionnel ou patient ; un filtre ne peut pas être interne).');
      if (f.type === 'bornes' && !(Number(f.valeur_min) < Number(f.valeur_max))) signaler('Filtres', '« ' + f.libelle + ' » : la valeur minimale doit être inférieure à la valeur maximale.');
      if ((f.modules || []).includes('patient') && f.visibilite !== 'patient') signaler('Filtres', '« ' + f.libelle + ' » est posé aux patients mais sa visibilité n\'est pas « patient ».');
    }

    // Listes de valeurs
    for (const cle of ['phase', 'statut', 'oui_non', 'requis_exclu', 'fonction']) {
      if (!p.listes || !Array.isArray(p.listes[cle]) || !p.listes[cle].length) signaler('Listes', 'La liste « ' + cle + ' » est vide.');
    }
    return problemes;
  }

  /**
   * Motif de détection du nom de l'établissement, DÉDUIT du format des e-mails de l'annuaire
   * (« prenom.nom@xxx-ville.fr » → « xxx », « xxx ville », « xxx de ville ») : rien n'est écrit en dur.
   * Renvoie { motif, adresses } ou null si le format est absent.
   */
  function motifEtablissement(p) {
    const formats = [(p.annuaire || {}).format_email, (p.annuaire || {}).format_mssante].filter(Boolean);
    const domaine = (formats[0] || '').split('@')[1];
    if (!domaine) return null;
    const echapper = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const morceaux = domaine.split('.')[0].split('-').filter(Boolean);
    if (!morceaux.length) return null;
    // « Mot entier » qui tient compte des lettres accentuées : un mot qui finit par les mêmes lettres après
    // une lettre accentuée n'est pas le sigle (avec \b, une lettre accentuée comptait comme une séparation :
    // faux positif corrigé le 22/11 ; exemples dans tests/parametres-excel.test.js).
    const seul = (x) => '(?<![\\p{L}\\p{N}])' + x + '(?![\\p{L}\\p{N}])';
    const variantes = [seul(morceaux.map(echapper).join("[\\s-]+(?:de\\s+|d')?"))];
    if (morceaux.length > 1 && morceaux[0].length <= 4) variantes.push(seul(echapper(morceaux[0]))); // le sigle seul
    const domaines = formats.map((f) => echapper(f.split('@')[1]));
    return { motif: new RegExp(variantes.join('|'), 'iu'), adresses: new RegExp('@?(?:' + domaines.join('|') + ')', 'gi') };
  }

  /**
   * Contrôles supplémentaires AVANT de publier parametres.json sur le site (dépôt public) :
   * paramètres cohérents, aucun DECT, aucun contenu interne, aucune mention de l'établissement
   * (règle 3 : les adresses e-mail de l'établissement restent permises). Mêmes règles que le
   * test automatique du dossier site/. Renvoie une liste de messages ; vide = publiable.
   */
  // Noms des rubriques de l'outil Paramètres, pour dire OÙ se trouve un texte à corriger.
  const RUBRIQUES = {
    'textes.patient': 'Textes patient', 'textes.patient.benefices': 'Bénéfices (page patient)',
    'textes.patient.temoignages': 'Témoignages (page patient)', 'textes.email_patient': 'Messages types › E-mail patient',
    'textes.adressage': 'Messages types › Adressage (libéraux)', 'textes.mentions': 'Page Mentions',
    'textes.site': 'Publication', 'memos': 'Mémos', 'memos.sections': 'Sections des mémos', 'newsletter': 'Newsletter',
    'champs': 'Messages d\'aide des lignes de l\'Excel', 'specialite': 'Identité', 'modules': 'Identité',
    'poles': 'Pôles', 'groupes_pathologies': 'Groupes de pathologies', 'pathologies': 'Pathologies',
    'vignettes': 'Vignettes patient', 'filtres': 'Filtres d\'éligibilité et traitements', 'listes': 'Listes de valeurs',
    'annuaire': 'Annuaire (formats d\'adresse)', 'publication': 'Publication',
  };

  // Libellés des champs, tels qu'affichés dans l'outil Paramètres.
  const LIBELLES = {
    question_patient: 'Question posée au patient', libelle_patient: 'Libellé patient (traitement)', libelle: 'Libellé',
    aide_patient: 'Aide (patient)', corps: 'corps', objet: 'objet', texte: 'Texte', titre: 'Titre', nom: 'Nom',
    synonymes: 'Synonymes', description: 'Description', avertissement_pro: 'Avertissement de la page des médecins',
  };

  /** Chemin dans les réglages → endroit lisible : « Pathologies › CMD › synonymes », « … › corps, ligne 3 ». */
  function endroit(p, chemin) {
    let rubrique = '', depuis = 0;
    for (let n = chemin.length; n > 0; n--) {
      const cle = chemin.slice(0, n).join('.');
      if (RUBRIQUES[cle]) { rubrique = RUBRIQUES[cle]; depuis = n; break; }
    }
    const morceaux = rubrique ? [rubrique] : [];
    let objet = p;
    for (let i = 0; i < chemin.length; i++) {
      objet = objet == null ? undefined : objet[chemin[i]];
      if (i < depuis) continue;
      const cle = chemin[i];
      if (/^\d+$/.test(cle)) {
        const element = objet;
        const nom = element && typeof element === 'object' ? (element.nom || element.libelle || element.titre || element.auteur || element.id) : null;
        morceaux.push(nom ? String(nom) : 'ligne ' + (Number(cle) + 1));
      } else morceaux.push(LIBELLES[cle] || cle);
    }
    return morceaux.join(' › ');
  }

  /** Extrait d'environ 40 caractères autour de la position trouvée. */
  function extrait(texte, index, longueur) {
    const debut = Math.max(0, index - 20), fin = Math.min(texte.length, index + longueur + 20);
    return (debut > 0 ? '…' : '') + texte.slice(debut, fin).replace(/\s+/g, ' ') + (fin < texte.length ? '…' : '');
  }

  /** Tous les textes des réglages, avec leur chemin : [{ chemin: ['textes', 'adressage', 'corps', '2'], texte }]. */
  function textes(valeur, chemin, resultat) {
    if (typeof valeur === 'string') resultat.push({ chemin, texte: valeur });
    else if (Array.isArray(valeur)) valeur.forEach((v, i) => textes(v, chemin.concat(String(i)), resultat));
    else if (valeur && typeof valeur === 'object') for (const [k, v] of Object.entries(valeur)) { if (k === 'dect') resultat.push({ chemin: chemin.concat(k), texte: 'dect' }); textes(v, chemin.concat(k), resultat); }
    return resultat;
  }

  /**
   * Contrôles supplémentaires AVANT de publier parametres.json sur le site (dépôt public) :
   * paramètres cohérents, aucun DECT, aucun contenu interne, aucune mention de l'établissement
   * (règle 3 : les adresses e-mail de l'établissement restent permises). Mêmes règles que le
   * test automatique du dossier site/. Renvoie une liste de messages ; vide = publiable.
   * Chaque message dit OÙ (rubrique de l'outil Paramètres) et montre un extrait du texte en cause.
   */
  function verifierPourPublication(p) {
    const problemes = verifier(p).map((x) => x.rubrique + ' : ' + x.message);
    const nom = motifEtablissement(p);
    for (const { chemin, texte } of textes(p || {}, [], [])) {
      const ou = endroit(p, chemin);
      const signaler = (raison, m) => problemes.push(ou + ' : ' + raison + ' (« ' + extrait(texte, m.index, m[0].length) + ' »).');
      let m;
      if ((m = /\[interne/i.exec(texte))) signaler('contenu interne', m);
      if ((m = /\bDECT\b/i.exec(texte)) || (chemin[chemin.length - 1] === 'dect' && (m = { index: 0, 0: texte }))) signaler('le mot « DECT » (les numéros de poste ne sont jamais publiés)', m);
      if (nom) {
        const sansAdresses = texte.replace(nom.adresses, (x) => ' '.repeat(x.length)); // garde les positions
        if ((m = nom.motif.exec(sansAdresses))) signaler('nom ou sigle de l\'établissement, interdit sur le site', m);
      }
    }
    return problemes;
  }

  /** Texte stable d'un objet (clés triées) : deux paramètres identiques donnent le même texte. */
  function empreinte(valeur) {
    if (Array.isArray(valeur)) return '[' + valeur.map(empreinte).join(',') + ']';
    if (valeur && typeof valeur === 'object') return '{' + Object.keys(valeur).sort().map((k) => JSON.stringify(k) + ':' + empreinte(valeur[k])).join(',') + '}';
    return JSON.stringify(valeur === undefined ? null : valeur);
  }
  const identiques = (a, b) => empreinte(a) === empreinte(b);

  InnovaCare.parametres = { verifier, verifierPourPublication, identiques };
})(typeof globalThis !== 'undefined' ? globalThis : this);

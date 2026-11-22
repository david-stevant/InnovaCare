// =============================================================================
// normalisation.js — petites fonctions de nettoyage des valeurs de l'Excel
// =============================================================================
// Chaque fonction prend une valeur telle qu'elle est écrite dans une cellule et
// renvoie une version « comprise » par l'outil, SANS RIEN DEVINER : quand une
// valeur n'est pas reconnue avec certitude, la fonction le dit (ok: false) et
// garde le texte d'origine. Ces fonctions ne connaissent rien à la cardiologie :
// les listes de mots (mentions de statut, noms commerciaux…) leur sont données
// en paramètre.
//
// Une cellule lue dans l'Excel vaut : null (vide), un texte, un nombre, ou une
// date écrite sous la forme { date: "AAAA-MM-JJ" }.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  // --- Outils de base (src/texte.js, partagé avec le site public) -------------------

  const { estDate, estVide, enTexte, texteSimple, identifiant } = InnovaCare.texte;

  /** Lit un nombre écrit à la française (« 1,5 ») ou à l'anglaise (« 1.5 »). */
  function lireNombre(texte) {
    const propre = String(texte).trim().replace(/\s/g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(propre) ? Number(propre) : null;
  }

  // --- Nom de l'étude et statut écrit dans le nom ---------------------------------

  /**
   * Sépare le nom d'une étude d'une éventuelle mention de statut écrite dedans.
   * « PINNACLE (non ouverte aux inclusions pour le moment) » →
   *   { nom: "PINNACLE", statut: "à venir", mention: "non ouverte aux inclusions pour le moment" }
   * mentionsStatut : liste [{ motif, statut }] (fichier de correspondances).
   */
  function analyserNomEtude(brut, mentionsStatut) {
    const texte = enTexte(brut);
    // Morceaux candidats : ce qui est entre parenthèses, et les lignes après la première.
    const lignes = texte.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let nom = lignes.shift() || '';
    const candidats = lignes.slice();
    const parentheses = nom.match(/\(([^)]*)\)/g) || [];
    for (const morceau of parentheses) candidats.push(morceau);

    for (const candidat of candidats) {
      const trouve = (mentionsStatut || []).find((m) => contientDebutDeMot(candidat, m.motif));
      if (trouve) {
        nom = nom.replace(candidat, '').replace(/\s+/g, ' ').trim();
        return { nom, statut: trouve.statut, mention: candidat.replace(/^\(|\)$/g, '').trim(), reste: lignes.filter((l) => l !== candidat) };
      }
    }
    return { nom: nom.replace(/\s+/g, ' ').trim(), statut: null, mention: null, reste: lignes };
  }

  /**
   * Vrai si le texte contient le motif au DÉBUT d'un mot : le motif « termin » reconnaît
   * « terminé » ou « terminée », mais pas « déterminée ».
   */
  function contientDebutDeMot(texte, motif) {
    const echappe = texteSimple(motif).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + echappe).test(texteSimple(texte));
  }

  /** Cherche une mention de statut dans un texte quelconque (ex. « terminé » en début d'inclusion). */
  function chercherMentionStatut(valeur, mentionsStatut) {
    const simple = texteSimple(valeur);
    if (!simple) return null;
    const trouve = (mentionsStatut || []).find((m) => contientDebutDeMot(simple, m.motif));
    return trouve ? { statut: trouve.statut, mention: enTexte(valeur) } : null;
  }

  // --- Filtres d'éligibilité en texte libre ------------------------------------------

  /**
   * Lit un filtre écrit en texte libre.
   *   « 18-80 » → { ok, min: 18, max: 80 }        « > 40 » → { ok, min: 40, minStricte: true }
   *   « ≥ 55 » → { ok, min: 55 }                  « ≤ 85 » → { ok, max: 85 }
   *   « oui » → { ok, oui: true }                 autre chose → { ok: false }
   * Une borne « stricte » (> ou <) est signalée, car le nouveau gabarit n'utilise
   * que des bornes incluses : la conversion sera à valider.
   */
  function lireFiltre(valeur) {
    const brut = enTexte(valeur);
    const resultat = { brut, ok: false, min: null, max: null, minStricte: false, maxStricte: false, oui: null };
    if (!brut) return Object.assign(resultat, { ok: true, vide: true });
    if (typeof valeur === 'number') return resultat; // un nombre seul est ambigu (minimum ? maximum ?)

    const texte = brut.replace(/\s+/g, ' ').trim();
    const simple = texteSimple(texte);
    if (simple === 'oui') return Object.assign(resultat, { ok: true, oui: true });
    if (simple === 'non') return Object.assign(resultat, { ok: true, oui: false });

    const NOMBRE = '(\\d+(?:[.,]\\d+)?)';
    let m = texte.match(new RegExp('^' + NOMBRE + '\\s*(?:-|à|–)\\s*' + NOMBRE + '$'));
    if (m) {
      const min = lireNombre(m[1]);
      const max = lireNombre(m[2]);
      if (min <= max) return Object.assign(resultat, { ok: true, min, max });
      return resultat;
    }
    m = texte.match(new RegExp('^(>=|=>|≥|>|<=|=<|≤|<)\\s*' + NOMBRE + '$'));
    if (m) {
      const nombre = lireNombre(m[2]);
      const signe = m[1];
      if (signe === '>' ) return Object.assign(resultat, { ok: true, min: nombre, minStricte: true });
      if (signe === '<') return Object.assign(resultat, { ok: true, max: nombre, maxStricte: true });
      if (/[>≥]/.test(signe)) return Object.assign(resultat, { ok: true, min: nombre });
      return Object.assign(resultat, { ok: true, max: nombre });
    }
    return resultat;
  }

  /** Vrai si deux filtres lus disent la même chose. */
  function filtresEgaux(a, b) {
    return a.min === b.min && a.max === b.max && a.minStricte === b.minStricte &&
      a.maxStricte === b.maxStricte && a.oui === b.oui;
  }

  // --- Dates ----------------------------------------------------------------------

  const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

  /**
   * Lit une date de début d'inclusion.
   *   date Excel            → { ok, iso: "2025-03-01", precision: "jour" }
   *   « novembre 2025 »     → { ok, iso: "2025-11", precision: "mois" }
   *   « 11/2025 »           → { ok, iso: "2025-11", precision: "mois" }
   *   « fin 2025 », « 2024 », « terminé »… → { ok: false, indice: "2025" (ce qui a été repéré) }
   * Seul un texte qui n'est QUE une date est accepté : le reste est à vérifier.
   */
  function lireDate(valeur) {
    const brut = enTexte(valeur);
    if (!brut) return { brut, ok: true, vide: true };
    if (estDate(valeur)) return { brut, ok: true, iso: valeur.date, precision: 'jour' };
    if (typeof valeur === 'number') {
      // Une année seule (« 2024 ») n'est pas une date précise, mais ce n'est pas une erreur de saisie.
      if (Number.isInteger(valeur) && valeur >= 1990 && valeur <= 2100) return { brut, ok: false, indice: String(valeur) };
      return { brut, ok: false, nombre: true };
    }

    const simple = texteSimple(brut);
    let m = simple.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      return { brut, ok: true, iso: m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'), precision: 'jour' };
    }
    m = simple.match(/^(\d{1,2})\/(\d{4})$/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
      return { brut, ok: true, iso: m[2] + '-' + m[1].padStart(2, '0'), precision: 'mois' };
    }
    m = simple.match(/^([a-z]+)\s+(\d{4})$/);
    if (m && MOIS.includes(m[1])) {
      return { brut, ok: true, iso: m[2] + '-' + String(MOIS.indexOf(m[1]) + 1).padStart(2, '0'), precision: 'mois' };
    }
    // Pas une date pure : on note seulement ce qu'on a repéré, sans l'appliquer.
    const indice = (simple.match(/\b\d{1,2}\/\d{4}\b/) || simple.match(new RegExp('\\b(' + MOIS.join('|') + ')\\b.*?\\b\\d{4}\\b')) || simple.match(/\b(19|20)\d{2}\b/) || [null])[0];
    return { brut, ok: false, indice };
  }

  // --- Personnes (investigateurs, ARC) ------------------------------------------------

  // Un numéro DECT : 5 chiffres, parfois écrits « 68,870 » ou « 65 115 ».
  const MOTIF_DECT = /\d{2}[ ,.]?\d{3}(?!\d)/g;

  /**
   * Découpe une cellule « contact » en personnes.
   * « Alexandra AUVRIGNON 97643/99392 » → [{ nom: "Alexandra AUVRIGNON", dect: ["97643", "99392"] }]
   * « Helena FETTRE / Marine RENARD »   → 2 personnes
   * « Isabelle PORTIER 99818 Clara MORA 99425 » → 2 personnes
   * « Dr PLESSIS Julien et Dr GUILLON Benoit (neurologue) » → 2 personnes, titre « Dr », complément « neurologue »
   */
  function separerPersonnes(valeur) {
    const texte = enTexte(valeur);
    if (!texte) return [];
    // 1. Coupures franches : « / » (sauf entre deux numéros), « ; », retour à la ligne, « et ».
    const morceaux = texte.split(/(?<!\d)\s*\/\s*(?!\s*\d)|\s*;\s*|\n+|\s+et\s+/i);
    // 2. Un numéro suivi d'un autre nom marque aussi une coupure.
    const personnes = [];
    for (const morceau of morceaux) {
      const sousMorceaux = morceau.replace(/(\d{2}[ ,.]?\d{3}\)?)\s*,?\s+(?=[A-Za-zÀ-ÿ])/g, '$1\u0000').split('\u0000');
      for (const brut of sousMorceaux) {
        const propre = brut.trim().replace(/,\s*$/, '');
        if (!propre) continue;
        const dect = (propre.match(MOTIF_DECT) || []).map((d) => d.replace(/\D/g, ''));
        let nom = propre.replace(/\(?\s*\d{2}[ ,.]?\d{3}(?!\d)(\s*\/\s*\d{2}[ ,.]?\d{3})*\s*\)?/g, ' ');
        const complements = (nom.match(/\(([^)]*)\)/g) || []).map((c) => c.replace(/[()]/g, '').trim()).filter(Boolean);
        nom = nom.replace(/\([^)]*\)/g, ' ');
        const titre = /^\s*(dr|pr)\.?\s+/i.test(nom) ? nom.match(/^\s*(dr|pr)/i)[1] : null;
        nom = nom.replace(/^\s*(dr|pr)\.?\s+/i, '').replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!nom && !dect.length) continue;
        personnes.push({ brut: propre, nom, dect, titre, complements, cle: clePersonne(nom) });
      }
    }
    return personnes;
  }

  /**
   * Clé de comparaison d'un nom de personne, indépendante de l'ordre, de la casse et des accents :
   * « FONTENEAU Léa », « Lea FONTENEAU » et « Léa Fonteneau » donnent « fonteneau lea ».
   */
  function clePersonne(nom) {
    return texteSimple(nom).replace(/[-']/g, ' ').split(' ').filter(Boolean).sort().join(' ');
  }

  /** Adresse e-mail attendue d'après un format « prenom.nom@domaine ». */
  function emailAttendu(prenom, nom, format) {
    const morceau = (t) => texteSimple(t).replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
    return String(format || '').replace('prenom', morceau(prenom)).replace('nom', morceau(nom));
  }

  // --- Traitements ------------------------------------------------------------------

  /** Mots d'un texte (pour chercher un nom de médicament sans confondre avec un morceau de mot). */
  function contientMot(texte, mot) {
    // Les « / » comptent comme des séparateurs : « Forxiga/Xiguo » contient le mot « Forxiga ».
    const simpleTexte = ' ' + texteSimple(texte).replace(/[^a-z0-9-]+/g, ' ') + ' ';
    const simpleMot = texteSimple(mot).replace(/[^a-z0-9-]+/g, ' ').trim();
    return simpleMot.length > 0 && simpleTexte.includes(' ' + simpleMot + ' ');
  }

  /** Noms commerciaux présents dans un texte. filtres : liste des filtres des paramètres. */
  function nomsCommerciauxCites(valeur, filtres) {
    const texte = enTexte(valeur);
    const trouves = [];
    for (const filtre of filtres || []) {
      for (const nom of filtre.noms_commerciaux || []) {
        if (contientMot(texte, nom) && !trouves.includes(nom)) trouves.push(nom);
      }
    }
    return trouves;
  }

  /**
   * Lit une ligne « traitements » : « entresto ET MRA ET beta-bloquant ET gliflozine »
   * → { classes: ["ttt_arni", "ttt_arm", "ttt_betabloquant", "ttt_gliflozine"], inconnus: [] }.
   * Chaque mot est cherché parmi les DCI, noms commerciaux et synonymes des paramètres.
   */
  function lireTraitements(valeur, filtres) {
    const texte = enTexte(valeur);
    const termes = texte.split(/\s+et\s+|\s*\+\s*|\s*,\s*|\s+ou\s+/i).map((t) => t.trim()).filter(Boolean);
    const classes = [];
    const inconnus = [];
    for (const terme of termes) {
      // « furosémide/Lasilix » : chaque côté du « / » est essayé.
      const variantes = [terme].concat(terme.split('/'));
      const filtre = (filtres || []).find((f) =>
        f.famille === 'traitement' &&
        variantes.some((v) => [].concat(f.dci || [], f.noms_commerciaux || [], f.synonymes || [], [f.libelle]).some((mot) => texteSimple(mot) === texteSimple(v)))
      );
      if (filtre) { if (!classes.includes(filtre.id)) classes.push(filtre.id); }
      else inconnus.push(terme);
    }
    return { brut: texte, classes, inconnus };
  }

  InnovaCare.normalisation = {
    estDate, estVide, enTexte, texteSimple, identifiant, lireNombre,
    analyserNomEtude, chercherMentionStatut, contientDebutDeMot,
    lireFiltre, filtresEgaux, lireDate,
    separerPersonnes, clePersonne, emailAttendu,
    contientMot, nomsCommerciauxCites, lireTraitements,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

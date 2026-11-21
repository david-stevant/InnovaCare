// =============================================================================
// eligibilite.js — moteur d'éligibilité partagé (outil interne, puis InnovAction
// et InnovActeur)
// =============================================================================
// Reprend la logique d'e-CardioScope v4, avec des filtres décrits dans parametres.json :
//   - « bornes » : l'étude fixe un minimum et/ou un maximum (lignes *_min, *_max de
//     l'Excel), bornes INCLUSES ;
//   - « requis » : l'étude dit requis / exclu / indifférent ;
//   - la question propre à une étude (ligne « Question de screening… ») : « non » exclut.
// Une valeur que l'on n'a pas renseignée n'exclut JAMAIS : le critère reste « à vérifier ».
// Les réponses (âge, FEVG…) sont passées en argument : ce fichier ne garde rien.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;

  const PREFIXE_QUESTION = 'question:';
  const nombre = (v) => (typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null));
  const repondu = (r) => r !== null && r !== undefined && r !== '';
  const formater = (n) => String(n).replace('.', ',');

  /** Filtres des paramètres posés dans un module (« interne », « professionnel », « patient »). */
  function filtresDuModule(parametres, module) {
    return ((parametres && parametres.filtres) || []).filter((f) => (f.modules || []).includes(module));
  }

  /** Identifiant de la question propre à une étude (deux études qui posent la même question la partagent). */
  const idQuestion = (texte) => PREFIXE_QUESTION + N.texteSimple(texte);

  /**
   * Vérifie un filtre pour une étude. Renvoie { statut, seuil } :
   * statut = 'sans_objet' (l'étude ne fixe rien), 'a_verifier' (pas de réponse), 'ok' ou 'exclu'.
   */
  function verifier(valeurs, filtre, reponses) {
    const r = (reponses || {})[filtre.id];
    if (filtre.type === 'bornes') {
      const min = nombre(valeurs[filtre.id + '_min']);
      const max = nombre(valeurs[filtre.id + '_max']);
      if (min === null && max === null) return { statut: 'sans_objet' };
      const unite = filtre.unite ? ' ' + filtre.unite : '';
      const seuil = min !== null && max !== null ? formater(min) + ' à ' + formater(max) + unite
        : min !== null ? '≥ ' + formater(min) + unite : '≤ ' + formater(max) + unite;
      const v = nombre(r);
      if (v === null) return { statut: 'a_verifier', seuil };
      const dedans = (min === null || v >= min) && (max === null || v <= max);
      return { statut: dedans ? 'ok' : 'exclu', seuil };
    }
    // « requis / exclu / indifférent »
    const exigence = N.texteSimple(valeurs[filtre.id]);
    if (exigence !== 'requis' && exigence !== 'exclu') return { statut: 'sans_objet' };
    const seuil = exigence; // « requis » ou « exclu »
    if (!repondu(r)) return { statut: 'a_verifier', seuil };
    const oui = N.texteSimple(r) === 'oui';
    const exclu = (exigence === 'requis' && !oui) || (exigence === 'exclu' && oui);
    return { statut: exclu ? 'exclu' : 'ok', seuil };
  }

  /** La question propre à l'étude, vue comme un filtre « oui exigé ». */
  function questionDe(valeurs) {
    const texte = N.enTexte(valeurs.question_specifique);
    return texte ? { id: idQuestion(texte), libelle: texte, type: 'question' } : null;
  }

  function verifierQuestion(question, reponses) {
    const r = (reponses || {})[question.id];
    if (!repondu(r)) return { statut: 'a_verifier', seuil: 'oui' };
    return { statut: N.texteSimple(r) === 'oui' ? 'ok' : 'exclu', seuil: 'oui' };
  }

  /**
   * Évalue une étude : { eligible, criteres: [{ id, libelle, statut, seuil }] } (filtres sans objet omis).
   * ignorer : identifiant d'un filtre à ne pas compter (sert à savoir si un filtre est encore utile).
   */
  function evaluer(etude, filtres, reponses, ignorer) {
    const valeurs = etude.valeurs || etude;
    const criteres = [];
    for (const f of filtres) {
      if (f.id === ignorer) continue;
      const v = verifier(valeurs, f, reponses);
      if (v.statut !== 'sans_objet') criteres.push({ id: f.id, libelle: f.libelle, statut: v.statut, seuil: v.seuil });
    }
    const q = questionDe(valeurs);
    if (q && q.id !== ignorer) criteres.push(Object.assign({ libelle: q.libelle }, { id: q.id }, verifierQuestion(q, reponses)));
    return { eligible: !criteres.some((c) => c.statut === 'exclu'), criteres };
  }

  /**
   * Filtres à montrer (règle de la v4) : un filtre est utile si une étude le fixe ET resterait éligible
   * sans lui, ou s'il a déjà une réponse (pour pouvoir la corriger). Renvoie aussi les questions propres
   * aux études : [{ id, libelle, type: 'question', etudes: [noms] }].
   */
  function filtresUtiles(etudes, filtres, reponses) {
    const r = reponses || {};
    const utiles = filtres.filter((f) => repondu(r[f.id]) || etudes.some((e) => verifier(e.valeurs, f, r).statut !== 'sans_objet' && evaluer(e, filtres, r, f.id).eligible));
    const questions = new Map();
    for (const e of etudes) {
      const q = questionDe(e.valeurs);
      if (!q) continue;
      if (!repondu(r[q.id]) && !evaluer(e, filtres, r, q.id).eligible) continue;
      if (!questions.has(q.id)) questions.set(q.id, Object.assign(q, { etudes: [] }));
      questions.get(q.id).etudes.push(e.nom || N.enTexte(e.valeurs.nom));
    }
    return { filtres: utiles, questions: [...questions.values()] };
  }

  /** Études proposées au screening : statut « ouvert » et affichées dans l'outil interne. */
  function candidates(etudes) {
    return etudes.filter((e) => /^ouvert/.test(N.texteSimple(e.statut)) && !e.masquee);
  }

  /**
   * Contextes cliniques (pathologies) dans l'ordre et par groupes des paramètres, avec le nombre
   * d'études proposées. Une pathologie écrite dans l'Excel mais absente des paramètres va dans « Autres ».
   * Renvoie [{ groupe, emoji, pathologies: [{ nom, emoji, nombre }] }].
   */
  function contextes(etudes, parametres) {
    const compte = new Map();
    for (const e of etudes) for (const p of new Set(e.pathologies.map(N.texteSimple))) compte.set(p, (compte.get(p) || 0) + 1);
    const connues = new Set();
    const groupes = ((parametres.groupes_pathologies || []).length ? parametres.groupes_pathologies : [{ id: null, nom: '' }]).map((g) => ({
      groupe: g.nom, emoji: g.emoji || '',
      pathologies: (parametres.pathologies || []).filter((p) => !g.id || p.groupe === g.id).map((p) => {
        connues.add(N.texteSimple(p.nom));
        return { nom: p.nom, emoji: p.emoji || '', nombre: compte.get(N.texteSimple(p.nom)) || 0 };
      }),
    }));
    const autres = [...new Set(etudes.flatMap((e) => e.pathologies))].filter((p) => !connues.has(N.texteSimple(p)));
    if (autres.length) groupes.push({ groupe: 'Autres', emoji: '', pathologies: autres.map((p) => ({ nom: p, emoji: '', nombre: compte.get(N.texteSimple(p)) })) });
    return groupes.filter((g) => g.pathologies.length);
  }

  /** Études d'au moins un des contextes choisis (une étude n'apparaît qu'une fois). */
  function selon(etudes, contextesChoisis) {
    const choix = new Set((contextesChoisis || []).map(N.texteSimple));
    return etudes.filter((e) => e.pathologies.some((p) => choix.has(N.texteSimple(p))));
  }

  InnovaCare.eligibilite = { filtresDuModule, verifier, evaluer, filtresUtiles, candidates, contextes, selon, idQuestion };
})(typeof globalThis !== 'undefined' ? globalThis : this);

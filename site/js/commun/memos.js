// Copie automatique de src/memos.js (outils-src/construire.mjs) : ne pas modifier ici.
// =============================================================================
// memos.js — mémos des études ouvertes, au format validé des mémos CardioScope v3
// =============================================================================
// Contenu tiré de l'Excel MOT POUR MOT (règle 4) : nom, thématique, intervention vs
// comparateur, design, critères d'inclusion principaux, contact de l'ARC n° 1 (annuaire).
// Seule mise en forme automatique : les seuils chiffrés passent en gras (« ≥ 40 % »).
// Le numéro de poste interne n'apparaît que dans l'outil local : il est fourni par
// src/catalogue.js (fichier de l'outil interne seulement, jamais copié sur le site) et
// peut être retiré par une case à cocher. Ce fichier est aussi utilisé par le site public,
// qui n'a donc aucun moyen d'afficher ce numéro.
// Textes (titre, émojis, sections…) : parametres.memos. Rien n'est envoyé.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.texte; // src/texte.js (aussi copié dans le site public)

  // Seuil = comparateur + nombre (+ unité usuelle) : « ≥ 40 % », « > 3 », « < 1,5 cm² », « ≤ 85 ans ».
  const SEUIL = /(?:≥|≤|>=|<=|>|<)\s?\d+(?:[.,]\d+)?(?:\s?(?:%|ans|mois|semaines|jours|mmHg|mL\/min(?:\/1,73\s?m²)?|pg\/mL|ng\/L|ng\/mL|mg\/g|mg\/dL|g\/m²|mL\/m²|kg\/m²|kg|cm²|cm|mm|m|ms|bpm))?(?![\d\w])/g;

  /** Découpe un texte en morceaux { texte, gras } : les seuils chiffrés sont « gras ». */
  function morceaux(texte) {
    const resultat = [];
    let dernier = 0;
    for (const m of texte.matchAll(SEUIL)) {
      if (m.index > dernier) resultat.push({ texte: texte.slice(dernier, m.index), gras: false });
      resultat.push({ texte: m[0], gras: true });
      dernier = m.index + m[0].length;
    }
    if (dernier < texte.length) resultat.push({ texte: texte.slice(dernier), gras: false });
    return resultat;
  }

  /** « FEVG ≥ 40 % » → « FEVG **≥ 40 %** » (Markdown). */
  const seuilsEnGras = (texte) => morceaux(texte).map((m) => (m.gras ? '**' + m.texte + '**' : m.texte)).join('');

  /**
   * Structure du mémo. etudes : catalogue.preparer(…).etudes (outil interne) ou public.preparer(…) (site).
   * options : { section: titre d'une section (sinon tout le mémo), avecDect: true par défaut }.
   */
  function construire(etudes, parametres, options) {
    const o = Object.assign({ avecDect: true, section: '' }, options);
    const m = parametres.memos || {};
    const retenues = InnovaCare.eligibilite.candidates(etudes);
    const sections = (m.sections || []).map((s) => ({ titre: s.titre, emoji: s.emoji || '', poles: s.poles || [], etudes: [] }));
    const autres = { titre: 'Autres', emoji: '', poles: [], etudes: [], orpheline: true };
    for (const e of retenues) (sections.find((s) => s.poles.includes(e.pole)) || autres).etudes.push(e);
    if (autres.etudes.length) sections.push(autres);
    for (const s of sections) {
      // Mises en avant d'abord, puis l'ordre des colonnes de l'Excel (ordre d'origine conservé).
      s.etudes = s.etudes.map((e, i) => [e, i]).sort((a, b) => (b[0].enAvant - a[0].enAvant) || (a[1] - b[1])).map(([e]) => fiche(e, o.avecDect));
    }
    const choisies = sections.filter((s) => s.etudes.length && (!o.section || s.titre === o.section));
    return {
      titre: m.titre || '', hashtags: m.hashtags || '', pied: m.pied || '',
      emojis: { etude: m.emoji_etude || '', design: m.emoji_design || '', criteres: m.emoji_criteres || '', contact: m.emoji_contact || '' },
      libelleCriteres: m.libelle_criteres || '',
      sections: choisies,
      sectionsDisponibles: sections.filter((s) => s.etudes.length).map((s) => s.titre),
    };
  }

  /** « - critère » ou « • critère » → « critère » (mise en forme seulement, le texte reste intact). */
  const sansPuce = (t) => t.replace(/^\s*[-–•*]\s*/, '');

  function fiche(e, avecDect) {
    const v = e.valeurs;
    // Outil interne : contacts.arc_1 (annuaire) ; site public : contacts.arc[0] (e-mail publié).
    const arc = e.contacts.arc_1 || (e.contacts.arc || [])[0];
    const numero = avecDect && InnovaCare.catalogue && InnovaCare.catalogue.numeroPoste ? InnovaCare.catalogue.numeroPoste(arc || {}) : '';
    const contact = arc ? [arc.nom, numero, arc.email || ''].filter(Boolean) : [];
    return {
      nom: e.nom,
      thematique: e.thematique,
      science: [N.enTexte(v.intervention), N.enTexte(v.design)].filter(Boolean).join(' — '),
      // Le tiret ou la puce que l'ARC a tapé en début de critère est retiré : la liste a déjà ses puces.
      criteres: [1, 2, 3, 4, 5].map((n) => sansPuce(N.enTexte(v['inclusion_' + n]))).filter(Boolean),
      contact,
      sansArc: !arc,
    };
  }

  /** Études à compléter dans l'Excel : sans critère d'inclusion principal, ou sans ARC n° 1. */
  function aCompleter(memo) {
    const manques = [];
    for (const s of memo.sections) {
      for (const e of s.etudes) {
        const quoi = [!e.criteres.length ? 'critère d\'inclusion principal' : '', e.sansArc ? 'ARC n° 1' : ''].filter(Boolean);
        if (quoi.length) manques.push({ nom: e.nom, section: s.titre, manque: quoi });
      }
    }
    return manques;
  }

  // --- Texte brut (Markdown, format v3) --------------------------------------------------

  function versMarkdown(memo) {
    const L = [];
    const em = memo.emojis;
    if (memo.titre) L.push('# 📋 ' + memo.titre);
    if (memo.hashtags) L.push(memo.hashtags);
    L.push('', '---');
    for (const s of memo.sections) {
      L.push('', '## ' + (s.emoji ? s.emoji + ' ' : '') + s.titre.toUpperCase(), '', '---');
      for (const e of s.etudes) {
        L.push('', '### ' + (em.etude ? em.etude + ' ' : '') + e.nom + (e.thematique ? ' — ' + e.thematique : ''));
        if (e.science) L.push('', (em.design ? em.design + ' ' : '') + seuilsEnGras(e.science));
        if (e.criteres.length) {
          L.push('', (em.criteres ? em.criteres + ' ' : '') + '**' + memo.libelleCriteres + '**');
          for (const c of e.criteres) L.push('- ' + seuilsEnGras(c).replace(/\n+/g, ' '));
        }
        if (e.contact.length) L.push('', (em.contact ? em.contact + ' ' : '') + e.contact.join(' — '));
        L.push('', '---');
      }
    }
    if (memo.pied) L.push('', '*' + memo.pied + '*');
    return L.join('\n') + '\n';
  }

  // --- Texte mis en forme (HTML simple, styles intégrés : passe dans Outlook) -------------

  const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const enHtml = (t) => morceaux(t).map((m) => (m.gras ? '<strong>' + echapper(m.texte) + '</strong>' : echapper(m.texte))).join('').replace(/\n/g, '<br>');

  function versHtml(memo) {
    const em = memo.emojis;
    const police = 'font-family:Calibri,Arial,sans-serif;';
    const H = ['<div style="' + police + 'font-size:11pt;color:#17313a">'];
    if (memo.titre) H.push('<h1 style="font-size:18pt;margin:0 0 4px">📋 ' + echapper(memo.titre) + '</h1>');
    if (memo.hashtags) H.push('<p style="margin:0 0 12px;color:#51666d">' + echapper(memo.hashtags) + '</p>');
    for (const s of memo.sections) {
      H.push('<h2 style="font-size:15pt;margin:18px 0 6px;border-bottom:2px solid #00bac6">' + echapper((s.emoji ? s.emoji + ' ' : '') + s.titre.toUpperCase()) + '</h2>');
      for (const e of s.etudes) {
        H.push('<h3 style="font-size:12.5pt;margin:12px 0 2px">' + echapper((em.etude ? em.etude + ' ' : '') + e.nom) + (e.thematique ? ' — ' + echapper(e.thematique) : '') + '</h3>');
        if (e.science) H.push('<p style="margin:2px 0">' + echapper(em.design ? em.design + ' ' : '') + enHtml(e.science) + '</p>');
        if (e.criteres.length) {
          H.push('<p style="margin:6px 0 2px">' + echapper(em.criteres ? em.criteres + ' ' : '') + '<strong>' + echapper(memo.libelleCriteres) + '</strong></p>');
          H.push('<ul style="margin:0 0 4px 18px;padding:0">' + e.criteres.map((c) => '<li>' + enHtml(c) + '</li>').join('') + '</ul>');
        }
        if (e.contact.length) H.push('<p style="margin:4px 0 8px">' + echapper((em.contact ? em.contact + ' ' : '') + e.contact.join(' — ')) + '</p>');
      }
    }
    if (memo.pied) H.push('<p style="margin-top:16px;color:#51666d"><em>' + echapper(memo.pied) + '</em></p>');
    H.push('</div>');
    return H.join('\n');
  }

  InnovaCare.memos = { construire, versMarkdown, versHtml, aCompleter, seuilsEnGras, morceaux, sansPuce };
})(typeof globalThis !== 'undefined' ? globalThis : this);

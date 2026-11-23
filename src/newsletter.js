// =============================================================================
// newsletter.js — brouillon de newsletter du lundi (cahier des charges § 7.2)
// =============================================================================
// À partir des données PUBLIQUES seulement (protocoles.json, parametres.json) :
//   1. choisit 2 à 3 études à mettre en lumière : celles « mises en avant », puis les
//      études nouvellement ouvertes, puis une rotation des autres (la moins récemment
//      présentée d'abord ; historique conservé dans newsletter/historique.json) ;
//   2. rédige le brouillon au format des mémos (src/memos.js), sans numéro de poste ;
//   3. ajoute le rappel au porteur et des contrôles (fin de recrutement dépassée,
//      étude non mise à jour depuis longtemps).
// Utilisé par outils-src/newsletter.mjs (lancé chaque lundi par GitHub Actions).
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const T = InnovaCare.texte;

  const jour = (iso) => {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(iso || ''));
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) / 86400000) : null;
  };

  /** Études candidates : publiées (tous modules) et au statut « ouvert ». */
  function candidates(donnees, parametres) {
    return InnovaCare.eligibilite.candidates(InnovaCare.public.preparer(donnees, parametres, null));
  }

  /**
   * Choisit les études de la semaine. historique : { etudes: { id: 'AAAA-MM-JJ' } } (dernière présentation).
   * Renvoie [{ etude, raison }] ; raison = 'mise en avant' | 'nouvellement ouverte' | 'rotation'.
   */
  function choisir(etudes, parametres, historique, aujourdhui) {
    const n = (parametres.newsletter || {});
    const max = Math.max(1, Number(n.nombre_etudes_max) || 3);
    const vues = (historique && historique.etudes) || {};
    const derniere = (e) => (vues[e.id] ? jour(vues[e.id]) : -Infinity); // jamais présentée = la plus ancienne
    const parAnciennete = (a, b) => (derniere(a) - derniere(b)) || a.nom.localeCompare(b.nom, 'fr');
    const recentes = new Set(InnovaCare.public.nouveautes(etudes, aujourdhui).recentes.map((e) => e.id));
    const groupes = [
      ['mise en avant', etudes.filter((e) => e.enAvant)],
      ['nouvellement ouverte', etudes.filter((e) => !e.enAvant && recentes.has(e.id))],
      ['rotation', etudes.filter((e) => !e.enAvant && !recentes.has(e.id))],
    ];
    const choix = [];
    for (const [raison, liste] of groupes) {
      for (const e of liste.slice().sort(parAnciennete)) {
        if (choix.length >= max) break;
        choix.push({ etude: e, raison });
      }
    }
    return choix;
  }

  /** Contrôles pour le porteur : fin de recrutement dépassée (encore « ouvert »), mise à jour ancienne. */
  function controles(etudes, parametres, aujourdhui) {
    const j = jour(aujourdhui);
    const mois = Number((parametres.newsletter || {}).delai_alerte_maj_mois) || 6;
    const fins = etudes.filter((e) => { const d = jour(e.valeurs.fin_recrutement); return d !== null && d < j; });
    const anciennes = etudes.filter((e) => { const d = jour(e.maj); return d !== null && j - d > mois * 30.5; });
    return { fins, anciennes, mois };
  }

  /** Corps du ticket (Markdown). */
  function corps(donnees, parametres, historique, aujourdhui) {
    const etudes = candidates(donnees, parametres);
    const choix = choisir(etudes, parametres, historique, aujourdhui);
    const c = controles(etudes, parametres, aujourdhui);
    const fr = InnovaCare.public.dateFr;
    const L = [];
    L.push('## 1. Brouillon prêt à copier-coller', '');
    L.push('Études mises en lumière cette semaine : ' + (choix.length ? choix.map((x) => x.etude.nom + ' (' + x.raison + ')').join(', ') : 'aucune étude ouverte publiée') + '.', '');
    if (choix.length) {
      const memo = InnovaCare.memos.construire(choix.map((x) => x.etude), parametres, { avecDect: false });
      L.push('```markdown', InnovaCare.memos.versMarkdown(memo).trim(), '```', '');
    }
    L.push('## 2. Rappel', '', (parametres.newsletter || {}).rappel || 'Si l\'Excel a changé cette semaine, pensez à publier.', '');
    L.push('## 3. Contrôles', '');
    L.push('**Fin de recrutement prévue dépassée, mais toujours « ouvert » :** ' + (c.fins.length ? '' : 'aucune.'));
    for (const e of c.fins) L.push('- ' + e.nom + ' (fin prévue le ' + fr(e.valeurs.fin_recrutement) + ')');
    L.push('', '**Non mises à jour depuis plus de ' + c.mois + ' mois :** ' + (c.anciennes.length ? '' : 'aucune.'));
    for (const e of c.anciennes) L.push('- ' + e.nom + ' (dernière mise à jour le ' + fr(e.maj) + ')');
    L.push('', '---', '*Brouillon généré automatiquement à partir des données publiques du site (aucune donnée interne). Données publiées le ' + fr(donnees.genere_le) + '.*');
    return { texte: L.join('\n') + '\n', choix, controles: c };
  }

  /** Titre du ticket. */
  const titre = (aujourdhui) => 'Brouillon de newsletter — semaine du ' + InnovaCare.public.dateFr(aujourdhui);

  /** Historique mis à jour : date de présentation des études choisies. */
  function majHistorique(historique, choix, aujourdhui) {
    const h = { etudes: Object.assign({}, (historique && historique.etudes) || {}) };
    for (const x of choix) h.etudes[x.etude.id] = aujourdhui;
    return h;
  }

  InnovaCare.newsletter = { candidates, choisir, controles, corps, titre, majHistorique };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// =============================================================================
// publieur-ui.js — interface du Publieur
// =============================================================================
// 1. lit l'Excel harmonisé ; 2. contrôles ; 3. récupère la version en ligne de
// protocoles.json (lecture publique, sans jeton) et compare ; 4. publie avec le jeton
// GitHub (API « contents ») ; 5. secours : téléchargement du fichier.
// Seul le fichier public (liste blanche, src/export-public.js) est envoyé.
// Étape 1.5 : les paramètres sont lus dans l'Excel (onglet masqué) ; s'ils diffèrent de ceux
// du site, parametres.json est publié aussi, après vérification (aucun DECT, aucun nom de
// l'établissement). Le Publieur signale enfin les nouvelles versions des outils.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const DEPART = JSON.parse(document.getElementById('donnees-parametres').textContent);
  let P = DEPART;                 // paramètres utilisés : ceux de l'Excel, sinon ceux de départ
  let PUB = P.publication || {};
  let parametresDeLExcel = false; // seuls des paramètres venus de l'Excel peuvent être publiés
  const API = 'https://api.github.com';
  const CLE_JETON = 'innovacare-jeton-github';
  const CLE_MEMOIRE = 'excel-etudes';       // partagée avec l'outil Paramètres
  const ANCIENNE_CLE = 'publieur-excel';    // avant l'étape 1.5
  const MA_VERSION = (document.querySelector('[data-version]') || {}).dataset ? document.querySelector('[data-version]').dataset.version : null;
  const $ = (id) => document.getElementById(id);
  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  let nouveau = null;   // contenu à publier
  let enLigne = null;   // contenu actuellement en ligne (ou null)
  let shaEnLigne = null;
  let bloquants = 0;
  let parametresEnLigne = null;   // { contenu, sha } de site/donnees/parametres.json, ou null
  let parametresAPublier = false; // vrai si les paramètres de l'Excel diffèrent de ceux du site
  const cheminParametres = () => (PUB.chemin || '').replace(/[^/]*$/, '') + 'parametres.json';

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }
  const ligne = (classe, texte) => el('li', { className: classe }, texte);
  const lireJeton = () => { try { return localStorage.getItem(CLE_JETON) || ''; } catch (e) { return ''; } };
  const garderJeton = (j) => { try { localStorage.setItem(CLE_JETON, j); } catch (e) { /* stockage refusé */ } };

  // --- 1. Lecture -------------------------------------------------------------------

  async function lireExcel(fichier) {
    if (!/\.xlsx$/i.test(fichier.name)) { $('etat').textContent = 'Ce fichier n\'est pas au format .xlsx.'; return; }
    $('etat').textContent = 'Lecture en cours…';
    $('suite').hidden = true;
    try {
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, await fichier.arrayBuffer());
      const lus = IC.lecture.lireParametres(grilles);
      parametresDeLExcel = !!lus.parametres;
      P = lus.parametres || DEPART;
      PUB = P.publication || {};
      const lu = IC.lecture.lireGabarit(grilles, P);
      if (lu.version === null || lu.version === undefined) {
        $('etat').textContent = 'Ce fichier n\'est pas l\'Excel harmonisé (numéro de version introuvable). L\'ancien Excel doit d\'abord passer par l\'outil Migration.';
        return;
      }
      afficherControles(IC.publication.controler(lu, P));
      if (!parametresDeLExcel) {
        $('liste-controles').appendChild(ligne('alerte', '! Cet Excel ne contient pas encore ses réglages (pathologies, filtres, textes) : ceux de départ de l\'outil sont utilisés. Ouvrez-le une fois avec l\'outil Paramètres et cliquez sur « Enregistrer dans l\'Excel ».'));
      } else {
        const problemesParametres = IC.parametres.verifierPourPublication(P);
        bloquants += problemesParametres.length;
        for (const m of problemesParametres) $('liste-controles').appendChild(ligne('echec', '✘ Réglages (outil Paramètres) : ' + m));
        if (problemesParametres.length) { $('resume-controles').textContent = bloquants + ' erreur(s) bloquante(s), dont ' + problemesParametres.length + ' dans les réglages : corrigez-les avec l\'outil Paramètres.'; $('resume-controles').className = 'etat-echec'; $('details-controles').open = true; }
      }
      nouveau = IC.exportPublic.exporter(lu, P);
      const problemes = IC.exportPublic.verifierContenu(nouveau, P);
      if (problemes.length) { // ne devrait jamais arriver : sécurité supplémentaire
        bloquants += problemes.length;
        for (const p of problemes) $('liste-controles').appendChild(ligne('echec', '✘ Sécurité : ' + p));
      }
      $('etat').textContent = lu.etudes.length + ' études lues, dont ' + nouveau.protocoles.length + ' à publier.';
      $('suite').hidden = false;
      $('chemin-manuel').textContent = PUB.chemin || '';
      await recupererEnLigne();
    } catch (erreur) {
      console.error(erreur);
      $('etat').textContent = 'Le fichier n\'a pas pu être lu (' + erreur.message + '). Est-il ouvert dans Excel ?';
    }
  }

  // --- 2. Contrôles -------------------------------------------------------------------

  function afficherControles(liste) {
    bloquants = liste.filter((c) => c.gravite === 'bloquant').length;
    const avertissements = liste.length - bloquants;
    $('resume-controles').textContent = bloquants
      ? bloquants + ' erreur(s) bloquante(s) : la publication est impossible tant qu\'elles ne sont pas corrigées dans l\'Excel. ' + avertissements + ' avertissement(s).'
      : 'Aucune erreur bloquante. ' + avertissements + ' avertissement(s) à regarder quand vous le pourrez.';
    $('resume-controles').className = bloquants ? 'etat-echec' : 'etat-ok';
    const ul = $('liste-controles');
    ul.textContent = '';
    for (const c of liste) ul.appendChild(ligne(c.gravite === 'bloquant' ? 'echec' : 'alerte', (c.gravite === 'bloquant' ? '✘ ' : '! ') + (c.etude || '') + ' : ' + c.message));
    $('details-controles').open = bloquants > 0;
  }

  // --- 3. Version en ligne et comparaison ---------------------------------------------------

  /** Lit un fichier du dépôt (lecture publique, sans jeton). Renvoie { contenu, sha } ou null s'il n'existe pas. */
  async function lireDuDepot(chemin) {
    const url = API + '/repos/' + PUB.depot + '/contents/' + chemin + '?ref=' + encodeURIComponent(PUB.branche || 'main');
    const reponse = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (reponse.status === 404) return null;
    if (!reponse.ok) throw new Error('code ' + reponse.status);
    const donnees = await reponse.json();
    return { contenu: JSON.parse(IC.publication.depuisBase64(donnees.content)), sha: donnees.sha };
  }

  /** Paramètres du site : à publier si ceux de l'Excel sont différents. */
  async function comparerParametres() {
    parametresAPublier = false;
    const zone = $('etat-parametres');
    if (!parametresDeLExcel) { zone.textContent = 'Réglages : non publiés (cet Excel ne les contient pas encore).'; return; }
    try {
      parametresEnLigne = await lireDuDepot(cheminParametres());
      const enLigne = parametresEnLigne && parametresEnLigne.contenu;
      if (enLigne && IC.parametres.identiques(enLigne, P)) { zone.textContent = 'Réglages : identiques à ceux du site.'; return; }
      parametresAPublier = true;
      const rubriques = enLigne ? Object.keys(Object.assign({}, enLigne, P)).filter((k) => !IC.parametres.identiques(enLigne[k], P[k])) : ['tous'];
      zone.textContent = 'Réglages modifiés depuis la dernière publication (' + rubriques.join(', ') + ') : ils seront publiés aussi.';
    } catch (erreur) {
      parametresEnLigne = null;
      zone.textContent = 'Réglages en ligne inaccessibles (' + erreur.message + ') : ils ne seront pas publiés cette fois.';
    }
  }

  async function recupererEnLigne() {
    $('etat-en-ligne').textContent = 'Lecture de la version en ligne…';
    verifierVersions();
    await comparerParametres();
    try {
      const url = API + '/repos/' + PUB.depot + '/contents/' + PUB.chemin + '?ref=' + encodeURIComponent(PUB.branche || 'main');
      const reponse = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
      if (reponse.status === 404) { enLigne = null; shaEnLigne = null; $('etat-en-ligne').textContent = 'Aucune version en ligne : ce sera la première publication.'; }
      else if (!reponse.ok) throw new Error('code ' + reponse.status);
      else {
        const donnees = await reponse.json();
        shaEnLigne = donnees.sha;
        enLigne = JSON.parse(IC.publication.depuisBase64(donnees.content));
        $('etat-en-ligne').textContent = 'Version en ligne récupérée (générée le ' + (enLigne.genere_le || '?') + ').';
      }
      $('rangee-manuelle').hidden = true;
    } catch (erreur) {
      enLigne = null; shaEnLigne = null;
      $('etat-en-ligne').textContent = 'Version en ligne inaccessible (' + erreur.message + '). Déposez le protocoles.json actuel pour comparer, sinon toutes les études seront datées d\'aujourd\'hui.';
      $('rangee-manuelle').hidden = false;
    }
    comparer();
  }

  function comparer() {
    IC.publication.dater(nouveau, enLigne, aujourdhui());
    const d = IC.publication.comparer(enLigne, nouveau);
    const zone = $('changements');
    zone.textContent = '';
    const bloc = (titre, liste, avecChamps) => {
      if (!liste.length) return;
      zone.appendChild(el('h3', null, titre + ' (' + liste.length + ')'));
      const ul = el('ul', { className: 'changements' });
      for (const x of liste) ul.appendChild(el('li', null, x.nom, avecChamps ? el('span', { className: 'champs-modifies' }, ' — ' + x.champs.join(', ')) : null));
      zone.appendChild(ul);
    };
    bloc('Études ajoutées', d.ajoutees);
    bloc('Études modifiées', d.modifiees, true);
    bloc('Études retirées du site', d.retirees);
    zone.appendChild(el('p', { className: 'note' }, d.identiques + ' étude(s) inchangée(s).'));
    nouveau._difference = d;
  }

  // --- 4. Publication -------------------------------------------------------------------

  /** Envoie un fichier sur le dépôt (API « contents »). Renvoie { ok, code, sha }. */
  async function envoyer(chemin, texte, sha, message, jeton) {
    const corps = { message, content: IC.publication.enBase64(texte), branch: PUB.branche || 'main' };
    if (sha) corps.sha = sha;
    const reponse = await fetch(API + '/repos/' + PUB.depot + '/contents/' + chemin, {
      method: 'PUT',
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    if (!reponse.ok) return { ok: false, code: reponse.status };
    const donnees = await reponse.json();
    return { ok: true, code: reponse.status, sha: donnees.content && donnees.content.sha };
  }

  function expliquerEchec(code, quoi) {
    if (code === 401 || code === 403) return '✘ Jeton refusé par GitHub (code ' + code + ') : expiré, ou sans le droit « Contents : Read and write » sur ce dépôt.';
    if (code === 409 || code === 422) return '✘ ' + quoi + ' : la version en ligne a changé entre-temps (code ' + code + ') : rechargez l\'Excel puis recommencez.';
    return '✘ ' + quoi + ' : échec de la publication (code ' + code + '). Utilisez le secours (section 5).';
  }

  async function publier() {
    const resultat = $('resultat-publication');
    resultat.textContent = '';
    if (!nouveau) return;
    if (bloquants) { resultat.appendChild(ligne('echec', '✘ Corrigez d\'abord les erreurs bloquantes (section 2).')); return; }
    const jeton = $('jeton').value.trim();
    if (!jeton) { resultat.appendChild(ligne('alerte', '! Saisissez le jeton GitHub (voir docs/GUIDE_PORTEUR.md).')); return; }
    const d = nouveau._difference;
    const etudesAPublier = !d || d.ajoutees.length || d.modifiees.length || d.retirees.length;
    if (!etudesAPublier && !parametresAPublier) { resultat.appendChild(ligne('ok', '✔ Rien à publier : le site est déjà à jour.')); return; }
    resultat.appendChild(ligne('', 'Publication en cours…'));
    try {
      // 1. Les réglages d'abord : le site ne doit jamais afficher une étude avec une pathologie qu'il ne connaît pas.
      if (parametresAPublier) {
        const problemes = IC.parametres.verifierPourPublication(P);
        if (problemes.length) { resultat.textContent = ''; resultat.appendChild(ligne('echec', '✘ Réglages non publiables : ' + problemes.join(' '))); return; }
        const r = await envoyer(cheminParametres(), JSON.stringify(P, null, 2) + '\n', parametresEnLigne && parametresEnLigne.sha, 'Réglages publiés le ' + aujourdhui().split('-').reverse().join('/'), jeton);
        if (!r.ok) { resultat.textContent = ''; resultat.appendChild(ligne('echec', expliquerEchec(r.code, 'Réglages'))); return; }
        garderJeton(jeton);
        parametresEnLigne = { contenu: JSON.parse(JSON.stringify(P)), sha: r.sha };
        parametresAPublier = false;
        resultat.appendChild(ligne('ok', '✔ Réglages publiés (parametres.json).'));
        $('etat-parametres').textContent = 'Réglages : identiques à ceux du site.';
      }
      // 2. Les études.
      if (etudesAPublier) {
        const contenu = Object.assign({}, nouveau);
        delete contenu._difference;
        const message = IC.publication.messageCommit(d, aujourdhui());
        const r = await envoyer(PUB.chemin, JSON.stringify(contenu, null, 2) + '\n', shaEnLigne, message, jeton);
        if (!r.ok) { resultat.appendChild(ligne('echec', expliquerEchec(r.code, 'Études'))); return; }
        garderJeton(jeton);
        shaEnLigne = r.sha;
        enLigne = contenu;
        resultat.appendChild(ligne('ok', '✔ Publié : « ' + message + ' ».'));
        comparer();
      }
      const premier = resultat.firstChild;
      if (premier && premier.textContent === 'Publication en cours…') premier.remove();
      resultat.appendChild(el('li', { className: 'ok' }, 'Le site sera à jour dans 1 à 2 minutes : ', el('a', { href: PUB.url_site, target: '_blank', rel: 'noopener', textContent: PUB.url_site })));
    } catch (erreur) {
      resultat.appendChild(ligne('echec', '✘ GitHub injoignable (' + erreur.message + '). Utilisez le secours (section 5).'));
    }
  }

  // --- Versions des outils -------------------------------------------------------------------

  /** Lit outils/versions.json en ligne et signale les nouvelles versions (lien de téléchargement). */
  async function verifierVersions() {
    const zone = $('versions-outils');
    if (!zone) return;
    zone.textContent = '';
    try {
      const lu = await lireDuDepot('outils/versions.json');
      if (!lu) return;
      const versions = lu.contenu;
      const moi = Object.keys(versions).find((n) => /^Publieur/i.test(n));
      const ul = el('ul', { className: 'resultats' });
      if (moi && MA_VERSION && versions[moi] !== MA_VERSION) {
        ul.appendChild(ligne('alerte', '! Une nouvelle version du Publieur existe (' + versions[moi] + ', vous avez ' + MA_VERSION + ') : téléchargez-la ci-dessous et remplacez celle du dossier des outils.'));
      }
      for (const [nom, version] of Object.entries(versions)) {
        const url = 'https://github.com/' + PUB.depot + '/blob/' + (PUB.branche || 'main') + '/outils/' + nom;
        ul.appendChild(el('li', null, nom + ' : version ' + version + ' — ', el('a', { href: url, target: '_blank', rel: 'noopener', textContent: 'page de téléchargement' })));
      }
      zone.appendChild(el('p', { className: 'note' }, 'Dernières versions en ligne. Comparez avec le numéro écrit en bas de chaque outil ; s\'il diffère, ouvrez la page de téléchargement puis cliquez sur le bouton « Download raw file » (flèche vers le bas, en haut à droite).'));
      zone.appendChild(ul);
    } catch (erreur) { /* pas grave : simple information */ }
  }

  function telecharger() {
    if (!nouveau) return;
    const contenu = Object.assign({}, nouveau);
    delete contenu._difference;
    const blob = new Blob([JSON.stringify(contenu, null, 2) + '\n'], { type: 'application/json' });
    const lien = el('a', { href: URL.createObjectURL(blob), download: 'protocoles.json' });
    document.body.appendChild(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
  }

  // --- Démarrage ------------------------------------------------------------------------

  async function choisir() {
    if (!IC.memoireFichier.disponible()) { $('selecteur-excel').click(); return; }
    try {
      const choix = await IC.memoireFichier.choisir();
      if (!choix) return;
      try { await IC.memoireFichier.memoriser(CLE_MEMOIRE, choix.poignee); } catch (e) { /* pas grave */ }
      $('bouton-recharger').hidden = false;
      $('bouton-recharger').textContent = 'Recharger « ' + choix.poignee.name + ' »';
      await lireExcel(choix.fichier);
    } catch (erreur) { $('etat').textContent = 'Le sélecteur de fichier a échoué (' + erreur.name + ').'; }
  }

  const retrouverPoignee = async () => (await IC.memoireFichier.retrouver(CLE_MEMOIRE)) || IC.memoireFichier.retrouver(ANCIENNE_CLE);

  async function recharger() {
    try {
      const poignee = await retrouverPoignee();
      const fichier = poignee && await IC.memoireFichier.relire(poignee);
      if (fichier) await lireExcel(fichier); else $('etat').textContent = 'Autorisation refusée : choisissez de nouveau le fichier.';
    } catch (erreur) { $('etat').textContent = 'Le fichier mémorisé est introuvable : choisissez-le de nouveau.'; }
  }

  async function demarrer() {
    $('nom-excel-attendu').textContent = ((DEPART.specialite && DEPART.specialite.instance) || 'InnovaCare') + '_ETUDES.xlsx';
    $('jeton').value = lireJeton();
    $('bouton-choisir').addEventListener('click', choisir);
    $('bouton-recharger').addEventListener('click', recharger);
    $('selecteur-excel').addEventListener('change', (e) => { if (e.target.files[0]) lireExcel(e.target.files[0]); });
    $('bouton-publier').addEventListener('click', publier);
    $('bouton-oublier').addEventListener('click', () => { try { localStorage.removeItem(CLE_JETON); } catch (e) { /* rien */ } $('jeton').value = ''; });
    $('bouton-telecharger').addEventListener('click', telecharger);
    $('bouton-ancien').addEventListener('click', () => $('selecteur-ancien').click());
    $('selecteur-ancien').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { enLigne = JSON.parse(await f.text()); $('etat-en-ligne').textContent = 'Version déposée à la main (générée le ' + (enLigne.genere_le || '?') + ').'; comparer(); }
      catch (erreur) { $('etat-en-ligne').textContent = 'Ce fichier n\'est pas un JSON valide.'; }
    });
    const zone = $('zone-depot');
    ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, () => zone.classList.remove('survol')));
    zone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) lireExcel(e.dataTransfer.files[0]); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
    if (IC.memoireFichier.disponible()) {
      try {
        const p = await retrouverPoignee();
        if (p) { $('bouton-recharger').hidden = false; $('bouton-recharger').textContent = 'Recharger « ' + p.name + ' »'; }
      } catch (e) { /* base locale indisponible */ }
    }
  }

  demarrer();
})();

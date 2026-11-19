// =============================================================================
// publieur-ui.js — interface du Publieur
// =============================================================================
// 1. lit l'Excel harmonisé ; 2. contrôles ; 3. récupère la version en ligne de
// protocoles.json (lecture publique, sans jeton) et compare ; 4. publie avec le jeton
// GitHub (API « contents ») ; 5. secours : téléchargement du fichier.
// Seul le fichier public (liste blanche, src/export-public.js) est envoyé.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const P = JSON.parse(document.getElementById('donnees-parametres').textContent);
  const PUB = P.publication || {};
  const API = 'https://api.github.com';
  const CLE_JETON = 'innovacare-jeton-github';
  const CLE_MEMOIRE = 'publieur-excel';
  const $ = (id) => document.getElementById(id);
  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  let nouveau = null;   // contenu à publier
  let enLigne = null;   // contenu actuellement en ligne (ou null)
  let shaEnLigne = null;
  let bloquants = 0;

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
      const lu = IC.lecture.lireGabarit(await IC.excel.lireClasseur(window.ExcelJS, await fichier.arrayBuffer()), P);
      if (lu.version === null || lu.version === undefined) {
        $('etat').textContent = 'Ce fichier n\'est pas l\'Excel harmonisé (numéro de version introuvable). L\'ancien Excel doit d\'abord passer par l\'outil Migration.';
        return;
      }
      afficherControles(IC.publication.controler(lu, P));
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

  async function recupererEnLigne() {
    $('etat-en-ligne').textContent = 'Lecture de la version en ligne…';
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

  async function publier() {
    const resultat = $('resultat-publication');
    resultat.textContent = '';
    if (!nouveau) return;
    if (bloquants) { resultat.appendChild(ligne('echec', '✘ Corrigez d\'abord les erreurs bloquantes (section 2).')); return; }
    const jeton = $('jeton').value.trim();
    if (!jeton) { resultat.appendChild(ligne('alerte', '! Saisissez le jeton GitHub (voir docs/GUIDE_PORTEUR.md).')); return; }
    const d = nouveau._difference;
    if (d && !d.ajoutees.length && !d.modifiees.length && !d.retirees.length) { resultat.appendChild(ligne('ok', '✔ Rien à publier : le site est déjà à jour.')); return; }
    const contenu = Object.assign({}, nouveau);
    delete contenu._difference;
    const texte = JSON.stringify(contenu, null, 2) + '\n';
    resultat.appendChild(ligne('', 'Publication en cours…'));
    try {
      const corps = { message: IC.publication.messageCommit(d, aujourdhui()), content: IC.publication.enBase64(texte), branch: PUB.branche || 'main' };
      if (shaEnLigne) corps.sha = shaEnLigne;
      const reponse = await fetch(API + '/repos/' + PUB.depot + '/contents/' + PUB.chemin, {
        method: 'PUT',
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      resultat.textContent = '';
      if (reponse.status === 401 || reponse.status === 403) { resultat.appendChild(ligne('echec', '✘ Jeton refusé par GitHub (code ' + reponse.status + ') : expiré, ou sans le droit « Contents : Read and write » sur ce dépôt.')); return; }
      if (reponse.status === 409 || reponse.status === 422) { resultat.appendChild(ligne('echec', '✘ La version en ligne a changé entre-temps (code ' + reponse.status + ') : rechargez l\'Excel puis recommencez.')); return; }
      if (!reponse.ok) { resultat.appendChild(ligne('echec', '✘ Échec de la publication (code ' + reponse.status + '). Utilisez le secours (section 5).')); return; }
      const donnees = await reponse.json();
      garderJeton(jeton);
      shaEnLigne = donnees.content && donnees.content.sha;
      enLigne = contenu;
      resultat.appendChild(ligne('ok', '✔ Publié : « ' + corps.message + ' ».'));
      resultat.appendChild(el('li', { className: 'ok' }, 'Le site sera à jour dans 1 à 2 minutes : ', el('a', { href: PUB.url_site, target: '_blank', rel: 'noopener', textContent: PUB.url_site })));
      comparer();
    } catch (erreur) {
      resultat.textContent = '';
      resultat.appendChild(ligne('echec', '✘ GitHub injoignable (' + erreur.message + '). Utilisez le secours (section 5).'));
    }
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

  async function recharger() {
    try {
      const poignee = await IC.memoireFichier.retrouver(CLE_MEMOIRE);
      const fichier = poignee && await IC.memoireFichier.relire(poignee);
      if (fichier) await lireExcel(fichier); else $('etat').textContent = 'Autorisation refusée : choisissez de nouveau le fichier.';
    } catch (erreur) { $('etat').textContent = 'Le fichier mémorisé est introuvable : choisissez-le de nouveau.'; }
  }

  async function demarrer() {
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
        const p = await IC.memoireFichier.retrouver(CLE_MEMOIRE);
        if (p) { $('bouton-recharger').hidden = false; $('bouton-recharger').textContent = 'Recharger « ' + p.name + ' »'; }
      } catch (e) { /* base locale indisponible */ }
    }
  }

  demarrer();
})();

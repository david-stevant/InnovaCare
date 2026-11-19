// =============================================================================
// migration-ui.js — interface de l'outil « Migration vers l'Excel harmonisé »
// =============================================================================
// Enchaîne : choix de l'ancien fichier → lecture (ExcelJS) → migration →
// fabrication du nouveau classeur → téléchargement. Tout se passe dans la page.
// Les valeurs venant de l'Excel sont affichées comme du texte, jamais comme du HTML.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const CLE_MEMOIRE = 'controle-excel'; // même fichier que l'outil Contrôle
  const lireJson = (id) => JSON.parse(document.getElementById(id).textContent);
  const PARAMETRES = lireJson('donnees-parametres');
  const CORRESPONDANCES = lireJson('donnees-correspondances-ancien-excel');
  const INSTANCE = (PARAMETRES.specialite && PARAMETRES.specialite.instance) || 'InnovaCare';
  const $ = (id) => document.getElementById(id);
  let derniere = null;

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const enfant of enfants) {
      if (enfant === null || enfant === undefined) continue;
      noeud.appendChild(typeof enfant === 'string' || typeof enfant === 'number' ? document.createTextNode(String(enfant)) : enfant);
    }
    return noeud;
  }

  function tableau(id, entetes, lignes) {
    const table = $(id);
    table.textContent = '';
    table.appendChild(el('thead', null, el('tr', null, ...entetes.map((t) => el('th', { scope: 'col' }, t)))));
    table.appendChild(el('tbody', null, ...lignes.map((cellules) => el('tr', null, ...cellules.map((c) => el('td', null, c))))));
  }

  function etat(texte, gravite) {
    $('etat').textContent = texte;
    $('etat').className = 'note' + (gravite ? ' etat-' + gravite : '');
  }

  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  /** Propose le téléchargement d'un classeur ExcelJS. */
  async function telecharger(classeur, nomFichier) {
    const contenu = await classeur.xlsx.writeBuffer();
    const blob = new Blob([contenu], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const lien = el('a', { href: URL.createObjectURL(blob), download: nomFichier });
    document.body.appendChild(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
  }

  async function migrer(fichier) {
    if (!/\.xlsx$/i.test(fichier.name)) { etat('Ce fichier n\'est pas au format .xlsx.', 'echec'); return; }
    etat('Lecture et migration en cours…');
    $('resultat').hidden = true;
    try {
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, await fichier.arrayBuffer());
      const lecture = IC.lectureAncien.lireAncienExcel(grilles, CORRESPONDANCES);
      derniere = IC.migration.migrer(lecture, PARAMETRES, CORRESPONDANCES);
      afficher(derniere.resume, derniere.rapport);
      etat('Migration terminée. Téléchargez le nouvel Excel ci-dessous.', 'ok');
    } catch (erreur) {
      console.error(erreur);
      etat('Le fichier n\'a pas pu être lu (' + (erreur && erreur.message ? erreur.message : erreur) + '). Est-il ouvert dans Excel ou protégé par un mot de passe ?', 'echec');
    }
  }

  function afficher(resume, rapport) {
    const compteurs = $('compteurs');
    compteurs.textContent = '';
    const ajout = (n, texte, classe) => compteurs.appendChild(el('div', { className: 'compteur' + (classe ? ' gravite-' + classe : '') }, el('strong', null, n), ' ' + texte));
    ajout(resume.etudesMigrees, 'études migrées (sur ' + resume.etudesLues + ' colonnes lues)');
    ajout(resume.personnes, 'personnes dans l\'annuaire');
    ajout(resume.rapport.corriger, 'à corriger', 'corriger');
    ajout(resume.rapport.verifier, 'à vérifier', 'verifier');
    tableau('table-poles', ['Pôle', 'Études'], Object.entries(resume.parPole).map(([p, n]) => [p, String(n)]));
    const gravite = { corriger: 'à corriger', verifier: 'à vérifier', info: 'information' };
    tableau('table-rapport', ['Gravité', 'Pôle', 'Étude', 'Champ', 'Constat'], rapport.map((r) => [gravite[r.gravite], r.pole, r.etude, r.champ, r.message]));
    $('resultat').hidden = false;
    $('titre-synthese').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function telechargerMigre() {
    if (!derniere) return;
    $('message').textContent = 'Fabrication du fichier…';
    try {
      await telecharger(IC.gabarit.creerClasseur(window.ExcelJS, PARAMETRES, derniere), INSTANCE + '_etudes_harmonise_' + aujourdhui() + '.xlsx');
      $('message').textContent = 'Fichier téléchargé (dossier « Téléchargements »). Déposez-le sur le disque partagé à côté de l\'ancien.';
    } catch (erreur) {
      console.error(erreur);
      $('message').textContent = 'Échec de la fabrication du fichier (' + erreur.message + ').';
    }
  }

  async function telechargerVierge() {
    try {
      await telecharger(IC.gabarit.creerClasseur(window.ExcelJS, PARAMETRES), INSTANCE + '_gabarit_vierge.xlsx');
    } catch (erreur) {
      console.error(erreur);
      etat('Échec de la fabrication du gabarit vierge (' + erreur.message + ').', 'echec');
    }
  }

  async function copierCompteurs() {
    if (!derniere) return;
    const texte = IC.migration.resumeCompteurs(derniere.resume);
    try { await navigator.clipboard.writeText(texte); $('message').textContent = 'Compteurs copiés : collez-les dans la conversation avec Claude.'; }
    catch (erreur) { window.prompt('Copie automatique impossible. Sélectionnez le texte puis Ctrl + C :', texte); }
  }

  async function choisir() {
    if (!IC.memoireFichier.disponible()) { $('selecteur-classique').click(); return; }
    try {
      const choix = await IC.memoireFichier.choisir();
      if (!choix) return;
      try { await IC.memoireFichier.memoriser(CLE_MEMOIRE, choix.poignee); } catch (e) { /* pas grave */ }
      preparerRecharger(choix.poignee);
      await migrer(choix.fichier);
    } catch (erreur) {
      etat('Le sélecteur de fichier a échoué (' + erreur.name + ').', 'echec');
    }
  }

  function preparerRecharger(poignee) {
    $('bouton-recharger').hidden = false;
    $('bouton-recharger').textContent = 'Recharger « ' + poignee.name + ' »';
  }

  async function recharger() {
    try {
      const poignee = await IC.memoireFichier.retrouver(CLE_MEMOIRE);
      const fichier = poignee && await IC.memoireFichier.relire(poignee);
      if (fichier) await migrer(fichier); else etat('Autorisation refusée : choisissez de nouveau le fichier.', 'echec');
    } catch (erreur) {
      etat('Le fichier mémorisé est introuvable : choisissez-le de nouveau.', 'echec');
    }
  }

  function activerDepot() {
    const zone = $('zone-depot');
    ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, () => zone.classList.remove('survol')));
    zone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) migrer(e.dataTransfer.files[0]); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  async function demarrer() {
    $('bouton-choisir').addEventListener('click', choisir);
    $('bouton-recharger').addEventListener('click', recharger);
    $('bouton-telecharger').addEventListener('click', telechargerMigre);
    $('bouton-vierge').addEventListener('click', telechargerVierge);
    $('bouton-copier').addEventListener('click', copierCompteurs);
    $('selecteur-classique').addEventListener('change', (e) => { if (e.target.files[0]) migrer(e.target.files[0]); });
    activerDepot();
    if (IC.memoireFichier.disponible()) {
      try { const p = await IC.memoireFichier.retrouver(CLE_MEMOIRE); if (p) preparerRecharger(p); } catch (e) { /* base locale indisponible */ }
    }
  }

  demarrer();
})();

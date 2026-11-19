// =============================================================================
// controle.js — interface de l'outil « Contrôle de l'Excel actuel »
// =============================================================================
// Enchaîne : choix du fichier → lecture (ExcelJS) → lecture par libellés →
// contrôles → affichage du rapport. Tout se passe dans la page : rien n'est
// envoyé ni enregistré, sauf la « poignée » du fichier (pour le bouton Recharger).
// Toutes les valeurs venant de l'Excel sont affichées comme du texte (jamais
// interprétées comme du HTML).
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const CLE_MEMOIRE = 'controle-excel';
  const lireJson = (id) => JSON.parse(document.getElementById(id).textContent);
  const PARAMETRES = lireJson('donnees-parametres');
  const CORRESPONDANCES = lireJson('donnees-correspondances-ancien-excel');

  const $ = (id) => document.getElementById(id);
  let dernierRapport = null;

  /** Fabrique un élément HTML : el('td', { className: 'x' }, 'texte', autreElement). */
  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const enfant of enfants) {
      if (enfant === null || enfant === undefined) continue;
      noeud.appendChild(typeof enfant === 'string' || typeof enfant === 'number' ? document.createTextNode(String(enfant)) : enfant);
    }
    return noeud;
  }

  function tableau(idTable, entetes, lignes) {
    const table = $(idTable);
    table.textContent = '';
    table.appendChild(el('thead', null, el('tr', null, ...entetes.map((t) => el('th', { scope: 'col' }, t)))));
    table.appendChild(el('tbody', null, ...lignes.map((cellules) => el('tr', null, ...cellules.map((c) => el('td', null, c))))));
  }

  function etat(texte, gravite) {
    $('etat').textContent = texte;
    $('etat').className = 'note' + (gravite ? ' etat-' + gravite : '');
  }

  // --- Lecture ----------------------------------------------------------------

  async function analyser(fichier) {
    if (!/\.xlsx$/i.test(fichier.name)) {
      etat('Ce fichier n\'est pas au format .xlsx. Dans Excel : Fichier › Enregistrer sous › Classeur Excel (.xlsx).', 'echec');
      return;
    }
    etat('Lecture en cours…');
    $('rapport').hidden = true;
    try {
      const contenu = await fichier.arrayBuffer();
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, contenu);
      const lecture = IC.lectureAncien.lireAncienExcel(grilles, CORRESPONDANCES);
      dernierRapport = IC.controles.controler(lecture, PARAMETRES, CORRESPONDANCES);
      afficher(dernierRapport, fichier);
      etat('Lecture terminée.', 'ok');
    } catch (erreur) {
      console.error(erreur);
      etat('Le fichier n\'a pas pu être lu (' + (erreur && erreur.message ? erreur.message : erreur) + '). Est-il ouvert et verrouillé par Excel, ou protégé par un mot de passe ?', 'echec');
    }
  }

  // --- Affichage ----------------------------------------------------------------

  const LIBELLES_GRAVITE = { corriger: 'à corriger', verifier: 'à vérifier', info: 'pour information' };

  function afficher(rapport, fichier) {
    $('resume-fichier').textContent = 'Fichier « ' + fichier.name + ' », lu le ' + new Date().toLocaleString('fr-FR') + '.';

    const compteurs = $('compteurs');
    compteurs.textContent = '';
    compteurs.appendChild(el('div', { className: 'compteur' }, el('strong', null, rapport.nombreEtudes), ' études'));
    compteurs.appendChild(el('div', { className: 'compteur' }, el('strong', null, rapport.nombrePersonnesAnnuaire), ' personnes dans l\'annuaire'));
    for (const gravite of ['corriger', 'verifier', 'info']) {
      compteurs.appendChild(el('div', { className: 'compteur gravite-' + gravite }, el('strong', null, rapport.compteurs[gravite]), ' ' + LIBELLES_GRAVITE[gravite]));
    }

    tableau('table-inventaire', ['Onglet', 'Rôle', 'Nombre', 'Études'], rapport.inventaire.map((i) => [
      i.onglet, { pole: 'pôle', suivi: 'suivi / terminées', annuaire: 'annuaire' }[i.role] || i.role,
      String(i.nombre) + (i.role === 'annuaire' ? ' personnes' : ''), i.noms.join(' · '),
    ]));

    // Alertes regroupées par type, les plus graves d'abord.
    const zone = $('alertes');
    zone.textContent = '';
    for (const gravite of ['corriger', 'verifier', 'info']) {
      for (const [type, [g, titre, explication]] of Object.entries(IC.controles.TYPES)) {
        if (g !== gravite) continue;
        const liste = rapport.alertes.filter((a) => a.type === type);
        if (!liste.length) continue;
        const bloc = el('details', { className: 'groupe gravite-' + gravite, open: gravite === 'corriger' },
          el('summary', null, el('span', { className: 'pastille' }, LIBELLES_GRAVITE[gravite]), ' ' + titre + ' ', el('span', { className: 'nombre' }, '(' + liste.length + ')')),
          el('p', { className: 'note' }, explication),
          el('div', { className: 'defilement' }, el('table', null,
            el('thead', null, el('tr', null, ...['Onglet', 'Étude / personne', 'Cellule', 'Constat'].map((t) => el('th', { scope: 'col' }, t)))),
            el('tbody', null, ...liste.map((a) => el('tr', null, el('td', null, a.onglet), el('td', null, a.etude), el('td', { className: 'adresse' }, a.adresse), el('td', null, a.message))))
          ))
        );
        zone.appendChild(bloc);
      }
    }

    tableau('table-statuts', ['Onglet', 'Étude', 'Colonne', 'Statut proposé', 'D\'après'], rapport.statuts.map((s) => [s.onglet, s.etude, s.colonne, s.statut, s.origine]));

    const remplirTags = (id, liste) => {
      const ul = $(id);
      ul.textContent = '';
      for (const t of liste) ul.appendChild(el('li', null, t.valeur + ' ', el('span', { className: 'nombre' }, '× ' + t.nombre)));
      if (!liste.length) ul.appendChild(el('li', null, '(aucune valeur)'));
    };
    remplirTags('tags-ecs', rapport.tags.ecs);
    remplirTags('tags-patient', rapport.tags.patient);

    $('rapport').hidden = false;
    $('titre-synthese').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Boutons -------------------------------------------------------------------

  async function choisir() {
    if (!IC.memoireFichier.disponible()) { $('selecteur-classique').click(); return; }
    try {
      const choix = await IC.memoireFichier.choisir();
      if (!choix) return;
      try { await IC.memoireFichier.memoriser(CLE_MEMOIRE, choix.poignee); } catch (e) { /* mémorisation impossible : pas grave */ }
      preparerRecharger(choix.poignee);
      await analyser(choix.fichier);
    } catch (erreur) {
      etat('Le sélecteur de fichier a échoué (' + erreur.name + ').', 'echec');
    }
  }

  function preparerRecharger(poignee) {
    $('bouton-recharger').hidden = false;
    $('bouton-recharger').textContent = 'Recharger « ' + poignee.name + ' »';
    $('bouton-oublier').hidden = false;
  }

  async function recharger() {
    try {
      const poignee = await IC.memoireFichier.retrouver(CLE_MEMOIRE);
      const fichier = poignee && await IC.memoireFichier.relire(poignee);
      if (fichier) await analyser(fichier);
      else etat('Autorisation refusée : choisissez de nouveau le fichier.', 'echec');
    } catch (erreur) {
      etat('Le fichier mémorisé est introuvable (déplacé ou renommé ?) : choisissez-le de nouveau.', 'echec');
    }
  }

  async function oublier() {
    try { await IC.memoireFichier.oublier(CLE_MEMOIRE); } catch (e) { /* rien à oublier */ }
    $('bouton-recharger').hidden = true;
    $('bouton-oublier').hidden = true;
    etat('Fichier oublié.');
  }

  async function copierCompteurs() {
    if (!dernierRapport) return;
    const texte = IC.controles.resumeCompteurs(dernierRapport);
    try {
      await navigator.clipboard.writeText(texte);
      $('message-copie').textContent = 'Copié. Collez-le dans la conversation avec Claude.';
    } catch (erreur) {
      window.prompt('Copie automatique impossible. Sélectionnez le texte puis Ctrl + C :', texte);
    }
  }

  function imprimer() {
    // À l'impression, tous les groupes sont dépliés.
    document.querySelectorAll('details').forEach((d) => { d.dataset.etaitOuvert = d.open ? '1' : ''; d.open = true; });
    window.print();
    document.querySelectorAll('details').forEach((d) => { d.open = d.dataset.etaitOuvert === '1'; });
  }

  // --- Glisser-déposer -----------------------------------------------------------

  function activerDepot() {
    const zone = $('zone-depot');
    ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, () => zone.classList.remove('survol')));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const fichier = e.dataTransfer.files[0];
      if (fichier) analyser(fichier);
    });
    // Un fichier lâché ailleurs dans la page ne doit pas remplacer la page.
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  async function demarrer() {
    $('bouton-choisir').addEventListener('click', choisir);
    $('bouton-recharger').addEventListener('click', recharger);
    $('bouton-oublier').addEventListener('click', oublier);
    $('bouton-copier').addEventListener('click', copierCompteurs);
    $('bouton-imprimer').addEventListener('click', imprimer);
    $('selecteur-classique').addEventListener('change', (e) => { if (e.target.files[0]) analyser(e.target.files[0]); });
    activerDepot();
    if (IC.memoireFichier.disponible()) {
      try {
        const poignee = await IC.memoireFichier.retrouver(CLE_MEMOIRE);
        if (poignee) preparerRecharger(poignee);
      } catch (e) { /* base locale indisponible */ }
    }
  }

  demarrer();
})();

// =============================================================================
// ecardioscope-ui.js — interface de l'outil interne : catalogue des études
// =============================================================================
// 1. Ouvre l'Excel des études (le navigateur s'en souvient : bouton « Recharger »).
// 2. Lit les réglages rangés dans l'Excel (sinon ceux intégrés à l'outil).
// 3. Affiche les études en cartes ou en tableau, avec recherche et filtres.
// 4. Fiche détaillée imprimable (tous les champs, contacts avec DECT).
// CONFIDENTIALITÉ : données internes. Aucun envoi, aucun stockage dans le navigateur
// (seule la « poignée » du fichier est retenue, pas son contenu). Rien n'est inventé :
// un champ vide n'apparaît pas.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const N = IC.normalisation;
  const DEPART = JSON.parse(document.getElementById('donnees-parametres').textContent);
  const CLE_MEMOIRE = 'excel-etudes'; // partagée avec le Publieur et l'outil Paramètres
  const $ = (id) => document.getElementById(id);

  let P = DEPART;
  let cat = null;               // résultat de IC.catalogue.preparer
  const etat = { texte: '', pole: '', pathologie: '', arc: '', statuts: [], masquees: false, vue: 'cartes', tri: 'nom', sens: 'asc' };
  let statutsParDefautPoses = false;

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined && e !== false) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }

  // --- Identité (paramètres) ------------------------------------------------------------

  function appliquerIdentite() {
    const nomOutil = (P.modules && P.modules.interne) || 'Outil interne';
    $('titre-outil').textContent = nomOutil + ' — catalogue des études';
    document.title = nomOutil + ' — catalogue';
    const attendu = $('nom-excel-attendu'); // disparaît une fois l'Excel lu (message remplacé)
    if (attendu) attendu.textContent = ((P.specialite && P.specialite.instance) || 'InnovaCare') + '_ETUDES.xlsx';
    for (const [nom, valeur] of Object.entries(P.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
  }

  // Couleur d'un statut : selon sa place dans la liste des paramètres (1er à venir, 2e ouvert…),
  // repérée par mots-clés génériques pour rester juste si la liste change d'ordre.
  function couleurStatut(statut) {
    const s = N.texteSimple(statut);
    if (/^ouvert/.test(s)) return ['var(--vert)', '#dff7e5'];
    if (/venir/.test(s)) return ['var(--or)', '#fff1d1'];
    if (/suspend/.test(s)) return ['var(--rose)', '#fde2ec'];
    return ['#9aa9ad', '#e9eef0'];
  }
  const badgeStatut = (statut) => {
    if (!statut) return el('span', { className: 'badge' }, 'statut non renseigné');
    const [, fondClair] = couleurStatut(statut);
    const b = el('span', { className: 'badge' }, statut);
    b.style.setProperty('--fond-statut', fondClair);
    return b;
  };

  // --- Lecture de l'Excel ----------------------------------------------------------------

  async function lireExcel(fichier) {
    if (!/\.xlsx$/i.test(fichier.name)) { $('etat').textContent = 'Ce fichier n\'est pas au format .xlsx.'; return; }
    $('etat').textContent = 'Lecture en cours…';
    try {
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, await fichier.arrayBuffer());
      const lus = IC.lecture.lireParametres(grilles);
      P = lus.parametres || DEPART;
      appliquerIdentite();
      const lu = IC.lecture.lireGabarit(grilles, P);
      if (lu.version === null || lu.version === undefined) {
        $('etat').textContent = 'Ce fichier n\'est pas l\'Excel harmonisé des études. L\'ancien Excel doit d\'abord passer par l\'outil Migration.';
        return;
      }
      cat = IC.catalogue.preparer(lu, P);
      const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      $('etat').textContent = '« ' + fichier.name + ' » lu à ' + heure + ' : ' + cat.etudes.length + ' études.'
        + (lus.parametres ? '' : ' (Réglages de départ de l\'outil : cet Excel ne contient pas encore les siens.)');
      preparerFiltres();
      $('catalogue').hidden = false;
      dessiner();
    } catch (erreur) {
      console.error(erreur);
      $('etat').textContent = 'Le fichier n\'a pas pu être lu (' + erreur.message + ').';
    }
  }

  function remplirSelect(select, valeurs, premier) {
    const garde = select.value;
    select.textContent = '';
    select.appendChild(el('option', { value: '' }, premier));
    for (const v of valeurs) select.appendChild(el('option', { value: v }, v));
    select.value = valeurs.includes(garde) ? garde : '';
  }

  function preparerFiltres() {
    remplirSelect($('filtre-pole'), cat.poles, 'Tous les pôles');
    const utilisees = new Set(cat.etudes.flatMap((e) => e.pathologies.map(N.texteSimple)));
    remplirSelect($('filtre-pathologie'), cat.pathologies.filter((p) => utilisees.has(N.texteSimple(p))), 'Toutes les pathologies');
    remplirSelect($('filtre-arc'), cat.arcs, 'Tous les ARC');
    // Par défaut : les études « ouvert » (premier statut qui commence par « ouvert »), un clic pour tout voir.
    if (!statutsParDefautPoses) {
      const ouvert = cat.statuts.find((s) => /^ouvert/.test(N.texteSimple(s)));
      etat.statuts = ouvert ? [ouvert] : [];
      statutsParDefautPoses = true;
    }
  }

  // --- Affichage -------------------------------------------------------------------------

  function criteres(sansStatut) {
    return {
      texte: etat.texte, poles: etat.pole ? [etat.pole] : [], pathologies: etat.pathologie ? [etat.pathologie] : [],
      arc: etat.arc, statuts: sansStatut ? [] : etat.statuts, masquees: etat.masquees,
    };
  }

  function dessinerPuces() {
    const zone = $('puces-statut');
    zone.textContent = '';
    const base = IC.catalogue.filtrer(cat.etudes, criteres(true));
    const n = IC.catalogue.compter(base, 'statut');
    const puce = (libelle, actif, action) => {
      const b = el('button', { type: 'button', className: 'puce' }, libelle);
      b.setAttribute('aria-pressed', String(actif));
      b.addEventListener('click', action);
      return b;
    };
    zone.appendChild(puce('Tous (' + base.length + ')', !etat.statuts.length, () => { etat.statuts = []; dessiner(); }));
    for (const s of cat.statuts) {
      const actif = etat.statuts.includes(s);
      zone.appendChild(puce(s + ' (' + (n[s] || 0) + ')', actif, () => {
        etat.statuts = actif ? etat.statuts.filter((x) => x !== s) : etat.statuts.concat(s);
        dessiner();
      }));
    }
    if (cat.masquees) {
      const caseM = el('input', { type: 'checkbox', checked: etat.masquees, id: 'case-masquees' });
      caseM.addEventListener('change', () => { etat.masquees = caseM.checked; dessiner(); });
      zone.appendChild(el('label', { className: 'case-masquees', htmlFor: 'case-masquees' }, caseM,
        'inclure les études non affichées dans l\'outil interne (' + cat.masquees + ')'));
    }
    const liste = IC.catalogue.filtrer(cat.etudes, criteres());
    zone.appendChild(el('span', { className: 'nombre-etudes' }, liste.length + ' étude' + (liste.length > 1 ? 's' : '')));
    return liste;
  }

  function ligneContact(c, prefixe) {
    if (!c) return null;
    const morceaux = [prefixe + c.nom];
    if (c.dect) morceaux.push('☎ ' + c.dect);
    if (!c.connu) morceaux.push('(hors annuaire)');
    return el('div', { className: 'contact' }, morceaux.join(' · '));
  }

  function jauge(r) {
    if (!r) return null;
    const texte = (r.recrutes !== null ? r.recrutes : '?') + ' / ' + (r.objectif !== null ? r.objectif : '?') + ' inclus' + (r.pourcentage !== null ? ' (' + r.pourcentage + ' %)' : '');
    const bloc = el('div', null, el('div', { className: 'jauge-texte' }, texte));
    if (r.pourcentage !== null) {
      const barre = el('span');
      barre.style.width = Math.min(100, r.pourcentage) + '%';
      bloc.appendChild(el('div', { className: 'jauge', role: 'img', ariaLabel: texte }, barre));
    }
    return bloc;
  }

  function carte(e) {
    const b = el('button', { type: 'button', className: 'carte-etude' });
    b.style.setProperty('--couleur-statut', couleurStatut(e.statut)[0]);
    b.appendChild(el('div', { className: 'tete' }, el('span', { className: 'nom' }, (e.enAvant ? '★ ' : '') + e.nom), badgeStatut(e.statut)));
    if (e.aRessaisir) b.appendChild(el('div', { className: 'alerte-ligne' }, '⚠ Colonne à ressaisir (décalée dans l\'ancien Excel)'));
    if (e.masquee) b.appendChild(el('div', { className: 'alerte-ligne' }, 'Non affichée dans l\'outil interne'));
    if (e.thematique) b.appendChild(el('div', { className: 'them' }, e.thematique));
    b.appendChild(el('div', { className: 'meta' }, [e.poleNom].concat(e.autresPoles).join(' · ')));
    if (e.pathologies.length) b.appendChild(el('div', { className: 'etiquettes' }, ...e.pathologies.map((p) => el('span', { className: 'etiquette' }, p))));
    for (const morceau of [ligneContact(e.contacts.investigateur, 'PI : '), ligneContact(e.contacts.arc_1, 'ARC : '), jauge(e.recrutement)]) {
      if (morceau) b.appendChild(morceau); // une information absente n'est pas affichée
    }
    b.addEventListener('click', () => ouvrirFiche(e));
    return b;
  }

  function tableau(liste) {
    const colonnes = [
      ['nom', 'Étude', (e) => (e.enAvant ? '★ ' : '') + e.nom + (e.aRessaisir ? ' ⚠' : '')],
      ['statut', 'Statut', (e) => e.statut],
      ['pole', 'Pôle', (e) => e.poleNom],
      [null, 'Thématique', (e) => e.thematique],
      [null, 'Investigateur', (e) => (e.contacts.investigateur ? e.contacts.investigateur.nom : '')],
      [null, 'ARC (DECT)', (e) => (e.contacts.arc_1 ? e.contacts.arc_1.nom + (e.contacts.arc_1.dect ? ' · ' + e.contacts.arc_1.dect : '') : '')],
      ['recrutement', 'Recrutés / objectif', (e) => (e.recrutement ? (e.recrutement.recrutes ?? '?') + ' / ' + (e.recrutement.objectif ?? '?') : '')],
      ['debut', 'Début', (e) => N.enTexte(e.valeurs.debut_inclusion)],
    ];
    const entete = el('tr');
    for (const [cle, titre] of colonnes) {
      if (!cle) { entete.appendChild(el('th', { scope: 'col' }, titre)); continue; }
      const fleche = etat.tri === cle ? (etat.sens === 'asc' ? ' ▲' : ' ▼') : '';
      const bouton = el('button', { type: 'button' }, titre + fleche);
      bouton.addEventListener('click', () => { etat.sens = etat.tri === cle && etat.sens === 'asc' ? 'desc' : 'asc'; etat.tri = cle; dessiner(); });
      const th = el('th', { scope: 'col' }, bouton);
      if (etat.tri === cle) th.setAttribute('aria-sort', etat.sens === 'asc' ? 'ascending' : 'descending');
      entete.appendChild(th);
    }
    const corps = el('tbody');
    for (const e of liste) {
      const tr = el('tr', { tabIndex: 0 });
      for (const [, , valeur] of colonnes) tr.appendChild(el('td', null, valeur(e) || ''));
      tr.addEventListener('click', () => ouvrirFiche(e));
      tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ouvrirFiche(e); });
      corps.appendChild(tr);
    }
    return el('div', { className: 'defilement' }, el('table', { className: 'tableau-etudes' }, el('thead', null, entete), corps));
  }

  function dessiner() {
    if (!cat) return;
    const liste = IC.catalogue.trier(dessinerPuces(), etat.tri, cat.statuts, etat.sens);
    const zone = $('resultats');
    zone.textContent = '';
    $('vue-cartes').setAttribute('aria-pressed', String(etat.vue === 'cartes'));
    $('vue-tableau').setAttribute('aria-pressed', String(etat.vue === 'tableau'));
    if (!liste.length) { zone.appendChild(el('p', { className: 'vide' }, 'Aucune étude ne correspond. Élargissez la recherche ou les filtres.')); return; }
    zone.appendChild(etat.vue === 'tableau' ? tableau(liste) : el('div', { className: 'grille-etudes' }, ...liste.map(carte)));
  }

  // --- Fiche détaillée ---------------------------------------------------------------------

  function ouvrirFiche(e) {
    $('fiche-titre').textContent = (e.enAvant ? '★ ' : '') + e.nom;
    const statut = $('fiche-statut');
    statut.textContent = '';
    statut.appendChild(badgeStatut(e.statut));
    const corps = $('fiche-corps');
    corps.textContent = '';
    corps.appendChild(el('p', { className: 'note' }, 'Onglet « ' + e.onglet + ' », colonne ' + e.colonne + ' de l\'Excel.'
      + (e.note ? ' Note : ' + e.note : '')));
    const r = jauge(e.recrutement);
    if (r) corps.appendChild(r);
    for (const bloc of IC.catalogue.fiche(e, P)) {
      corps.appendChild(el('h3', null, bloc.bloc));
      const dl = el('dl');
      for (const l of bloc.lignes) {
        dl.appendChild(el('dt', null, l.libelle, l.interne ? el('span', { className: 'interne', title: 'Information interne, jamais publiée' }, 'interne') : null));
        let texte = l.texte;
        if (l.contact) {
          const c = l.contact;
          texte = [c.nom, c.dect ? '☎ DECT ' + c.dect : '', c.email || '', c.connu ? '' : '(hors annuaire)'].filter(Boolean).join(' · ');
        }
        dl.appendChild(el('dd', null, texte));
      }
      corps.appendChild(dl);
    }
    const d = $('fiche');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    $('bouton-fermer').focus();
  }

  function fermerFiche() {
    const d = $('fiche');
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }

  function imprimer() {
    document.body.classList.add('impression-fiche');
    window.print();
    setTimeout(() => document.body.classList.remove('impression-fiche'), 500);
  }

  // --- Fichier mémorisé ------------------------------------------------------------------

  const retrouverPoignee = async () => (await IC.memoireFichier.retrouver(CLE_MEMOIRE)) || IC.memoireFichier.retrouver('publieur-excel');

  async function choisir() {
    if (!IC.memoireFichier.disponible()) { $('selecteur-excel').click(); return; }
    try {
      const choix = await IC.memoireFichier.choisir();
      if (!choix) return;
      try { await IC.memoireFichier.memoriser(CLE_MEMOIRE, choix.poignee); } catch (e) { /* pas grave */ }
      afficherRecharger(choix.poignee.name);
      await lireExcel(choix.fichier);
    } catch (erreur) { $('etat').textContent = 'Le sélecteur de fichier a échoué (' + erreur.name + ').'; }
  }

  function afficherRecharger(nom) {
    $('bouton-recharger').hidden = false;
    $('bouton-recharger').textContent = 'Recharger « ' + nom + ' »';
  }

  async function recharger() {
    try {
      const poignee = await retrouverPoignee();
      const fichier = poignee && await IC.memoireFichier.relire(poignee);
      if (fichier) await lireExcel(fichier); else $('etat').textContent = 'Autorisation refusée : choisissez de nouveau le fichier.';
    } catch (erreur) { $('etat').textContent = 'Le fichier mémorisé est introuvable : choisissez-le de nouveau.'; }
  }

  // --- Démarrage -------------------------------------------------------------------------

  async function demarrer() {
    appliquerIdentite();
    $('bouton-choisir').addEventListener('click', choisir);
    $('bouton-recharger').addEventListener('click', recharger);
    $('selecteur-excel').addEventListener('change', (e) => { if (e.target.files[0]) lireExcel(e.target.files[0]); });
    let minuterie = null;
    $('texte').addEventListener('input', (e) => { clearTimeout(minuterie); minuterie = setTimeout(() => { etat.texte = e.target.value; dessiner(); }, 120); });
    $('filtre-pole').addEventListener('change', (e) => { etat.pole = e.target.value; dessiner(); });
    $('filtre-pathologie').addEventListener('change', (e) => { etat.pathologie = e.target.value; dessiner(); });
    $('filtre-arc').addEventListener('change', (e) => { etat.arc = e.target.value; dessiner(); });
    $('vue-cartes').addEventListener('click', () => { etat.vue = 'cartes'; dessiner(); });
    $('vue-tableau').addEventListener('click', () => { etat.vue = 'tableau'; dessiner(); });
    $('bouton-fermer').addEventListener('click', fermerFiche);
    $('bouton-imprimer').addEventListener('click', imprimer);
    $('fiche').addEventListener('click', (e) => { if (e.target === $('fiche')) fermerFiche(); }); // clic hors de la fiche
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) lireExcel(e.dataTransfer.files[0]); });
    if (IC.memoireFichier.disponible()) {
      try { const p = await retrouverPoignee(); if (p) afficherRecharger(p.name); } catch (e) { /* base locale indisponible */ }
    }
  }

  demarrer();
})();

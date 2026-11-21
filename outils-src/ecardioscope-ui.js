// =============================================================================
// ecardioscope-ui.js — interface de l'outil interne : catalogue des études
// =============================================================================
// 1. Ouvre l'Excel des études (le navigateur s'en souvient : bouton « Recharger »).
// 2. Lit les réglages rangés dans l'Excel (sinon ceux intégrés à l'outil).
// 3. Onglet « Screening » : contexte clinique, puis seulement les critères utiles, résultats
//    en direct (moteur partagé src/eligibilite.js, logique d'e-CardioScope v4).
// 4. Onglet « Catalogue » : les études en cartes ou en tableau, avec recherche et filtres.
// 5. Onglet « Mémos » : mémo des études ouvertes au format validé (src/memos.js), à copier.
// 6. Fiche détaillée imprimable (tous les champs, contacts avec DECT).
// Les valeurs saisies pour un patient restent dans la page (variable « sc ») : jamais gardées.
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
  const E = IC.eligibilite;
  const sc = { contextes: new Set(), reponses: {}, tousLesContextes: true }; // screening en cours (patient) : mémoire de la page seulement
  let ongletCourant = 'screening';

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined && e !== false) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }

  // --- Identité (paramètres) ------------------------------------------------------------

  function appliquerIdentite() {
    const nomOutil = (P.modules && P.modules.interne) || 'Outil interne';
    $('titre-outil').textContent = nomOutil;
    document.title = nomOutil + ' — screening et catalogue';
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
      $('espace').hidden = false;
      dessiner();
      dessinerScreening();
      dessinerMemo();
      afficherOnglet(ongletCourant);
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

  // --- Onglets -----------------------------------------------------------------------------

  function afficherOnglet(nom) {
    ongletCourant = nom;
    for (const n of ['screening', 'catalogue', 'memos']) {
      $('onglet-' + n).setAttribute('aria-selected', String(n === nom));
      $(n).hidden = n !== nom;
    }
  }

  // --- Screening -----------------------------------------------------------------------------

  const filtresInternes = () => E.filtresDuModule(P, 'interne');
  const candidates = () => E.candidates(cat.etudes);
  const etudesDuContexte = () => E.selon(candidates(), [...sc.contextes]);
  const repondu = (v) => v !== undefined && v !== null && v !== '';

  function dessinerScreening() {
    if (!cat) return;
    // Un contexte qui n'existe plus (Excel modifié) est oublié.
    const existants = new Set(E.contextes(candidates(), P).flatMap((g) => g.pathologies.map((p) => p.nom)));
    for (const c of [...sc.contextes]) if (!existants.has(c)) sc.contextes.delete(c);
    dessinerContextes();
    dessinerFiltresScreening();
    mettreAJourScreening();
  }

  // Une fois un contexte choisi, la liste se replie (seuls les choisis restent) : les critères
  // du patient remontent à l'écran, sans défilement. « Ajouter ou changer » la déplie.
  function dessinerContextes() {
    const zone = $('contextes');
    zone.textContent = '';
    const replie = sc.contextes.size > 0 && !sc.tousLesContextes;
    if (replie) {
      const ligne = el('div', { className: 'groupe-contextes' });
      for (const nom of sc.contextes) {
        const b = el('button', { type: 'button', className: 'contexte', title: 'Retirer ce contexte' }, nom + ' ✕');
        b.setAttribute('aria-pressed', 'true');
        b.addEventListener('click', () => { sc.contextes.delete(nom); if (!sc.contextes.size) sc.tousLesContextes = true; dessinerContextes(); dessinerFiltresScreening(); mettreAJourScreening(); });
        ligne.appendChild(b);
      }
      const plus = el('button', { type: 'button', className: 'secondaire petit' }, 'Ajouter ou changer de contexte');
      plus.addEventListener('click', () => { sc.tousLesContextes = true; dessinerContextes(); });
      ligne.appendChild(plus);
      zone.appendChild(ligne);
      return;
    }
    if (sc.contextes.size) {
      const fin = el('button', { type: 'button', className: 'petit', style: 'margin-bottom:6px' }, 'Valider le contexte (' + sc.contextes.size + ')');
      fin.addEventListener('click', () => { sc.tousLesContextes = false; dessinerContextes(); });
      zone.appendChild(fin);
    }
    for (const g of E.contextes(candidates(), P)) {
      if (g.groupe) zone.appendChild(el('h4', null, (g.emoji ? g.emoji + ' ' : '') + g.groupe));
      const ligne = el('div', { className: 'groupe-contextes' });
      for (const p of g.pathologies) {
        const choisi = sc.contextes.has(p.nom);
        const b = el('button', { type: 'button', className: 'contexte', disabled: !p.nombre && !choisi },
          (p.emoji ? p.emoji + ' ' : '') + p.nom + ' ', el('small', null, '(' + p.nombre + ')'));
        b.setAttribute('aria-pressed', String(choisi));
        b.addEventListener('click', () => {
          const ajout = !sc.contextes.has(p.nom);
          if (ajout) sc.contextes.add(p.nom); else sc.contextes.delete(p.nom);
          // Premier choix : la liste se replie aussitôt (un seul clic pour le cas le plus courant).
          if (ajout && sc.contextes.size === 1) sc.tousLesContextes = false;
          dessinerContextes();
          dessinerFiltresScreening();
          mettreAJourScreening();
        });
        ligne.appendChild(b);
      }
      zone.appendChild(ligne);
    }
  }

  /** Une ligne par critère que fixe au moins une étude du contexte ; leur visibilité suit ensuite les réponses. */
  function dessinerFiltresScreening() {
    const zone = $('filtres-screening');
    zone.textContent = '';
    const etudes = etudesDuContexte();
    $('panneau-filtres').hidden = !etudes.length;
    if (!etudes.length) return;
    const tous = E.filtresUtiles(etudes, filtresInternes(), {}); // sans réponse : tout ce que fixe une étude
    const dejaRepondus = filtresInternes().filter((f) => repondu(sc.reponses[f.id]) && !tous.filtres.includes(f));
    const filtres = tous.filtres.concat(dejaRepondus);
    const bornes = filtres.filter((f) => f.type === 'bornes');
    const requis = filtres.filter((f) => f.type !== 'bornes' && f.famille !== 'traitement');
    const traitements = filtres.filter((f) => f.type !== 'bornes' && f.famille === 'traitement');
    for (const f of bornes) {
      const id = 'saisie-' + f.id;
      const champ = el('input', { type: 'number', id, step: 'any', inputMode: 'decimal', value: repondu(sc.reponses[f.id]) ? sc.reponses[f.id] : '' });
      champ.addEventListener('input', () => { sc.reponses[f.id] = champ.value === '' ? null : Number(champ.value); mettreAJourScreening(); });
      zone.appendChild(el('div', { className: 'champ-num', id: 'ligne-' + f.id }, el('label', { htmlFor: id }, f.libelle + (f.unite ? ' (' + f.unite + ')' : '')), champ));
    }
    const ouiNon = (id, libelle, sousTitre) => {
      const boutons = el('span', { className: 'oui-non', role: 'group', ariaLabel: libelle });
      for (const [valeur, texte] of [['oui', 'Oui'], ['non', 'Non']]) {
        const b = el('button', { type: 'button', className: valeur }, texte);
        b.setAttribute('aria-pressed', String(sc.reponses[id] === valeur));
        b.addEventListener('click', () => {
          sc.reponses[id] = sc.reponses[id] === valeur ? null : valeur; // second clic : on efface
          for (const x of boutons.children) x.setAttribute('aria-pressed', String(sc.reponses[id] === x.className));
          mettreAJourScreening();
        });
        boutons.appendChild(b);
      }
      return el('div', { className: 'ligne-oui-non', id: 'ligne-' + id }, el('span', null, libelle, sousTitre ? el('small', null, sousTitre) : null), boutons);
    };
    if (requis.length) zone.appendChild(el('h4', null, 'Antécédents et terrain'));
    for (const f of requis) zone.appendChild(ouiNon(f.id, f.libelle));
    if (traitements.length) zone.appendChild(el('h4', { id: 'titre-traitements' }, 'Traitements en cours'));
    for (const f of traitements) zone.appendChild(ouiNon(f.id, f.libelle, (f.dci || []).join(', ')));
    if (tous.questions.length) zone.appendChild(el('h4', { id: 'titre-questions' }, 'Questions propres aux études'));
    for (const q of tous.questions) zone.appendChild(ouiNon(q.id, q.libelle, q.etudes.join(', ')));
  }

  /** Recalcule les résultats et masque les critères devenus inutiles (sans redessiner les champs : la saisie continue). */
  function mettreAJourScreening() {
    const etudes = etudesDuContexte();
    const zone = $('resultats-screening');
    for (const n of [...zone.children]) if (n.id !== 't-resultats') n.remove();
    $('compte-collant').hidden = !etudes.length;
    if (!etudes.length) {
      zone.appendChild(el('p', { className: 'aide-screening' }, sc.contextes.size ? 'Aucune étude ouverte pour ce contexte.' : 'Choisissez un contexte clinique pour voir les études ouvertes.'));
      return;
    }
    const filtres = filtresInternes();
    const utiles = E.filtresUtiles(etudes, filtres, sc.reponses);
    const visibles = new Set(utiles.filtres.map((f) => f.id).concat(utiles.questions.map((q) => q.id)));
    for (const ligne of $('filtres-screening').querySelectorAll('[id^="ligne-"]')) ligne.hidden = !visibles.has(ligne.id.slice(6));
    for (const titre of $('filtres-screening').querySelectorAll('h4')) {
      let n = titre.nextElementSibling, visible = false;
      while (n && n.tagName !== 'H4') { if (!n.hidden) visible = true; n = n.nextElementSibling; }
      titre.hidden = !visible;
    }
    const evaluations = etudes.map((e) => ({ e, r: E.evaluer(e, filtres, sc.reponses) }));
    const retenues = IC.catalogue.trier(evaluations.filter((x) => x.r.eligible).map((x) => x.e), 'nom');
    const ecartees = evaluations.filter((x) => !x.r.eligible);
    const texte = retenues.length + ' étude' + (retenues.length > 1 ? 's' : '') + ' proposée' + (retenues.length > 1 ? 's' : '');
    zone.appendChild(el('div', { className: 'bandeau-compte' }, el('strong', null, texte), el('span', { className: 'aide-screening' }, 'sur ' + etudes.length + ' ouverte' + (etudes.length > 1 ? 's' : '') + ' dans ce contexte')));
    $('compte-collant-texte').textContent = texte;
    const parId = new Map(evaluations.map((x) => [x.e, x.r]));
    for (const e of retenues) zone.appendChild(carteResultat(e, parId.get(e)));
    if (!retenues.length) zone.appendChild(el('p', { className: 'vide' }, 'Aucune étude ne correspond aux réponses. Une valeur non renseignée n\'écarte jamais une étude.'));
    if (ecartees.length) {
      const d = el('details', null, el('summary', null, 'Études écartées (' + ecartees.length + ')'));
      const ul = el('ul');
      for (const x of ecartees) {
        const raisons = x.r.criteres.filter((c) => c.statut === 'exclu').map((c) => c.libelle + (c.id.startsWith('question:') ? ' : non' : ' : ' + c.seuil));
        ul.appendChild(el('li', null, x.e.nom + ' — ' + raisons.join(' ; ')));
      }
      d.appendChild(ul);
      zone.appendChild(d);
    }
  }

  function carteResultat(e, evaluation) {
    const v = e.valeurs;
    const carte = el('article', { className: 'carte-resultat' });
    carte.appendChild(el('h4', null, (e.enAvant ? '★ ' : '') + e.nom));
    if (e.thematique) carte.appendChild(el('div', { className: 'them' }, e.thematique));
    const science = [N.enTexte(v.intervention), N.enTexte(v.design)].filter(Boolean).join(' — ');
    if (science) carte.appendChild(el('div', null, science));
    const criteres = [1, 2, 3, 4, 5].map((n) => IC.memos.sansPuce(N.enTexte(v['inclusion_' + n]))).filter(Boolean);
    if (criteres.length) carte.appendChild(el('ul', null, ...criteres.map((c) => el('li', null, c))));
    const pastilles = evaluation.criteres.filter((c) => c.statut !== 'exclu').map((c) => {
      const libelle = c.id.startsWith('question:') ? c.libelle : c.libelle + ' ' + c.seuil;
      return el('span', { className: 'pastille' + (c.statut === 'ok' ? ' ok' : '') }, c.statut === 'ok' ? '✓ ' + libelle : libelle + ' — à vérifier');
    });
    if (pastilles.length) carte.appendChild(el('div', { className: 'pastilles' }, ...pastilles));
    for (const [id, prefixe] of [['arc_1', '📞 ARC : '], ['investigateur', 'PI : ']]) {
      const c = e.contacts[id];
      if (c) carte.appendChild(el('div', { className: 'contact' }, prefixe + [c.nom, c.dect ? 'DECT ' + c.dect : '', c.email || ''].filter(Boolean).join(' · ')));
    }
    const bouton = el('button', { type: 'button', className: 'secondaire petit' }, 'Fiche complète');
    bouton.addEventListener('click', () => ouvrirFiche(e));
    carte.appendChild(el('div', { className: 'actions' }, bouton));
    return carte;
  }

  function nouveauPatient() {
    sc.contextes.clear();
    sc.reponses = {};
    sc.tousLesContextes = true;
    dessinerScreening();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Mémos ---------------------------------------------------------------------------------

  let memoCourant = null;

  function dessinerMemo() {
    if (!cat) return;
    const choix = $('memo-section');
    const tout = IC.memos.construire(cat.etudes, P);
    const garde = choix.value;
    choix.textContent = '';
    choix.appendChild(el('option', { value: '' }, 'Tout le mémo'));
    for (const t of tout.sectionsDisponibles) choix.appendChild(el('option', { value: t }, t));
    choix.value = tout.sectionsDisponibles.includes(garde) ? garde : '';
    memoCourant = IC.memos.construire(cat.etudes, P, { section: choix.value, avecDect: !$('memo-sans-dect').checked });
    // Le HTML du mémo échappe tout le texte venu de l'Excel (src/memos.js) : il peut être affiché tel quel.
    $('apercu-memo').innerHTML = memoCourant.sections.length ? IC.memos.versHtml(memoCourant) : '<p>Aucune étude ouverte à afficher.</p>';
    const manques = IC.memos.aCompleter(memoCourant);
    const zone = $('memo-a-completer');
    zone.textContent = '';
    if (manques.length) {
      const d = el('details', { className: 'a-completer carte' }, el('summary', null, 'À compléter dans l\'Excel (' + manques.length + ')'));
      d.appendChild(el('ul', null, ...manques.map((x) => el('li', null, x.nom + ' (' + x.section + ') : ' + x.manque.join(' et ') + ' manquant'))));
      zone.appendChild(d);
    }
    $('message-memo').textContent = '';
  }

  /** Copie dans le presse-papiers ; à défaut, sélectionne l'aperçu et demande Ctrl+C. */
  async function copier(enHtml) {
    if (!memoCourant || !memoCourant.sections.length) return;
    const brut = IC.memos.versMarkdown(memoCourant);
    const message = $('message-memo');
    try {
      if (enHtml && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        const html = IC.memos.versHtml(memoCourant);
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([brut], { type: 'text/plain' }) })]);
      } else if (!enHtml && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(brut);
      } else { throw new Error('presse-papiers indisponible'); }
      message.textContent = enHtml ? '✔ Copié : collez-le dans un nouveau message (Ctrl+V).' : '✔ Texte brut copié.';
    } catch (erreur) {
      if (enHtml) {
        const zone = $('apercu-memo');
        const plage = document.createRange();
        plage.selectNodeContents(zone);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(plage);
        const ok = document.execCommand && document.execCommand('copy');
        message.textContent = ok ? '✔ Copié : collez-le dans un nouveau message (Ctrl+V).' : 'Le mémo est sélectionné : faites Ctrl+C, puis collez-le dans votre message.';
      } else {
        const t = el('textarea', { value: brut, readOnly: true });
        document.body.appendChild(t);
        t.select();
        const ok = document.execCommand && document.execCommand('copy');
        t.remove();
        message.textContent = ok ? '✔ Texte brut copié.' : 'La copie automatique est refusée par le navigateur : utilisez « Copier pour un mail ».';
      }
    }
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
    $('onglet-screening').addEventListener('click', () => afficherOnglet('screening'));
    $('onglet-catalogue').addEventListener('click', () => afficherOnglet('catalogue'));
    $('bouton-nouveau').addEventListener('click', nouveauPatient);
    $('onglet-memos').addEventListener('click', () => afficherOnglet('memos'));
    $('memo-section').addEventListener('change', dessinerMemo);
    $('memo-sans-dect').addEventListener('change', dessinerMemo);
    $('bouton-copier-mail').addEventListener('click', () => copier(true));
    $('bouton-copier-brut').addEventListener('click', () => copier(false));
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

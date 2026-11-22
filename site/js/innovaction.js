// =============================================================================
// innovaction.js — pages pour les médecins libéraux (cahier des charges § 6.3)
// =============================================================================
// Lit les fichiers PUBLICS (donnees/protocoles.json, donnees/parametres.json) : études
// publiées pour les libéraux et au statut « ouvert ». Navigation par pathologie, recherche,
// profil du patient (même moteur que l'outil interne : js/commun/eligibilite.js), fiche,
// et « Adresser un patient » vers la messagerie sécurisée (MSSanté) de l'investigateur.
// Aucun cookie, aucun formulaire qui envoie : ce qui est saisi reste dans la page.
// Toutes les valeurs sont insérées comme du texte (jamais interprétées comme du HTML).
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const T = IC.texte, E = IC.eligibilite, PU = IC.public;
  const $ = (id) => document.getElementById(id);
  const MODULE = 'professionnel';

  let P = null;
  let etudes = [];                       // études ouvertes publiées pour les libéraux
  const choix = { pathologies: new Set(), texte: '', reponses: {} };
  const ouvertes = new Set();            // fiches et encarts d'adressage dépliés (identifiants)

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined && e !== false) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }
  const sansPuce = (t) => t.replace(/^\s*[-–•*]\s*/, '');
  const repondu = (v) => v !== undefined && v !== null && v !== '';

  async function lireJson(chemin) {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) throw new Error(chemin + ' : code ' + reponse.status);
    return reponse.json();
  }

  // --- Navigation par pathologie ----------------------------------------------------------

  function dessinerTuiles() {
    const zone = $('tuiles');
    zone.textContent = '';
    for (const g of E.contextes(etudes, P)) {
      if (!g.pathologies.some((p) => p.nombre)) continue;
      if (g.groupe) zone.appendChild(el('h3', null, (g.emoji ? g.emoji + ' ' : '') + g.groupe));
      const ligne = el('div', { className: 'groupe' });
      for (const p of g.pathologies) {
        if (!p.nombre) continue;
        const b = el('button', { type: 'button', className: 'tuile' }, (p.emoji ? p.emoji + ' ' : '') + p.nom + ' (' + p.nombre + ')');
        b.setAttribute('aria-pressed', String(choix.pathologies.has(p.nom)));
        b.addEventListener('click', () => {
          if (choix.pathologies.has(p.nom)) choix.pathologies.delete(p.nom); else choix.pathologies.add(p.nom);
          b.setAttribute('aria-pressed', String(choix.pathologies.has(p.nom)));
          dessinerFiltres();
          mettreAJour();
        });
        ligne.appendChild(b);
      }
      zone.appendChild(ligne);
    }
  }

  const selection = () => {
    const parPathologie = choix.pathologies.size ? E.selon(etudes, [...choix.pathologies]) : etudes;
    return PU.rechercher(parPathologie, choix.texte);
  };

  // --- Profil du patient ----------------------------------------------------------------------

  function dessinerFiltres() {
    const zone = $('filtres');
    zone.textContent = '';
    const filtres = E.filtresDuModule(P, MODULE);
    const tous = E.filtresUtiles(selection(), filtres, {});
    const liste = tous.filtres.concat(filtres.filter((f) => repondu(choix.reponses[f.id]) && !tous.filtres.includes(f)));
    for (const f of liste.filter((x) => x.type === 'bornes')) {
      const id = 'saisie-' + f.id;
      const champ = el('input', { type: 'number', id, step: 'any', inputMode: 'decimal', value: repondu(choix.reponses[f.id]) ? choix.reponses[f.id] : '' });
      champ.addEventListener('input', () => { choix.reponses[f.id] = champ.value === '' ? null : Number(champ.value); mettreAJour(); });
      zone.appendChild(el('div', { className: 'champ-num', id: 'ligne-' + f.id }, el('label', { htmlFor: id }, f.libelle + (f.unite ? ' (' + f.unite + ')' : '')), champ));
    }
    const ouiNon = (id, libelle, sousTitre) => {
      const groupe = el('span', { className: 'oui-non', role: 'group', ariaLabel: libelle });
      for (const [valeur, texte] of [['oui', 'Oui'], ['non', 'Non']]) {
        const b = el('button', { type: 'button', value: valeur }, texte);
        b.setAttribute('aria-pressed', String(choix.reponses[id] === valeur));
        b.addEventListener('click', () => {
          choix.reponses[id] = choix.reponses[id] === valeur ? null : valeur;
          for (const x of groupe.children) x.setAttribute('aria-pressed', String(choix.reponses[id] === x.value));
          mettreAJour();
        });
        groupe.appendChild(b);
      }
      return el('div', { className: 'ligne-oui-non', id: 'ligne-' + id }, el('span', null, libelle, sousTitre ? el('small', null, sousTitre) : null), groupe);
    };
    for (const f of liste.filter((x) => x.type !== 'bornes')) zone.appendChild(ouiNon(f.id, f.libelle, (f.dci || []).join(', ')));
    for (const q of tous.questions) zone.appendChild(ouiNon(q.id, q.libelle, q.etudes.join(', ')));
    if (!zone.children.length) zone.appendChild(el('p', { className: 'note' }, 'Aucun critère chiffré pour ces études.'));
  }

  // --- Résultats -------------------------------------------------------------------------------

  function mettreAJour() {
    const filtres = E.filtresDuModule(P, MODULE);
    const base = selection();
    const utiles = E.filtresUtiles(base, filtres, choix.reponses);
    const visibles = new Set(utiles.filtres.map((f) => f.id).concat(utiles.questions.map((q) => q.id)));
    for (const ligne of $('filtres').querySelectorAll('[id^="ligne-"]')) ligne.hidden = !visibles.has(ligne.id.slice(6));
    const retenues = base.map((e) => ({ e, r: E.evaluer(e, filtres, choix.reponses) })).filter((x) => x.r.eligible);
    $('compte').textContent = retenues.length + ' étude' + (retenues.length > 1 ? 's' : '') + ' ouverte' + (retenues.length > 1 ? 's' : '')
      + (retenues.length < etudes.length ? ' (sur ' + etudes.length + ')' : '');
    const liste = $('liste');
    liste.textContent = '';
    for (const x of retenues) liste.appendChild(carte(x.e, x.r));
    if (!retenues.length) liste.appendChild(el('p', { className: 'note' }, 'Aucune étude ne correspond. Élargissez la recherche ou le profil.'));
  }

  function lignes(dl, couples) {
    for (const [libelle, valeur] of couples) if (valeur) dl.appendChild(el('dt', null, libelle)), dl.appendChild(el('dd', null, valeur));
    return dl;
  }

  function carte(e, evaluation) {
    const v = e.valeurs;
    const textes = (P.textes && P.textes.site) || {};
    const article = el('article', { className: 'etude', id: 'etude-' + e.id });
    article.appendChild(el('h3', null, e.nom));
    if (e.thematique) article.appendChild(el('p', { className: 'thematique' }, e.thematique));
    const meta = [T.enTexte(v.phase) ? 'Phase : ' + T.enTexte(v.phase) : '', T.enTexte(v.promoteur), e.poleNom].filter(Boolean).join(' · ');
    if (meta) article.appendChild(el('p', { className: 'meta' }, meta));
    const science = [T.enTexte(v.intervention), T.enTexte(v.design)].filter(Boolean).join(' — ');
    if (science) article.appendChild(el('p', null, science));
    const criteres = [1, 2, 3, 4, 5].map((n) => sansPuce(T.enTexte(v['inclusion_' + n]))).filter(Boolean);
    if (criteres.length) article.appendChild(el('ul', { className: 'criteres' }, ...criteres.map((c) => el('li', null, c))));
    const pastilles = evaluation.criteres.filter((c) => c.statut !== 'exclu' && (c.statut === 'ok' || Object.keys(choix.reponses).some((k) => repondu(choix.reponses[k]))))
      .map((c) => el('span', { className: 'pastille' + (c.statut === 'ok' ? ' ok' : '') }, (c.statut === 'ok' ? '✓ ' : '') + (c.id.startsWith('question:') ? c.libelle : c.libelle + ' ' + c.seuil) + (c.statut === 'ok' ? '' : ' — à vérifier')));
    if (pastilles.length) article.appendChild(el('div', { className: 'pastilles' }, ...pastilles));
    const pi = e.contacts.investigateur;
    article.appendChild(lignes(el('dl'), [
      ['Investigateur principal', pi ? pi.nom : ''],
      [textes.mise_a_jour || 'Mise à jour', PU.dateFr(e.maj)],
    ]));

    const actions = el('div', { className: 'actions' });
    const boutonFiche = el('button', { type: 'button', className: 'bouton' }, ouvertes.has('fiche-' + e.id) ? 'Masquer la fiche' : 'Fiche détaillée');
    boutonFiche.setAttribute('aria-expanded', String(ouvertes.has('fiche-' + e.id)));
    boutonFiche.addEventListener('click', () => { basculer('fiche-' + e.id); });
    actions.appendChild(boutonFiche);
    const adr = PU.adressage(e, P);
    if (adr) {
      const boutonAdr = el('button', { type: 'button', className: 'bouton principal' }, 'Adresser un patient');
      boutonAdr.setAttribute('aria-expanded', String(ouvertes.has('adr-' + e.id)));
      boutonAdr.addEventListener('click', () => { basculer('adr-' + e.id); });
      actions.appendChild(boutonAdr);
    }
    article.appendChild(actions);
    if (ouvertes.has('fiche-' + e.id)) article.appendChild(fiche(e));
    if (adr && ouvertes.has('adr-' + e.id)) article.appendChild(encartAdressage(adr));
    return article;
  }

  function basculer(cle) {
    if (ouvertes.has(cle)) ouvertes.delete(cle); else ouvertes.add(cle);
    mettreAJour();
  }

  function fiche(e) {
    const v = e.valeurs;
    const date = (x) => PU.dateFr(x);
    return el('div', { className: 'encart' }, lignes(el('dl'), [
      ['Titre', T.enTexte(v.titre)],
      ['Promoteur', T.enTexte(v.promoteur)],
      ['Coordinateur', T.enTexte(v.coordinateur)],
      ['Phase', T.enTexte(v.phase)],
      ['N° d\'enregistrement', T.enTexte(v.registre)],
      ['Pathologies', e.pathologies.join(', ')],
      ['Intervention', T.enTexte(v.intervention)],
      ['Design', T.enTexte(v.design)],
      ['Début d\'inclusion', date(v.debut_inclusion)],
      ['Fin de recrutement prévue', date(v.fin_recrutement)],
      ['Durée de suivi', T.enTexte(v.duree_suivi)],
      ['Rythme des visites', T.enTexte(v.rythme_visites)],
      ['Co-investigateur(s)', T.enTexte(v.co_investigateurs)],
    ]));
  }

  function encartAdressage(adr) {
    const message = el('span', { className: 'message-copie', ariaLive: 'polite' });
    const copier = async (texte, quoi) => {
      try { await navigator.clipboard.writeText(texte); message.textContent = '✔ ' + quoi + ' copié.'; }
      catch (err) { message.textContent = 'Copie refusée par le navigateur : sélectionnez le texte puis Ctrl+C.'; }
    };
    const actions = el('div', { className: 'actions' },
      el('a', { className: 'bouton principal', href: adr.mailto }, 'Ouvrir ma messagerie'));
    const bAdresse = el('button', { type: 'button', className: 'bouton' }, 'Copier l\'adresse');
    bAdresse.addEventListener('click', () => copier(adr.mssante, 'Adresse'));
    actions.appendChild(bAdresse);
    if (adr.corps) {
      const bMessage = el('button', { type: 'button', className: 'bouton' }, 'Copier le message');
      bMessage.addEventListener('click', () => copier((adr.objet ? adr.objet + '\n\n' : '') + adr.corps, 'Message'));
      actions.appendChild(bMessage);
    }
    actions.appendChild(message);
    return el('div', { className: 'encart' },
      el('p', null, 'Adressage à l\'investigateur principal, ' + adr.nom + ', par messagerie sécurisée de santé :'),
      el('p', null, el('strong', null, adr.mssante)),
      adr.objet ? el('p', { className: 'note' }, 'Objet : ' + adr.objet) : null,
      actions,
      el('p', { className: 'note' }, '« Ouvrir ma messagerie » ne fonctionne que si votre messagerie sécurisée est l\'application de messagerie par défaut ; sinon, copiez l\'adresse. Aucune donnée patient ne transite par ce site.'));
  }

  // --- Démarrage ------------------------------------------------------------------------------

  async function demarrer() {
    try {
      const [parametres, donnees] = await Promise.all([lireJson('../donnees/parametres.json'), lireJson('../donnees/protocoles.json')]);
      P = parametres;
      for (const [nom, valeur] of Object.entries(P.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textes = (P.textes && P.textes.site) || {};
      const nomModule = (P.modules && P.modules.professionnel) || 'Études cliniques';
      document.title = nomModule + ' — ' + (textes.titre_liste || 'études ouvertes');
      $('titre').textContent = nomModule;
      $('sous-titre').textContent = textes.titre_liste || '';
      if (P.publication && P.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textes.bandeau_test || 'Version de test'; }
      // Avertissement propre aux professionnels (outil Paramètres → Publication) ; vide = rien.
      $('avertissement').textContent = textes.avertissement_pro || '';
      $('genere').textContent = donnees.genere_le ? 'Données publiées le ' + PU.dateFr(donnees.genere_le) + '.' : '';
      etudes = E.candidates(PU.preparer(donnees, P, MODULE));
      if (!etudes.length) { $('etat').textContent = textes.aucune_etude || 'Aucune étude publiée pour le moment.'; return; }
      $('etat').hidden = true;
      $('contenu').hidden = false;
      dessinerTuiles();
      dessinerFiltres();
      mettreAJour();
      let minuterie = null;
      $('recherche').addEventListener('input', (ev) => { clearTimeout(minuterie); minuterie = setTimeout(() => { choix.texte = ev.target.value; dessinerFiltres(); mettreAJour(); }, 150); });
      $('effacer-profil').addEventListener('click', () => { choix.reponses = {}; dessinerFiltres(); mettreAJour(); });
      // Lien direct vers une étude (depuis « Nouveautés ») : …/innovaction/#etude-identifiant
      const cible = decodeURIComponent((location.hash || '').replace(/^#etude-/, ''));
      if (cible && etudes.some((x) => x.id === cible)) {
        ouvertes.add('fiche-' + cible);
        mettreAJour();
        const noeud = document.getElementById('etude-' + cible);
        if (noeud) noeud.scrollIntoView();
      }
    } catch (erreur) {
      $('etat').textContent = 'Les données n\'ont pas pu être chargées (' + erreur.message + ').';
    }
  }

  demarrer();
})();

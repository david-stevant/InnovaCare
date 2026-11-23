// =============================================================================
// innovacteur.js — page patients (cahier des charges § 6.4), base InnovaCoeur v2
// =============================================================================
// Page éditoriale, puis test en 3 étapes : situation (vignettes), précisions (seulement les
// questions utiles), résultats (phrase patient, détails pratiques, contact de l'équipe).
// Tous les textes viennent de parametres.json (repris mot pour mot de la v2) ; les études du
// fichier public protocoles.json. RÈGLE N° 1 : ce que le patient saisit (âge, poids, nom, date
// de naissance…) reste dans cette page — aucun stockage, aucun cookie, rien d'envoyé. Le message
// à l'équipe est envoyé par le patient lui-même, depuis sa messagerie.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const E = IC.eligibilite, PU = IC.public;
  const $ = (id) => document.getElementById(id);

  let P = null, TP = {};                 // paramètres, textes patient
  let etudes = [];                       // études ouvertes publiées pour les patients
  const choix = { vignettes: new Set(), saisies: {} };
  let etudeMessage = null;

  // --- Mascotte : un petit cœur souriant, dessiné ici (aucune image extérieure) ------------------
  // Ses phrases viennent des paramètres (textes.patient.mascotte_*) ; à défaut, ces textes de départ
  // s'affichent [à confirmer par le porteur du projet].
  const BULLES_DEPART = {
    accueil: 'Bonjour ! Je vous accompagne pendant le test. Il ne prend qu\'une minute.',
    etape1: 'Quelle est votre situation ? Vous pouvez en choisir plusieurs.',
    etape2: 'Encore quelques questions. Toutes sont facultatives.',
    resultats: 'Bonne nouvelle : des études pourraient vous correspondre !',
    aucun: 'Pas d\'étude pour le moment, mais la recherche avance vite !',
  };
  const bulle = (cle) => TP['mascotte_' + cle] || BULLES_DEPART[cle];

  function creerMascotte() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'mascotte');
    svg.setAttribute('focusable', 'false');
    // Deux moitiés de cœur aux couleurs des paramètres (comme le logo d'InnovaCoeur v2), un visage.
    svg.innerHTML = '<g class="mascotte-corps">'
      + '<path d="M60 104 C60 104 13 74 13 40 C13 23 26 12 40 12 C50 12 57 18 60 27" fill="var(--turquoise)"/>'
      + '<path d="M60 104 C60 104 107 74 107 40 C107 23 94 12 80 12 C70 12 63 18 60 27" fill="var(--rose, #ef4d89)"/>'
      + '<circle class="oeil" cx="45" cy="50" r="6" fill="#17313a"/><circle class="oeil" cx="75" cy="50" r="6" fill="#17313a"/>'
      + '<circle cx="47" cy="48" r="2" fill="#fff"/><circle cx="77" cy="48" r="2" fill="#fff"/>'
      + '<circle cx="36" cy="64" r="5" fill="#fff" opacity=".35"/><circle cx="84" cy="64" r="5" fill="#fff" opacity=".35"/>'
      + '<path class="bouche" d="M47 66 Q60 78 73 66" stroke="#17313a" stroke-width="4" fill="none" stroke-linecap="round"/>'
      + '</g>';
    return svg;
  }

  /** Change l'humeur de la mascotte (salue, ecoute, joie, encourage) et sa bulle. */
  function guide(humeur, texteBulle) {
    for (const id of ['mascotte-edito', 'mascotte-test']) $(id).dataset.humeur = humeur;
    if (texteBulle !== undefined) bulleTexte($('bulle-test'), texteBulle);
  }

  /** Texte d'une bulle, précédé pour les lecteurs d'écran de « La mascotte dit : ». */
  function bulleTexte(noeud, valeur) {
    noeud.textContent = '';
    noeud.appendChild(el('span', { className: 'visuellement-cache' }, 'La mascotte dit : '));
    noeud.appendChild(document.createTextNode(valeur || ''));
  }

  /** Petit sursaut de la mascotte quand le patient répond. */
  function reagir() {
    const boite = $('mascotte-test');
    boite.classList.remove('reagit');
    void boite.offsetWidth; // relance l'animation
    boite.classList.add('reagit');
  }

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const e of enfants) if (e !== null && e !== undefined && e !== false) noeud.appendChild(typeof e === 'string' ? document.createTextNode(e) : e);
    return noeud;
  }
  const texte = (id, valeur) => { $(id).textContent = valeur || ''; };

  async function lireJson(chemin) {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) throw new Error(chemin + ' : code ' + reponse.status);
    return reponse.json();
  }

  // --- Page éditoriale --------------------------------------------------------------------

  function dessinerEdito() {
    texte('p-bandeau', TP.bandeau);
    texte('p-titre', TP.titre);
    texte('p-accroche', TP.accroche);
    bulleTexte($('bulle-edito'), bulle('accueil'));
    for (const ligne of [].concat(TP.sous_titre || [])) $('p-sous-titre').appendChild(el('p', { className: 'heros-sous-titre' }, ligne));
    texte('p-edito-titre', TP.edito_titre);
    texte('p-edito-texte', TP.edito_texte);
    for (const b of TP.benefices || []) $('p-benefices').appendChild(el('div', { className: 'benefice' }, el('div', { className: 'benefice-emoji', ariaHidden: 'true' }, b.emoji || ''), el('h3', null, b.titre || ''), el('p', null, b.texte || '')));
    for (const t of TP.temoignages || []) $('p-temoignages').appendChild(el('blockquote', { className: 'temoignage' }, el('p', null, '« ' + (t.texte || '') + ' »'), el('footer', null, '— ' + (t.auteur || ''))));
    texte('p-appel-titre', TP.appel_titre);
    texte('p-appel-texte', TP.appel_texte);
    $('bouton-test').textContent = (TP.appel_bouton || 'Faites le test') + (TP.appel_duree ? ' (' + TP.appel_duree + ')' : '');
  }

  // --- Navigation entre les étapes -------------------------------------------------------------

  function montrer(n) {
    $('edito').hidden = n !== 0;
    $('test').hidden = n === 0;
    for (const i of [1, 2, 3]) {
      $('etape-' + i).hidden = i !== n;
      $('pt-' + i).className = i === n ? 'actif' : i < n ? 'fait' : '';
    }
    // Transition douce (désactivée en CSS si le téléphone demande de réduire les animations).
    const visible = n === 0 ? $('edito') : $('etape-' + n);
    visible.classList.remove('apparition');
    void visible.offsetWidth;
    visible.classList.add('apparition');
    if (n) $('etape-texte').textContent = 'Étape ' + n + ' sur 3';
    if (n === 0) guide('salue');
    if (n === 1) guide('salue', bulle('etape1'));
    if (n === 2) guide('ecoute', bulle('etape2'));
    window.scrollTo(0, 0);
    const titre = n === 0 ? $('p-titre') : $('etape-' + n).querySelector('h2');
    if (titre) { titre.tabIndex = -1; titre.focus({ preventScroll: true }); }
  }

  // --- Étape 1 : vignettes -------------------------------------------------------------------

  function dessinerVignettes() {
    texte('p-etape1-titre', TP.etape1_titre);
    texte('p-etape1-texte', TP.etape1_texte);
    const zone = $('vignettes');
    zone.textContent = '';
    for (const v of PU.vignettes(etudes, P)) {
      const b = el('button', { type: 'button', className: 'vignette' },
        el('span', { className: 'vignette-emoji', ariaHidden: 'true' }, v.emoji),
        el('span', null, el('strong', null, v.nom), v.description ? el('small', null, v.description) : null));
      b.setAttribute('aria-pressed', String(choix.vignettes.has(v.nom)));
      b.addEventListener('click', () => {
        if (choix.vignettes.has(v.nom)) choix.vignettes.delete(v.nom); else choix.vignettes.add(v.nom);
        b.setAttribute('aria-pressed', String(choix.vignettes.has(v.nom)));
        $('vers-2').disabled = !choix.vignettes.size;
        reagir();
      });
      zone.appendChild(b);
    }
    $('vers-2').disabled = !choix.vignettes.size;
  }

  const etudesChoisies = () => PU.selonVignettes(etudes, [...choix.vignettes]);

  // --- Étape 2 : questions utiles ----------------------------------------------------------------

  function dessinerQuestions() {
    texte('p-etape2-titre', TP.etape2_titre);
    texte('p-etape2-texte', TP.etape2_texte);
    $('vers-3').textContent = '🔍 ' + (TP.bouton_resultats || 'Voir les résultats');
    const zone = $('questions');
    zone.textContent = '';
    const questions = PU.questionsPatient(P);
    const filtres = questions.map((q) => q.filtre);
    const utiles = new Set(E.filtresUtiles(etudesChoisies(), filtres, {}).filtres.map((f) => f.id));
    const cases = [];
    for (const { filtre: f, forme } of questions) {
      if (!utiles.has(f.id)) continue;
      if (forme === 'case') { cases.push(f); continue; }
      const bloc = el('fieldset', { className: 'question' }, el('legend', null, (f.emoji ? f.emoji + ' ' : '') + f.question_patient, f.aide_patient ? el('small', null, ' (' + f.aide_patient + ')') : null));
      if (forme === 'nombre_nsp') {
        // Le patient tape sa valeur s'il la connaît, sinon « Je ne sais pas » (n'écarte aucune étude).
        const champ = el('input', { type: 'number', inputMode: 'decimal', id: 'q-' + f.id, value: choix.saisies[f.id] && choix.saisies[f.id] !== 'nsp' ? choix.saisies[f.id] : '' });
        const nsp = el('button', { type: 'button', className: 'bouton-nsp' }, 'Je ne sais pas');
        nsp.setAttribute('aria-pressed', String(choix.saisies[f.id] === 'nsp'));
        champ.addEventListener('input', () => { choix.saisies[f.id] = champ.value; nsp.setAttribute('aria-pressed', 'false'); });
        nsp.addEventListener('click', () => {
          const actif = choix.saisies[f.id] !== 'nsp';
          choix.saisies[f.id] = actif ? 'nsp' : '';
          if (actif) champ.value = '';
          nsp.setAttribute('aria-pressed', String(actif));
          reagir();
        });
        bloc.appendChild(el('div', { className: 'choix' }, el('label', { className: 'ligne-saisie', htmlFor: 'q-' + f.id }, champ, ' ' + (f.unite_patient || f.unite || '')), nsp));
      } else if (forme === 'nombre') {
        const champ = el('input', { type: 'number', inputMode: 'numeric', id: 'q-' + f.id, value: choix.saisies[f.id] || '' });
        champ.addEventListener('input', () => { choix.saisies[f.id] = champ.value; });
        bloc.appendChild(el('label', { className: 'ligne-saisie', htmlFor: 'q-' + f.id }, champ, ' ' + (f.unite_patient || f.unite || '')));
      } else if (forme === 'taille_poids') {
        const imc = el('span', { className: 'imc', ariaLive: 'polite' });
        const majImc = () => { const v = PU.calculerImc(choix.saisies[f.id + '_taille'], choix.saisies[f.id + '_poids']); imc.textContent = v === null ? '' : 'IMC : ' + String(v).replace('.', ','); };
        for (const [suffixe, unite, aide] of [['_taille', 'cm', 'Taille'], ['_poids', 'kg', 'Poids']]) {
          const champ = el('input', { type: 'number', inputMode: 'numeric', id: 'q-' + f.id + suffixe, value: choix.saisies[f.id + suffixe] || '' });
          champ.addEventListener('input', () => { choix.saisies[f.id + suffixe] = champ.value; majImc(); });
          bloc.appendChild(el('label', { className: 'ligne-saisie', htmlFor: champ.id }, aide + ' ', champ, ' ' + unite));
        }
        bloc.appendChild(imc);
        majImc();
      } else {
        const reponses = forme === 'choix' ? f.reponses_patient : [{ valeur: 'oui', libelle: 'Oui' }, { valeur: 'non', libelle: 'Non' }];
        const groupe = el('div', { className: 'choix' });
        for (const r of reponses) {
          const b = el('button', { type: 'button', value: r.valeur }, r.libelle);
          b.setAttribute('aria-pressed', String(choix.saisies[f.id] === r.valeur));
          b.addEventListener('click', () => {
            choix.saisies[f.id] = choix.saisies[f.id] === r.valeur ? null : r.valeur;
            for (const x of groupe.children) x.setAttribute('aria-pressed', String(choix.saisies[f.id] === x.value));
            reagir();
          });
          groupe.appendChild(b);
        }
        bloc.appendChild(groupe);
      }
      zone.appendChild(bloc);
    }
    if (cases.length) {
      const bloc = el('fieldset', { className: 'question' }, el('legend', null, '💊 Traitements actuels', el('small', null, ' (cochez ceux que vous prenez)')));
      for (const f of cases) {
        const c = el('input', { type: 'checkbox', checked: choix.saisies[f.id] === true });
        c.addEventListener('change', () => { choix.saisies[f.id] = c.checked; reagir(); });
        bloc.appendChild(el('label', { className: 'case' }, c, ' ' + f.libelle_patient));
      }
      zone.appendChild(bloc);
    }
    if (!zone.children.length) zone.appendChild(el('p', { className: 'grand' }, 'Aucune précision n\'est nécessaire pour cette situation.'));
  }

  // --- Étape 3 : résultats --------------------------------------------------------------------

  function dessinerResultats() {
    const zone = $('resultats');
    zone.textContent = '';
    $('recommencer').textContent = TP.bouton_recommencer || 'Recommencer le test';
    const filtres = PU.questionsPatient(P).map((q) => q.filtre);
    const reponses = PU.reponsesPatient(choix.saisies, P);
    const retenues = etudesChoisies().filter((e) => E.evaluer(e, filtres, reponses).eligible);
    guide(retenues.length ? 'joie' : 'encourage', bulle(retenues.length ? 'resultats' : 'aucun'));
    IC.audience.compter(P, 'test-termine'); // seulement le fait qu'un test a été fait, rien de ce qui a été saisi
    if (!retenues.length) {
      zone.appendChild(el('div', { className: 'aucun' }, el('div', { className: 'grand-emoji', ariaHidden: 'true' }, '🌟'),
        el('h2', null, TP.aucun_resultat_titre || ''), el('p', { className: 'grand' }, TP.aucun_resultat_texte || ''), el('p', null, TP.aucun_resultat_conseil || '')));
      return;
    }
    zone.appendChild(el('p', { className: 'compte-patient' }, el('strong', null, String(retenues.length)), ' ' + (retenues.length > 1 ? 'études pourraient' : 'étude pourrait') + ' correspondre à votre situation'));
    for (const e of retenues) {
      const v = e.valeurs;
      const carte = el('article', { className: 'resultat-patient' }, el('h3', null, '🔬 ' + e.nom));
      if (v.phrase_patient) carte.appendChild(el('p', { className: 'grand' }, String(v.phrase_patient)));
      if (v.details_pratiques) carte.appendChild(el('p', { className: 'en-pratique' }, el('strong', null, (TP.resultat_en_pratique || 'En pratique :') + ' '), String(v.details_pratiques)));
      const actions = el('div', { className: 'actions' });
      if (PU.messagePatient(e, P).destinataire) {
        const b = el('button', { type: 'button', className: 'gros-bouton' }, '✉️ ' + (TP.resultat_bouton_contact || 'Contacter l\'équipe de recherche'));
        b.addEventListener('click', () => { IC.audience.compter(P, 'contacter-equipe'); ouvrirMessage(e); });
        actions.appendChild(b);
      }
      actions.appendChild(el('p', { className: 'conseil' }, '👨‍⚕️ ' + (TP.resultat_bouton_cardiologue || 'Parlez-en à votre cardiologue')));
      carte.appendChild(actions);
      zone.appendChild(carte);
    }
    if (TP.conclusion) {
      const boite = el('div', { className: 'mascotte-boite', ariaHidden: 'true' }, creerMascotte());
      boite.dataset.humeur = 'joie';
      zone.appendChild(el('section', { className: 'guide conclusion apparition' }, el('p', { className: 'bulle' }, el('span', { className: 'visuellement-cache' }, 'La mascotte dit : '), TP.conclusion), boite));
    }
  }

  // --- Message à l'équipe (fenêtre) -----------------------------------------------------------

  function majMessage() {
    const m = PU.messagePatient(etudeMessage, P, {
      situations: [...choix.vignettes], reponses: PU.lignesReponses(choix.saisies, P),
      nom: $('m-nom').value.trim(), naissance: $('m-naissance').value,
    });
    $('m-texte').value = (m.objet ? 'Objet : ' + m.objet + '\n\n' : '') + m.corps;
    $('m-messagerie').href = m.mailto || '#';
    return m;
  }

  function ouvrirMessage(e) {
    etudeMessage = e;
    const em = (P.textes && P.textes.email_patient) || {};
    texte('fenetre-titre', '📧 ' + (em.titre_fenetre || 'Texte à copier-coller dans votre e-mail'));
    $('m-messagerie').textContent = em.bouton_messagerie || 'Ouvrir ma messagerie';
    $('m-copier').textContent = '📋 ' + (em.bouton_copier || 'Copier');
    $('m-etat').textContent = '';
    majMessage();
    $('fenetre').showModal();
  }

  async function copierMessage() {
    const m = majMessage();
    try { await navigator.clipboard.writeText((m.objet ? m.objet + '\n\n' : '') + m.corps); $('m-etat').textContent = '✅ Copié !'; }
    catch (err) { $('m-texte').select(); $('m-etat').textContent = 'Le texte est sélectionné : faites « Copier ».'; }
  }

  function toutEffacer() {
    choix.vignettes.clear();
    choix.saisies = {};
    $('m-nom').value = '';
    $('m-naissance').value = '';
    dessinerVignettes();
    montrer(1);
  }

  // --- Démarrage ------------------------------------------------------------------------------

  async function demarrer() {
    try {
      const [parametres, donnees] = await Promise.all([lireJson('../donnees/parametres.json'), lireJson('../donnees/protocoles.json')]);
      P = parametres;
      TP = (P.textes && P.textes.patient) || {};
      for (const [nom, valeur] of Object.entries(P.couleurs || {})) document.documentElement.style.setProperty('--' + nom, valeur);
      const textesSite = (P.textes && P.textes.site) || {};
      document.title = ((P.modules && P.modules.patient) || TP.titre || 'Recherche clinique');
      if (P.publication && P.publication.site_discret) { $('bandeau-test').hidden = false; $('bandeau-test').textContent = textesSite.bandeau_test || 'Version de test'; }
      texte('avertissement', TP.avertissement);
      etudes = E.candidates(PU.preparer(donnees, P, 'patient'));
      $('mascotte-edito').appendChild(creerMascotte());
      $('mascotte-test').appendChild(creerMascotte());
      dessinerEdito();
      dessinerVignettes();
      $('etat').hidden = true;
      montrer(0);
      IC.audience.compter(P); // visite
      $('bouton-test').addEventListener('click', () => montrer(1));
      $('bouton-retour').addEventListener('click', () => {
        const actuelle = [1, 2, 3].find((i) => !$('etape-' + i).hidden);
        montrer(actuelle > 1 ? actuelle - 1 : 0);
      });
      $('vers-2').addEventListener('click', () => { dessinerQuestions(); montrer(2); });
      $('vers-3').addEventListener('click', () => { dessinerResultats(); montrer(3); });
      $('recommencer').addEventListener('click', toutEffacer);
      $('m-nom').addEventListener('input', majMessage);
      $('m-naissance').addEventListener('input', majMessage);
      $('m-copier').addEventListener('click', copierMessage);
      $('m-fermer').addEventListener('click', () => $('fenetre').close());
    } catch (erreur) {
      $('etat').textContent = 'Les données n\'ont pas pu être chargées (' + erreur.message + ').';
    }
  }

  demarrer();
})();

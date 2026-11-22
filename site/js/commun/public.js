// Copie automatique de src/public.js (outils-src/construire.mjs) : ne pas modifier ici.
// =============================================================================
// public.js — prépare les études PUBLIÉES (protocoles.json) pour les pages publiques
// =============================================================================
// Utilisé par InnovAction (libéraux) et plus tard InnovActeur (patients). Une copie
// automatique est placée dans site/js/commun/ (outils-src/construire.mjs).
// Ne lit que le fichier public : il ne peut donc rien afficher d'interne.
// Les études ont la même forme que dans l'outil interne, pour réutiliser le moteur
// d'éligibilité (src/eligibilite.js). Rien n'est envoyé ni enregistré.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const T = InnovaCare.texte;

  /** « 2025-03-01 » → « 01/03/2025 » (dates du fichier public). */
  function dateFr(iso) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(iso || ''));
    if (!m) return T.enTexte(iso);
    return (m[3] ? m[3] + '/' : '') + m[2] + '/' + m[1];
  }

  /**
   * Études d'un module (« professionnel » ou « patient »), prêtes à afficher et à filtrer.
   * Seules celles dont le module figure dans « modules » sont gardées ; le statut est
   * filtré ensuite par eligibilite.candidates (« ouvert » seulement).
   */
  function preparer(donnees, parametres, module) {
    const nomPole = Object.fromEntries((parametres.poles || []).map((p) => [p.id, p.nom]));
    return ((donnees && donnees.protocoles) || [])
      .filter((p) => (p.modules || []).includes(module))
      .map((p) => {
        const v = p.valeurs || {};
        const pathologies = [1, 2, 3, 4].map((n) => v['pathologie_' + n]).filter((x) => !T.estVide(x)).map(T.enTexte);
        const vignettes = [1, 2, 3].map((n) => v['vignette_' + n]).filter((x) => !T.estVide(x)).map(T.enTexte);
        const recherche = T.texteSimple(Object.values(v).map(T.enTexte).concat(nomPole[p.pole] || '', p.contacts && p.contacts.investigateur ? p.contacts.investigateur.nom : '').join(' '));
        return {
          id: p.id, pole: p.pole, poleNom: nomPole[p.pole] || '', nom: T.enTexte(v.nom), statut: T.enTexte(v.statut),
          thematique: T.enTexte(v.thematique), pathologies, vignettes, valeurs: v, contacts: p.contacts || {}, maj: p.maj || '',
          masquee: false, enAvant: false, recherche,
        };
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }

  /** Recherche plein texte (tous les mots, sans accents ni majuscules). */
  function rechercher(etudes, texte) {
    const mots = T.texteSimple(texte || '').split(' ').filter(Boolean);
    return etudes.filter((e) => mots.every((m) => e.recherche.includes(m)));
  }

  /**
   * Adressage à l'investigateur principal, par sa messagerie sécurisée (MSSanté) — cahier des charges § 6.3.
   * Renvoie null si aucune adresse MSSanté n'est publiée (elle ne l'est que si elle a été vérifiée).
   * Objet et corps viennent des paramètres (textes.adressage) ; {protocole} = nom de l'étude.
   * Un corps vide reste vide : rien n'est inventé.
   */
  function adressage(etude, parametres) {
    const pi = etude.contacts && etude.contacts.investigateur;
    if (!pi || !pi.mssante) return null;
    const textes = ((parametres.textes || {}).adressage) || {};
    const remplacer = (t) => String(t || '').split('{protocole}').join(etude.nom);
    const objet = remplacer(textes.objet);
    const corps = remplacer([].concat(textes.corps || []).join('\n'));
    const parametresLien = [objet ? 'subject=' + encodeURIComponent(objet) : '', corps ? 'body=' + encodeURIComponent(corps) : ''].filter(Boolean).join('&');
    return { nom: pi.nom, mssante: pi.mssante, objet, corps, mailto: 'mailto:' + pi.mssante + (parametresLien ? '?' + parametresLien : '') };
  }

  // --- Nouveautés (cahier des charges § 6.3) -----------------------------------------------

  const JOURS_NOUVEAUTE = 30;

  /** « 2025-03-01 » ou « 2025-03 » (1er du mois) → nombre de jours depuis 1970, ou null. */
  function jour(iso) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(iso || ''));
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) / 86400000) : null;
  }

  /**
   * Études récemment ouvertes (début d'inclusion dans les 30 derniers jours, la plus récente d'abord)
   * et fins de recrutement annoncées (date future, la plus proche d'abord). Une étude sans date ne
   * figure dans aucune liste : rien n'est deviné. aujourdhui : « AAAA-MM-JJ ».
   */
  function nouveautes(etudes, aujourdhui) {
    const j = jour(aujourdhui);
    const recentes = etudes.filter((e) => { const d = jour(e.valeurs.debut_inclusion); return d !== null && d <= j && j - d <= JOURS_NOUVEAUTE; })
      .sort((a, b) => jour(b.valeurs.debut_inclusion) - jour(a.valeurs.debut_inclusion));
    const fins = etudes.filter((e) => { const d = jour(e.valeurs.fin_recrutement); return d !== null && d >= j; })
      .sort((a, b) => jour(a.valeurs.fin_recrutement) - jour(b.valeurs.fin_recrutement));
    return { recentes, fins, jours: JOURS_NOUVEAUTE };
  }

  // --- InnovActeur : parcours patient (cahier des charges § 6.4) ----------------------------

  /** Vignettes des paramètres (dans leur ordre) qui ont au moins une étude, avec leur nombre. */
  function vignettes(etudes, parametres) {
    const compte = new Map();
    for (const e of etudes) for (const x of new Set(e.vignettes.map(T.texteSimple))) compte.set(x, (compte.get(x) || 0) + 1);
    return (parametres.vignettes || []).map((x) => ({ nom: x.nom || x.libelle, emoji: x.emoji || '', description: x.description || '', nombre: compte.get(T.texteSimple(x.nom || x.libelle)) || 0 }))
      .filter((x) => x.nombre);
  }

  /** Études d'au moins une des vignettes choisies. */
  function selonVignettes(etudes, choisies) {
    const choix = new Set((choisies || []).map(T.texteSimple));
    return etudes.filter((e) => e.vignettes.some((x) => choix.has(T.texteSimple(x))));
  }

  /** IMC = poids (kg) / taille (m)², au dixième ; null si une valeur manque ou est invraisemblable. */
  function calculerImc(tailleCm, poidsKg) {
    const t = Number(tailleCm), p = Number(poidsKg);
    if (!(t >= 100 && t <= 250 && p >= 20 && p <= 400)) return null;
    return Math.round((p / Math.pow(t / 100, 2)) * 10) / 10;
  }

  /**
   * Questions posées aux patients : filtres du module « patient » qui ont une question rédigée
   * (question_patient), ou un traitement avec son libellé patient (case à cocher). Rien d'autre.
   * Renvoie [{ filtre, forme: 'nombre' | 'taille_poids' | 'choix' | 'oui_non' | 'case' }].
   */
  function questionsPatient(parametres) {
    const filtres = ((parametres && parametres.filtres) || []).filter((f) => (f.modules || []).includes('patient'));
    const questions = [];
    for (const f of filtres) {
      if (f.question_patient) {
        const forme = f.type === 'bornes' ? (f.saisie_patient === 'taille_poids' ? 'taille_poids' : (Array.isArray(f.reponses_patient) && f.seuil_patient !== undefined ? 'choix' : 'nombre')) : 'oui_non';
        questions.push({ filtre: f, forme });
      } else if (f.type !== 'bornes' && f.famille === 'traitement' && f.libelle_patient) {
        questions.push({ filtre: f, forme: 'case' });
      }
    }
    return questions;
  }

  /**
   * Traduit les saisies du patient en réponses pour le moteur d'éligibilité.
   *   nombre : { age: 65 } ; taille_poids : { imc_taille, imc_poids } → IMC calculé ;
   *   choix (FEVG) : « oui » = au moins le seuil, « non » = en dessous, « nsp » = rien ;
   *   oui_non : « oui » / « non » ; case cochée = « oui » (non cochée = pas de réponse, jamais « non »).
   */
  function reponsesPatient(saisies, parametres) {
    const s = saisies || {};
    const r = {};
    for (const { filtre: f, forme } of questionsPatient(parametres)) {
      if (forme === 'nombre' && s[f.id] !== undefined && s[f.id] !== null && s[f.id] !== '') r[f.id] = Number(s[f.id]);
      else if (forme === 'taille_poids') { const imc = calculerImc(s[f.id + '_taille'], s[f.id + '_poids']); if (imc !== null) r[f.id] = imc; }
      else if (forme === 'choix') {
        if (s[f.id] === 'oui') r[f.id] = { min: f.seuil_patient };
        else if (s[f.id] === 'non') r[f.id] = { max: f.seuil_patient - 1e-9 };
      } else if (forme === 'oui_non' && (s[f.id] === 'oui' || s[f.id] === 'non')) r[f.id] = s[f.id];
      else if (forme === 'case' && s[f.id] === true) r[f.id] = 'oui';
    }
    return r;
  }

  /** Lignes « réponses » du message à l'équipe (seulement ce que le patient a renseigné). */
  function lignesReponses(saisies, parametres) {
    const s = saisies || {};
    const lignes = [];
    const cochés = [];
    for (const { filtre: f, forme } of questionsPatient(parametres)) {
      const unite = f.unite_patient || f.unite || '';
      if (forme === 'nombre' && s[f.id] !== undefined && s[f.id] !== null && s[f.id] !== '') lignes.push(f.libelle + ' : ' + s[f.id] + (unite ? ' ' + unite : ''));
      else if (forme === 'taille_poids') {
        const imc = calculerImc(s[f.id + '_taille'], s[f.id + '_poids']);
        if (imc !== null) lignes.push(f.libelle + ' : ' + String(imc).replace('.', ',') + ' (' + s[f.id + '_taille'] + ' cm, ' + s[f.id + '_poids'] + ' kg)');
      } else if (forme === 'choix' && s[f.id]) {
        const rep = (f.reponses_patient || []).find((x) => x.valeur === s[f.id]);
        lignes.push(f.libelle + ' : ' + (rep ? rep.libelle : s[f.id]));
      } else if (forme === 'oui_non' && (s[f.id] === 'oui' || s[f.id] === 'non')) lignes.push(f.libelle + ' : ' + s[f.id]);
      else if (forme === 'case' && s[f.id] === true) cochés.push(f.libelle_patient);
    }
    if (cochés.length) lignes.push('Traitements : ' + cochés.join(', '));
    return lignes;
  }

  /**
   * Message du patient à l'équipe de recherche (textes.email_patient des paramètres).
   * {protocole}, {situations} et {reponses} sont remplacés ; le nom et la date de naissance, s'ils sont
   * saisis, remplissent les blancs « ____ » du modèle. Rien n'est envoyé par le site : le patient
   * envoie lui-même le message depuis sa messagerie. destinataire : e-mail de l'ARC n° 1 publié, sinon null.
   */
  function messagePatient(etude, parametres, infos) {
    const i = infos || {};
    const modele = ((parametres.textes || {}).email_patient) || {};
    const arc = ((etude.contacts || {}).arc || [])[0];
    const remplacer = (t) => String(t || '').split('{protocole}').join(etude.nom).split('{situations}').join((i.situations || []).join(', '));
    let corps = [].concat(modele.corps || []).map(remplacer).join('\n').split('{reponses}').join((i.reponses || []).join('\n'));
    if (i.nom) corps = corps.replace(/_{4,}/, i.nom);
    if (i.naissance) corps = corps.replace(/_+\s*\/\s*_+\s*\/\s*_+/, dateFr(i.naissance));
    const objet = remplacer(modele.objet);
    const destinataire = arc && arc.email ? arc.email : null;
    const mailto = destinataire ? 'mailto:' + destinataire + '?subject=' + encodeURIComponent(objet) + '&body=' + encodeURIComponent(corps) : null;
    return { destinataire, objet, corps, mailto };
  }

  InnovaCare.public = {
    preparer, rechercher, adressage, dateFr, nouveautes,
    vignettes, selonVignettes, calculerImc, questionsPatient, reponsesPatient, lignesReponses, messagePatient,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

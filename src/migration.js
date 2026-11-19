// =============================================================================
// migration.js — transforme l'Excel ACTUEL en fiches au NOUVEAU format (plan § 4)
// =============================================================================
// Entrée : la lecture de l'ancien Excel (lecture-ancien.js).
// Sortie : { fichesParPole, annuaire, rapport, resume } que gabarit.js sait écrire.
//
// Règle d'or : RIEN N'EST DEVINÉ. Une valeur qui ne peut pas être convertie avec
// certitude est recopiée dans « Remarques », précédée de « [migration] », et une
// ligne du rapport la signale. Une case vide reste vide. La phrase patient et les
// détails pratiques sont repris mot pour mot.
// Le rapport de contrôle (controles.js) est réutilisé : statuts proposés, colonnes
// décalées, doublons.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;

  const PREFIXE = '[migration] ';
  const CAPACITE = { inclusion: 5, inclusion_autre: 5, exclusion: 12, pathologie: 4, vignette: 3, arc_backup: 2 };

  /** Découpe « Prénom NOM » : les mots en MAJUSCULES forment le nom, les autres le prénom. */
  function decouperNom(texte) {
    const mots = String(texte).split(/\s+/).filter(Boolean);
    const estMaj = (m) => m.length >= 2 && m === m.toUpperCase() && /[A-ZÀ-Ý]/.test(m);
    let nom = mots.filter(estMaj);
    let prenom = mots.filter((m) => !estMaj(m));
    if (!prenom.length && nom.length > 1) {
      // Tout en majuscules : un premier mot très court (« JC », « D ») est un prénom en initiales.
      if (nom[0].length <= 2) { prenom = [nom[0]]; nom = nom.slice(1); }
    }
    if (!nom.length && prenom.length > 1) { nom = [prenom.pop().toUpperCase()]; }
    return { prenom: prenom.join(' '), nom: nom.join(' ') };
  }

  function migrer(lecture, parametres, correspondances) {
    const controle = InnovaCare.controles.controler(lecture, parametres, correspondances);
    const etudes = InnovaCare.lectureAncien.toutesLesEtudes(lecture); // complétées par controler (nom, id, indices…)
    const rapport = [];
    const filtresParam = parametres.filtres || [];
    const poleParId = Object.fromEntries((parametres.poles || []).map((p) => [p.id, p]));
    const libelleAncien = (champ) => (correspondances.libelles.find((e) => e.champ === champ) || {}).ancien || champ;
    const signaler = (gravite, etude, champ, message) => rapport.push({ gravite, pole: etude ? (poleParId[etude.poleCible] || {}).nom || '' : '', etude: etude ? etude.nom : '', champ, message });

    // --- 1. Annuaire de départ (corrections et ajouts validés appliqués) -------------
    const reglage = correspondances.annuaire || {};
    const annuaire = InnovaCare.controles.preparerAnnuaire(lecture, correspondances).map((p) => {
      const correction = (reglage.corrections_validees || []).find((c) => c.quoi === 'e-mail' && N.texteSimple(c.avant) === N.texteSimple(p.email));
      const poleAncien = (reglage.poles_anciens || {})[p.poleAncien];
      return Object.assign(p, {
        fonction: 'ARC',
        email: correction ? correction.apres : p.email,
        pole: poleAncien && poleParId[poleAncien] ? poleParId[poleAncien].nom : '',
      });
    });
    const nomAffiche = (p) => (p.prenom + ' ' + p.nom).trim();

    /**
     * Retrouve une personne de l'annuaire, prudemment :
     *  1. même prénom et même NOM (dans n'importe quel ordre) ;
     *  2. même prénom et NOM identique aux espaces près (« LE TOURNEAU » / « LETOURNEAU ») ;
     *  3. NOM seul, SEULEMENT si le prénom manque ou n'est qu'une initiale compatible
     *     (« ERNOULD », « D JACOBI »), et si un seul candidat porte ce nom.
     * Deux personnes de même nom et de prénoms différents ne sont jamais confondues.
     */
    function retrouver(p) {
      const exacte = annuaire.find((a) => a.cle === p.cle);
      if (exacte) return { fiche: exacte, qualite: 'exacte' };
      const morceaux = decouperNom(p.nom);
      const tasse = (t) => N.texteSimple(t).replace(/[\s-]/g, '');
      const prenom = N.texteSimple(morceaux.prenom);
      const proche = annuaire.find((a) => prenom && N.texteSimple(a.prenom) === prenom && tasse(a.nom) === tasse(morceaux.nom));
      if (proche) return { fiche: proche, qualite: 'orthographe' };
      if (prenom.replace(/[^a-z]/g, '').length <= 2) {
        const candidats = annuaire.filter((a) => tasse(a.nom) === tasse(morceaux.nom) && (!prenom || N.texteSimple(a.prenom).startsWith(prenom.replace(/[^a-z]/g, '').slice(0, 1))));
        if (candidats.length === 1) return { fiche: candidats[0], qualite: 'nom seul' };
      }
      return { fiche: null, qualite: 'aucune' };
    }

    /** Trouve ou crée la personne dans l'annuaire ; renvoie son « nom affiché ». */
    function personne(p, fonction, etude, champ) {
      const trouve = retrouver(p);
      let fiche = trouve.fiche;
      if (fiche && trouve.qualite !== 'exacte') {
        signaler('verifier', etude, champ, '« ' + p.brut + ' » rapproché de ' + nomAffiche(fiche) + ' (' + trouve.qualite + ') : à confirmer.');
      }
      if (!fiche) {
        const morceaux = decouperNom(p.nom);
        fiche = { prenom: morceaux.prenom, nom: morceaux.nom, fonction, dect: p.dect.join('/'), email: '', pole: '', origine: 'migration' };
        fiche.cle = N.clePersonne(fiche.prenom + ' ' + fiche.nom);
        fiche.cleNom = N.texteSimple(fiche.nom);
        annuaire.push(fiche);
        signaler('verifier', null, 'Annuaire', 'Personne ajoutée à l\'annuaire : ' + nomAffiche(fiche) + ' (' + fonction + ')' +
          (fonction === 'ARC' ? ', e-mail à compléter' : '') + (!fiche.prenom || fiche.prenom.length <= 2 ? ', prénom à compléter' : '') +
          '. Citée dans « ' + etude.nom + ' ».');
      } else {
        if (!fiche.dect && p.dect.length) fiche.dect = p.dect.join('/');
        if (fiche.fonction === 'ARC' && fonction === 'investigateur' && fiche.origine === 'annuaire') {
          signaler('verifier', etude, champ, nomAffiche(fiche) + ' (ARC dans l\'annuaire) est citée comme investigatrice ou investigateur principal.');
        }
      }
      return nomAffiche(fiche);
    }

    // --- 2. Pôle cible, doublons ----------------------------------------------------
    const affectation = (correspondances.affectation_suivi || {}).etudes || [];
    for (const e of etudes) {
      if (!e.suivi) { e.poleCible = e.pole; continue; }
      const a = affectation.find((x) => N.identifiant(N.analyserNomEtude(x.nom, correspondances.mentions_statut).nom) === e.id);
      e.poleCible = a && poleParId[a.pole] ? a.pole : 'transversales';
      if (!a) signaler('verifier', e, 'Pôle', 'Étude de l\'onglet « suivi ou terminées » sans pôle prévu : placée dans « ' + (poleParId[e.poleCible] || {}).nom + ' », à déplacer si besoin.');
    }
    const groupes = new Map();
    for (const e of etudes) groupes.set(e.id, (groupes.get(e.id) || []).concat([e]));
    const conservees = [];
    for (const groupe of groupes.values()) {
      const tri = groupe.slice().sort((a, b) => (a.mentionDoublon ? 1 : 0) - (b.mentionDoublon ? 1 : 0) || (a.suivi ? 1 : 0) - (b.suivi ? 1 : 0));
      const gardee = tri[0];
      gardee.autresPoles = [...new Set(tri.slice(1).map((e) => e.poleCible).filter((p) => p !== gardee.poleCible))];
      if (tri.length > 1) {
        const doublon = controle.doublons.find((d) => d.id === gardee.id);
        signaler('verifier', gardee, 'Doublon', 'Colonne conservée : « ' + gardee.onglet + ' » (' + gardee.colonne + '). Non reprise : ' +
          tri.slice(1).map((e) => '« ' + e.onglet + ' » (' + e.colonne + ')').join(', ') + '.' +
          (doublon && doublon.divergents.length ? ' Lignes différentes à comparer à la main : ' + doublon.divergents.join(', ') + '.' : ''));
      }
      conservees.push(gardee);
    }

    // --- 3. Une fiche par étude conservée ------------------------------------------
    const decalees = new Set(controle.alertes.filter((a) => a.type === 'colonne_decalee').map((a) => a.onglet + '|' + a.etude));
    let bornesStrictes = 0;
    const fichesParPole = {};

    for (const e of conservees) {
      const v = {};
      const remarques = [];
      const noter = (texte) => remarques.push(PREFIXE + texte);
      const valeurs = (champ) => e.champs[champ] || [];
      const textes = (champ) => valeurs(champ).map((x) => N.enTexte(x.valeur)).filter(Boolean);
      const joindre = (champ) => textes(champ).join('\n');

      // Identification
      const analyse = N.analyserNomEtude(e.nomBrut, correspondances.mentions_statut);
      v.nom = analyse.nom;
      if (analyse.mention) noter('Mention dans le nom d\'origine : « ' + analyse.mention + ' ».');
      for (const ligne of analyse.reste.filter((l) => l !== analyse.mention)) noter('Ligne supplémentaire dans le nom d\'origine : « ' + ligne + ' ».');
      const statut = controle.statuts.find((s) => s.onglet === e.onglet && s.colonne === e.colonne);
      v.statut = statut ? statut.statut : '';
      if (statut && statut.origine !== 'par défaut') signaler('verifier', e, 'Statut', 'Statut « ' + statut.statut + ' » proposé d\'après ' + statut.origine + '.');
      e.autresPoles.slice(0, 2).forEach((p, i) => { v['autre_pole_' + (i + 1)] = poleParId[p].nom; });

      // Textes repris tels quels
      for (const [ancien, nouveau] of [['titre', 'titre'], ['thematique', 'thematique'], ['synopsis', 'synopsis'], ['design', 'design'],
        ['nsn', 'nsn'], ['cjp', 'cjp'], ['duree_suivi', 'duree_suivi'], ['rythme_visites', 'rythme_visites'],
        ['question_specifique', 'question_specifique'], ['phrase_patient', 'phrase_patient'], ['details_pratiques', 'details_pratiques']]) {
        const t = joindre(ancien);
        if (t) v[nouveau] = t;
      }

      // Critères : 5 principaux, puis « autres » ; le surplus est regroupé dans la dernière ligne
      const repartir = (liste, cibles) => {
        let reste = liste.slice();
        for (const [prefixe, capacite] of cibles) {
          const part = reste.splice(0, capacite);
          part.forEach((t, i) => { v[prefixe + '_' + (i + 1)] = t; });
          if (part.length === capacite && reste.length && cibles[cibles.length - 1][0] === prefixe) {
            v[prefixe + '_' + capacite] += '\n' + reste.join('\n');
            reste = [];
          }
        }
        return reste;
      };
      const inclusion = textes('inclusion');
      repartir(inclusion, [['inclusion', CAPACITE.inclusion], ['inclusion_autre', CAPACITE.inclusion_autre]]);
      if (inclusion.length > CAPACITE.inclusion) signaler('info', e, 'Critères d\'inclusion', inclusion.length + ' critères : les ' + CAPACITE.inclusion + ' premiers sont « principaux », les suivants en « autres critères ». Choisir les 5 critères principaux à la main.');
      const exclusion = textes('exclusion');
      repartir(exclusion, [['exclusion', CAPACITE.exclusion]]);
      if (exclusion.length > CAPACITE.exclusion) signaler('info', e, 'Critères d\'exclusion', exclusion.length + ' critères : le surplus est regroupé dans le critère ' + CAPACITE.exclusion + '.');

      // Dates
      const debut = valeurs('debut_inclusion');
      if (debut.length) {
        const date = N.lireDate(debut[0].valeur);
        if (date.ok && !date.vide) v.debut_inclusion = { date: date.iso };
        else {
          noter('Début d\'inclusion d\'origine : « ' + date.brut + ' ».');
          // Une simple mention de statut (« terminé ») a déjà servi à proposer le statut : pas d'alerte de plus.
          if (!N.chercherMentionStatut(debut[0].valeur, correspondances.mentions_statut)) {
            signaler('verifier', e, 'Début d\'inclusion', '« ' + date.brut + ' » n\'est pas une date : à saisir (texte gardé en Remarques).');
          }
        }
        for (const autre of debut.slice(1)) noter('Autre valeur en « Début d\'inclusion » : « ' + N.enTexte(autre.valeur) + ' ».');
      }
      for (const x of valeurs('duree_recrutement')) {
        const date = N.lireDate(x.valeur);
        if (date.ok && !date.vide && !v.fin_recrutement) v.fin_recrutement = { date: date.iso };
        else noter('Durée de recrutement prévisible : « ' + date.brut + ' ».');
      }

      // Recrutés / objectif
      for (const x of valeurs('recrutes_objectif')) {
        const texte = N.enTexte(x.valeur);
        const m = texte.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (m) { v.recrutes = Number(m[1]); v.objectif = Number(m[2]); }
        else if (typeof x.valeur === 'number' || /^\d+$/.test(texte)) v.objectif = Number(texte);
        else noter('Recrutés / objectif : « ' + texte + ' ».');
      }

      // Contacts
      const personnesDe = (champ) => valeurs(champ).flatMap((x) => N.separerPersonnes(x.valeur));
      const valides = (liste, champ) => liste.filter((p) => {
        const nonPersonne = (correspondances.valeurs_non_personnes || []).some((t) => N.texteSimple(t) === N.texteSimple(p.nom)) ||
          !p.nom || !/[A-ZÀ-Ý]{2,}/.test(p.nom) && p.nom.split(' ').length < 2;
        if (nonPersonne) noter(libelleAncien(champ) + ' d\'origine : « ' + p.brut + ' ».');
        return !nonPersonne;
      });
      const investigateurs = valides(personnesDe('investigateur'), 'investigateur').map((p) => personne(p, 'investigateur', e, 'Investigateur principal'));
      if (investigateurs.length) v.investigateur = investigateurs[0];
      if (investigateurs.length > 1) v.co_investigateurs = investigateurs.slice(1).join(' ; ');
      const arcs = valides(personnesDe('arc_1'), 'arc_1').concat(valides(personnesDe('arc_backup'), 'arc_backup')).map((p) => personne(p, 'ARC', e, 'ARC'));
      const arcsUniques = arcs.filter((nom, i) => arcs.indexOf(nom) === i);
      if (arcsUniques[0]) v.arc_1 = arcsUniques[0];
      arcsUniques.slice(1, 1 + CAPACITE.arc_backup).forEach((nom, i) => { v['arc_backup_' + (i + 1)] = nom; });
      if (arcsUniques.length > 1 + CAPACITE.arc_backup) noter('Autres ARC cités : ' + arcsUniques.slice(1 + CAPACITE.arc_backup).join(', ') + '.');

      // Anciens « tags » : recopiés tels quels en attendant les listes de l'étape 1.3
      const pathologies = textes('tag_ecs').flatMap((t) => t.split('+').map((x) => x.trim()).filter(Boolean));
      pathologies.slice(0, CAPACITE.pathologie).forEach((t, i) => { v['pathologie_' + (i + 1)] = t; });
      if (pathologies.length > CAPACITE.pathologie) noter('Autres tags : ' + pathologies.slice(CAPACITE.pathologie).join(' + ') + '.');
      const vignettes = textes('tag_innovacoeur');
      vignettes.slice(0, CAPACITE.vignette).forEach((t, i) => { v['vignette_' + (i + 1)] = t; });

      // Affichage
      const drapeau = (champ, cible, libelle) => {
        const x = valeurs(champ)[0];
        const texte = x ? N.enTexte(x.valeur) : '';
        if (texte === '1' || texte === '0') { v[cible] = texte === '1' ? 'oui' : 'non'; return; }
        v[cible] = /^1\b/.test(texte) ? 'oui' : 'non';
        if (texte) noter(libelle + ' d\'origine : « ' + texte + ' ».');
      };
      drapeau('afficher_ecardioscope', 'afficher_ecardioscope', 'Faire apparaître dans e-Cardioscope');
      drapeau('afficher_innovacoeur', 'afficher_innovacteur', 'Faire apparaître dans InnovaCoeur');
      v.afficher_innovaction = 'non';

      // Filtres : la valeur e-Cardioscope fait foi
      const descriptions = correspondances.libelles.filter((d) => d.nature === 'filtre' && !d.section);
      for (const d of descriptions) {
        const param = filtresParam.find((f) => f.id === d.filtre);
        if (!param) continue;
        const dPatient = correspondances.libelles.find((x) => x.nature === 'filtre' && x.section === 'patient' && x.filtre === d.filtre);
        const lire = (desc) => {
          const x = desc && valeurs(desc.champ)[0];
          if (!x) return null;
          const lu = N.lireFiltre(x.valeur);
          if (lu.ok && lu.oui === true && desc.oui_signifie_min !== undefined) Object.assign(lu, { min: desc.oui_signifie_min, minStricte: true, oui: null, ouiTraduit: true });
          const lisible = lu.ok && !lu.vide && (param.type === 'requis' ? lu.oui !== null : lu.oui === null);
          if (!lisible && !lu.vide) noter('Filtre « ' + desc.ancien.slice(0, 40) + ' » non interprétable : « ' + lu.brut + ' ».');
          return lisible ? lu : null;
        };
        const ecs = lire(d);
        const pat = lire(dPatient);
        const retenu = ecs || pat;
        if (!retenu) continue;
        if (!ecs && pat) signaler('info', e, param.libelle, 'Filtre repris de la partie patient (« ' + pat.brut + ' »)' + (pat.ouiTraduit ? ' : « force de contraction normale » traduit en FEVG minimum ' + pat.min + '.' : '.'));
        if (ecs && pat && !(pat.ouiTraduit ? ecs.min !== null && ecs.min >= pat.min && ecs.max === null : N.filtresEgaux(ecs, pat))) {
          noter('Filtre InnovaCoeur différent pour ' + param.libelle + ' : « ' + pat.brut + ' » (valeur e-Cardioscope « ' + ecs.brut + ' » retenue).');
          signaler('verifier', e, param.libelle, 'Deux valeurs : « ' + ecs.brut + ' » (e-Cardioscope, retenue) et « ' + pat.brut + ' » (InnovaCoeur, gardée en Remarques).');
        }
        if (param.type === 'requis') { v[param.id] = retenu.oui ? 'requis' : 'exclu'; continue; }
        if (retenu.min !== null) v[param.id + '_min'] = retenu.min;
        if (retenu.max !== null) v[param.id + '_max'] = retenu.max;
        if ((retenu.minStricte && !retenu.ouiTraduit) || retenu.maxStricte) {
          bornesStrictes++;
          if (param.id === 'age') signaler('verifier', e, param.libelle, '« ' + retenu.brut + ' » converti en borne incluse (' + (retenu.min !== null ? 'minimum ' + retenu.min : 'maximum ' + retenu.max) + ') : vérifier si l\'âge limite est inclus.');
        }
      }

      // Traitements
      for (const x of valeurs('patient_filtre_traitements')) {
        const lu = N.lireTraitements(x.valeur, filtresParam);
        for (const id of lu.classes) v[id] = 'requis';
        if (lu.classes.length) signaler('info', e, 'Traitements', '« ' + lu.brut + ' » converti en : ' + lu.classes.map((id) => (filtresParam.find((f) => f.id === id) || {}).libelle).join(', ') + ' (requis).');
        if (lu.inconnus.length) noter('Traitements non reconnus : « ' + lu.inconnus.join(' », « ') + ' ».');
      }

      // Valeurs sans libellé
      for (const h of e.horsFiche) noter('Valeur sans libellé (' + h.adresse + ') : « ' + N.enTexte(h.valeur) + ' ».');

      // Colonne décalée : reprise telle quelle mais signalée, jamais affichée
      const suspecte = decalees.has(e.onglet + '|' + e.nom);
      if (suspecte) {
        v.afficher_ecardioscope = 'non'; v.afficher_innovaction = 'non'; v.afficher_innovacteur = 'non';
        signaler('corriger', e, 'Toute la colonne', 'Colonne décalée dans l\'ancien Excel (' + e.indices.join(' ; ') + ') : informations à ressaisir. Affichage désactivé.');
      }

      // Remarques : celles d'origine, puis celles de la migration
      const remarquesOrigine = joindre('remarques');
      const toutes = [remarquesOrigine].concat(remarques).filter(Boolean).join('\n');
      if (toutes) v.remarques = toutes;
      if (remarques.length) signaler('info', e, 'Remarques', remarques.length + ' valeur(s) non convertie(s) gardée(s) en Remarques.');

      const fiche = {
        valeurs: v, suspecte,
        note: suspecte ? 'Migration : colonne décalée dans l\'ancien Excel. Informations à ressaisir avant tout affichage.' : null,
        origine: { onglet: e.onglet, colonne: e.colonne, etude: e },
      };
      (fichesParPole[e.poleCible] || (fichesParPole[e.poleCible] = [])).push(fiche);
    }

    if (bornesStrictes) {
      rapport.push({ gravite: 'info', pole: '', etude: '', champ: 'Filtres', message: bornesStrictes + ' borne(s) stricte(s) (« > » ou « < ») converties en bornes incluses : « > 40 » devient minimum 40. Écart d\'une unité, à corriger seulement s\'il compte cliniquement.' });
    }
    rapport.push({ gravite: 'info', pole: '', etude: '', champ: 'Affichage', message: '« Afficher aux médecins libéraux » n\'existait pas : mis à « non » partout, à activer étude par étude.' });
    if (!(parametres.pathologies || []).length) {
      rapport.push({ gravite: 'info', pole: '', etude: '', champ: 'Pathologies, vignettes', message: 'Les anciens « Tag » sont recopiés tels quels. Les listes déroulantes de pathologies et de vignettes arriveront à l\'étape suivante.' });
    }

    // Annuaire final : dans l'ordre (annuaire d'origine, ajouts validés, ajouts de la migration)
    const annuaireFinal = annuaire.map((p) => ({ prenom: p.prenom, nom: p.nom, fonction: p.fonction, pole: p.pole || '', dect: p.dect || '', email: p.email || '', mssante: '', mssante_verifiee: '' }));
    const ordreGravite = { corriger: 0, verifier: 1, info: 2 };
    rapport.sort((a, b) => ordreGravite[a.gravite] - ordreGravite[b.gravite]);
    const resume = {
      etudesLues: etudes.length,
      etudesMigrees: conservees.length,
      parPole: Object.fromEntries((parametres.poles || []).map((p) => [p.nom, (fichesParPole[p.id] || []).length])),
      colonnesDecalees: conservees.filter((e) => decalees.has(e.onglet + '|' + e.nom)).length,
      personnes: annuaireFinal.length,
      personnesAjoutees: annuaire.filter((p) => p.origine === 'migration').length,
      rapport: { corriger: rapport.filter((r) => r.gravite === 'corriger').length, verifier: rapport.filter((r) => r.gravite === 'verifier').length, info: rapport.filter((r) => r.gravite === 'info').length },
    };
    return { fichesParPole, annuaire: annuaireFinal, rapport, resume, controle };
  }

  /** Texte du résumé SANS AUCUN CONTENU (nombres seulement), à transmettre sans risque. */
  function resumeCompteurs(resume) {
    return ['MIGRATION INNOVACARE — compteurs seulement (aucun contenu)', '',
      'Études lues : ' + resume.etudesLues + ' ; migrées (après fusion des doublons) : ' + resume.etudesMigrees,
      'Par pôle :'].concat(Object.entries(resume.parPole).map(([p, n]) => '  ' + p + ' : ' + n),
      ['Colonnes décalées à ressaisir : ' + resume.colonnesDecalees,
        'Annuaire : ' + resume.personnes + ' personnes, dont ' + resume.personnesAjoutees + ' ajoutées par la migration',
        'Rapport : ' + resume.rapport.corriger + ' à corriger, ' + resume.rapport.verifier + ' à vérifier, ' + resume.rapport.info + ' pour information']).join('\n');
  }

  InnovaCare.migration = { migrer, resumeCompteurs, decouperNom };
})(typeof globalThis !== 'undefined' ? globalThis : this);

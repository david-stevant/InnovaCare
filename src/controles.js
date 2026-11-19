// =============================================================================
// controles.js — rapport de contrôle de l'Excel ACTUEL (étape 1.1)
// =============================================================================
// Reçoit le résultat de lecture-ancien.js et produit la liste de tout ce que la
// migration devra traiter. Chaque constat est une « alerte » :
//   { gravite, type, onglet, etude, adresse, message }
// avec trois niveaux de gravité :
//   « corriger »  (rouge)  : la migration ne pourra pas traiter la valeur seule ;
//   « verifier »  (orange) : une valeur sera convertie ou proposée, à valider ;
//   « info »      (gris)   : simple constat, rien à faire.
// Rien n'est modifié : ce module ne fait que constater.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});
  const N = InnovaCare.normalisation;
  const { toutesLesEtudes } = InnovaCare.lectureAncien;

  // Les types d'alertes, avec leur gravité et une explication pour le rapport.
  const TYPES = {
    onglet_inconnu: ['verifier', 'Onglet inconnu', 'Onglet non décrit dans le fichier de correspondances : il n\'est pas lu.'],
    onglet_absent: ['verifier', 'Onglet attendu absent', 'Un onglet décrit dans le fichier de correspondances est introuvable (renommé ?).'],
    onglet_ignore: ['info', 'Onglet ignoré', 'Onglet volontairement non lu.'],
    entete_introuvable: ['corriger', 'Ligne « Etudes » introuvable', 'L\'onglet ne contient pas la ligne des noms d\'études : il ne peut pas être lu.'],
    entete_decalee: ['info', 'En-tête sur une autre ligne', 'La ligne des noms d\'études n\'est pas à la même place que dans les autres onglets.'],
    libelle_inconnu: ['verifier', 'Libellé inconnu en colonne A', 'Ligne non reconnue : ses valeurs ne sont rattachées à aucun champ.'],
    libelles_absents: ['info', 'Lignes absentes de l\'onglet', 'Ces lignes existent ailleurs mais pas dans cet onglet (les onglets n\'ont pas tous la même structure).'],
    cellules_fusionnees: ['info', 'Cellules fusionnées', 'Les colonnes fusionnées sont lues comme une seule étude.'],
    colonne_vide: ['info', 'Colonne sans contenu', 'Colonne qui a un en-tête mais aucune donnée : ignorée.'],
    donnees_sans_nom: ['corriger', 'Données sans nom d\'étude', 'Colonne remplie mais sans nom d\'étude en en-tête.'],
    hors_fiche: ['info', 'Valeurs hors fiche ignorées', 'Valeurs situées dans un bloc annexe (liste d\'ARC, précisions) : non reprises.'],
    valeur_sans_libelle: ['verifier', 'Valeur sous un libellé inconnu', 'Valeur rattachée à aucun champ.'],
    colonne_decalee: ['corriger', 'Colonne probablement décalée', 'Plusieurs indices montrent que les informations ne sont pas sur les bonnes lignes : la colonne sera à ressaisir.'],
    indice_decalage: ['verifier', 'Indice isolé de décalage', 'Un seul indice : probablement une valeur mal placée, à vérifier.'],
    statut_dans_nom: ['verifier', 'Statut écrit dans le nom ou une date', 'Le statut sera proposé d\'après cette mention, à valider.'],
    nom_avec_complement: ['info', 'Nom d\'étude avec complément', 'Le nom contient un complément (promoteur, précision) : à séparer du nom court lors de la migration.'],
    doublon: ['verifier', 'Étude présente dans plusieurs onglets', 'Une seule colonne sera conservée ; l\'autre pôle sera noté en « Autre pôle concerné ».'],
    dect_colle: ['info', 'DECT collé au nom', 'Le numéro sera déplacé vers l\'annuaire.'],
    plusieurs_personnes: ['info', 'Plusieurs personnes dans une cellule', 'Elles seront réparties sur les lignes prévues (ARC back-up 1 et 2, co-investigateurs).'],
    arc_absent_annuaire: ['verifier', 'ARC absent de l\'annuaire', 'Personne citée comme ARC mais absente de l\'onglet des coordonnées : à ajouter (e-mail, DECT).'],
    nom_incomplet: ['verifier', 'Nom incomplet', 'Personne reconnue seulement par son nom de famille : à confirmer.'],
    non_personne: ['verifier', 'Valeur qui n\'est pas un nom', 'Une ligne de contact contient autre chose qu\'un nom de personne.'],
    dect_divergent: ['verifier', 'DECT différent de l\'annuaire', 'Le numéro écrit dans la fiche n\'est pas celui de l\'annuaire.'],
    investigateurs: ['info', 'Investigateurs à créer dans l\'annuaire', 'L\'annuaire actuel ne contient que des ARC : les investigateurs y seront ajoutés.'],
    email_hors_format: ['verifier', 'E-mail hors format', 'L\'adresse ne suit pas le format prenom.nom@… des paramètres.'],
    correction_validee: ['info', 'Correction déjà validée', 'Correction confirmée par le porteur du projet, qui sera appliquée par la migration.'],
    ajout_valide: ['info', 'Personne à ajouter (validée)', 'Coordonnées confirmées par le porteur du projet, absentes de l\'annuaire actuel.'],
    date_texte: ['verifier', 'Date écrite en texte', 'Seules les dates exactes sont converties ; le texte d\'origine sera gardé en remarque.'],
    filtre_illisible: ['verifier', 'Filtre non interprétable', 'Valeur qui ne suit aucun format connu (« 18-80 », « > 40 », « oui »…).'],
    borne_stricte: ['info', 'Borne stricte (> ou <)', 'Le nouveau gabarit n\'utilise que des bornes incluses : conversion à valider (ex. « > 40 » → minimum 40 ou 41 ?).'],
    filtre_divergent: ['verifier', 'Filtres e-Cardioscope et InnovaCoeur différents', 'Une seule valeur sera gardée (celle d\'e-Cardioscope, par défaut).'],
    filtre_patient_seul: ['info', 'Filtre présent seulement côté patient', 'Sera repris comme filtre commun, à valider.'],
    plusieurs_valeurs: ['verifier', 'Plusieurs valeurs pour un champ unique', 'Un champ qui n\'attend qu\'une valeur en contient plusieurs.'],
    drapeau_illisible: ['verifier', 'Affichage oui/non illisible', 'La case « Faire apparaître » devrait contenir 1 ou 0.'],
    traitements_lus: ['info', 'Traitements reconnus', 'Le texte libre sera converti en classes thérapeutiques « requis », à valider.'],
    traitement_inconnu: ['verifier', 'Traitement non reconnu', 'Terme absent des DCI, noms commerciaux et synonymes des paramètres.'],
    nom_commercial: ['info', 'Nom commercial dans un texte', 'Signalé seulement : les textes libres ne sont jamais modifiés automatiquement.'],
    criteres_nombreux: ['info', 'Nombreux critères', 'Plus de lignes que prévu dans le nouveau gabarit : le surplus sera regroupé.'],
  };

  // Typographie française dans les messages : espace insécable avant « : ; ? ! » et dans « ».
  // (Ne s'applique qu'au texte fixe du message, jamais aux valeurs citées.)
  function typo(morceau) {
    return morceau.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ');
  }
  function msg(morceaux, ...valeurs) {
    return morceaux.reduce((texte, morceau, i) => texte + typo(morceau) + (i < valeurs.length ? valeurs[i] : ''), '');
  }
  const cite = (valeur) => N.enTexte(valeur).replace(/\s+/g, ' ').slice(0, 120);

  // Nombre de lignes prévues dans le nouveau gabarit (plan § 2.1).
  const CAPACITE = { inclusion: 10, exclusion: 12 };

  // ---------------------------------------------------------------------------

  /** Prépare l'annuaire de référence : annuaire lu + corrections et ajouts validés. */
  function preparerAnnuaire(lecture, correspondances) {
    const reglage = correspondances.annuaire || {};
    const corrigerPrenom = (prenom) => {
      const c = (reglage.corrections_validees || []).find((x) => x.quoi === 'prénom' && N.texteSimple(x.avant) === N.texteSimple(prenom));
      return c ? c.apres : prenom;
    };
    const personnes = lecture.annuaire.map((p) => Object.assign({}, p, { prenom: corrigerPrenom(p.prenom), origine: 'annuaire' }));
    for (const ajout of reglage.personnes_a_ajouter || []) personnes.push(Object.assign({ dect: '', origine: 'ajout' }, ajout));
    for (const p of personnes) {
      p.cle = N.clePersonne(p.prenom + ' ' + p.nom);
      p.cleNom = N.texteSimple(p.nom);
    }
    return personnes;
  }

  /** Retrouve une personne de l'annuaire : exacte, partielle (nom seul) ou rien. */
  function rapprocher(personne, annuaire) {
    const exacte = annuaire.find((a) => a.cle === personne.cle);
    if (exacte) return { qualite: 'exacte', fiche: exacte };
    const mots = N.texteSimple(personne.nom).split(' ');
    const partielles = annuaire.filter((a) => a.cleNom && mots.includes(a.cleNom) || (a.cleNom.includes(' ') && N.texteSimple(personne.nom).includes(a.cleNom)));
    if (partielles.length === 1) return { qualite: 'partielle', fiche: partielles[0] };
    return { qualite: 'aucune', fiche: null };
  }

  /** Vrai si un texte ressemble à un nom de personne (un NOM en majuscules, ou au moins deux mots). */
  function ressembleANom(nom) {
    const mots = nom.split(/\s+/).filter(Boolean);
    return mots.some((m) => m.length >= 2 && m === m.toUpperCase() && /[A-Z]/.test(N.texteSimple(m).toUpperCase())) || mots.length >= 2;
  }

  // ---------------------------------------------------------------------------

  function controler(lecture, parametres, correspondances) {
    const alertes = [];
    const ajouter = (type, contexte, message) => {
      const [gravite] = TYPES[type];
      alertes.push(Object.assign({ gravite, type, onglet: '', etude: '', adresse: '', message }, contexte));
    };
    const filtresParam = parametres.filtres || [];
    const descriptionLibelle = (champ) => correspondances.libelles.find((e) => e.champ === champ) || {};
    const ancienLibelle = (champ) => descriptionLibelle(champ).ancien || champ;
    const annuaire = preparerAnnuaire(lecture, correspondances);
    const arcs = annuaire; // l'annuaire actuel ne contient que des ARC

    // --- Onglets et structure ---------------------------------------------------
    for (const nom of lecture.ongletsInconnus) ajouter('onglet_inconnu', { onglet: nom }, msg`Onglet « ${nom} » non lu.`);
    for (const nom of lecture.ongletsAbsents || []) ajouter('onglet_absent', { onglet: nom }, msg`Onglet « ${nom} » introuvable.`);
    for (const o of lecture.ongletsIgnores) ajouter('onglet_ignore', { onglet: o.nom }, msg`Onglet ignoré : ${o.raison}.`);

    const ongletsEtudes = lecture.onglets.filter((o) => o.role === 'pole' || o.role === 'suivi');
    const lignesEntete = ongletsEtudes.filter((o) => o.ligneEntete).map((o) => o.ligneEntete);
    const ligneHabituelle = lignesEntete.sort((a, b) => lignesEntete.filter((x) => x === b).length - lignesEntete.filter((x) => x === a).length)[0];
    for (const o of ongletsEtudes) {
      const ctx = { onglet: o.nom };
      if (o.enteteIntrouvable) { ajouter('entete_introuvable', ctx, msg`Aucune ligne « ${correspondances.libelle_entete} » en colonne A.`); continue; }
      if (o.ligneEntete !== ligneHabituelle) ajouter('entete_decalee', Object.assign({ adresse: 'A' + o.ligneEntete }, ctx), msg`Noms d'études en ligne ${o.ligneEntete} (ligne ${ligneHabituelle} ailleurs).`);
      for (const l of o.libellesInconnus) ajouter('libelle_inconnu', Object.assign({ adresse: l.adresse }, ctx), msg`Libellé « ${cite(l.libelle)} » non reconnu.`);
      const absents = (correspondances.libelles_attendus || []).filter((champ) => !o.champsPresents.includes(champ));
      if (absents.length) ajouter('libelles_absents', ctx, msg`${absents.length} ligne(s) absente(s) : ` + absents.map((c) => '« ' + ancienLibelle(c) + ' »').join(', ') + '.');
      if (o.fusions) ajouter('cellules_fusionnees', ctx, msg`${o.fusions} zone(s) de cellules fusionnées.`);
      for (const v of o.colonnesVides) ajouter('colonne_vide', Object.assign({ adresse: v.adresse }, ctx), msg`Colonne « ${cite(v.valeur)} » sans contenu.`);
      for (const d of o.donneesSansNom) ajouter('donnees_sans_nom', Object.assign({ adresse: d.colonne }, ctx), msg`Colonne ${d.colonne} remplie mais sans nom d'étude.`);
      if (o.horsFiche.length) ajouter('hors_fiche', ctx, msg`${o.horsFiche.length} valeur(s) ignorée(s) : ` + o.horsFiche.map((h) => h.adresse).join(', ') + '.');
    }

    // --- Annuaire ---------------------------------------------------------------
    const formatEmail = parametres.annuaire && parametres.annuaire.format_email;
    for (const c of (correspondances.annuaire || {}).corrections_validees || []) {
      ajouter('correction_validee', { onglet: 'Annuaire' }, msg`${c.quoi} : « ${c.avant} » → « ${c.apres} » (${c.source}).`);
    }
    for (const a of (correspondances.annuaire || {}).personnes_a_ajouter || []) {
      ajouter('ajout_valide', { onglet: 'Annuaire' }, msg`${a.prenom} ${a.nom} (${a.email}), ${a.source}.`);
    }
    for (const p of annuaire.filter((x) => x.origine === 'annuaire')) {
      if (!formatEmail) break;
      const attendu = N.emailAttendu(p.prenom, p.nom, formatEmail);
      if (N.texteSimple(p.email) === attendu) continue;
      const corrige = ((correspondances.annuaire || {}).corrections_validees || []).some((c) => c.quoi === 'e-mail' && N.texteSimple(c.avant) === N.texteSimple(p.email));
      if (!corrige) ajouter('email_hors_format', { onglet: 'Annuaire', etude: p.prenom + ' ' + p.nom, adresse: p.adresse }, msg`« ${p.email} » au lieu de « ${attendu} ».`);
    }

    // --- Études -----------------------------------------------------------------
    const etudes = toutesLesEtudes(lecture);
    const statuts = [];
    const investigateurs = new Map();
    const arcsAbsents = new Map();
    const tags = { ecs: new Map(), patient: new Map() };

    for (const etude of etudes) {
      const analyse = N.analyserNomEtude(etude.nomBrut, correspondances.mentions_statut);
      etude.nom = analyse.nom;
      etude.id = N.identifiant(analyse.nom);
      const ctx = { onglet: etude.onglet, etude: analyse.nom };
      const indices = [];
      const valeurs = (champ) => etude.champs[champ] || [];
      const premiere = (champ) => valeurs(champ)[0];

      // Nom et statut
      let statut = null;
      if (analyse.statut) {
        statut = { statut: analyse.statut, origine: 'nom : « ' + analyse.mention + ' »' };
        ajouter('statut_dans_nom', Object.assign({ adresse: etude.colonne + '·nom' }, ctx), msg`Mention « ${cite(analyse.mention)} » → statut proposé « ${analyse.statut} ».`);
      } else {
        for (const champ of ['debut_inclusion', 'duree_recrutement']) {
          for (const v of valeurs(champ)) {
            const mention = N.chercherMentionStatut(v.valeur, correspondances.mentions_statut);
            if (mention && !statut) {
              statut = { statut: mention.statut, origine: ancienLibelle(champ) + ' : « ' + cite(mention.mention) + ' »' };
              ajouter('statut_dans_nom', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(v.valeur)} » → statut proposé « ${mention.statut} ».`);
            }
          }
        }
      }
      if (!statut) {
        const defaut = correspondances.statut_par_defaut || {};
        statut = { statut: etude.suivi ? defaut.suivi : defaut.pole, origine: etude.suivi ? 'onglet « suivi ou terminées »' : 'par défaut' };
      }
      statuts.push({ onglet: etude.onglet, etude: analyse.nom, colonne: etude.colonne, statut: statut.statut, origine: statut.origine });
      if (/\s[-–]\s|\(/.test(analyse.nom) || analyse.reste.length) {
        ajouter('nom_avec_complement', Object.assign({ adresse: etude.colonne }, ctx), msg`« ${cite(etude.nomBrut)} ».`);
      }

      for (const h of etude.horsFiche) ajouter('valeur_sans_libelle', Object.assign({ adresse: h.adresse }, ctx), msg`« ${cite(h.valeur)} ».`);

      // Champs à valeur unique
      for (const [champ, liste] of Object.entries(etude.champs)) {
        const nature = descriptionLibelle(champ).nature;
        if (['filtre', 'drapeau', 'date', 'traitements'].includes(nature) && liste.length > 1) {
          ajouter('plusieurs_valeurs', Object.assign({ adresse: liste.map((v) => v.adresse).join(', ') }, ctx), msg`« ${ancienLibelle(champ)} » : ${liste.length} valeurs (` + liste.map((v) => '« ' + cite(v.valeur) + ' »').join(', ') + ').');
          indices.push('plusieurs valeurs dans « ' + ancienLibelle(champ) + ' »');
        }
        if (nature === 'texte' && ['inclusion', 'exclusion', 'thematique', 'design', 'question_specifique', 'rythme_visites', 'duree_suivi', 'tag_ecs', 'tag_innovacoeur'].includes(champ)) {
          const nus = liste.filter((v) => typeof v.valeur === 'number' || N.estDate(v.valeur) || /^\s*\d+\s*$/.test(String(v.valeur)));
          if (nus.length) indices.push('nombre ou date seul dans « ' + ancienLibelle(champ) + ' » (' + nus.map((v) => v.adresse).join(', ') + ')');
        }
        if (CAPACITE[champ] && liste.length > CAPACITE[champ]) {
          ajouter('criteres_nombreux', Object.assign({ adresse: liste[0].adresse }, ctx), msg`« ${ancienLibelle(champ)} » : ${liste.length} lignes pour ${CAPACITE[champ]} prévues.`);
        }
        // Noms commerciaux dans les textes
        if (nature === 'texte' || nature === 'traitements') {
          for (const v of liste) {
            const noms = N.nomsCommerciauxCites(v.valeur, filtresParam);
            if (noms.length) ajouter('nom_commercial', Object.assign({ adresse: v.adresse }, ctx), msg`${noms.join(', ')} dans « ${ancienLibelle(champ)} ».`);
          }
        }
        // Une personne dans une ligne qui n'est pas un contact
        if (nature !== 'personne' && nature !== 'nom') {
          for (const v of liste) {
            if (typeof v.valeur !== 'string') continue;
            const personnes = N.separerPersonnes(v.valeur);
            const connue = personnes.some((p) => rapprocher(p, arcs).qualite === 'exacte');
            const avecDect = /^[A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý]{2,}[A-ZÀ-Ý -]*\s+\d{2}[ ,.]?\d{3}\s*$/.test(v.valeur.trim());
            if (connue || avecDect) indices.push('nom de personne en « ' + ancienLibelle(champ) + ' » (' + v.adresse + ')');
          }
        }
      }

      // Début d'inclusion
      for (const v of valeurs('debut_inclusion').slice(0, 1)) {
        const date = N.lireDate(v.valeur);
        if (date.ok) continue;
        if (date.nombre) { indices.push('nombre seul en « Début d\'inclusion » (' + v.adresse + ')'); continue; }
        const mention = N.chercherMentionStatut(v.valeur, correspondances.mentions_statut);
        if (mention) continue; // déjà traité comme statut
        ajouter('date_texte', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(v.valeur)} »` + (date.indice ? msg` (repéré : ${date.indice})` : '') + '.');
        if (!date.indice) indices.push('« Début d\'inclusion » sans aucune date (' + v.adresse + ')');
      }

      // Contacts
      for (const champ of ['investigateur', 'arc_1', 'arc_backup']) {
        const estArc = !!descriptionLibelle(champ).arc;
        for (const v of valeurs(champ)) {
          const personnes = N.separerPersonnes(v.valeur);
          if (personnes.some((p) => p.dect.length)) ajouter('dect_colle', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(v.valeur)} ».`);
          if (personnes.length > 1 && champ !== 'arc_backup') ajouter('plusieurs_personnes', Object.assign({ adresse: v.adresse }, ctx), msg`${personnes.length} personnes dans « ${ancienLibelle(champ)} » : « ${cite(v.valeur)} ».`);
          for (const p of personnes) {
            const estNonPersonne = (correspondances.valeurs_non_personnes || []).some((x) => N.texteSimple(x) === N.texteSimple(p.nom));
            if (estNonPersonne || !p.nom || !ressembleANom(p.nom)) {
              ajouter('non_personne', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(p.brut)} » en « ${ancienLibelle(champ)} ».`);
              continue;
            }
            const trouve = rapprocher(p, arcs);
            if (!estArc) {
              if (trouve.qualite === 'exacte') indices.push('un ARC de l\'annuaire (' + trouve.fiche.prenom + ' ' + trouve.fiche.nom + ') en « Investigateur principal » (' + v.adresse + ')');
              else investigateurs.set(p.cle, (investigateurs.get(p.cle) || []).concat([v.adresse]));
              continue;
            }
            if (trouve.qualite === 'aucune') { arcsAbsents.set(p.nom, (arcsAbsents.get(p.nom) || []).concat([{ onglet: etude.onglet, etude: analyse.nom, adresse: v.adresse }])); continue; }
            if (trouve.qualite === 'partielle') ajouter('nom_incomplet', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(p.brut)} » rapproché de ${trouve.fiche.prenom} ${trouve.fiche.nom}.`);
            const dectAnnuaire = String(trouve.fiche.dect || '').split(/\D+/).filter(Boolean);
            if (p.dect.length && dectAnnuaire.length && !p.dect.some((d) => dectAnnuaire.includes(d))) {
              ajouter('dect_divergent', Object.assign({ adresse: v.adresse }, ctx), msg`${trouve.fiche.prenom} ${trouve.fiche.nom} : ${p.dect.join('/')} dans la fiche, ${trouve.fiche.dect} dans l'annuaire.`);
            }
          }
        }
      }

      // Drapeaux d'affichage
      for (const champ of ['afficher_ecardioscope', 'afficher_innovacoeur']) {
        const v = premiere(champ);
        if (!v) continue;
        const texte = N.enTexte(v.valeur);
        if (texte === '0' || texte === '1') continue;
        if (/^[01]\b/.test(texte) && /doublon/i.test(texte)) { etude.mentionDoublon = true; continue; }
        ajouter('drapeau_illisible', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(v.valeur)} ».`);
      }

      // Filtres
      const filtresAncien = correspondances.libelles.filter((e) => e.nature === 'filtre' && (e.section || 'principal') === 'principal');
      for (const desc of filtresAncien) {
        const param = filtresParam.find((f) => f.id === desc.filtre) || {};
        const descPatient = correspondances.libelles.find((e) => e.nature === 'filtre' && e.section === 'patient' && e.filtre === desc.filtre);
        const lire = (d) => {
          const v = d && premiere(d.champ);
          if (!v) return null;
          const lu = N.lireFiltre(v.valeur);
          if (lu.ok && lu.oui === true && d.oui_signifie_min !== undefined) Object.assign(lu, { min: d.oui_signifie_min, minStricte: true, ouiTraduit: true });
          const attenduOuiNon = param.type === 'requis';
          const lisible = lu.ok && (attenduOuiNon ? lu.oui !== null : (lu.oui === null || lu.ouiTraduit));
          if (!lisible) {
            ajouter('filtre_illisible', Object.assign({ adresse: v.adresse }, ctx), msg`« ${d.ancien.slice(0, 40)} » : « ${cite(v.valeur)} »` + (attenduOuiNon ? msg` (oui/non attendu).` : '.'));
            indices.push('filtre non interprétable en « ' + d.ancien.slice(0, 40) + ' » (' + v.adresse + ')');
            return null;
          }
          if ((lu.minStricte && !lu.ouiTraduit) || lu.maxStricte) ajouter('borne_stricte', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(v.valeur)} ».`);
          return Object.assign(lu, { adresse: v.adresse });
        };
        const ecs = lire(desc);
        const pat = lire(descPatient);
        if (pat && !ecs && !premiere(desc.champ)) {
          ajouter('filtre_patient_seul', Object.assign({ adresse: pat.adresse }, ctx), msg`${param.libelle || desc.filtre} : « ${pat.brut} » côté patient seulement.`);
        } else if (ecs && pat) {
          const coherent = pat.ouiTraduit ? (ecs.min !== null && ecs.min >= pat.min && ecs.max === null) : N.filtresEgaux(ecs, pat);
          if (!coherent) ajouter('filtre_divergent', Object.assign({ adresse: ecs.adresse + ' / ' + pat.adresse }, ctx), msg`${param.libelle || desc.filtre} : « ${ecs.brut} » (e-Cardioscope) / « ${pat.brut} » (InnovaCoeur).`);
        }
      }

      // Traitements
      for (const v of valeurs('patient_filtre_traitements')) {
        const lu = N.lireTraitements(v.valeur, filtresParam);
        if (lu.classes.length) ajouter('traitements_lus', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(v.valeur)} » → ` + lu.classes.map((id) => (filtresParam.find((f) => f.id === id) || {}).libelle || id).join(', ') + '.');
        for (const inconnu of lu.inconnus) ajouter('traitement_inconnu', Object.assign({ adresse: v.adresse }, ctx), msg`« ${cite(inconnu)} ».`);
      }

      // Valeurs des anciens « tags » (pour construire pathologies et vignettes en 1.3)
      for (const v of valeurs('tag_ecs')) for (const t of N.enTexte(v.valeur).split('+').map((x) => x.trim()).filter(Boolean)) tags.ecs.set(t, (tags.ecs.get(t) || 0) + 1);
      for (const v of valeurs('tag_innovacoeur')) { const t = N.enTexte(v.valeur); tags.patient.set(t, (tags.patient.get(t) || 0) + 1); }

      // Bilan des indices de décalage
      etude.indices = indices;
      if (indices.length >= 2) ajouter('colonne_decalee', Object.assign({ adresse: 'colonne ' + etude.colonne }, ctx), msg`${indices.length} indices : ` + indices.join(' ; ') + '.');
      else if (indices.length === 1) ajouter('indice_decalage', Object.assign({ adresse: 'colonne ' + etude.colonne }, ctx), indices[0] + '.');
    }

    // ARC absents de l'annuaire (une alerte par personne)
    for (const [nom, lieux] of arcsAbsents) {
      ajouter('arc_absent_annuaire', { onglet: lieux.map((l) => l.onglet).filter((x, i, t) => t.indexOf(x) === i).join(', '), etude: nom, adresse: lieux.map((l) => l.adresse).join(', ') },
        msg`${nom}, cité(e) dans : ` + lieux.map((l) => l.etude).filter((x, i, t) => t.indexOf(x) === i).join(', ') + '.');
    }
    if (investigateurs.size) ajouter('investigateurs', { onglet: 'Annuaire' }, msg`${investigateurs.size} investigateur(s) différent(s) cité(s) dans les fiches.`);

    // Doublons entre onglets
    const parId = new Map();
    for (const e of etudes) parId.set(e.id, (parId.get(e.id) || []).concat([e]));
    const doublons = [];
    for (const [id, groupe] of parId) {
      if (groupe.length < 2) continue;
      const champs = [...new Set(groupe.flatMap((e) => Object.keys(e.champs)))];
      const divergents = champs.filter((champ) => {
        const versions = groupe.map((e) => (e.champs[champ] || []).map((v) => N.texteSimple(v.valeur)).join(' | '));
        return versions.some((v) => v !== versions[0]);
      });
      doublons.push({ id, nom: groupe[0].nom, onglets: groupe.map((e) => e.onglet + ' (' + e.colonne + ')'), divergents: divergents.map(ancienLibelle) });
      ajouter('doublon', { onglet: groupe.map((e) => e.onglet).join(', '), etude: groupe[0].nom, adresse: groupe.map((e) => e.colonne).join(', ') },
        msg`Présente dans : ` + groupe.map((e) => '« ' + e.onglet + ' »' + (e.mentionDoublon ? ' (marquée « ne pas faire doublon »)' : '')).join(', ') + '. ' +
        (divergents.length ? msg`${divergents.length} ligne(s) différente(s) : ` + divergents.map((c) => '« ' + ancienLibelle(c).slice(0, 40) + ' »').join(', ') + '.' : 'Contenus identiques.'));
    }

    // Inventaire et compteurs
    const inventaire = lecture.onglets.map((o) => ({
      onglet: o.nom, role: o.role, nombre: o.role === 'annuaire' ? o.nbPersonnes : (o.etudes || []).length,
      noms: (o.etudes || []).map((e) => e.nom),
    }));
    const compteurs = { corriger: 0, verifier: 0, info: 0, parType: {} };
    for (const a of alertes) {
      compteurs[a.gravite]++;
      compteurs.parType[a.type] = (compteurs.parType[a.type] || 0) + 1;
    }
    const enListe = (carte) => [...carte.entries()].sort((a, b) => b[1] - a[1]).map(([valeur, nombre]) => ({ valeur, nombre }));
    return {
      inventaire, alertes, compteurs, statuts, doublons,
      nombreEtudes: etudes.length, nombrePersonnesAnnuaire: lecture.annuaire.length,
      tags: { ecs: enListe(tags.ecs), patient: enListe(tags.patient) },
    };
  }

  /** Texte des compteurs SEULEMENT (aucun nom, aucun contenu) : à transmettre sans risque. */
  function resumeCompteurs(rapport) {
    const lignes = ['CONTRÔLE INNOVACARE — compteurs seulement (aucun contenu)', ''];
    lignes.push('Études lues : ' + rapport.nombreEtudes + ' ; personnes dans l\'annuaire : ' + rapport.nombrePersonnesAnnuaire);
    lignes.push('Par onglet :');
    for (const i of rapport.inventaire) lignes.push('  ' + i.onglet + ' : ' + i.nombre + (i.role === 'annuaire' ? ' personnes' : ' études'));
    lignes.push('');
    lignes.push('Alertes : ' + rapport.compteurs.corriger + ' à corriger, ' + rapport.compteurs.verifier + ' à vérifier, ' + rapport.compteurs.info + ' pour information');
    for (const [type, [gravite, titre]] of Object.entries(TYPES)) {
      const n = rapport.compteurs.parType[type];
      if (n) lignes.push('  [' + gravite + '] ' + titre + ' : ' + n);
    }
    lignes.push('');
    lignes.push('Doublons entre onglets : ' + rapport.doublons.length);
    return lignes.join('\n');
  }

  InnovaCare.controles = { TYPES, controler, resumeCompteurs, preparerAnnuaire, rapprocher };
})(typeof globalThis !== 'undefined' ? globalThis : this);

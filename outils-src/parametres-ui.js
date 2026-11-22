// =============================================================================
// parametres-ui.js — formulaire d'édition de parametres.json, avec aperçu
// =============================================================================
// Le formulaire est décrit par la liste RUBRIQUES ci-dessous : pour ajouter un
// réglage, il suffit d'ajouter une ligne (chemin dans le JSON, libellé, type).
// Types de champ : texte, long (plusieurs lignes), nombre, couleur, choix (liste),
// lignes (une valeur par ligne → tableau), cases (cases à cocher → tableau).
// Une rubrique « liste » édite un tableau d'objets (pôles, pathologies…), une fiche par élément.
// Étape 1.5 : les paramètres sont lus dans l'Excel des études (onglet masqué « Paramètres »)
// et réécrits dans ce même Excel (« Enregistrer dans l'Excel »). Rien n'est envoyé.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const ORIGINE = JSON.parse(document.getElementById('donnees-parametres').textContent);
  let P = JSON.parse(JSON.stringify(ORIGINE));
  let nomFichier = 'réglages de départ de l\'outil (aucun Excel ouvert)';
  let excel = null;      // { poignee, fichier, nom, sansParametres } : l'Excel ouvert
  let nonEnregistre = false; // modifications pas encore enregistrées dans l'Excel
  const CLE_MEMOIRE = 'excel-etudes'; // la même que le Publieur : un seul choix de fichier
  const $ = (id) => document.getElementById(id);

  // --- Description du formulaire ------------------------------------------------------

  const MODULES = [{ valeur: 'interne', libelle: 'outil interne' }, { valeur: 'professionnel', libelle: 'médecins libéraux' }, { valeur: 'patient', libelle: 'patients' }];
  const groupes = () => (P.groupes_pathologies || []).map((g) => ({ valeur: g.id, libelle: g.nom }));
  const poles = () => (P.poles || []).map((p) => ({ valeur: p.id, libelle: p.nom }));

  const RUBRIQUES = [
    { titre: 'Identité', ouverte: true, champs: [
      { chemin: 'specialite.nom', libelle: 'Spécialité' },
      { chemin: 'specialite.instance', libelle: 'Nom de l\'instance' },
      { chemin: 'modules.interne', libelle: 'Outil interne (médecins du service)' },
      { chemin: 'modules.patient', libelle: 'Outil patient' },
      { chemin: 'modules.professionnel', libelle: 'Outil médecins libéraux' },
      { chemin: 'modules.plateforme', libelle: 'Plateforme' },
    ] },
    { titre: 'Couleurs et police', champs: [
      { chemin: 'couleurs.turquoise', libelle: 'Couleur principale', type: 'couleur' },
      { chemin: 'couleurs.or', libelle: 'Couleur des boutons', type: 'couleur' },
      { chemin: 'couleurs.rose', libelle: 'Couleur d\'accent', type: 'couleur' },
      { chemin: 'couleurs.vert', libelle: 'Couleur de validation', type: 'couleur' },
      { chemin: 'police', libelle: 'Police' },
    ] },
    { titre: 'Pôles (un onglet Excel par pôle)', liste: 'poles', nomElement: 'pôle',
      note: 'L\'identifiant ne doit pas changer une fois l\'Excel en service. Le nom est celui de l\'onglet (31 caractères au plus).',
      colonnes: [{ cle: 'id', libelle: 'Identifiant' }, { cle: 'nom', libelle: 'Nom de l\'onglet' }] },
    { titre: 'Groupes de pathologies', liste: 'groupes_pathologies', nomElement: 'groupe',
      colonnes: [{ cle: 'id', libelle: 'Identifiant' }, { cle: 'nom', libelle: 'Nom' }, { cle: 'emoji', libelle: 'Émoji' }] },
    { titre: 'Pathologies (contextes cliniques)', liste: 'pathologies', nomElement: 'pathologie',
      note: 'L\'ordre est celui des boutons de l\'outil interne. Les synonymes servent à reconnaître les anciens libellés (un par ligne).',
      colonnes: [{ cle: 'id', libelle: 'Identifiant' }, { cle: 'emoji', libelle: 'Émoji' }, { cle: 'nom', libelle: 'Nom' },
        { cle: 'groupe', libelle: 'Groupe', type: 'choix', options: groupes }, { cle: 'synonymes', libelle: 'Synonymes', type: 'lignes' }] },
    { titre: 'Vignettes patient', liste: 'vignettes', nomElement: 'vignette',
      note: 'Situations dans lesquelles le patient se reconnaît (première étape du test patient). Mots simples.',
      colonnes: [{ cle: 'id', libelle: 'Identifiant' }, { cle: 'emoji', libelle: 'Émoji' }, { cle: 'nom', libelle: 'Libellé', type: 'long' },
        { cle: 'description', libelle: 'Précision', type: 'long' }, { cle: 'synonymes', libelle: 'Synonymes', type: 'lignes' }] },
    { titre: 'Filtres d\'éligibilité et traitements', liste: 'filtres', nomElement: 'filtre',
      note: 'Bornes : deux lignes dans l\'Excel (minimum, maximum). Requis : une ligne requis / exclu / indifférent. Les médicaments s\'écrivent en DCI, le nom commercial entre parenthèses.',
      colonnes: [{ cle: 'id', libelle: 'Identifiant' }, { cle: 'libelle', libelle: 'Libellé (professionnels)' },
        { cle: 'type', libelle: 'Type', type: 'choix', options: () => [{ valeur: 'bornes', libelle: 'bornes (min / max)' }, { valeur: 'requis', libelle: 'requis / exclu / indifférent' }] },
        { cle: 'unite', libelle: 'Unité' }, { cle: 'valeur_min', libelle: 'Valeur la plus basse acceptée', type: 'nombre' }, { cle: 'valeur_max', libelle: 'Valeur la plus haute acceptée', type: 'nombre' },
        { cle: 'visibilite', libelle: 'Publié jusqu\'au niveau', type: 'choix', options: () => [{ valeur: 'professionnel', libelle: 'professionnel' }, { valeur: 'patient', libelle: 'patient' }] },
        { cle: 'modules', libelle: 'Posé dans', type: 'cases', options: () => MODULES },
        { cle: 'question_patient', libelle: 'Question posée au patient', type: 'long' }, { cle: 'libelle_patient', libelle: 'Libellé patient (traitement)', type: 'long' },
        { cle: 'dci', libelle: 'DCI', type: 'lignes' }, { cle: 'noms_commerciaux', libelle: 'Noms commerciaux', type: 'lignes' }, { cle: 'synonymes', libelle: 'Autres façons de l\'écrire', type: 'lignes' }] },
    { titre: 'Listes de valeurs (listes déroulantes)', champs: [
      { chemin: 'listes.phase', libelle: 'Phases', type: 'lignes' },
      { chemin: 'listes.statut', libelle: 'Statuts', type: 'lignes', aide: 'Attention : les outils reconnaissent « ouvert » pour proposer une étude.' },
      { chemin: 'listes.fonction', libelle: 'Fonctions (annuaire)', type: 'lignes' },
      { chemin: 'annuaire.format_email', libelle: 'Format des e-mails' },
      { chemin: 'annuaire.format_mssante', libelle: 'Format des adresses MSSanté' },
    ] },
    { titre: 'Textes patient', champs: [
      { chemin: 'textes.patient.titre', libelle: 'Titre' }, { chemin: 'textes.patient.accroche', libelle: 'Accroche', type: 'long' },
      { chemin: 'textes.patient.sous_titre', libelle: 'Sous-titre (une ligne par phrase)', type: 'lignes' }, { chemin: 'textes.patient.bandeau', libelle: 'Bandeau' },
      { chemin: 'textes.patient.edito_titre', libelle: 'Titre de l\'éditorial' }, { chemin: 'textes.patient.edito_texte', libelle: 'Éditorial', type: 'long' },
      { chemin: 'textes.patient.appel_titre', libelle: 'Appel au test : titre', type: 'long' }, { chemin: 'textes.patient.appel_texte', libelle: 'Appel au test : texte', type: 'long' },
      { chemin: 'textes.patient.appel_bouton', libelle: 'Bouton du test' }, { chemin: 'textes.patient.appel_duree', libelle: 'Durée affichée' },
      { chemin: 'textes.patient.etape1_titre', libelle: 'Étape 1 : titre' }, { chemin: 'textes.patient.etape1_texte', libelle: 'Étape 1 : texte', type: 'long' },
      { chemin: 'textes.patient.etape2_titre', libelle: 'Étape 2 : titre' }, { chemin: 'textes.patient.etape2_texte', libelle: 'Étape 2 : texte', type: 'long' },
      { chemin: 'textes.patient.aucun_resultat_titre', libelle: 'Aucun résultat : titre', type: 'long' }, { chemin: 'textes.patient.aucun_resultat_texte', libelle: 'Aucun résultat : texte', type: 'long' },
      { chemin: 'textes.patient.aucun_resultat_conseil', libelle: 'Aucun résultat : conseil', type: 'long' },
      { chemin: 'textes.patient.avertissement', libelle: 'Avertissement (pied de page)', type: 'long' },
      { chemin: 'textes.patient.pied_de_page', libelle: 'Pied de page (une ligne par ligne)', type: 'lignes' },
      { chemin: 'textes.patient.conclusion', libelle: 'Conclusion' },
    ] },
    { titre: 'Bénéfices (page patient)', liste: 'textes.patient.benefices', nomElement: 'bénéfice',
      colonnes: [{ cle: 'emoji', libelle: 'Émoji' }, { cle: 'titre', libelle: 'Titre' }, { cle: 'texte', libelle: 'Texte', type: 'long' }] },
    { titre: 'Témoignages (page patient)', liste: 'textes.patient.temoignages', nomElement: 'témoignage',
      colonnes: [{ cle: 'texte', libelle: 'Témoignage', type: 'long' }, { cle: 'auteur', libelle: 'Auteur' }] },
    { titre: 'Messages types', champs: [
      { chemin: 'textes.email_patient.objet', libelle: 'E-mail patient : objet', aide: '{protocole} est remplacé par le nom de l\'étude.' },
      { chemin: 'textes.email_patient.corps', libelle: 'E-mail patient : corps', type: 'lignes', aide: '{situations} et {reponses} sont remplacés par les réponses du patient.' },
      { chemin: 'textes.adressage.objet', libelle: 'Adressage (libéraux) : objet' },
      { chemin: 'textes.adressage.corps', libelle: 'Adressage (libéraux) : corps', type: 'lignes', aide: 'À rédiger.' },
    ] },
    { titre: 'Mémos', champs: [
      { chemin: 'memos.titre', libelle: 'Titre' }, { chemin: 'memos.hashtags', libelle: 'En-tête' },
      { chemin: 'memos.libelle_criteres', libelle: 'Intitulé des critères' }, { chemin: 'memos.pied', libelle: 'Pied de page', type: 'long' },
    ] },
    { titre: 'Sections des mémos', liste: 'memos.sections', nomElement: 'section',
      colonnes: [{ cle: 'emoji', libelle: 'Émoji' }, { cle: 'titre', libelle: 'Titre' }, { cle: 'poles', libelle: 'Pôles', type: 'cases', options: poles }] },
    { titre: 'Publication (site public)', champs: [
      { chemin: 'publication.depot', libelle: 'Dépôt GitHub (propriétaire/nom)' },
      { chemin: 'publication.branche', libelle: 'Branche' },
      { chemin: 'publication.url_site', libelle: 'Adresse du site' },
      { chemin: 'publication.contacts_arc', libelle: 'Publier les e-mails des ARC', type: 'booleen', aide: 'À activer seulement une fois les ARC informés.' },
      { chemin: 'publication.site_discret', libelle: 'Site discret (bandeau de test)', type: 'booleen' },
      { chemin: 'textes.site.titre_liste', libelle: 'Sous-titre du site' },
      { chemin: 'textes.site.bandeau_test', libelle: 'Texte du bandeau de test' },
      { chemin: 'textes.site.avertissement_pro', libelle: 'Avertissement en bas de la page des médecins libéraux', type: 'long', aide: 'Vide = pas d\'avertissement sur cette page (celui des patients reste sur l\'accueil).' },
    ] },
    { titre: 'Newsletter', champs: [
      { chemin: 'newsletter.jour', libelle: 'Jour du brouillon' },
      { chemin: 'newsletter.nombre_etudes_min', libelle: 'Études mises en lumière (minimum)', type: 'nombre' },
      { chemin: 'newsletter.nombre_etudes_max', libelle: 'Études mises en lumière (maximum)', type: 'nombre' },
      { chemin: 'newsletter.delai_alerte_maj_mois', libelle: 'Alerte « non mis à jour depuis » (mois)', type: 'nombre' },
      { chemin: 'newsletter.rappel', libelle: 'Rappel au porteur', type: 'long' },
    ] },
  ];

  // --- Lecture / écriture d'un chemin « a.b.c » dans l'objet ------------------------------

  function lire(objet, chemin) {
    return chemin.split('.').reduce((o, cle) => (o && typeof o === 'object' ? o[cle] : undefined), objet);
  }
  function ecrire(objet, chemin, valeur) {
    const cles = chemin.split('.');
    let o = objet;
    for (const cle of cles.slice(0, -1)) { if (!o[cle] || typeof o[cle] !== 'object') o[cle] = {}; o = o[cle]; }
    o[cles[cles.length - 1]] = valeur;
  }

  // --- Fabrication des champs ---------------------------------------------------------

  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.assign(noeud, proprietes || {});
    for (const enfant of enfants) {
      if (enfant === null || enfant === undefined) continue;
      noeud.appendChild(typeof enfant === 'string' ? document.createTextNode(enfant) : enfant);
    }
    return noeud;
  }

  let compteur = 0;
  /** Un champ du formulaire. obtenir() lit la valeur actuelle, changer(v) l'enregistre. */
  function champ(desc, obtenir, changer) {
    const id = 'champ-' + (++compteur);
    const type = desc.type || 'texte';
    const boite = el('div', { className: 'champ' + (['long', 'lignes'].includes(type) ? ' large' : '') });
    boite.appendChild(el('label', { htmlFor: id }, desc.libelle));
    const valeur = obtenir();
    let saisie;
    if (type === 'long' || type === 'lignes') {
      saisie = el('textarea', { id, value: type === 'lignes' ? (Array.isArray(valeur) ? valeur.join('\n') : '') : (valeur === null || valeur === undefined ? '' : String(valeur)) });
      saisie.addEventListener('input', () => changer(type === 'lignes' ? saisie.value.split('\n').map((l) => l.trim()).filter(Boolean) : (saisie.value === '' && valeur === null ? null : saisie.value)));
    } else if (type === 'nombre') {
      saisie = el('input', { id, type: 'number', value: valeur === null || valeur === undefined ? '' : String(valeur) });
      saisie.addEventListener('input', () => changer(saisie.value === '' ? null : Number(saisie.value)));
    } else if (type === 'couleur') {
      const rangee = el('div', { className: 'rangee' });
      rangee.style.marginTop = '0';
      saisie = el('input', { id, type: 'color', value: valeur || '#000000' });
      const texte = el('input', { type: 'text', value: valeur || '', spellcheck: false, 'aria-label': desc.libelle + ' (code)' });
      texte.style.maxWidth = '120px';
      saisie.addEventListener('input', () => { texte.value = saisie.value; changer(saisie.value); });
      texte.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(texte.value)) saisie.value = texte.value; changer(texte.value); });
      rangee.append(saisie, texte);
      boite.appendChild(rangee);
      return boite;
    } else if (type === 'booleen') {
      saisie = el('select', { id });
      saisie.append(el('option', { value: 'true', textContent: 'oui' }), el('option', { value: 'false', textContent: 'non' }));
      saisie.value = valeur === true ? 'true' : 'false';
      saisie.addEventListener('change', () => changer(saisie.value === 'true'));
    } else if (type === 'choix') {
      saisie = el('select', { id });
      const options = desc.options();
      if (!options.some((o) => o.valeur === valeur)) saisie.appendChild(el('option', { value: valeur || '', textContent: valeur ? valeur + ' (inconnu)' : '—' }));
      for (const o of options) saisie.appendChild(el('option', { value: o.valeur, textContent: o.libelle }));
      saisie.value = valeur || '';
      saisie.addEventListener('change', () => changer(saisie.value));
    } else if (type === 'cases') {
      const actuel = Array.isArray(valeur) ? valeur.slice() : [];
      const cases = el('div', { className: 'cases', id });
      for (const o of desc.options()) {
        const c = el('input', { type: 'checkbox', checked: actuel.includes(o.valeur) });
        c.addEventListener('change', () => {
          const liste = desc.options().map((x) => x.valeur).filter((v) => (v === o.valeur ? c.checked : (obtenir() || []).includes(v)));
          changer(liste);
        });
        cases.appendChild(el('label', null, c, ' ' + o.libelle));
      }
      boite.appendChild(cases);
      return boite;
    } else {
      saisie = el('input', { id, type: 'text', value: valeur === null || valeur === undefined ? '' : String(valeur) });
      saisie.addEventListener('input', () => changer(saisie.value));
    }
    boite.appendChild(saisie);
    if (desc.aide) boite.appendChild(el('div', { className: 'aide' }, desc.aide));
    return boite;
  }

  // --- Rubriques ----------------------------------------------------------------------

  function rubriqueChamps(r, contenu) {
    const grille = el('div', { className: 'grille-champs' });
    for (const d of r.champs) grille.appendChild(champ(d, () => lire(P, d.chemin), (v) => { ecrire(P, d.chemin, v); modifie(); }));
    contenu.appendChild(grille);
  }

  function rubriqueListe(r, contenu) {
    const zone = el('div');
    const dessiner = () => {
      zone.textContent = '';
      const liste = lire(P, r.liste) || [];
      liste.forEach((element, i) => {
        const fiche = el('div', { className: 'fiche' });
        const titre = el('strong', null, (element.emoji ? element.emoji + ' ' : '') + (element.nom || element.libelle || element.titre || element.auteur || '(sans nom)'));
        const bouton = (texte, aria, action, desactive) => {
          const b = el('button', { type: 'button', className: 'secondaire petit', textContent: texte, disabled: !!desactive });
          b.setAttribute('aria-label', aria);
          b.addEventListener('click', action);
          return b;
        };
        const deplacer = (sens) => { const l = lire(P, r.liste); const [x] = l.splice(i, 1); l.splice(i + sens, 0, x); dessiner(); modifie(); };
        fiche.appendChild(el('div', { className: 'fiche-entete' }, titre,
          bouton('↑', 'Monter', () => deplacer(-1), i === 0),
          bouton('↓', 'Descendre', () => deplacer(1), i === liste.length - 1),
          bouton('Supprimer', 'Supprimer ce ' + r.nomElement, () => {
            if (!window.confirm('Supprimer ce ' + r.nomElement + ' ?')) return;
            lire(P, r.liste).splice(i, 1); dessiner(); modifie();
          })));
        const grille = el('div', { className: 'grille-champs' });
        for (const c of r.colonnes) {
          grille.appendChild(champ(c, () => element[c.cle], (v) => {
            element[c.cle] = v;
            if (['nom', 'libelle', 'titre', 'emoji', 'auteur'].includes(c.cle)) titre.textContent = (element.emoji ? element.emoji + ' ' : '') + (element.nom || element.libelle || element.titre || element.auteur || '(sans nom)');
            modifie();
          }));
        }
        fiche.appendChild(grille);
        zone.appendChild(fiche);
      });
      const ajouter = el('button', { type: 'button', className: 'secondaire', textContent: '+ Ajouter un ' + r.nomElement });
      ajouter.addEventListener('click', () => {
        if (!lire(P, r.liste)) ecrire(P, r.liste, []);
        const nouveau = {};
        for (const c of r.colonnes) nouveau[c.cle] = ['lignes', 'cases'].includes(c.type) ? [] : '';
        lire(P, r.liste).push(nouveau);
        dessiner(); modifie();
      });
      zone.appendChild(el('div', { className: 'rangee' }, ajouter));
    };
    dessiner();
    contenu.appendChild(zone);
  }

  function dessinerRubriques() {
    const zone = $('rubriques');
    zone.textContent = '';
    for (const r of RUBRIQUES) {
      const bloc = el('details', { className: 'rubrique', open: !!r.ouverte }, el('summary', null, r.titre));
      if (r.note) bloc.appendChild(el('p', { className: 'note' }, r.note));
      if (r.liste) rubriqueListe(r, bloc); else rubriqueChamps(r, bloc);
      zone.appendChild(bloc);
    }
  }

  // --- Vérification et aperçu ------------------------------------------------------------

  let minuterie = null;
  function modifie() {
    nonEnregistre = true;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { verifier(); apercu(); garderBrouillon(); }, 150);
  }

  // --- Brouillon automatique (src/brouillon.js) ----------------------------------------

  const stockage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  function garderBrouillon() { if (stockage && nonEnregistre) IC.brouillon.garder(stockage, P); }

  /** Affiche le bandeau si un brouillon existe et diffère des réglages affichés. */
  function afficherBrouillon() {
    const b = stockage && IC.brouillon.retrouver(stockage);
    const utile = !!b && !IC.parametres.identiques(b.parametres, P);
    $('bandeau-brouillon').hidden = !utile;
    if (utile) $('texte-brouillon').textContent = 'Des modifications non enregistrées dans l\'Excel, du ' + IC.brouillon.quand(b.date) + ', ont été retrouvées.';
  }

  function reprendreBrouillon() {
    const b = stockage && IC.brouillon.retrouver(stockage);
    if (!b) { afficherBrouillon(); return; }
    P = JSON.parse(JSON.stringify(b.parametres));
    nonEnregistre = true;
    nomFichier = 'brouillon du ' + IC.brouillon.quand(b.date) + (excel ? ', à enregistrer dans l\'Excel « ' + excel.nom + ' »' : ' (ouvrez l\'Excel pour l\'y enregistrer)');
    toutRedessiner();
  }

  function effacerBrouillon() {
    if (!window.confirm('Effacer définitivement ces modifications non enregistrées ?')) return;
    if (stockage) IC.brouillon.effacer(stockage);
    afficherBrouillon();
  }

  function verifier() {
    const problemes = IC.parametres.verifier(P);
    // Règles de publication (aucun DECT, aucun nom de l'établissement…) : signalées dès maintenant,
    // le Publieur refusera de publier tant qu'elles ne sont pas respectées.
    const publication = IC.parametres.verifierPourPublication(P).slice(problemes.length);
    const liste = $('problemes');
    liste.textContent = '';
    if (!problemes.length && !publication.length) liste.appendChild(el('li', { className: 'ok' }, '✔ Paramètres cohérents.'));
    for (const p of problemes) liste.appendChild(el('li', { className: 'alerte' }, '! ' + p.rubrique + ' : ' + p.message));
    for (const m of publication) liste.appendChild(el('li', { className: 'alerte' }, '! Publication : ' + m));
    return problemes;
  }

  function apercu() {
    const zone = $('apercu');
    for (const [nom, valeur] of Object.entries(P.couleurs || {})) zone.style.setProperty('--' + nom, valeur);
    zone.style.fontFamily = '"' + (P.police || 'DM Sans') + '", "Segoe UI", Arial, sans-serif';
    const nuancier = $('apercu-nuancier');
    nuancier.textContent = '';
    for (const [nom, valeur] of Object.entries(P.couleurs || {})) {
      const p = el('div', { className: 'pastille-couleur', title: nom + ' ' + valeur });
      p.style.background = valeur;
      nuancier.appendChild(p);
    }
    const vignettes = $('apercu-vignettes');
    vignettes.textContent = '';
    (P.vignettes || []).slice(0, 3).forEach((v, i) => {
      vignettes.appendChild(el('div', { className: 'vignette' + (i === 0 ? ' choisie' : '') }, el('span', null, v.emoji || ''), el('div', null, v.nom || '', el('small', null, v.description || ''))));
    });
    if ((P.vignettes || []).length > 3) vignettes.appendChild(el('p', { className: 'note' }, '… et ' + (P.vignettes.length - 3) + ' autre(s).'));
    const fevg = (P.filtres || []).find((f) => f.question_patient && f.reponses_patient) || (P.filtres || []).find((f) => f.question_patient);
    const question = $('apercu-question');
    question.textContent = '';
    if (fevg) {
      question.appendChild(el('div', { className: 'question' }, (fevg.emoji ? fevg.emoji + ' ' : '') + fevg.question_patient));
      const reponses = el('div', { className: 'reponses' });
      for (const r of fevg.reponses_patient || [{ libelle: 'Oui' }, { libelle: 'Non' }]) reponses.appendChild(el('span', null, r.libelle));
      question.appendChild(reponses);
    }
    const t = (P.textes && P.textes.patient) || {};
    $('apercu-bouton').textContent = (t.appel_bouton || 'Faites le test') + (t.appel_duree ? ' (' + t.appel_duree + ')' : '');
    const zonePatho = $('apercu-pathologies');
    zonePatho.textContent = '';
    for (const g of P.groupes_pathologies || []) {
      const membres = (P.pathologies || []).filter((x) => x.groupe === g.id);
      if (!membres.length) continue;
      zonePatho.appendChild(el('div', { className: 'note' }, (g.emoji || '') + ' ' + g.nom));
      zonePatho.appendChild(el('div', { className: 'puces' }, ...membres.map((x) => el('span', null, (x.emoji || '') + ' ' + x.nom))));
    }
    const m = P.memos || {};
    const section = (m.sections || [])[0] || {};
    $('apercu-memo').textContent = [
      (m.titre || ''), (m.hashtags || ''), '',
      (section.emoji || '') + ' ' + (section.titre || '').toUpperCase(), '',
      '### ' + (m.emoji_etude || '') + ' ÉTUDE-EXEMPLE — thématique fictive',
      (m.emoji_design || '') + ' Molécule X vs placebo — randomisé 1:1',
      (m.emoji_criteres || '') + ' ' + (m.libelle_criteres || ''),
      '- critère fictif n° 1', '- critère fictif n° 2',
      (m.emoji_contact || '') + ' Prénom NOM — prenom.nom@…',
    ].join('\n');
  }

  // --- Fichier JSON (rubrique « Avancé ») ----------------------------------------------

  const nomExcelAttendu = () => ((P.specialite && P.specialite.instance) || 'InnovaCare') + '_ETUDES.xlsx';
  function afficherOrigine() {
    $('origine').textContent = 'Réglages affichés : ' + nomFichier + '.';
    $('nom-excel-attendu').textContent = nomExcelAttendu();
  }
  const toutRedessiner = () => { afficherOrigine(); dessinerRubriques(); verifier(); apercu(); afficherBrouillon(); };

  function telechargerBlob(contenu, type, nom) {
    const lien = el('a', { href: URL.createObjectURL(new Blob([contenu], { type })), download: nom });
    document.body.appendChild(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
  }
  const TYPE_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  function telechargerJson() {
    const problemes = verifier();
    if (problemes.length && !window.confirm(problemes.length + ' problème(s) détecté(s) (voir la liste). Télécharger quand même ?')) return;
    const nom = IC.brouillon.nomDate('parametres', '.json');
    telechargerBlob(JSON.stringify(P, null, 2) + '\n', 'application/json', nom);
    $('message-fichier').textContent = '« ' + nom + ' » téléchargé (dossier « Téléchargements »).';
  }

  async function chargerJson(fichier) {
    try {
      P = JSON.parse(await fichier.text());
      nomFichier = '« ' + fichier.name + ' » (pas encore enregistrés dans l\'Excel)';
      nonEnregistre = true;
      garderBrouillon();
      toutRedessiner();
      $('message-fichier').textContent = 'Fichier ouvert. Pensez à « Enregistrer dans l\'Excel ».';
    } catch (erreur) {
      $('message-fichier').textContent = 'Ce fichier n\'est pas un JSON valide (' + erreur.message + ').';
    }
  }

  function reinitialiser() {
    if (!window.confirm('Abandonner toutes les modifications non enregistrées ?')) return;
    if (excel && excel.parametres) P = JSON.parse(JSON.stringify(excel.parametres));
    else P = JSON.parse(JSON.stringify(ORIGINE));
    nonEnregistre = false;
    toutRedessiner();
  }

  // --- Excel des études : ouverture ---------------------------------------------------------

  /** Lit l'Excel : ses paramètres (onglet masqué) deviennent les réglages affichés. */
  async function ouvrirExcel(fichier, poignee) {
    const etat = $('origine');
    if (!/\.xlsx$/i.test(fichier.name)) { etat.textContent = 'Ce fichier n\'est pas au format .xlsx.'; return; }
    if (nonEnregistre && !window.confirm('Des modifications ne sont pas enregistrées. Les abandonner et ouvrir cet Excel ?')) return;
    etat.textContent = 'Lecture en cours…';
    try {
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, await fichier.arrayBuffer());
      const lus = IC.lecture.lireParametres(grilles);
      const reglages = lus.parametres || JSON.parse(JSON.stringify(ORIGINE));
      const lu = IC.lecture.lireGabarit(grilles, reglages);
      if (lu.version === null || lu.version === undefined) {
        etat.textContent = 'Ce fichier n\'est pas l\'Excel harmonisé des études (onglet « Listes » introuvable). L\'ancien Excel doit d\'abord passer par l\'outil Migration.';
        return;
      }
      excel = { poignee: poignee || null, fichier, nom: fichier.name, parametres: lus.parametres };
      P = JSON.parse(JSON.stringify(reglages));
      nonEnregistre = false;
      nomFichier = lus.parametres
        ? 'ceux de l\'Excel « ' + fichier.name + ' » (' + lu.etudes.length + ' études)'
        : 'réglages de départ de l\'outil, car l\'Excel « ' + fichier.name + ' » ne contient pas encore les siens'
          + (lus.probleme === 'absent' ? '' : ' (onglet Paramètres ' + lus.probleme + ')')
          + ' : ils y seront rangés au premier « Enregistrer dans l\'Excel »';
      toutRedessiner();
      $('bouton-enregistrer').disabled = false;
      $('etat-excel').textContent = '';
      $('signalements-excel').textContent = '';
    } catch (erreur) {
      console.error(erreur);
      etat.textContent = 'Le fichier n\'a pas pu être lu (' + erreur.message + ').';
    }
  }

  async function choisirExcel() {
    if (!IC.memoireFichier.disponible()) { $('selecteur-excel').click(); return; }
    try {
      const choix = await IC.memoireFichier.choisir();
      if (!choix) return;
      try { await IC.memoireFichier.memoriser(CLE_MEMOIRE, choix.poignee); } catch (e) { /* pas grave */ }
      afficherRecharger(choix.poignee.name);
      await ouvrirExcel(choix.fichier, choix.poignee);
    } catch (erreur) { $('origine').textContent = 'Le sélecteur de fichier a échoué (' + erreur.name + ').'; }
  }

  function afficherRecharger(nom) {
    $('bouton-recharger-excel').hidden = false;
    $('bouton-recharger-excel').textContent = 'Recharger « ' + nom + ' »';
  }

  // Fichier mémorisé ; à défaut, celui que le Publieur avait mémorisé avant l'étape 1.5.
  const retrouverPoignee = async () => (await IC.memoireFichier.retrouver(CLE_MEMOIRE)) || IC.memoireFichier.retrouver('publieur-excel');

  async function rechargerExcel() {
    try {
      const poignee = await retrouverPoignee();
      const fichier = poignee && await IC.memoireFichier.relire(poignee);
      if (fichier) await ouvrirExcel(fichier, poignee); else $('origine').textContent = 'Autorisation refusée : choisissez de nouveau le fichier.';
    } catch (erreur) { $('origine').textContent = 'Le fichier mémorisé est introuvable : choisissez-le de nouveau.'; }
  }

  // --- Excel des études : enregistrement -----------------------------------------------------

  /**
   * Réécrit l'Excel avec les réglages affichés. Étapes : (1) autorisation d'écrire, demandée tout
   * de suite après le clic ; (2) relecture du fichier ACTUEL (un ARC a pu le modifier entre-temps) ;
   * (3) reconstruction avec les nouveaux réglages, sans perte ; (4) copie de sauvegarde téléchargée ;
   * (5) écriture à sa place, ou téléchargement si le navigateur ne sait pas écrire.
   */
  async function enregistrer() {
    const etat = $('etat-excel');
    const liste = $('signalements-excel');
    liste.textContent = '';
    etat.className = '';
    if (!excel) { etat.textContent = 'Ouvrez d\'abord l\'Excel (section 1).'; return; }
    if (verifier().length) { etat.textContent = 'Corrigez d\'abord les problèmes signalés en haut de la liste des rubriques.'; return; }
    $('bouton-enregistrer').disabled = true;
    try {
      const ecriturePermise = excel.poignee ? await IC.memoireFichier.autoriserEcriture(excel.poignee) : false;
      etat.textContent = 'Relecture de l\'Excel et mise à jour en cours…';
      const fichier = excel.poignee ? await excel.poignee.getFile() : excel.fichier;
      const octets = await fichier.arrayBuffer();
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, octets);
      const anciens = IC.lecture.lireParametres(grilles).parametres || ORIGINE;
      // Lecture : les LIGNES selon les nouveaux réglages (une ligne supprimée part en Remarques), les ONGLETS
      // selon les deux (un pôle renommé ou supprimé : ses études sont retrouvées et replacées).
      const nomsPoles = new Set((P.poles || []).map((x) => x.nom));
      const lecture = Object.assign({}, P, { poles: (P.poles || []).concat((anciens.poles || []).filter((x) => !nomsPoles.has(x.nom))) });
      const lu = IC.lecture.lireGabarit(grilles, lecture);
      if (lu.version === null || lu.version === undefined) { etat.textContent = 'Ce fichier n\'est plus l\'Excel harmonisé des études : rien n\'a été écrit.'; return; }
      const connus = new Set(lecture.poles.map((x) => x.nom.slice(0, 31)).concat(Object.values(IC.gabarit.NOMS_ONGLETS)));
      const enTrop = grilles.map((g) => g.nom).filter((n) => !connus.has(n));
      if (enTrop.length && !window.confirm('Ces onglets ajoutés à la main ne seront pas repris : ' + enTrop.join(', ') + '.\nUne copie de sauvegarde sera téléchargée. Continuer ?')) { etat.textContent = 'Enregistrement annulé : rien n\'a été écrit.'; return; }
      const { contenu, signalements } = IC.lecture.versContenu(lu, P);
      const tampon = await IC.gabarit.creerClasseur(window.ExcelJS, P, contenu).xlsx.writeBuffer();
      const base = excel.nom.replace(/\.xlsx$/i, '');
      // Nom impossible à confondre avec le bon fichier : la sauvegarde est l'ANCIENNE version.
      const nomSauvegarde = IC.brouillon.nomDate('ANCIENNE_VERSION_' + base, '.xlsx');
      telechargerBlob(octets, TYPE_EXCEL, nomSauvegarde);
      const bilan = lu.etudes.length + ' études et ' + lu.annuaire.length + ' personnes reprises.';
      if (ecriturePermise) {
        const r = await IC.memoireFichier.ecrire(excel.poignee, tampon);
        if (!r.ok) {
          etat.className = 'etat-echec';
          etat.textContent = r.raison === 'verrouille'
            ? '✘ L\'Excel est ouvert (par vous ou par un ARC) : il n\'a pas été modifié. Fermez-le partout, puis cliquez de nouveau sur « Enregistrer dans l\'Excel ».'
            : '✘ L\'écriture a échoué (' + r.detail + ') : l\'Excel n\'a pas été modifié.';
          liste.appendChild(el('li', null, el('button', { type: 'button', className: 'secondaire petit', textContent: 'Télécharger plutôt le fichier mis à jour', onclick: () => telechargerBlob(tampon, TYPE_EXCEL, excel.nom) })));
          return;
        }
        if (stockage) IC.brouillon.effacer(stockage);
        etat.className = 'etat-ok';
        etat.textContent = '✔ Enregistré dans « ' + excel.nom + ' ». ' + bilan + ' Rien d\'autre à faire. Dans « Téléchargements », « ' + nomSauvegarde + ' » est l\'ancienne version, gardée par précaution : ne pas la remettre dans le dossier.';
      } else {
        telechargerBlob(tampon, TYPE_EXCEL, excel.nom);
        etat.className = 'etat-ok';
        etat.textContent = '✔ ' + bilan + ' Ce navigateur ne peut pas écrire directement dans le fichier : deux fichiers ont été téléchargés. Déplacez dans le dossier des outils, à la place de l\'ancien, celui qui s\'appelle exactement « ' + excel.nom + ' » (si Windows l\'a renommé « … (1).xlsx », retirez le « (1) »). L\'autre, « ' + nomSauvegarde + ' », est l\'ancienne version : ne pas l\'utiliser.';
      }
      excel.parametres = JSON.parse(JSON.stringify(P));
      nonEnregistre = false;
      nomFichier = 'ceux de l\'Excel « ' + excel.nom + ' » (' + lu.etudes.length + ' études)';
      afficherOrigine();
      afficherBrouillon();
      const anomalies = lu.anomalies.filter((a) => a.type === 'libelle_inconnu');
      for (const a of anomalies) liste.appendChild(el('li', { className: 'alerte' }, '! ' + a.onglet + ' ' + (a.adresse || '') + ' : ' + a.message + ' Ses valeurs ont été gardées en Remarques.'));
      for (const x of signalements) liste.appendChild(el('li', { className: 'alerte' }, '! ' + x.etude + ' : ' + x.message));
      if (!anomalies.length && !signalements.length) liste.appendChild(el('li', { className: 'ok' }, '✔ Aucune valeur déplacée.'));
    } catch (erreur) {
      console.error(erreur);
      etat.className = 'etat-echec';
      etat.textContent = '✘ Le fichier n\'a pas pu être lu ou écrit (' + erreur.message + ') : l\'Excel n\'a pas été modifié. Est-il ouvert dans Excel ?';
    } finally {
      $('bouton-enregistrer').disabled = false;
    }
  }

  // --- Démarrage ------------------------------------------------------------------------

  async function demarrer() {
    toutRedessiner();
    $('bouton-telecharger').addEventListener('click', telechargerJson);
    $('bouton-charger').addEventListener('click', () => $('selecteur-json').click());
    $('selecteur-json').addEventListener('change', (e) => { if (e.target.files[0]) chargerJson(e.target.files[0]); });
    $('bouton-reinitialiser').addEventListener('click', reinitialiser);
    $('bouton-ouvrir-excel').addEventListener('click', choisirExcel);
    $('bouton-recharger-excel').addEventListener('click', rechargerExcel);
    $('selecteur-excel').addEventListener('change', (e) => { if (e.target.files[0]) ouvrirExcel(e.target.files[0], null); });
    $('bouton-enregistrer').addEventListener('click', enregistrer);
    $('bouton-reprendre').addEventListener('click', reprendreBrouillon);
    $('bouton-effacer-brouillon').addEventListener('click', effacerBrouillon);
    // Toute saisie dans les rubriques = modification à enregistrer.
    ['input', 'change'].forEach((n) => $('rubriques').addEventListener(n, () => { nonEnregistre = true; }));
    $('rubriques').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') nonEnregistre = true; });
    window.addEventListener('beforeunload', (e) => { if (nonEnregistre) { e.preventDefault(); e.returnValue = ''; } });
    const zone = $('zone-depot');
    ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, () => zone.classList.remove('survol')));
    zone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) ouvrirExcel(e.dataTransfer.files[0], null); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
    if (IC.memoireFichier.disponible()) {
      try {
        const poignee = await retrouverPoignee();
        if (poignee) afficherRecharger(poignee.name);
      } catch (e) { /* base locale indisponible */ }
    }
  }

  demarrer();
})();

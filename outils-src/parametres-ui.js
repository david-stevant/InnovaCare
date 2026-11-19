// =============================================================================
// parametres-ui.js — formulaire d'édition de parametres.json, avec aperçu
// =============================================================================
// Le formulaire est décrit par la liste RUBRIQUES ci-dessous : pour ajouter un
// réglage, il suffit d'ajouter une ligne (chemin dans le JSON, libellé, type).
// Types de champ : texte, long (plusieurs lignes), nombre, couleur, choix (liste),
// lignes (une valeur par ligne → tableau), cases (cases à cocher → tableau).
// Une rubrique « liste » édite un tableau d'objets (pôles, pathologies…), une fiche par élément.
// Tout se passe dans la page : rien n'est envoyé.
// =============================================================================
(function () {
  'use strict';
  const IC = window.InnovaCare;
  const ORIGINE = JSON.parse(document.getElementById('donnees-parametres').textContent);
  let P = JSON.parse(JSON.stringify(ORIGINE));
  let nomFichier = 'parametres.json (version du dépôt)';
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
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { verifier(); apercu(); }, 150);
  }

  function verifier() {
    const problemes = IC.parametres.verifier(P);
    const liste = $('problemes');
    liste.textContent = '';
    if (!problemes.length) liste.appendChild(el('li', { className: 'ok' }, '✔ Paramètres cohérents.'));
    for (const p of problemes) liste.appendChild(el('li', { className: 'alerte' }, '! ' + p.rubrique + ' : ' + p.message));
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

  // --- Fichier JSON -------------------------------------------------------------------

  function afficherOrigine() { $('origine').textContent = 'Fichier affiché : ' + nomFichier + '.'; }

  function telechargerJson() {
    const problemes = verifier();
    if (problemes.length && !window.confirm(problemes.length + ' problème(s) détecté(s) (voir la liste). Télécharger quand même ?')) return;
    const blob = new Blob([JSON.stringify(P, null, 2) + '\n'], { type: 'application/json' });
    const lien = el('a', { href: URL.createObjectURL(blob), download: 'parametres.json' });
    document.body.appendChild(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
    $('message-fichier').textContent = 'parametres.json téléchargé (dossier « Téléchargements »).';
  }

  async function chargerJson(fichier) {
    try {
      P = JSON.parse(await fichier.text());
      nomFichier = '« ' + fichier.name + ' »';
      afficherOrigine(); dessinerRubriques(); verifier(); apercu();
      $('message-fichier').textContent = 'Fichier ouvert.';
    } catch (erreur) {
      $('message-fichier').textContent = 'Ce fichier n\'est pas un JSON valide (' + erreur.message + ').';
    }
  }

  function reinitialiser() {
    if (!window.confirm('Abandonner toutes les modifications et revenir aux paramètres d\'origine ?')) return;
    P = JSON.parse(JSON.stringify(ORIGINE));
    nomFichier = 'parametres.json (version du dépôt)';
    afficherOrigine(); dessinerRubriques(); verifier(); apercu();
  }

  // --- Mise à jour d'un Excel -------------------------------------------------------------

  async function mettreAJourExcel(fichier) {
    const etat = $('etat-excel');
    const liste = $('signalements-excel');
    liste.textContent = '';
    if (!/\.xlsx$/i.test(fichier.name)) { etat.textContent = 'Ce fichier n\'est pas au format .xlsx.'; return; }
    if (IC.parametres.verifier(P).length) { etat.textContent = 'Corrigez d\'abord les problèmes signalés dans les paramètres (en haut de la page).'; return; }
    etat.textContent = 'Lecture et mise à jour en cours…';
    try {
      const grilles = await IC.excel.lireClasseur(window.ExcelJS, await fichier.arrayBuffer());
      const lu = IC.lecture.lireGabarit(grilles, P);
      if (lu.version === null || lu.version === undefined) {
        etat.textContent = 'Ce fichier n\'est pas un Excel harmonisé (onglet « Listes » ou numéro de version introuvable). Pour l\'ancien Excel, utilisez l\'outil Migration.';
        return;
      }
      const { contenu, signalements } = IC.lecture.versContenu(lu, P);
      const classeur = IC.gabarit.creerClasseur(window.ExcelJS, P, contenu);
      const tampon = await classeur.xlsx.writeBuffer();
      const blob = new Blob([tampon], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const lien = el('a', { href: URL.createObjectURL(blob), download: fichier.name.replace(/\.xlsx$/i, '') + '_mis_a_jour.xlsx' });
      document.body.appendChild(lien);
      lien.click();
      setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
      etat.textContent = lu.etudes.length + ' études et ' + lu.annuaire.length + ' personnes reprises. Fichier mis à jour téléchargé : vérifiez-le dans Excel, puis remplacez l\'ancien.';
      const anomalies = lu.anomalies.filter((a) => a.type === 'libelle_inconnu');
      for (const a of anomalies) liste.appendChild(el('li', { className: 'alerte' }, '! ' + a.onglet + ' ' + (a.adresse || '') + ' : ' + a.message + ' Ses valeurs ont été gardées en Remarques.'));
      for (const s of signalements) liste.appendChild(el('li', { className: 'alerte' }, '! ' + s.etude + ' : ' + s.message));
      if (!anomalies.length && !signalements.length) liste.appendChild(el('li', { className: 'ok' }, '✔ Aucune valeur déplacée.'));
    } catch (erreur) {
      console.error(erreur);
      etat.textContent = 'Le fichier n\'a pas pu être lu (' + erreur.message + '). Est-il ouvert dans Excel ?';
    }
  }

  // --- Démarrage ------------------------------------------------------------------------

  function demarrer() {
    afficherOrigine();
    dessinerRubriques();
    verifier();
    apercu();
    $('bouton-telecharger').addEventListener('click', telechargerJson);
    $('bouton-charger').addEventListener('click', () => $('selecteur-json').click());
    $('selecteur-json').addEventListener('change', (e) => { if (e.target.files[0]) chargerJson(e.target.files[0]); });
    $('bouton-reinitialiser').addEventListener('click', reinitialiser);
    $('bouton-excel').addEventListener('click', () => $('selecteur-excel').click());
    $('selecteur-excel').addEventListener('change', (e) => { if (e.target.files[0]) mettreAJourExcel(e.target.files[0]); });
    const zone = $('zone-depot');
    ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, () => zone.classList.remove('survol')));
    zone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) mettreAJourExcel(e.dataTransfer.files[0]); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  demarrer();
})();

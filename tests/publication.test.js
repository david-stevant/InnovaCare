// Tests de l'étape 1.4 : export public (liste blanche), contacts, contrôles, comparaison,
// dates de mise à jour, et contenu du dossier site/. Règle absolue n° 2 de CLAUDE.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, correspondances, parametres, parametresDuSite, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const PARAM = parametres();
const SENTINELLE = 'SENTINELLE-INTERNE';
const copie = (x) => JSON.parse(JSON.stringify(x));

/** Une étude fictive dont CHAQUE champ verrouillé contient la sentinelle, publiée aux libéraux et aux patients. */
function etudeSentinelle() {
  const valeurs = { nom: 'ETUDE-FICTIVE', statut: 'ouvert', thematique: 'thématique fictive', phrase_patient: 'Phrase fictive.', investigateur: 'Jean TESTEUR', arc_1: 'Alice FICTIVE', co_investigateurs: 'Paul COLLEGUE' };
  for (const c of IC.schema.champsFiche(PARAM)) if (c.jamaisPublic && !c.id.startsWith('afficher_')) valeurs[c.id] = c.type === 'entier' ? 999 : SENTINELLE;
  Object.assign(valeurs, { afficher_ecardioscope: 'oui', afficher_innovaction: 'oui', afficher_innovacteur: 'oui' });
  return valeurs;
}
const ANNUAIRE = [
  { prenom: 'Jean', nom: 'TESTEUR', fonction: 'investigateur', dect: '91234', email: 'jean.testeur@chu-nantes.fr', mssante_verifiee: 'oui', nom_affiche: 'Jean TESTEUR' },
  { prenom: 'Alice', nom: 'FICTIVE', fonction: 'ARC', dect: '95678', email: 'alice.fictive@chu-nantes.fr', nom_affiche: 'Alice FICTIVE' },
];
const lu = (valeursListe, annuaire = ANNUAIRE) => ({ version: 1, anomalies: [], annuaire, etudes: valeursListe.map((v, i) => ({ pole: 'ic', onglet: 'Insuffisance cardiaque', colonne: String.fromCharCode(67 + i), id: IC.normalisation.identifiant(v.nom), valeurs: v })) });

test('liste blanche : aucun champ verrouillé, aucun nom de personne, aucun DECT', () => {
  const contenu = IC.exportPublic.exporter(lu([etudeSentinelle()]), PARAM);
  const texte = JSON.stringify(contenu);
  assert.equal(contenu.protocoles.length, 1);
  assert.ok(!texte.includes(SENTINELLE), 'une valeur interne a fuité');
  assert.ok(!texte.includes('999'), 'recrutés / objectif ont fuité');
  assert.ok(!/91234|95678|dect/i.test(texte), 'un DECT a fuité');
  assert.ok(!texte.includes('Alice') && !texte.includes('COLLEGUE'), 'ARC et co-investigateurs ne sont pas publiés');
  for (const id of IC.schema.champsJamaisPublics(PARAM)) assert.ok(!(id in contenu.protocoles[0].valeurs), id);
  assert.deepEqual(IC.exportPublic.verifierContenu(contenu, PARAM), []);
});

test('liste blanche : même si les paramètres déclarent un champ verrouillé « public », il reste interne', () => {
  const p = copie(PARAM);
  // Tentative : rendre publiable un champ verrouillé via ses textes (seuls aide et exemple sont modifiables).
  p.champs = Object.assign({}, p.champs, { synopsis: { aide: 'x', exemple: 'y', visibilite: 'patient', jamaisPublic: false } });
  const contenu = IC.exportPublic.exporter(lu([etudeSentinelle()]), p);
  assert.ok(!JSON.stringify(contenu).includes(SENTINELLE));
  assert.ok(!IC.exportPublic.champsPublics(p).some((c) => c.id === 'synopsis'));
});

test('contacts : seulement le nom et la MSSanté de l\'investigateur, et seulement si elle est vérifiée', () => {
  const [p] = IC.exportPublic.exporter(lu([etudeSentinelle()]), PARAM).protocoles;
  assert.deepEqual(p.contacts, { investigateur: { nom: 'Jean TESTEUR', mssante: 'jean.testeur@chu-nantes.mssante.fr' } });
  const nonVerifie = ANNUAIRE.map((x) => Object.assign({}, x, { mssante_verifiee: '' }));
  assert.deepEqual(IC.exportPublic.exporter(lu([etudeSentinelle()], nonVerifie), PARAM).protocoles[0].contacts, {});
  const explicite = ANNUAIRE.map((x) => Object.assign({}, x, { mssante: 'autre.adresse@exemple.mssante.fr' }));
  assert.equal(IC.exportPublic.exporter(lu([etudeSentinelle()], explicite), PARAM).protocoles[0].contacts.investigateur.mssante, 'autre.adresse@exemple.mssante.fr', 'l\'adresse saisie dans l\'annuaire est prioritaire');
  // Plus tard, une fois les ARC informés : contacts_arc = true
  const avecArc = copie(PARAM); avecArc.publication.contacts_arc = true;
  const c = IC.exportPublic.exporter(lu([etudeSentinelle()]), avecArc).protocoles[0].contacts;
  assert.deepEqual(c.arc, [{ nom: 'Alice FICTIVE', email: 'alice.fictive@chu-nantes.fr' }]);
  assert.ok(!/95678/.test(JSON.stringify(c)), 'le DECT n\'est jamais publié');
});

test('règle d\'export : affichée publiquement et non terminée', () => {
  const base = etudeSentinelle();
  const variantes = [
    Object.assign({}, base, { nom: 'TERMINEE', statut: 'terminé' }),
    Object.assign({}, base, { nom: 'INTERNE-SEULEMENT', afficher_innovaction: 'non', afficher_innovacteur: 'non' }),
    Object.assign({}, base, { nom: 'PRO-SEULEMENT', afficher_innovacteur: 'non' }),
    Object.assign({}, base, { nom: 'A-VENIR', statut: 'à venir', afficher_innovaction: 'non' }),
  ];
  const contenu = IC.exportPublic.exporter(lu(variantes), PARAM);
  assert.deepEqual(contenu.protocoles.map((p) => [p.valeurs.nom, p.modules]), [['PRO-SEULEMENT', ['professionnel']], ['A-VENIR', ['patient']]]);
});

test('verifierContenu : repère un fichier qui ne respecte pas la liste blanche', () => {
  const faux = { protocoles: [{ id: 'x', valeurs: { nom: 'X', synopsis: 'secret' }, contacts: { arc: [{ nom: 'A', email: 'a@b', dect: '12345' }] }, autre: 1 }] };
  const problemes = IC.exportPublic.verifierContenu(faux, PARAM).join('\n');
  assert.match(problemes, /champ « synopsis » non public/);
  assert.match(problemes, /contact « arc » non autorisé/);
  assert.match(problemes, /clé « autre » non prévue/);
  assert.match(problemes, /DECT/);
});

test('date de mise à jour : changée seulement si un champ public change', () => {
  const v1 = IC.exportPublic.exporter(lu([etudeSentinelle()]), PARAM);
  IC.publication.dater(v1, null, '2026-11-01');
  assert.equal(v1.protocoles[0].maj, '2026-11-01');
  // Modification interne seulement (synopsis) : la date ne bouge pas.
  const v2 = IC.exportPublic.exporter(lu([Object.assign(etudeSentinelle(), { synopsis: 'autre texte interne' })]), PARAM);
  IC.publication.dater(v2, v1, '2026-11-19');
  assert.equal(v2.protocoles[0].maj, '2026-11-01');
  assert.equal(IC.publication.comparer(v1, v2).identiques, 1);
  // Modification publique (thématique) : nouvelle date, et le champ est cité.
  const v3 = IC.exportPublic.exporter(lu([Object.assign(etudeSentinelle(), { thematique: 'nouvelle' })]), PARAM);
  IC.publication.dater(v3, v1, '2026-11-19');
  assert.equal(v3.protocoles[0].maj, '2026-11-19');
  assert.deepEqual(IC.publication.comparer(v1, v3).modifiees[0].champs, ['thematique']);
  // Ajout et retrait
  const v4 = IC.exportPublic.exporter(lu([Object.assign(etudeSentinelle(), { nom: 'AUTRE' })]), PARAM);
  const d = IC.publication.comparer(v1, v4);
  assert.deepEqual([d.ajoutees.map((x) => x.nom), d.retirees.map((x) => x.nom)], [['AUTRE'], ['ETUDE-FICTIVE']]);
  assert.equal(IC.publication.messageCommit(d, '2026-11-19'), 'Publication du 19/11/2026 : 1 ajoutée(s), 1 retirée(s)');
});

test('contrôles : doublon et statut hors liste bloquants, champs vides en avertissement', () => {
  const a = etudeSentinelle();
  const b = Object.assign(etudeSentinelle(), { statut: 'en cours' });
  const c = Object.assign(etudeSentinelle(), { nom: 'SANS-PHASE', investigateur: 'Inconnu PERSONNE' });
  const r = IC.publication.controler(lu([a, b, c]), PARAM);
  const bloquants = r.filter((x) => x.gravite === 'bloquant').map((x) => x.message).join('\n');
  assert.match(bloquants, /Nom d'étude en double/);
  assert.match(bloquants, /« Statut » : valeur « en cours » absente de la liste/);
  const avert = r.filter((x) => x.gravite === 'avertissement').map((x) => x.message).join('\n');
  assert.match(avert, /« Phase » est vide alors que l'étude est publiée/);
  assert.match(avert, /absent de l'annuaire/);
});

test('base64 UTF-8 (envoi vers GitHub) : aller-retour sans altération des accents', () => {
  const texte = '{"nom":"Étude « test » — ≥ 40 %"}';
  assert.equal(IC.publication.depuisBase64(IC.publication.enBase64(texte)), texte);
});

test('bout en bout sur la copie de dev : export conforme, phrases patient identiques', async () => {
  const grilles = await IC.excel.lireClasseur(ExcelJS, readFileSync(join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx')));
  const migre = IC.migration.migrer(IC.lectureAncien.lireAncienExcel(grilles, correspondances()), PARAM, correspondances());
  const relu = IC.lecture.lireGabarit(await IC.excel.lireClasseur(ExcelJS, await IC.gabarit.creerClasseur(ExcelJS, PARAM, migre).xlsx.writeBuffer()), PARAM);
  const contenu = IC.exportPublic.exporter(relu, PARAM);
  assert.deepEqual(IC.exportPublic.verifierContenu(contenu, PARAM), []);
  assert.equal(contenu.protocoles.length, 15);
  assert.ok(!JSON.stringify(contenu).includes('[interne'), 'aucun contenu masqué « [interne – masqué] » n\'est exporté');
  for (const p of contenu.protocoles) {
    const source = relu.etudes.find((e) => e.id === p.id);
    assert.equal(p.valeurs.phrase_patient, source.valeurs.phrase_patient);
  }
  assert.deepEqual(IC.publication.controler(relu, PARAM).filter((x) => x.gravite === 'bloquant'), []);
});

// --- Contenu du dossier site/ (publié tel quel sur GitHub Pages) -------------------------

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

test('site/ : protocoles.json respecte la liste blanche', () => {
  const contenu = JSON.parse(readFileSync(join(RACINE, 'site/donnees/protocoles.json'), 'utf8'));
  // Vérifié avec les réglages EN LIGNE : ce sont eux qui ont servi à la publication (par exemple
  // « Publier les e-mails des ARC », activé par le porteur le 22/11). Correctif : ce test utilisait
  // les réglages de test, ce qui bloquait la mise en ligne d'une publication pourtant conforme.
  assert.deepEqual(IC.exportPublic.verifierContenu(contenu, parametresDuSite()), []);
});

test('site/ : aucun Excel, aucun contenu interne, aucun DECT, aucune mention de l\'établissement', () => {
  for (const chemin of fichiers(join(RACINE, 'site'))) {
    const nom = relative(RACINE, chemin);
    assert.ok(!/\.(xlsx|xls|xlsm|csv)$/i.test(chemin), nom + ' : fichier de données interdit dans site/');
    if (!/\.(html|css|js|json|txt|md)$/i.test(chemin)) continue;
    const texte = readFileSync(chemin, 'utf8');
    assert.ok(!/\[interne/i.test(texte), nom + ' : contenu interne');
    assert.ok(!/\bDECT\b|"dect"/i.test(texte), nom + ' : DECT');
    const sansAdresses = texte.replace(/@?chu-nantes(\.mssante)?\.fr/gi, '');
    // Règle 3 : jamais le NOM de l'établissement. Dans les données publiées (protocoles.json), les textes
    // des ARC sont repris mot pour mot (règle 4) et peuvent dire « suivi au CHU » : le mot seul est toléré.
    // Dans le code et les textes du site, même le mot seul est refusé.
    const donneesPubliees = /protocoles\.json$/.test(chemin);
    // « Mot entier » sensible aux accents (avec \b, « échu » était pris à tort pour le sigle).
    const motif = donneesPubliees ? /CHU\s+de\s+Nantes|CHU\s+Nantes|chu[- ]nantes/i : /CHU\s+de\s+Nantes|CHU\s+Nantes|chu[- ]nantes|(?<![\p{L}\p{N}])CHU(?![\p{L}\p{N}])/iu;
    assert.ok(!motif.test(sansAdresses), nom + ' mentionne l\'établissement');
  }
});

test('site/ : discret tant que les avis ne sont pas obtenus (noindex, robots.txt)', () => {
  assert.match(readFileSync(join(RACINE, 'site/index.html'), 'utf8'), /<meta name="robots" content="noindex, nofollow">/);
  assert.match(readFileSync(join(RACINE, 'site/robots.txt'), 'utf8'), /Disallow: \//);
  // Réglages en ligne : modifiables par le porteur (outil Paramètres) ; on vérifie seulement leur forme.
  const pub = parametresDuSite().publication;
  assert.equal(typeof pub.site_discret, 'boolean');
  assert.equal(typeof pub.contacts_arc, 'boolean');
  // Paramètres de test : décisions du 19/11 (site discret, pas de données d'ARC publiées).
  assert.equal(PARAM.publication.site_discret, true);
  assert.equal(PARAM.publication.contacts_arc, false);
});

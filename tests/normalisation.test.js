// Tests des petites fonctions de nettoyage (src/normalisation.js).
// Les exemples reprennent les formats réellement rencontrés dans l'Excel (plan § 4.4),
// avec des noms de personnes FICTIFS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerInnovaCare, correspondances, parametres } from './charger.js';

const N = chargerInnovaCare().normalisation;
const MENTIONS = correspondances().mentions_statut;
const FILTRES = parametres().filtres;

test('texteSimple : ignore majuscules, accents, apostrophes et espaces multiples', () => {
  assert.equal(N.texteSimple('  Début  d’inclusion '), "debut d'inclusion");
  assert.equal(N.texteSimple('Filtre Traitements '), N.texteSimple('filtre traitements'));
});

test('identifiant : nom d\'étude normalisé', () => {
  assert.equal(N.identifiant('BRANCH-HF - PFIZER'), 'branch-hf-pfizer');
  assert.equal(N.identifiant('POLARIS '), 'polaris');
  assert.equal(N.identifiant('Come-TAVI '), 'come-tavi');
});

test('analyserNomEtude : statut écrit dans le nom', () => {
  const a = N.analyserNomEtude('PINNACLE  (non ouverte aux inclusions pour le moment)', MENTIONS);
  assert.equal(a.nom, 'PINNACLE');
  assert.equal(a.statut, 'à venir');
  const b = N.analyserNomEtude('RESPIRE - HFPEF (NovoNordisk) \nAnnulée en phase de lancement', MENTIONS);
  assert.equal(b.nom, 'RESPIRE - HFPEF (NovoNordisk)');
  assert.equal(b.statut, 'terminé');
  const c = N.analyserNomEtude('LEVEL 2 (Tenax)', MENTIONS);
  assert.equal(c.nom, 'LEVEL 2 (Tenax)');
  assert.equal(c.statut, null);
});

test('mention de statut : seulement en début de mot (« déterminée » n\'est pas « terminé »)', () => {
  assert.equal(N.chercherMentionStatut('non déterminée', MENTIONS), null);
  assert.equal(N.chercherMentionStatut('terminé', MENTIONS).statut, 'terminé');
  assert.equal(N.chercherMentionStatut('en cours de certification MISE EN PLACE NON FAITE', MENTIONS).statut, 'à venir');
});

test('lireFiltre : formats reconnus', () => {
  const cas = [
    ['18-80', { min: 18, max: 80 }],
    ['600-8500', { min: 600, max: 8500 }],
    ['> 40', { min: 40, minStricte: true }],
    ['≥ 55', { min: 55 }],
    ['>= 30', { min: 30 }],
    ['< 35', { max: 35, maxStricte: true }],
    ['≤ 85', { max: 85 }],
    ['oui', { oui: true }],
  ];
  for (const [texte, attendu] of cas) {
    const lu = N.lireFiltre(texte);
    assert.equal(lu.ok, true, texte);
    for (const [cle, valeur] of Object.entries(attendu)) assert.equal(lu[cle], valeur, texte + ' → ' + cle);
  }
});

test('lireFiltre : refuse ce qui est ambigu ou libre', () => {
  for (const valeur of ['Bloc de branche indifférencié', 300, '80-18', 'environ 40', 'Alice FICTIVE 91234']) {
    assert.equal(N.lireFiltre(valeur).ok, false, String(valeur));
  }
  assert.equal(N.lireFiltre(null).vide, true);
});

test('lireDate : n\'accepte que des dates pures, sans rien deviner', () => {
  assert.deepEqual([N.lireDate({ date: '2025-03-01' }).iso, N.lireDate({ date: '2025-03-01' }).precision], ['2025-03-01', 'jour']);
  assert.equal(N.lireDate(' novembre 2025').iso, '2025-11');
  assert.equal(N.lireDate('Juin 2025').iso, '2025-06');
  assert.equal(N.lireDate('11/2025').iso, '2025-11');
  assert.equal(N.lireDate('15/09/2025').iso, '2025-09-15');
  const flou = N.lireDate('+/- octobre, novembre 2025');
  assert.equal(flou.ok, false);
  assert.ok(flou.indice);
  assert.equal(N.lireDate('fin 2025').ok, false);
  assert.equal(N.lireDate('en cours depuis 11/2025').indice, '11/2025');
  assert.equal(N.lireDate(2024).indice, '2024', 'une année seule est une date imprécise');
  assert.equal(N.lireDate(15).nombre, true, 'un petit nombre seul n\'est pas une date');
  assert.equal(N.lireDate('18 M').ok, false);
});

test('separerPersonnes : DECT collés, plusieurs personnes, titres', () => {
  const un = N.separerPersonnes('Alice FICTIVE 97643/99392');
  assert.equal(un.length, 1);
  assert.equal(un[0].nom, 'Alice FICTIVE');
  assert.deepEqual(un[0].dect, ['97643', '99392']);

  assert.deepEqual(N.separerPersonnes('Bob EXEMPLE / Alice FICTIVE').map((p) => p.nom), ['Bob EXEMPLE', 'Alice FICTIVE']);
  assert.deepEqual(N.separerPersonnes('Carla UNE 99818 Dora DEUX 99425').map((p) => [p.nom, p.dect[0]]), [['Carla UNE', '99818'], ['Dora DEUX', '99425']]);
  assert.deepEqual(N.separerPersonnes('Eva TROIS (68,870)')[0].dect, ['68870']);
  assert.deepEqual(N.separerPersonnes('NOMUN Eva (65 115)')[0].dect, ['65115']);
  assert.deepEqual(N.separerPersonnes('UN/DEUX/TROIS/QUATRE').length, 4);

  const titres = N.separerPersonnes('Dr NOMA Paul et Dr NOMB Luc (neurologue)');
  assert.deepEqual(titres.map((p) => p.nom), ['NOMA Paul', 'NOMB Luc']);
  assert.equal(titres[0].titre, 'Dr');
  assert.deepEqual(titres[1].complements, ['neurologue']);
});

test('clePersonne : même clé quel que soit l\'ordre, la casse ou les accents', () => {
  assert.equal(N.clePersonne('FICTIVE Léa'), N.clePersonne('Lea fictive'));
  assert.notEqual(N.clePersonne('Léa FICTIVE'), N.clePersonne('Léo FICTIVE'));
});

test('emailAttendu : format prenom.nom des paramètres', () => {
  const format = parametres().annuaire.format_email;
  assert.equal(N.emailAttendu('Guénola', 'TESTEUR', format), 'guenola.testeur@chu-nantes.fr');
  assert.equal(N.emailAttendu('Jean Paul', 'DE TEST', format), 'jean-paul.de-test@chu-nantes.fr');
});

test('noms commerciaux et traitements : reconnus d\'après les paramètres', () => {
  assert.deepEqual(N.nomsCommerciauxCites('Sous dapagliflozine (Forxiga/Xiguo) ?', FILTRES), ['Forxiga']);
  assert.deepEqual(N.nomsCommerciauxCites('aucun médicament ici', FILTRES), []);
  const t = N.lireTraitements('entresto ET MRA ET beta-bloquant ET gliflozine', FILTRES);
  assert.deepEqual(t.classes, ['ttt_arni', 'ttt_arm', 'ttt_betabloquant', 'ttt_gliflozine']);
  assert.deepEqual(t.inconnus, []);
  assert.deepEqual(N.lireTraitements('furosémide/Lasilix', FILTRES).classes, ['ttt_diuretique_anse']);
  assert.deepEqual(N.lireTraitements('potion magique', FILTRES).inconnus, ['potion magique']);
});

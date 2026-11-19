// Tests du schéma de données (src/schema.js) : la définition unique des champs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerInnovaCare, parametres } from './charger.js';

const S = chargerInnovaCare().schema;
const PARAM = parametres();
const fiche = S.champsFiche(PARAM);
const tous = fiche.concat(S.CHAMPS_ANNUAIRE);

test('identifiants uniques et libellés uniques dans la fiche', () => {
  const ids = fiche.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiant en double');
  const libelles = fiche.map((c) => c.libelle);
  assert.equal(new Set(libelles).size, libelles.length, 'libellé de ligne en double');
});

test('chaque champ est complet : bloc, type, visibilité, obligation, aide ≤ 255 caractères', () => {
  for (const c of fiche) {
    assert.ok(S.BLOCS.includes(c.bloc), c.id + ' : bloc inconnu « ' + c.bloc + ' »');
    assert.ok(c.type, c.id + ' : type manquant');
    assert.ok(['oui', 'non', 'si_public', 'si_patient'].includes(c.obligatoire), c.id + ' : obligation inconnue');
  }
  for (const c of tous) {
    assert.ok(S.VISIBILITES.includes(c.visibilite), c.id + ' : visibilité inconnue');
    assert.equal(typeof c.aide, 'string', c.id + ' : aide manquante');
    assert.ok(c.aide.length <= 255, c.id + ' : aide trop longue pour Excel');
    if (c.type === 'liste' || c.type === 'requis_exclu') assert.ok(c.liste, c.id + ' : nom de liste manquant');
  }
});

test('règle 2 : tous les champs internes de CLAUDE.md sont verrouillés « jamais public »', () => {
  const verrouilles = S.champsJamaisPublics(PARAM);
  const obligatoires = [
    'synopsis', 'cjp', 'nsn', 'recrutes', 'objectif', 'remarques', 'dect', 'en_avant',
    'afficher_ecardioscope', 'afficher_innovaction', 'afficher_innovacteur',
  ].concat(
    Array.from({ length: 12 }, (_, i) => 'exclusion_' + (i + 1)),
    Array.from({ length: 5 }, (_, i) => 'inclusion_autre_' + (i + 1))
  );
  for (const id of obligatoires) assert.ok(verrouilles.includes(id), id + ' doit être verrouillé');
  for (const c of tous.filter((x) => x.jamaisPublic)) assert.equal(c.visibilite, 'interne', c.id);
});

test('les filtres viennent des paramètres et ne sont jamais verrouillés', () => {
  const filtres = S.champsFiltres(PARAM);
  assert.ok(filtres.some((c) => c.id === 'age_min') && filtres.some((c) => c.id === 'age_max'));
  assert.ok(filtres.some((c) => c.id === 'hospit_ic_delai'));
  assert.ok(filtres.some((c) => c.id === 'ttt_arm' && c.liste === 'requis_exclu'));
  assert.ok(filtres.every((c) => !c.jamaisPublic));
  assert.deepEqual(S.champsFiltres({ filtres: [] }), []);
});

test('les listes citées par le schéma existent dans les paramètres (ou sont fournies ailleurs)', () => {
  const fournies = Object.keys(PARAM.listes).concat(['poles', 'pathologies', 'vignettes']);
  for (const c of tous.filter((x) => x.liste)) assert.ok(fournies.includes(c.liste), c.id + ' : liste « ' + c.liste + ' » introuvable');
});

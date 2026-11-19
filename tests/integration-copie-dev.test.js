// Test d'ensemble sur la copie de développement de l'Excel (déjà publique, contenu interne masqué) :
// lecture réelle avec ExcelJS, puis contrôles. Vérifie les nombres attendus du plan (étape 1.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, correspondances, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const CHEMIN = join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx');

const rapport = await (async () => {
  const grilles = await IC.excel.lireClasseur(ExcelJS, readFileSync(CHEMIN));
  return IC.controles.controler(IC.lectureAncien.lireAncienExcel(grilles, correspondances()), parametres(), correspondances());
})();
const alertes = (type) => rapport.alertes.filter((a) => a.type === type);

test('copie de dev : 65 études dans 10 onglets, 14 personnes dans l\'annuaire', () => {
  const parOnglet = Object.fromEntries(rapport.inventaire.map((i) => [i.onglet, i.nombre]));
  assert.deepEqual(parOnglet, {
    'Insuff Cardiaque': 8, 'Cardiomyopathies - Amyloses': 10, 'Valves': 6, 'Rythmologie': 11,
    'Hémodynamique': 4, 'USIC': 8, 'HTA': 2, 'Endocardites': 1, 'Etudes transversales': 1,
    'Etudes en suivi ou terminées': 14, 'Coordonnées des ARC': 14,
  });
  assert.equal(rapport.nombreEtudes, 65);
});

test('copie de dev : colonnes décalées de l\'onglet « suivi ou terminées »', () => {
  assert.deepEqual(alertes('colonne_decalee').map((a) => a.etude).sort(), [
    'BALANCED-HF (Astra Zeneca)', 'DISCOVER-HCM', 'EACVI - INFLAME', 'LIBREXIA', 'NICD-CRT', 'TRITON (ALN-TTRSC04)', 'VICTORION Rides',
  ]);
  assert.ok(alertes('colonne_decalee').every((a) => a.onglet === 'Etudes en suivi ou terminées'));
  // REVERSE-MR n'a qu'un indice (« 15 » en début d'inclusion) : signalée à vérifier.
  assert.ok(alertes('indice_decalage').some((a) => a.etude === 'REVERSE-MR'));
});

test('copie de dev : doublons HF-RELIEF, BRAVE, TRITON', () => {
  assert.deepEqual(rapport.doublons.map((d) => d.nom).sort(), ['BRAVE', 'HF-RELIEF', 'TRITON (ALN-TTRSC04)']);
});

test('copie de dev : statuts écrits dans le nom', () => {
  const statut = (nom) => rapport.statuts.find((s) => s.etude === nom).statut;
  assert.equal(statut('PINNACLE'), 'à venir');
  assert.equal(statut('ENITH-MACE'), 'à venir');
  assert.equal(statut('ATA-301 ATACIGUAT KARDIGAN'), 'à venir');
  assert.equal(statut('RESPIRE - HFPEF (NovoNordisk)'), 'terminé');
  assert.equal(statut('PROJET DESTIVA'), 'ouvert', '« non déterminée » ne veut pas dire « terminé »');
  assert.equal(statut('Dyna-MI'), 'clos aux inclusions (suivi)');
});

test('copie de dev : contacts', () => {
  assert.equal(alertes('arc_absent_annuaire').length, 9);
  assert.deepEqual(alertes('email_hors_format').map((a) => a.etude), ['Sandrine POTIRON']);
  assert.ok(alertes('non_personne').some((a) => a.message.includes('Hors CIC')));
  assert.ok(alertes('dect_colle').length > 30);
});

test('copie de dev : filtres et traitements', () => {
  assert.ok(alertes('filtre_divergent').some((a) => a.etude === 'POLARIS'));
  assert.ok(alertes('filtre_divergent').some((a) => a.etude === 'TRITON (ALN-TTRSC04)' && a.onglet === 'Cardiomyopathies - Amyloses'));
  assert.equal(alertes('traitement_inconnu').length, 0);
  assert.ok(alertes('traitements_lus').some((a) => a.etude === 'BONFIRE'));
});

test('copie de dev : aucune ligne inconnue dans les onglets lus', () => {
  assert.deepEqual(alertes('libelle_inconnu'), []);
  assert.deepEqual(alertes('onglet_inconnu'), []);
  assert.deepEqual(alertes('donnees_sans_nom'), []);
});

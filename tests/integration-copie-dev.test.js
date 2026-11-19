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

// --- Étape 1.2 : migration complète, écriture du nouvel Excel, relecture ---------------
const migration = await (async () => {
  const grilles = await IC.excel.lireClasseur(ExcelJS, readFileSync(CHEMIN));
  const lecture = IC.lectureAncien.lireAncienExcel(grilles, correspondances());
  const resultat = IC.migration.migrer(lecture, parametres(), correspondances());
  const tampon = await IC.gabarit.creerClasseur(ExcelJS, parametres(), resultat).xlsx.writeBuffer();
  const relu = IC.lecture.lireGabarit(await IC.excel.lireClasseur(ExcelJS, tampon), parametres());
  return { lecture, resultat, relu };
})();

test('aller-retour : 62 études (65 colonnes moins 3 doublons), gabarit relu sans anomalie', () => {
  const { resultat, relu } = migration;
  assert.equal(resultat.resume.etudesMigrees, 62);
  assert.equal(relu.etudes.length, 62);
  assert.equal(relu.version, IC.gabarit.VERSION_GABARIT);
  assert.deepEqual(relu.anomalies, []);
  assert.deepEqual(resultat.resume.parPole, {
    'Insuffisance cardiaque': 10, 'Cardiomyopathies-Amyloses': 14, 'Valves': 8, 'Rythmologie': 10,
    'Hémodynamique': 4, 'USIC': 12, 'HTA': 2, 'Endocardites': 1, 'Transversales': 1,
  });
  // La 7e colonne décalée (TRITON de l'onglet « suivi ») est un doublon : c'est la colonne saine qui est gardée.
  assert.equal(resultat.resume.colonnesDecalees, 6);
});

test('aller-retour : phrases patient et détails pratiques identiques au caractère près', () => {
  const { lecture, relu } = migration;
  const N = IC.normalisation;
  for (const e of IC.lectureAncien.toutesLesEtudes(lecture)) {
    const reluE = relu.etudes.find((x) => x.id === e.id);
    assert.ok(reluE, e.nom);
    for (const [ancien, nouveau] of [['phrase_patient', 'phrase_patient'], ['details_pratiques', 'details_pratiques']]) {
      const origine = (e.champs[ancien] || []).map((v) => N.enTexte(v.valeur)).join('\n');
      if (!origine) continue;
      // Pour un doublon non conservé, la phrase de la colonne gardée fait foi.
      if (reluE.onglet && e.onglet !== migration.resultat.fichesParPole[reluE.pole].find((f) => f.valeurs.nom === reluE.valeurs.nom).origine.onglet) continue;
      assert.equal(reluE.valeurs[nouveau], origine, e.nom + ' : ' + ancien);
    }
  }
});

test('aller-retour : aucun texte d\'origine perdu (retrouvé dans un champ ou en Remarques)', () => {
  const { resultat, relu } = migration;
  const N = IC.normalisation;
  const texteDe = (valeur) => N.enTexte(valeur).replace(/\s+/g, ' ');
  const natures = Object.fromEntries(correspondances().libelles.map((d) => [d.champ, d.nature]));
  let verifies = 0;
  for (const fiches of Object.values(resultat.fichesParPole)) {
    for (const f of fiches) {
      const e = f.origine.etude;
      const reluE = relu.etudes.find((x) => x.valeurs.nom === f.valeurs.nom && x.pole === e.poleCible);
      const tout = Object.values(reluE.valeurs).map(texteDe).join(' ¦ ');
      for (const [champ, liste] of Object.entries(e.champs)) {
        if (natures[champ] !== 'texte' && champ !== 'titre') continue;
        for (const v of liste) {
          const morceaux = champ === 'tag_ecs' ? N.enTexte(v.valeur).split('+').map((x) => x.trim()) : [texteDe(v.valeur)];
          for (const m of morceaux.filter(Boolean)) {
            verifies++;
            assert.ok(tout.includes(m), e.nom + ' : « ' + m.slice(0, 60) + ' » (' + v.adresse + ') introuvable');
          }
        }
      }
    }
  }
  assert.ok(verifies > 300, verifies + ' textes vérifiés');
});

test('aller-retour : annuaire complété, sans DECT dans les fiches', () => {
  const { relu } = migration;
  assert.ok(relu.annuaire.length >= 40);
  assert.ok(relu.annuaire.some((p) => p.nom === 'ERNOULD' && p.email === 'audrey.ernould@chu-nantes.fr'), 'ajout validé appliqué');
  assert.ok(relu.annuaire.some((p) => p.prenom === 'Guénola' && p.email === 'guenola.coste@chu-nantes.fr'), 'correction validée appliquée');
  assert.ok(relu.annuaire.some((p) => p.prenom === 'Helena' && p.nom === 'FETTRE'));
  for (const e of relu.etudes) {
    for (const id of ['investigateur', 'co_investigateurs', 'arc_1', 'arc_backup_1', 'arc_backup_2']) {
      assert.ok(!/\d{2}[ ,.]?\d{3}/.test(e.valeurs[id] || ''), e.valeurs.nom + ' : DECT resté dans « ' + id + ' »');
    }
  }
  // Deux homonymes ne sont pas fusionnés, une variante d'orthographe l'est.
  assert.equal(relu.annuaire.filter((p) => p.nom === 'PIRIOU').length, 2);
  assert.equal(relu.annuaire.filter((p) => IC.normalisation.texteSimple(p.nom).replace(/\s/g, '') === 'letourneau').length, 1);
});

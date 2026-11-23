// Tests de la phase 2.3 : mémos générés par l'outil interne (src/memos.js), sur des études FICTIVES,
// puis sur la copie de développement migrée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { chargerInnovaCare, correspondances, parametres, RACINE } from './charger.js';

const IC = chargerInnovaCare();
const M = IC.memos;
const PARAM = parametres();
const [S1, S2] = PARAM.memos.sections;
const pole = (id) => PARAM.poles.find((p) => p.id === id);
const annuaire = [{ prenom: 'Alice', nom: 'FICTIVE', fonction: 'ARC', dect: '91234', email: 'alice.fictive@exemple.fr', nom_affiche: 'Alice FICTIVE' }];
const etude = (poleId, valeurs) => ({ pole: poleId, onglet: pole(poleId).nom, colonne: 'C', id: valeurs.nom.toLowerCase(), valeurs: Object.assign({ statut: 'ouvert', afficher_ecardioscope: 'oui' }, valeurs), horsSchema: [], note: null });
const lu = {
  annuaire,
  etudes: [
    etude(S1.poles[0], { nom: 'PREMIERE', thematique: 'Thématique fictive', intervention: 'Molécule X vs placebo', design: 'randomisé 1:1', inclusion_1: 'FEVG ≥ 40 %', inclusion_2: 'NYHA II à IV', arc_1: 'Alice FICTIVE' }),
    etude(S1.poles[0], { nom: 'MISE-EN-AVANT', en_avant: 'oui', inclusion_1: 'Âge > 18 ans' }),
    etude(S2.poles[0], { nom: 'AUTRE-SECTION', inclusion_1: 'Critère <b>fictif</b> & co', arc_1: 'Alice FICTIVE' }),
    etude(S1.poles[0], { nom: 'TERMINEE', statut: 'terminé', inclusion_1: 'x' }),
    etude(S1.poles[0], { nom: 'MASQUEE', afficher_ecardioscope: 'non', inclusion_1: 'x' }),
  ],
};
const etudes = IC.catalogue.preparer(lu, PARAM).etudes;
const memo = M.construire(etudes, PARAM);

test('seuils en gras : comparateur + nombre (+ unité), sans toucher au reste', () => {
  assert.equal(M.seuilsEnGras('FEVG ≥ 40 % et âge > 18 ans'), 'FEVG **≥ 40 %** et âge **> 18 ans**');
  assert.equal(M.seuilsEnGras('NT-proBNP > 300 pg/mL, QRS ≥ 130 ms'), 'NT-proBNP **> 300 pg/mL**, QRS **≥ 130 ms**');
  assert.equal(M.seuilsEnGras('NYHA II à IV'), 'NYHA II à IV');
  assert.equal(M.seuilsEnGras('FEVG<35%'), 'FEVG**<35%**');
  // Le texte d'origine est intact une fois le gras retiré (aucune reformulation).
  const t = 'DFG ≥ 15 mL/min/1,73 m² et < 60';
  assert.equal(M.seuilsEnGras(t).replace(/\*\*/g, ''), t);
});

test('puce tapée par l\'ARC en début de critère retirée, rien d\'autre', () => {
  assert.equal(M.sansPuce('-Antécédent de FEVG'), 'Antécédent de FEVG');
  assert.equal(M.sansPuce(' - sous bêtabloquant'), 'sous bêtabloquant');
  assert.equal(M.sansPuce('• NYHA II'), 'NYHA II');
  assert.equal(M.sansPuce('FEVG - 40'), 'FEVG - 40');
});

test('études retenues : ouvertes et affichées, une seule fois, mises en avant d\'abord, puis ordre de l\'Excel', () => {
  assert.deepEqual(memo.sections.map((s) => s.titre), [S1.titre, S2.titre]);
  assert.deepEqual(memo.sections[0].etudes.map((e) => e.nom), ['MISE-EN-AVANT', 'PREMIERE']);
  assert.deepEqual(memo.sections[1].etudes.map((e) => e.nom), ['AUTRE-SECTION']);
});

test('une section seule ; pôle sans section placé dans « Autres »', () => {
  assert.deepEqual(M.construire(etudes, PARAM, { section: S2.titre }).sections.map((s) => s.titre), [S2.titre]);
  const p = JSON.parse(JSON.stringify(PARAM));
  p.memos.sections = [S1];
  assert.deepEqual(M.construire(etudes, p).sections.map((s) => s.titre), [S1.titre, 'Autres']);
});

test('DECT présent dans l\'outil interne, retiré avec « Sans DECT »', () => {
  assert.match(M.versMarkdown(memo), /Alice FICTIVE — DECT 91234 — alice\.fictive@exemple\.fr/);
  const sans = M.construire(etudes, PARAM, { avecDect: false });
  assert.ok(!/91234|DECT/.test(M.versMarkdown(sans) + M.versHtml(sans)));
  assert.match(M.versMarkdown(sans), /Alice FICTIVE — alice\.fictive@exemple\.fr/);
});

test('Markdown au format v3, champ vide = ligne absente', () => {
  const em = PARAM.memos;
  const md = M.versMarkdown(M.construire(etudes.filter((e) => e.nom === 'PREMIERE'), PARAM));
  const attendu = [
    '# 📋 ' + em.titre, em.hashtags, '', '---', '',
    '## ' + S1.emoji + ' ' + S1.titre.toUpperCase(), '', '---', '',
    '### ' + em.emoji_etude + ' PREMIERE — Thématique fictive', '',
    em.emoji_design + ' Molécule X vs placebo', '',
    em.emoji_criteres + ' **' + em.libelle_criteres + '**',
    '- FEVG **≥ 40 %**', '- NYHA II à IV', '',
    em.emoji_contact + ' Alice FICTIVE — DECT 91234 — alice.fictive@exemple.fr', '', '---', '',
    '*' + em.pied + '*', '',
  ].join('\n');
  assert.equal(md, attendu);
  const avant = M.versMarkdown(M.construire(etudes.filter((e) => e.nom === 'MISE-EN-AVANT'), PARAM));
  assert.ok(!avant.includes(em.emoji_design) && !avant.includes(em.emoji_contact), 'ni ligne 📌 ni contact quand c\'est vide');
});

test('HTML : texte de l\'Excel échappé (pas de balise injectée), seuils en gras', () => {
  const html = M.versHtml(memo);
  assert.ok(html.includes('Critère &lt;b&gt;fictif&lt;/b&gt; &amp; co'));
  assert.ok(!html.includes('<b>fictif'));
  assert.ok(html.includes('FEVG <strong>≥ 40 %</strong>'));
});

test('à compléter : études sans critère principal ou sans ARC', () => {
  assert.deepEqual(M.aCompleter(memo).map((x) => [x.nom, x.manque]), [['MISE-EN-AVANT', ['intervention vs comparateur', 'ARC n° 1']], ['AUTRE-SECTION', ['intervention vs comparateur']]]);
  assert.ok(!M.versMarkdown(memo).includes('randomisé 1:1'), 'le design n\'apparaît plus dans les mémos');
});

test('copie de dev migrée : toutes les études ouvertes affichées, chacune une seule fois', async () => {
  const C = correspondances();
  const g = await IC.excel.lireClasseur(ExcelJS, readFileSync(join(RACINE, 'reference/CardioScope_RC_copie_dev_sans_confidentiel.xlsx')));
  const migre = IC.migration.migrer(IC.lectureAncien.lireAncienExcel(g, C), PARAM, C);
  const grilles = await IC.excel.lireClasseur(ExcelJS, await IC.gabarit.creerClasseur(ExcelJS, PARAM, migre).xlsx.writeBuffer());
  const cat = IC.catalogue.preparer(IC.lecture.lireGabarit(grilles, PARAM), PARAM);
  const m = M.construire(cat.etudes, PARAM);
  const noms = m.sections.flatMap((s) => s.etudes.map((e) => e.nom));
  const attendues = IC.eligibilite.candidates(cat.etudes).map((e) => e.nom);
  assert.equal(noms.length, attendues.length);
  assert.deepEqual(noms.slice().sort(), attendues.slice().sort());
  assert.equal(new Set(noms).size, noms.length);
  assert.ok(M.versMarkdown(m).split('\n### ').length - 1 === noms.length);
});

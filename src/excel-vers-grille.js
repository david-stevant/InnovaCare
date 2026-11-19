// =============================================================================
// excel-vers-grille.js — ouvre un fichier Excel et le transforme en « grilles »
// =============================================================================
// C'est le SEUL fichier qui dépend de la bibliothèque ExcelJS. Il transforme chaque
// onglet en un simple tableau de cellules (une « grille »), que tout le reste du
// code sait lire. Cela rend les tests simples : on peut fabriquer une grille à la
// main sans fichier Excel.
//
// Une grille ressemble à :
//   { nom: "Valves",
//     cellules: [ [ligne 1 : colonne A, colonne B…], [ligne 2…], … ],
//     fusions: [ { premiereLigne, premiereColonne, derniereLigne, derniereColonne } ] }
// Les numéros de ligne et de colonne commencent à 0 dans le tableau ; la fonction
// adresse(0, 1) donne « B1 », comme dans Excel.
// Une cellule vaut : null (vide), un texte, un nombre, ou { date: "AAAA-MM-JJ" }.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  /** Lettre(s) de colonne Excel : 0 → « A », 25 → « Z », 26 → « AA ». */
  function lettreColonne(indice) {
    let lettres = '';
    let n = indice + 1;
    while (n > 0) {
      const reste = (n - 1) % 26;
      lettres = String.fromCharCode(65 + reste) + lettres;
      n = Math.floor((n - 1) / 26);
    }
    return lettres;
  }

  /** Inverse de lettreColonne : « B » → 1. */
  function indiceColonne(lettres) {
    let n = 0;
    for (const c of lettres.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
    return n - 1;
  }

  /** Adresse Excel d'une cellule de la grille : adresse(1, 0) → « A2 ». */
  function adresse(ligne, colonne) {
    return lettreColonne(colonne) + (ligne + 1);
  }

  const estUneDate = (v) => Object.prototype.toString.call(v) === '[object Date]';

  /** Convertit la valeur d'une cellule ExcelJS en valeur simple. */
  function valeurSimple(valeur) {
    if (valeur === null || valeur === undefined) return null;
    if (estUneDate(valeur)) return isNaN(valeur) ? null : { date: valeur.toISOString().slice(0, 10) };
    if (typeof valeur === 'string') return valeur.replace(/\r\n?/g, '\n');
    if (typeof valeur === 'number' || typeof valeur === 'boolean') return valeur;
    if (typeof valeur === 'object') {
      if (Array.isArray(valeur.richText)) return valeur.richText.map((morceau) => morceau.text).join('').replace(/\r\n?/g, '\n');
      if ('result' in valeur) return valeurSimple(valeur.result); // formule : on garde le résultat
      if ('formula' in valeur || 'sharedFormula' in valeur) return null; // formule sans résultat enregistré
      if ('text' in valeur) return valeurSimple(valeur.text); // lien (e-mail, site)
      if ('error' in valeur) return null;
    }
    return String(valeur);
  }

  /** Transforme un onglet ExcelJS en grille. */
  function ongletVersGrille(onglet) {
    const nbLignes = onglet.rowCount;
    const nbColonnes = onglet.columnCount;
    const cellules = [];
    for (let l = 1; l <= nbLignes; l++) {
      const ligne = [];
      for (let c = 1; c <= nbColonnes; c++) {
        const cellule = onglet.getCell(l, c);
        // Dans une zone fusionnée, seule la première cellule garde la valeur.
        const esclave = cellule.isMerged && cellule.master && cellule.master.address !== cellule.address;
        ligne.push(esclave ? null : valeurSimple(cellule.value));
      }
      cellules.push(ligne);
    }
    const fusions = Object.keys(onglet._merges || {}).map((cle) => {
      const zone = onglet._merges[cle].model || onglet._merges[cle];
      return { premiereLigne: zone.top - 1, premiereColonne: zone.left - 1, derniereLigne: zone.bottom - 1, derniereColonne: zone.right - 1 };
    });
    return { nom: onglet.name, cellules, fusions };
  }

  /**
   * Ouvre un fichier Excel (contenu binaire) et renvoie la liste de ses grilles.
   * ExcelJS : la bibliothèque (variable globale dans les outils, module dans les tests).
   *
   * Correctif de lecture : certains fichiers réenregistrés par d'autres logiciels qu'Excel
   * (c'est le cas de la copie de développement, écrite par un script Python) notent leurs
   * liens internes sous la forme « /xl/tables/… » au lieu de « ../tables/… », et ExcelJS
   * échoue alors sur les images et les tableaux. On réécrit ces liens au moment de la
   * lecture, et on ignore les images illisibles (elles ne servent à rien ici).
   * Sur un fichier enregistré par Excel, ce correctif ne change rien.
   */
  async function lireClasseur(ExcelJS, contenu) {
    const classeur = new ExcelJS.Workbook();
    const rapprochementOriginal = classeur.xlsx.reconcile.bind(classeur.xlsx);
    classeur.xlsx.reconcile = function (modele, options) {
      for (const liens of Object.values(modele.worksheetRels || {})) {
        for (const lien of liens || []) {
          if (typeof lien.Target === 'string' && lien.TargetMode !== 'External') lien.Target = lien.Target.replace(/^\/xl\//, '../');
        }
      }
      for (const nom of Object.keys(modele.drawings || {})) {
        if (!modele.drawings[nom]) modele.drawings[nom] = { anchors: [] };
      }
      return rapprochementOriginal(modele, options);
    };
    await classeur.xlsx.load(contenu);
    return classeur.worksheets.map(ongletVersGrille);
  }

  InnovaCare.excel = { lettreColonne, indiceColonne, adresse, valeurSimple, ongletVersGrille, lireClasseur };
})(typeof globalThis !== 'undefined' ? globalThis : this);

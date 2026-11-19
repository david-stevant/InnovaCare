// =============================================================================
// memoire-fichier.js — retenir le fichier Excel choisi d'une ouverture à l'autre
// =============================================================================
// Edge et Chrome savent donner une « poignée » sur un fichier choisi par l'utilisateur.
// On range cette poignée (et non le contenu du fichier) dans la base locale du
// navigateur : à la réouverture de l'outil, un bouton « Recharger » relit le même
// fichier après un clic d'autorisation. Validé par le diagnostic du 19/11/2026.
// Si le navigateur ne sait pas faire, on revient au sélecteur de fichier classique.
// Rien ne quitte l'ordinateur.
// =============================================================================
(function (racine) {
  'use strict';
  const InnovaCare = racine.InnovaCare || (racine.InnovaCare = {});

  const NOM_BASE = 'innovacare';
  const CASIER = 'fichiers';
  const TYPES_EXCEL = [{
    description: 'Classeur Excel',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
  }];

  const disponible = () => typeof racine.showOpenFilePicker === 'function' && typeof racine.indexedDB !== 'undefined';

  function operation(mode, action) {
    return new Promise((resoudre, rejeter) => {
      const ouverture = racine.indexedDB.open(NOM_BASE, 1);
      ouverture.onupgradeneeded = () => ouverture.result.createObjectStore(CASIER);
      ouverture.onerror = () => rejeter(ouverture.error);
      ouverture.onsuccess = () => {
        const base = ouverture.result;
        const demande = action(base.transaction(CASIER, mode).objectStore(CASIER));
        demande.onsuccess = () => { base.close(); resoudre(demande.result); };
        demande.onerror = () => { base.close(); rejeter(demande.error); };
      };
    });
  }

  /** Ouvre le sélecteur ; renvoie { fichier, poignee } ou null si l'utilisateur annule. */
  async function choisir() {
    try {
      const [poignee] = await racine.showOpenFilePicker({ types: TYPES_EXCEL, multiple: false });
      return { fichier: await poignee.getFile(), poignee };
    } catch (erreur) {
      if (erreur && erreur.name === 'AbortError') return null;
      throw erreur;
    }
  }

  const memoriser = (cle, poignee) => operation('readwrite', (casier) => casier.put(poignee, cle));
  const retrouver = (cle) => operation('readonly', (casier) => casier.get(cle));
  const oublier = (cle) => operation('readwrite', (casier) => casier.delete(cle));

  /** Relit le fichier d'une poignée mémorisée (demande l'autorisation si besoin). Renvoie un File ou null. */
  async function relire(poignee) {
    let permission = await poignee.queryPermission({ mode: 'read' });
    if (permission !== 'granted') permission = await poignee.requestPermission({ mode: 'read' });
    return permission === 'granted' ? poignee.getFile() : null;
  }

  InnovaCare.memoireFichier = { disponible, choisir, memoriser, retrouver, oublier, relire };
})(typeof globalThis !== 'undefined' ? globalThis : this);

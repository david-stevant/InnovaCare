// =============================================================================
// diagnostic.js — code de l'outil « Diagnostic du poste »
// =============================================================================
// Répond à deux questions posées en début de phase 1 :
//   1. Ce poste peut-il joindre GitHub (pour publier en un clic) ?
//   2. Le navigateur retient-il un fichier choisi d'une session à l'autre ?
// Rien n'est envoyé ni écrit sur GitHub ; aucun nom de fichier n'est conservé.
// =============================================================================
(function () {
  'use strict';

  const VERSION = '1.0';
  const DELAI_MAX_MS = 12000; // au-delà de 12 secondes sans réponse, on considère l'accès bloqué
  const CLE_OUVERTURES = 'innovacare-diagnostic-ouvertures';
  const CLE_MEMORISATION = 'innovacare-diagnostic-memorise-a-ouverture';
  const NOM_BASE = 'innovacare-diagnostic';

  // Tout ce que l'outil constate est rangé ici, puis recopié dans le compte rendu.
  const etat = {
    navigateur: [], // lignes { verdict, texte }
    reseau: [],
    fichier: [],
    copie: 'non testée',
    numeroOuverture: null,
  };

  const element = (id) => document.getElementById(id);

  // --- Affichage --------------------------------------------------------------

  const SYMBOLES = { ok: '✔', alerte: '!', echec: '✘', info: '•' };

  function afficherListe(idListe, lignes) {
    const liste = element(idListe);
    liste.textContent = '';
    for (const ligne of lignes) {
      const li = document.createElement('li');
      if (ligne.verdict !== 'info') li.className = ligne.verdict;
      li.textContent = SYMBOLES[ligne.verdict] + ' ' + ligne.texte;
      liste.appendChild(li);
    }
  }

  function rafraichir() {
    afficherListe('liste-navigateur', etat.navigateur);
    afficherListe('liste-reseau', etat.reseau);
    afficherListe('liste-fichier', etat.fichier);
    element('compte-rendu').value = redigerCompteRendu();
  }

  function redigerCompteRendu() {
    const bloc = (titre, lignes) =>
      [titre].concat(lignes.length ? lignes.map((l) => '  [' + l.verdict + '] ' + l.texte) : ['  (non fait)']);
    return []
      .concat(['DIAGNOSTIC INNOVACARE v' + VERSION + ' — ' + new Date().toLocaleString('fr-FR')], [''])
      .concat(bloc('1. NAVIGATEUR', etat.navigateur), [''])
      .concat(bloc('2. ACCÈS À GITHUB', etat.reseau), [''])
      .concat(bloc('3. MÉMORISATION D\'UN FICHIER', etat.fichier), [''])
      .concat(['4. COPIE AUTOMATIQUE DANS LE PRESSE-PAPIERS : ' + etat.copie])
      .join('\n');
  }

  // --- 1. Navigateur ----------------------------------------------------------

  function nomDuNavigateur() {
    const ua = navigator.userAgent;
    const trouve = (motif) => (ua.match(motif) || [])[1];
    if (trouve(/Edg\/(\d+)/)) return 'Edge ' + trouve(/Edg\/(\d+)/);
    if (trouve(/Firefox\/(\d+)/)) return 'Firefox ' + trouve(/Firefox\/(\d+)/);
    if (trouve(/Chrome\/(\d+)/)) return 'Chrome ' + trouve(/Chrome\/(\d+)/);
    if (trouve(/Version\/(\d+).*Safari/)) return 'Safari ' + trouve(/Version\/(\d+).*Safari/);
    return 'non reconnu';
  }

  /** Vrai si le navigateur garde de petites notes d'une ouverture à l'autre (« stockage local »). */
  function compterLesOuvertures() {
    try {
      const numero = (parseInt(localStorage.getItem(CLE_OUVERTURES), 10) || 0) + 1;
      localStorage.setItem(CLE_OUVERTURES, String(numero));
      return numero;
    } catch (erreur) {
      return null;
    }
  }

  function examinerLeNavigateur() {
    const lignes = [];
    lignes.push({ verdict: 'info', texte: 'Navigateur : ' + nomDuNavigateur() });
    lignes.push({ verdict: 'info', texte: 'Détail technique : ' + navigator.userAgent });
    lignes.push(
      location.protocol === 'file:'
        ? { verdict: 'ok', texte: 'Outil ouvert par double-clic (fichier local), comme prévu.' }
        : { verdict: 'alerte', texte: 'Outil ouvert via « ' + location.protocol + ' » et non par double-clic : refaire le test en local.' }
    );

    etat.numeroOuverture = compterLesOuvertures();
    lignes.push(
      etat.numeroOuverture === null
        ? { verdict: 'echec', texte: 'Stockage local refusé : le navigateur ne retiendra aucun réglage (jeton, préférences).' }
        : etat.numeroOuverture === 1
          ? { verdict: 'info', texte: 'Stockage local : accepté. Ouverture n° 1 (à confirmer en rouvrant le fichier : le compteur doit augmenter).' }
          : { verdict: 'ok', texte: 'Stockage local conservé d\'une ouverture à l\'autre (ouverture n° ' + etat.numeroOuverture + ').' }
    );

    lignes.push(
      'showOpenFilePicker' in window
        ? { verdict: 'ok', texte: 'Mémorisation de fichier : fonction présente dans ce navigateur (à vérifier à l\'étape 3).' }
        : { verdict: 'alerte', texte: 'Mémorisation de fichier : fonction absente de ce navigateur. Le fichier sera à re-sélectionner à chaque fois.' }
    );
    lignes.push(
      'indexedDB' in window
        ? { verdict: 'ok', texte: 'Base locale du navigateur : disponible.' }
        : { verdict: 'alerte', texte: 'Base locale du navigateur : indisponible.' }
    );
    etat.navigateur = lignes;
  }

  // --- 2. Réseau --------------------------------------------------------------

  /** Lance une requête avec un délai maximum. Renvoie { reponse, duree } ou lève une erreur. */
  async function interroger(url, options) {
    const minuterie = new AbortController();
    const reveil = setTimeout(() => minuterie.abort(), DELAI_MAX_MS);
    const debut = Date.now();
    try {
      const reponse = await fetch(url, Object.assign({ cache: 'no-store', signal: minuterie.signal }, options));
      return { reponse, duree: Date.now() - debut };
    } finally {
      clearTimeout(reveil);
    }
  }

  function raisonEchec(erreur) {
    return erreur && erreur.name === 'AbortError'
      ? 'aucune réponse après ' + DELAI_MAX_MS / 1000 + ' secondes'
      : 'connexion refusée ou filtrée par le réseau';
  }

  /** Un test « lisible » : on peut lire le code de réponse (l'API GitHub l'autorise). */
  async function testerApi(nom, url, options, codesAttendus) {
    try {
      const { reponse, duree } = await interroger(url, options);
      const vientDeGitHub = reponse.headers.has('x-github-request-id');
      if (codesAttendus.includes(reponse.status) && vientDeGitHub) {
        return { verdict: 'ok', texte: nom + ' : joignable (code ' + reponse.status + ', ' + duree + ' ms).' };
      }
      return {
        verdict: 'alerte',
        texte: nom + ' : réponse inattendue (code ' + reponse.status + (vientDeGitHub ? '' : ', ne semble pas venir de GitHub') + ').',
      };
    } catch (erreur) {
      return { verdict: 'echec', texte: nom + ' : BLOQUÉ (' + raisonEchec(erreur) + ').' };
    }
  }

  /** Un test « aveugle » : pour un site web classique, on sait seulement s'il a répondu. */
  async function testerSite(nom, url) {
    try {
      const { duree } = await interroger(url, { mode: 'no-cors' });
      return { verdict: 'ok', texte: nom + ' : joignable (' + duree + ' ms).' };
    } catch (erreur) {
      return { verdict: 'echec', texte: nom + ' : BLOQUÉ (' + raisonEchec(erreur) + ').' };
    }
  }

  async function testerLeReseau() {
    const depot = element('depot').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(depot)) {
      etat.reseau = [{ verdict: 'alerte', texte: 'Le dépôt doit s\'écrire « proprietaire/nom », par exemple « david-stevant/InnovaCare ».' }];
      rafraichir();
      return;
    }
    const [proprietaire, nom] = depot.split('/');
    const api = 'https://api.github.com';

    element('bouton-reseau').disabled = true;
    etat.reseau = [{ verdict: 'info', texte: 'Test en cours (jusqu\'à ' + (DELAI_MAX_MS / 1000) * 5 + ' secondes)…' }];
    rafraichir();

    const lecture = await testerApi('API GitHub, lecture', api + '/zen', {}, [200]);
    const projet = await testerApi('API GitHub, dépôt « ' + depot + ' »', api + '/repos/' + depot, {}, [200]);
    // Envoi sans jeton : GitHub refuse (codes 401, 403 ou 404), c'est voulu. Ce refus prouve que la
    // demande d'envoi a traversé le réseau jusqu'à GitHub. Rien n'est écrit.
    const envoi = await testerApi(
      'API GitHub, envoi (refusé par GitHub faute de jeton : c\'est normal)',
      api + '/repos/' + depot + '/contents/test-diagnostic-a-ignorer.txt',
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'test', content: '' }) },
      [401, 403, 404]
    );
    const siteGitHub = await testerSite('Site github.com (dépôt manuel de secours)', 'https://github.com/' + depot);
    const pages = await testerSite('GitHub Pages (futur site public)', 'https://' + proprietaire.toLowerCase() + '.github.io/' + nom + '/');

    const apiPraticable = lecture.verdict === 'ok' && envoi.verdict === 'ok';
    const conclusion = apiPraticable
      ? { verdict: 'ok', texte: 'CONCLUSION : la publication en un clic est possible depuis ce poste.' }
      : siteGitHub.verdict === 'ok'
        ? { verdict: 'alerte', texte: 'CONCLUSION : publication en un clic impossible ici ; le dépôt manuel sur github.com reste possible.' }
        : { verdict: 'echec', texte: 'CONCLUSION : GitHub est inaccessible depuis ce poste ; la publication devra se faire depuis un autre poste.' };

    etat.reseau = [lecture, projet, envoi, siteGitHub, pages, conclusion];
    element('bouton-reseau').disabled = false;
    rafraichir();
  }

  // --- 3. Mémorisation d'un fichier ----------------------------------------------
  // Le navigateur donne une « poignée » sur le fichier choisi. On la range dans sa base locale
  // (IndexedDB) ; à la réouverture, on regarde si elle y est toujours et si elle permet de relire.

  function ouvrirLaBase() {
    return new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open(NOM_BASE, 1);
      demande.onupgradeneeded = () => demande.result.createObjectStore('memoire');
      demande.onsuccess = () => resoudre(demande.result);
      demande.onerror = () => rejeter(demande.error);
    });
  }

  async function operationSurLaBase(mode, action) {
    const base = await ouvrirLaBase();
    try {
      return await new Promise((resoudre, rejeter) => {
        const demande = action(base.transaction('memoire', mode).objectStore('memoire'));
        demande.onsuccess = () => resoudre(demande.result);
        demande.onerror = () => rejeter(demande.error);
      });
    } finally {
      base.close();
    }
  }

  const rangerLaPoignee = (poignee) => operationSurLaBase('readwrite', (casier) => casier.put(poignee, 'fichier'));
  const retrouverLaPoignee = () => operationSurLaBase('readonly', (casier) => casier.get('fichier'));
  const effacerLaPoignee = () => operationSurLaBase('readwrite', (casier) => casier.delete('fichier'));

  function noter(cle, valeur) {
    try {
      if (valeur === null) localStorage.removeItem(cle);
      else localStorage.setItem(cle, valeur);
    } catch (erreur) { /* stockage local refusé : déjà signalé à l'étape 1 */ }
  }
  function relire(cle) {
    try { return localStorage.getItem(cle); } catch (erreur) { return null; }
  }

  const LIBELLES_PERMISSION = {
    granted: 'déjà accordée',
    prompt: 'à redemander (un clic)',
    denied: 'refusée',
  };

  async function choisirUnFichier() {
    if (!('showOpenFilePicker' in window)) {
      element('selecteur-classique').click(); // repli : sélecteur de fichier classique
      return;
    }
    let poignee;
    try {
      [poignee] = await window.showOpenFilePicker();
    } catch (erreur) {
      if (erreur.name === 'AbortError') return; // fenêtre fermée sans choisir : on ne dit rien
      etat.fichier = [{ verdict: 'echec', texte: 'Le sélecteur de fichier a échoué (' + erreur.name + ').' }];
      rafraichir();
      return;
    }
    const lignes = [];
    try {
      const fichier = await poignee.getFile();
      lignes.push({ verdict: 'ok', texte: 'Fichier choisi et lisible (' + fichier.size + ' octets).' });
    } catch (erreur) {
      lignes.push({ verdict: 'echec', texte: 'Fichier choisi mais illisible (' + erreur.name + ').' });
    }
    try {
      await rangerLaPoignee(poignee);
      noter(CLE_MEMORISATION, String(etat.numeroOuverture));
      lignes.push({ verdict: 'ok', texte: 'Fichier mémorisé à l\'ouverture n° ' + etat.numeroOuverture + '.' });
      lignes.push({ verdict: 'info', texte: 'À FAIRE : fermer complètement le navigateur, rouvrir ce fichier Diagnostic, cliquer sur « Recharger le fichier mémorisé ».' });
      element('bouton-recharger').disabled = false;
      element('bouton-oublier').disabled = false;
    } catch (erreur) {
      lignes.push({ verdict: 'echec', texte: 'Mémorisation refusée par le navigateur (' + erreur.name + ').' });
    }
    etat.fichier = lignes;
    rafraichir();
  }

  async function chercherUnFichierMemorise() {
    if (!('showOpenFilePicker' in window) || !('indexedDB' in window)) return;
    let poignee;
    try {
      poignee = await retrouverLaPoignee();
    } catch (erreur) {
      etat.fichier = [{ verdict: 'echec', texte: 'Base locale illisible (' + erreur.name + ') : mémorisation impossible.' }];
      return;
    }
    if (!poignee) {
      if (relire(CLE_MEMORISATION)) {
        etat.fichier = [{ verdict: 'echec', texte: 'Un fichier avait été mémorisé à l\'ouverture n° ' + relire(CLE_MEMORISATION) + ', mais le navigateur l\'a oublié.' }];
      }
      return;
    }
    const permission = await poignee.queryPermission({ mode: 'read' });
    etat.fichier = [
      {
        verdict: 'ok',
        texte: 'Fichier mémorisé à l\'ouverture n° ' + (relire(CLE_MEMORISATION) || '?') + ' retrouvé à l\'ouverture n° ' + etat.numeroOuverture + '.',
      },
      { verdict: 'info', texte: 'Autorisation de lecture : ' + (LIBELLES_PERMISSION[permission] || permission) + '. Cliquez sur « Recharger le fichier mémorisé ».' },
    ];
    element('bouton-recharger').disabled = false;
    element('bouton-oublier').disabled = false;
  }

  async function rechargerLeFichier() {
    const lignes = etat.fichier.filter((ligne) => ligne.verdict !== 'info' && !ligne.rechargement);
    const ajouter = (verdict, texte) => lignes.push({ verdict, texte, rechargement: true });
    try {
      const poignee = await retrouverLaPoignee();
      if (!poignee) {
        ajouter('echec', 'Rechargement : aucun fichier mémorisé n\'a été retrouvé.');
      } else {
        const avant = await poignee.queryPermission({ mode: 'read' });
        const apres = avant === 'granted' ? avant : await poignee.requestPermission({ mode: 'read' });
        ajouter('info', 'Rechargement : autorisation avant le clic « ' + (LIBELLES_PERMISSION[avant] || avant) + ' », après « ' + (LIBELLES_PERMISSION[apres] || apres) + ' ».');
        if (apres === 'granted') {
          const fichier = await poignee.getFile();
          const contenu = await fichier.arrayBuffer();
          ajouter('ok', 'Rechargement réussi sans re-sélectionner le fichier (' + contenu.byteLength + ' octets relus) à l\'ouverture n° ' + etat.numeroOuverture + '.');
        } else {
          ajouter('echec', 'Rechargement refusé : le fichier devra être re-sélectionné à chaque session.');
        }
      }
    } catch (erreur) {
      ajouter('echec', 'Rechargement en échec (' + erreur.name + ') : fichier déplacé, supprimé ou inaccessible ?');
    }
    etat.fichier = lignes;
    rafraichir();
  }

  async function oublierLeFichier() {
    try { await effacerLaPoignee(); } catch (erreur) { /* rien à effacer */ }
    noter(CLE_MEMORISATION, null);
    etat.fichier = [{ verdict: 'info', texte: 'Fichier oublié. Vous pouvez recommencer le test.' }];
    element('bouton-recharger').disabled = true;
    element('bouton-oublier').disabled = true;
    rafraichir();
  }

  function fichierChoisiParLeSelecteurClassique(evenement) {
    const fichier = evenement.target.files[0];
    if (!fichier) return;
    etat.fichier = [
      { verdict: 'ok', texte: 'Sélecteur classique : fichier lisible (' + fichier.size + ' octets).' },
      { verdict: 'alerte', texte: 'Ce navigateur ne sait pas mémoriser un fichier : il faudra le re-sélectionner à chaque fois.' },
    ];
    rafraichir();
  }

  // --- 4. Copie du compte rendu --------------------------------------------------

  async function copierLeCompteRendu() {
    const zone = element('compte-rendu');
    const message = element('message-copie');
    const ecrire = () => navigator.clipboard.writeText(redigerCompteRendu());
    try {
      await ecrire();
      etat.copie = 'réussie';
      await ecrire(); // seconde copie, pour que le texte collé contienne ce résultat
      message.textContent = 'Copié. Collez-le dans la conversation.';
    } catch (erreur) {
      etat.copie = 'ÉCHEC (' + (erreur && erreur.name) + ') : copie manuelle nécessaire';
      message.textContent = 'Copie automatique impossible : le texte est sélectionné, faites Ctrl + C.';
    }
    rafraichir();
    if (etat.copie !== 'réussie') { zone.focus(); zone.select(); }
  }

  // --- Démarrage ---------------------------------------------------------------

  async function demarrer() {
    examinerLeNavigateur();
    element('bouton-reseau').addEventListener('click', testerLeReseau);
    element('bouton-choisir').addEventListener('click', choisirUnFichier);
    element('bouton-recharger').addEventListener('click', rechargerLeFichier);
    element('bouton-oublier').addEventListener('click', oublierLeFichier);
    element('selecteur-classique').addEventListener('change', fichierChoisiParLeSelecteurClassique);
    element('bouton-copier').addEventListener('click', copierLeCompteRendu);
    try { await chercherUnFichierMemorise(); } catch (erreur) { /* le test manuel de l'étape 3 reste possible */ }
    rafraichir();
  }

  demarrer();
})();

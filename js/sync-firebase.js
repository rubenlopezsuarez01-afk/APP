/*
 * Espacio compartido en Firebase (Firestore). Todo lo de un espacio vive en
 * hogares/<código>/..., y quien conoce el código puede leer y escribir.
 */
(function (root) {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
  const CODE_LENGTH = 20;
  let firestore = null;

  function isConfigured() {
    return !!(root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.projectId);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(Object.assign(new Error('No se pudo cargar Firebase'), { code: 'offline' }));
      document.head.append(s);
    });
  }

  async function getFirestore() {
    if (firestore) return firestore;
    if (!isConfigured()) throw Object.assign(new Error('Firebase sin configurar'), { code: 'no_config' });
    if (!root.firebase) {
      await loadScript(SDK + 'firebase-app-compat.js');
      await loadScript(SDK + 'firebase-firestore-compat.js');
    }
    const fb = root.firebase;
    if (!fb.apps.length) fb.initializeApp(root.FIREBASE_CONFIG);
    firestore = fb.firestore();
    // Solo para pruebas en local con el emulador de Firestore.
    const emu = root.FIREBASE_CONFIG.emulator;
    if (emu) firestore.useEmulator(emu.host, emu.port);
    // Guarda los cambios hechos sin conexión y los envía al volver la cobertura.
    try { await firestore.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* otro navegador o pestaña */ }
    return firestore;
  }

  function newCode() {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  }

  /** Acepta el código con guiones, en minúsculas o el enlace de invitación entero. */
  function cleanCode(text) {
    const m = String(text || '').match(/unirse=([A-Za-z0-9-]+)/);
    const raw = (m ? m[1] : String(text || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return raw.length === CODE_LENGTH && [...raw].every((c) => ALPHABET.includes(c)) ? raw : null;
  }

  function formatCode(code) {
    return code.match(/.{1,5}/g).join('-');
  }

  /** Base de datos del espacio, con la forma que espera Store.connect. */
  async function open(code) {
    const fs = await getFirestore();
    const base = 'hogares/' + code + '/';
    return {
      doc: (p) => fs.doc(base + p),
      collection: (p) => fs.collection(base + p)
    };
  }

  /** ¿Existe ya un espacio con este código? (consulta al servidor) */
  async function exists(code) {
    const db = await open(code);
    const snap = await db.doc('meta/settings').get({ source: 'server' });
    return snap.exists;
  }

  function inviteLink(code) {
    return location.origin + location.pathname + '#unirse=' + formatCode(code);
  }

  root.FirebaseSync = { isConfigured, newCode, cleanCode, formatCode, open, exists, inviteLink };
})(typeof self !== 'undefined' ? self : this);

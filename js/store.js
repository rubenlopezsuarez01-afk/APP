/*
 * Persistencia. Por defecto en localStorage; si la app se abre como
 * artefacto de Claude con la capacidad `db`, los datos se guardan en la
 * base de datos del artefacto y se sincronizan entre dispositivos.
 *
 * Organización en la base de datos:
 *   meta/settings       { settings, ingredientShop }
 *   weeks/<yyyy-mm-dd>  { slots, extras, checked }
 *   recipes/<id>        { id, name, ingredients, notes }
 */
(function (root) {
  'use strict';

  const KEY = 'planificador-comidas-v1';
  const { STAPLES } = root.Logic;

  function defaults() {
    return {
      version: 1,
      settings: {
        meals: ['Comida', 'Cena'],
        supermarkets: ['Mercadona', 'Lidl', 'Carrefour', 'Dia', 'Alcampo', 'Frutería'],
        pantry: ['Sal', 'Aceite de oliva', 'Pimienta', 'Ajo', 'Pimentón', 'Orégano', 'Vinagre'],
        staples: STAPLES.slice()
      },
      recipes: [],
      weeks: {},
      ingredientShop: {}
    };
  }

  function migrate(data) {
    const base = defaults();
    if (!data || typeof data !== 'object') return base;
    return {
      ...base,
      ...data,
      settings: { ...base.settings, ...(data.settings || {}) },
      recipes: Array.isArray(data.recipes) ? data.recipes : [],
      weeks: data.weeks || {},
      ingredientShop: data.ingredientShop || {}
    };
  }

  // ---------- localStorage ----------
  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : defaults();
    } catch (e) {
      return defaults();
    }
  }

  function saveLocal(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- base de datos del artefacto ----------
  // JSON con claves ordenadas, para comparar documentos sin depender del orden.
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  function isEmptyWeek(w) {
    return !Object.keys(w.slots || {}).length && !(w.extras || []).length && !Object.keys(w.checked || {}).length;
  }

  /** Estado de la app -> { ruta: cuerpo } */
  function toDocs(state) {
    const docs = { 'meta/settings': { settings: state.settings, ingredientShop: state.ingredientShop } };
    for (const [k, w] of Object.entries(state.weeks)) {
      if (!isEmptyWeek(w)) docs['weeks/' + k] = { slots: w.slots || {}, extras: w.extras || [], checked: w.checked || {} };
    }
    for (const r of state.recipes) docs['recipes/' + r.id] = r;
    return docs;
  }

  /** { ruta: cuerpo } -> estado de la app */
  function fromDocs(docs) {
    const meta = docs['meta/settings'] || {};
    const state = migrate({ settings: meta.settings, ingredientShop: meta.ingredientShop });
    for (const [path, body] of Object.entries(docs)) {
      const [col, id] = path.split('/');
      if (col === 'weeks') state.weeks[id] = JSON.parse(JSON.stringify(body));
      if (col === 'recipes') state.recipes.push(JSON.parse(JSON.stringify({ ...body, id })));
    }
    state.recipes.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    return state;
  }

  const remote = {
    db: null,
    docs: {}, // último contenido conocido en el servidor, por ruta (JSON estable)
    queues: {}, // una escritura a la vez por documento
    onError: null
  };

  function enqueue(path, fn) {
    const prev = remote.queues[path] || Promise.resolve();
    const next = prev.then(fn, fn);
    remote.queues[path] = next.catch(() => {});
    return next;
  }

  function saveRemote(state) {
    const docs = toDocs(state);
    const writes = [];
    for (const [path, body] of Object.entries(docs)) {
      const s = stable(body);
      if (remote.docs[path] === s) continue;
      remote.docs[path] = s;
      writes.push(enqueue(path, () => remote.db.doc(path).set(JSON.parse(JSON.stringify(body)))));
    }
    for (const path of Object.keys(remote.docs)) {
      if (docs[path]) continue;
      delete remote.docs[path];
      writes.push(enqueue(path, () => remote.db.doc(path).delete()));
    }
    Promise.all(writes).catch((e) => remote.onError && remote.onError(e));
  }

  /**
   * Intenta conectar con la base de datos del artefacto. `onRemote(state)`
   * se llama con el estado completo cada vez que llegan cambios de otro
   * dispositivo (y una vez al conectar). Devuelve true si hay conexión.
   */
  async function connect(onRemote, onError) {
    const claude = root.claude;
    if (!claude || typeof claude.use !== 'function') return false;
    let db = null;
    try { db = await claude.use('db'); } catch (e) { db = null; }
    if (!db) return false;
    remote.db = db;
    remote.onError = onError;

    const parts = { meta: null, weeks: null, recipes: null };
    let ready = false;
    let localBeforeConnect = loadLocal();

    function emit() {
      if (!parts.meta || !parts.weeks || !parts.recipes) return;
      const docs = { ...parts.meta, ...parts.weeks, ...parts.recipes };
      let changed = !ready;
      for (const [path, body] of Object.entries(docs)) {
        const s = stable(body);
        if (remote.docs[path] !== s) { remote.docs[path] = s; changed = true; }
      }
      for (const path of Object.keys(remote.docs)) {
        if (!(path in docs)) { delete remote.docs[path]; changed = true; }
      }
      const first = !ready;
      ready = true;
      // Base de datos vacía: sube lo que hubiera en este navegador.
      if (first && !Object.keys(docs).length && localBeforeConnect &&
        (Object.keys(localBeforeConnect.weeks).length || localBeforeConnect.recipes.length)) {
        onRemote(localBeforeConnect);
        saveRemote(localBeforeConnect);
        localBeforeConnect = null;
        return;
      }
      if (changed) onRemote(fromDocs(docs));
    }

    const fail = (e) => onError && onError(e);
    db.doc('meta/settings').onSnapshot((snap) => {
      parts.meta = snap.exists ? { 'meta/settings': snap.data() } : {};
      emit();
    }, fail);
    for (const col of ['weeks', 'recipes']) {
      db.collection(col).onSnapshot((snap) => {
        const out = {};
        for (const d of snap.docs) out[col + '/' + d.id] = d.data();
        parts[col] = out;
        emit();
      }, fail);
    }
    return true;
  }

  function load() {
    return loadLocal();
  }

  function save(state) {
    if (remote.db) saveRemote(state);
    else if (!saveLocal(state) && remote.onError) remote.onError({ code: 'local' });
  }

  function isRemote() {
    return !!remote.db;
  }

  root.Store = { load, save, defaults, migrate, connect, isRemote, toDocs, fromDocs, stable };
})(typeof self !== 'undefined' ? self : this);

/*
 * Persistencia. Siempre en localStorage; además, si hay un espacio
 * compartido (Firebase) o la app se abre como artefacto de Claude, los
 * datos se sincronizan con el servidor y entre móviles (ver toDocs).
 */
(function (root) {
  'use strict';

  // No cambies esta clave: es donde viven los datos en el móvil. Si cambia,
  // la app arrancaría vacía tras una actualización.
  const KEY = 'planificador-comidas-v1';
  const META_KEY = 'planificador-comidas-meta';
  const DATA_VERSION = 1;
  const { STAPLES } = root.Logic;

  function defaults() {
    return {
      version: DATA_VERSION,
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
      ingredientShop: data.ingredientShop || {},
      version: DATA_VERSION
    };
  }

  // Aquí irán las conversiones si algún día cambia la forma de los datos:
  // if (data.version < 2) { ...convertir... }
  function upgrade(data) {
    return migrate(data);
  }

  // ---------- localStorage ----------
  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      if ((data.version || 1) < DATA_VERSION) {
        // Copia intacta antes de convertir los datos a la nueva versión.
        localStorage.setItem(`${KEY}-antes-de-v${DATA_VERSION}`, raw);
      }
      return upgrade(data);
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

  // ---------- sincronización (base de datos del artefacto o Firebase) ----------
  // JSON con claves ordenadas, para comparar documentos sin depender del orden.
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  // Hash corto para usar textos libres como id de documento.
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  }

  const COLLECTIONS = ['weeks', 'recipes', 'extras', 'checks'];
  // Los artículos añadidos a mano y los tachados de semanas antiguas se borran del servidor.
  const KEEP_LIST_WEEKS = 8;

  /**
   * Estado de la app -> { ruta: cuerpo }. Cada cosa que se suele tocar a la vez
   * desde dos móviles va en su propio documento, para que no se pisen:
   *   meta/settings            ajustes y supermercado de cada ingrediente
   *   weeks/<lunes>            { slots } comidas de la semana
   *   extras/<id>              artículo añadido a mano a la lista
   *   checks/<lunes>~<hash>    artículo tachado en la lista
   *   recipes/<id>             receta
   */
  function toDocs(state, todayISO) {
    const L = root.Logic;
    const cutoff = L.addDays(L.weekStart(todayISO ? L.fromISO(todayISO) : new Date()), -7 * KEEP_LIST_WEEKS);
    const docs = { 'meta/settings': { settings: state.settings, ingredientShop: state.ingredientShop } };
    for (const [k, w] of Object.entries(state.weeks)) {
      if (Object.keys(w.slots || {}).length) docs['weeks/' + k] = { slots: w.slots };
      if (k < cutoff) continue;
      for (const ex of w.extras || []) {
        docs['extras/' + ex.id] = { week: k, name: ex.name, qty: ex.qty || '', supermarket: ex.supermarket || '' };
      }
      for (const item of Object.keys(w.checked || {})) {
        if (w.checked[item]) docs['checks/' + k + '~' + hash(item)] = { week: k, item };
      }
    }
    for (const r of state.recipes) docs['recipes/' + r.id] = r;
    return docs;
  }

  /** { ruta: cuerpo } -> estado de la app */
  function fromDocs(docs) {
    const meta = docs['meta/settings'] || {};
    const state = migrate({ settings: meta.settings, ingredientShop: meta.ingredientShop });
    const week = (k) => (state.weeks[k] = state.weeks[k] || { slots: {}, extras: [], checked: {} });
    const clone = (o) => JSON.parse(JSON.stringify(o));
    for (const path of Object.keys(docs).sort()) {
      const body = docs[path];
      const i = path.indexOf('/');
      const col = path.slice(0, i);
      const id = path.slice(i + 1);
      if (col === 'weeks') {
        const w = week(id);
        w.slots = clone(body.slots || {});
        // Formato antiguo: lista y tachados dentro de la semana.
        for (const ex of body.extras || []) if (!w.extras.some((x) => x.id === ex.id)) w.extras.push(clone(ex));
        Object.assign(w.checked, body.checked || {});
      } else if (col === 'extras') {
        const w = week(body.week);
        if (!w.extras.some((x) => x.id === id)) w.extras.push({ id, name: body.name, qty: body.qty || '', supermarket: body.supermarket || '' });
      } else if (col === 'checks') {
        week(body.week).checked[body.item] = true;
      } else if (col === 'recipes') {
        state.recipes.push(clone({ ...body, id }));
      }
    }
    for (const w of Object.values(state.weeks)) w.extras.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    state.recipes.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    return state;
  }

  const remote = {
    db: null,
    docs: {}, // último contenido conocido en el servidor, por ruta (JSON estable)
    queues: {}, // una escritura a la vez por documento
    unsubscribe: [],
    pending: 0,
    onError: null,
    onStatus: null
  };

  function setPending(delta) {
    remote.pending += delta;
    if (remote.onStatus) remote.onStatus(remote.pending > 0 ? 'pending' : 'synced');
  }

  function enqueue(path, fn) {
    const prev = remote.queues[path] || Promise.resolve();
    const next = prev.then(fn, fn);
    remote.queues[path] = next.catch(() => {});
    return next;
  }

  function saveRemote(state) {
    const db = remote.db;
    const docs = toDocs(state);
    const writes = [];
    for (const [path, body] of Object.entries(docs)) {
      const s = stable(body);
      if (remote.docs[path] === s) continue;
      remote.docs[path] = s;
      writes.push(enqueue(path, () => db.doc(path).set(JSON.parse(JSON.stringify(body)))));
    }
    for (const path of Object.keys(remote.docs)) {
      if (docs[path]) continue;
      delete remote.docs[path];
      writes.push(enqueue(path, () => db.doc(path).delete()));
    }
    if (!writes.length) return;
    setPending(1);
    Promise.all(writes)
      .catch((e) => remote.onError && remote.onError(e))
      .finally(() => setPending(-1));
  }

  /**
   * Conecta con una base de datos de documentos (la del artefacto de Claude o
   * Firebase, que tienen la misma forma: doc().set/delete/onSnapshot y
   * collection().onSnapshot).
   *   onRemote(state)  se llama con el estado completo al conectar y cada vez
   *                    que llegan cambios del otro móvil.
   *   initial          estado a subir al conectar (al crear un espacio nuevo).
   *   uploadIfEmpty    si el servidor está vacío, sube los datos de este móvil.
   */
  function connect(db, opts) {
    disconnect();
    const { onRemote, onError, onStatus, initial, uploadIfEmpty } = opts;
    remote.db = db;
    remote.docs = {};
    remote.queues = {};
    remote.pending = 0;
    remote.onError = onError;
    remote.onStatus = onStatus;
    if (initial) saveRemote(initial);

    const parts = { meta: null };
    const fromCache = {};
    let ready = false;

    function emit() {
      if (!parts.meta || COLLECTIONS.some((c) => !parts[c])) return;
      const docs = Object.assign({}, parts.meta, ...COLLECTIONS.map((c) => parts[c]));
      const empty = !Object.keys(docs).length;
      // No decidir que el servidor está vacío con datos que aún vienen de la caché.
      if (!ready && empty && Object.values(fromCache).some(Boolean)) return;
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
      if (first && empty && uploadIfEmpty) {
        const local = loadLocal();
        if (Object.keys(local.weeks).length || local.recipes.length) {
          onRemote(local);
          saveRemote(local);
          return;
        }
      }
      if (changed) {
        const state = fromDocs(docs);
        saveLocal(state); // copia local para abrir rápido y sin conexión
        onRemote(state);
      }
    }

    const fail = (e) => onError && onError(e);
    remote.unsubscribe.push(db.doc('meta/settings').onSnapshot((snap) => {
      fromCache.meta = !!(snap.metadata && snap.metadata.fromCache);
      parts.meta = snap.exists ? { 'meta/settings': snap.data() } : {};
      emit();
    }, fail));
    for (const col of COLLECTIONS) {
      remote.unsubscribe.push(db.collection(col).onSnapshot((snap) => {
        fromCache[col] = !!(snap.metadata && snap.metadata.fromCache);
        const out = {};
        for (const d of snap.docs) out[col + '/' + d.id] = d.data();
        parts[col] = out;
        emit();
      }, fail));
    }
    if (onStatus) onStatus('synced');
    return true;
  }

  function disconnect() {
    for (const off of remote.unsubscribe) { try { if (typeof off === 'function') off(); } catch (e) { /* ya cerrada */ } }
    remote.unsubscribe = [];
    remote.db = null;
  }

  /** Base de datos del artefacto de Claude, si la app se abre como artefacto. */
  async function connectClaude(opts) {
    const claude = root.claude;
    if (!claude || typeof claude.use !== 'function') return false;
    let db = null;
    try { db = await claude.use('db'); } catch (e) { db = null; }
    if (!db) return false;
    return connect(db, { ...opts, uploadIfEmpty: true });
  }

  function load() {
    return loadLocal();
  }

  // Datos pequeños de la propia app (última copia, avisos aplazados).
  function getMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; }
  }
  function setMeta(patch) {
    try { localStorage.setItem(META_KEY, JSON.stringify({ ...getMeta(), ...patch })); } catch (e) { /* sin almacenamiento */ }
  }

  /** Pide al navegador que no borre los datos aunque falte espacio o no se use la app. */
  async function persist() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return null;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    const ok = saveLocal(state);
    if (remote.db) saveRemote(state);
    else if (!ok && remote.onError) remote.onError({ code: 'local' });
  }

  /** Guarda una copia de los datos de este móvil antes de sustituirlos. */
  function backupLocal(tag) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}-${tag}`, raw);
    } catch (e) { /* sin almacenamiento */ }
  }

  function isRemote() {
    return !!remote.db;
  }

  root.Store = {
    load, save, defaults, migrate: upgrade, connect, connectClaude, disconnect, isRemote, backupLocal,
    toDocs, fromDocs, stable, getMeta, setMeta, persist, DATA_VERSION
  };
})(typeof self !== 'undefined' ? self : this);

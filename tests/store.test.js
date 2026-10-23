const test = require('node:test');
const assert = require('node:assert');

const mem = {};
global.self = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
global.Logic = require('../js/logic.js');
require('../js/store.js');
const Store = global.Store;

function sample() {
  const s = Store.defaults();
  s.weeks['2026-10-05'] = {
    slots: { '0|Comida': { name: 'Lentejas', ingredients: [{ name: 'Lentejas', qty: '400 g', supermarket: 'Lidl', have: false }] } }
  };
  s.list = {
    extras: [
      { id: 'a1', name: 'Papel de cocina', qty: '', supermarket: 'Mercadona', from: null },
      { id: 'a2', name: 'Carne para barbacoa', qty: '1 kg', supermarket: '', from: '2026-11-01' }
    ],
    checked: { 'Lidl::lenteja': true, 'Sin asignar::pan de molde': true }
  };
  s.recipes.push({ id: 'r1', name: 'Lentejas', ingredients: [], notes: '' });
  return s;
}

test('toDocs separa comidas, lista y tachados en documentos propios', () => {
  const docs = Store.toDocs(sample());
  const paths = Object.keys(docs).sort();
  assert.deepStrictEqual(paths.filter((p) => !p.startsWith('checks/')), ['extras/a1', 'extras/a2', 'meta/settings', 'recipes/r1', 'weeks/2026-10-05']);
  assert.strictEqual(paths.filter((p) => p.startsWith('checks/')).length, 2);
  // Ids válidos para Firebase y para la base de datos del artefacto.
  for (const p of paths) assert.match(p, /^[a-z]+\/[A-Za-z0-9_.~:@+-]+$/, p);
  assert.deepStrictEqual(Object.keys(docs['weeks/2026-10-05']), ['slots']);
  assert.strictEqual(docs['extras/a2'].from, '2026-11-01');
});

test('fromDocs reconstruye el mismo estado', () => {
  const s = sample();
  const back = Store.fromDocs(JSON.parse(JSON.stringify(Store.toDocs(s))));
  assert.deepStrictEqual(back.weeks, s.weeks);
  assert.deepStrictEqual(back.list, s.list);
  assert.deepStrictEqual(back.recipes, s.recipes);
  assert.deepStrictEqual(back.settings, s.settings);
});

test('fromDocs pasa la lista por semanas (formato antiguo) a la lista general', () => {
  const now = Logic.weekStart(new Date());
  const old = '2020-01-06';
  const back = Store.fromDocs({
    [`weeks/${now}`]: { slots: {}, extras: [{ id: 'x', name: 'Café' }], checked: { 'Lidl::cafe': true } },
    [`weeks/${old}`]: { slots: {}, extras: [], checked: { 'Lidl::sal': true } },
    'extras/y': { week: now, name: 'Leche', qty: '', supermarket: 'Lidl' },
    'checks/abc': { week: old, item: 'Lidl::viejo' },
    'checks/def': { week: now, item: 'Lidl::leche' }
  });
  assert.deepStrictEqual(back.list.extras.map((e) => e.name).sort(), ['Café', 'Leche']);
  assert.deepStrictEqual(Object.keys(back.list.checked).sort(), ['Lidl::cafe', 'Lidl::leche']);
  assert.ok(!('extras' in back.weeks[now]));
});

test('los datos locales de la versión 1 se convierten y se guarda copia', () => {
  const now = Logic.weekStart(new Date());
  mem['planificador-comidas-v1'] = JSON.stringify({ version: 1, weeks: { [now]: { slots: {}, extras: [{ id: 'e', name: 'Pan' }], checked: { 'x::pan': true } } } });
  const st = Store.load();
  assert.strictEqual(st.version, 2);
  assert.deepStrictEqual(st.list.extras.map((e) => e.name), ['Pan']);
  assert.ok(st.list.checked['x::pan']);
  assert.ok(mem['planificador-comidas-v1-antes-de-v2']);
  delete mem['planificador-comidas-v1'];
});

test('dos móviles tachando a la vez no se pisan', async () => {
  const server = {};
  const listeners = [];
  const snap = (p) => ({ id: p.split('/').pop(), exists: p in server, data: () => JSON.parse(JSON.stringify(server[p])), metadata: { fromCache: false } });
  const notify = () => listeners.forEach((f) => f());
  const db = {
    doc: (p) => ({
      set: async (d) => { server[p] = JSON.parse(JSON.stringify(d)); notify(); },
      delete: async () => { delete server[p]; notify(); },
      onSnapshot: (n) => { const f = () => n(snap(p)); listeners.push(f); f(); return () => {}; }
    }),
    collection: (c) => ({
      onSnapshot: (n) => {
        const f = () => n({ docs: Object.keys(server).filter((k) => k.startsWith(c + '/')).map(snap), metadata: { fromCache: false } });
        listeners.push(f); f(); return () => {};
      }
    })
  };
  const a = sample();
  Store.connect(db, { onRemote: () => {}, initial: a });
  await new Promise((r) => setTimeout(r, 10));
  a.list.checked['Mercadona::papel de cocina'] = true;
  Store.save(a);
  await new Promise((r) => setTimeout(r, 10));
  // Cada tachado es un documento: el de A no toca los demás.
  const checks = Object.keys(server).filter((p) => p.startsWith('checks/')).map((p) => server[p].item).sort();
  assert.deepStrictEqual(checks, ['Lidl::lenteja', 'Mercadona::papel de cocina', 'Sin asignar::pan de molde']);
  Store.disconnect();
});

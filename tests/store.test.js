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
    slots: { '0|Comida': { name: 'Lentejas', ingredients: [{ name: 'Lentejas', qty: '400 g', supermarket: 'Lidl', have: false }] } },
    extras: [{ id: 'a1', name: 'Papel de cocina', qty: '', supermarket: 'Mercadona' }],
    checked: { 'Lidl::lenteja': true, 'Sin asignar::pan de molde': true }
  };
  s.recipes.push({ id: 'r1', name: 'Lentejas', ingredients: [], notes: '' });
  return s;
}

test('toDocs separa comidas, lista y tachados en documentos propios', () => {
  const docs = Store.toDocs(sample(), '2026-10-07');
  const paths = Object.keys(docs).sort();
  assert.deepStrictEqual(paths.filter((p) => !p.startsWith('checks/')), ['extras/a1', 'meta/settings', 'recipes/r1', 'weeks/2026-10-05']);
  assert.strictEqual(paths.filter((p) => p.startsWith('checks/2026-10-05~')).length, 2);
  // Ids válidos para Firebase y para la base de datos del artefacto.
  for (const p of paths) assert.match(p, /^[a-z]+\/[A-Za-z0-9_.~:@+-]+$/, p);
  assert.deepStrictEqual(Object.keys(docs['weeks/2026-10-05']), ['slots']);
});

test('fromDocs reconstruye el mismo estado', () => {
  const s = sample();
  const back = Store.fromDocs(JSON.parse(JSON.stringify(Store.toDocs(s, '2026-10-07'))));
  assert.deepStrictEqual(back.weeks, s.weeks);
  assert.deepStrictEqual(back.recipes, s.recipes);
  assert.deepStrictEqual(back.settings, s.settings);
});

test('fromDocs entiende el formato antiguo (lista dentro de la semana)', () => {
  const back = Store.fromDocs({ 'weeks/2026-10-05': { slots: {}, extras: [{ id: 'x', name: 'Café' }], checked: { 'Lidl::cafe': true } } });
  assert.strictEqual(back.weeks['2026-10-05'].extras[0].name, 'Café');
  assert.ok(back.weeks['2026-10-05'].checked['Lidl::cafe']);
});

test('la lista de semanas antiguas no se sube', () => {
  const s = sample();
  s.weeks['2026-01-05'] = { slots: { '0|Cena': { name: 'Sopa', ingredients: [] } }, extras: [{ id: 'old', name: 'Sal' }], checked: { a: true } };
  const docs = Store.toDocs(s, '2026-10-07');
  assert.ok(docs['weeks/2026-01-05'], 'las comidas antiguas se guardan (historial)');
  assert.ok(!docs['extras/old']);
  assert.ok(!Object.keys(docs).some((p) => p.startsWith('checks/2026-01-05')));
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
  // Móvil A crea el espacio; móvil B tacha otro artículo partiendo de un estado sin el tachado de A.
  const a = sample();
  Store.connect(db, { onRemote: () => {}, initial: a });
  await new Promise((r) => setTimeout(r, 10));
  const b = Store.fromDocs(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(server)))));
  a.weeks['2026-10-05'].checked['Mercadona::papel de cocina'] = true;
  Store.save(a);
  await new Promise((r) => setTimeout(r, 10));
  // B escribe su propio tachado: solo cambia su documento, no borra el de A.
  b.weeks['2026-10-05'].checked['Lidl::lenteja'] = false;
  const docsB = Store.toDocs(b);
  const checks = Object.keys(server).filter((p) => p.startsWith('checks/'));
  assert.strictEqual(checks.length, 3);
  assert.ok(!Object.keys(docsB).some((p) => p.startsWith('checks/') && server[p] && server[p].item === 'Mercadona::papel de cocina'));
  Store.disconnect();
});

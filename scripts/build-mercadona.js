/*
 * Genera js/mercadona-data.js a partir de docs/supermercados/mercadona-ambientes.json:
 * los 26 ambientes con sus subcategorías y los nombres de los productos ya
 * normalizados (para adivinar en qué ambiente va cada ingrediente).
 *
 *   node scripts/build-mercadona.js
 */
const fs = require('fs');
const path = require('path');
const Logic = require('../js/logic.js');

const root = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'docs/supermercados/mercadona-ambientes.json'), 'utf8'));

const ambientes = src.ambientes.map((a) => ({
  id: a.id,
  name: a.ambiente,
  section: a.seccion_oficial,
  color: a.color,
  cons: a.conservacion,
  subs: a.subcategorias.map((s) => ({ id: s.id, name: s.nombre, cons: s.conservacion }))
}));

// ---- Ajustes de sentido común sobre la clasificación online ----
// La tienda online agrupa por tipo de producto; en la tienda física algunas
// cosas están en otro sitio. Estos cambios ordenan los ambientes como se
// recorre la tienda (ver docs/supermercados/mercadona.md, "Ajustes en la app").
const MOVE = {
  47: 17, // Carne congelada -> Congelados
  34: 17 // Pescado congelado -> Congelados
};
const NEW_AMBIENTES = [
  // Sección "Listo para Comer" + platos preparados refrigerados.
  { id: 100, name: 'Comidas preparadas', section: 'Listo para Comer', color: null, cons: 'refrigerado', subs: [897, 140, 142] }
];
const RENAME = { 16: 'Pizzas' }; // se queda solo con las pizzas

const allSubs = new Map();
for (const a of ambientes) for (const s of a.subs) allSubs.set(s.id, s);
const taken = new Set([...Object.keys(MOVE).map(Number), ...NEW_AMBIENTES.flatMap((a) => a.subs)]);
for (const a of ambientes) {
  a.subs = a.subs.filter((s) => !taken.has(s.id));
  if (RENAME[a.id]) a.name = RENAME[a.id];
}
for (const [sub, amb] of Object.entries(MOVE)) ambientes.find((a) => a.id === amb).subs.push(allSubs.get(Number(sub)));
for (const na of NEW_AMBIENTES) ambientes.push({ ...na, subs: na.subs.map((id) => allSubs.get(id)) });
for (const a of ambientes) if (!a.subs.length) throw new Error('Ambiente vacío: ' + a.name);

const products = {};
for (const a of src.ambientes) {
  for (const s of a.subcategorias) {
    const names = new Set();
    for (const g of s.grupos) for (const p of g.productos) names.add(Logic.normalize(p));
    products[s.id] = [...names].sort().join('|');
  }
}

const out = `/* Generado por scripts/build-mercadona.js (${src.fecha}, ${src.fuente}). No editar a mano. */
(function (root) {
  'use strict';
  const DATA = ${JSON.stringify({ fecha: src.fecha, ambientes, products })};
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.MERCADONA = DATA;
})(typeof self !== 'undefined' ? self : this);
`;
fs.writeFileSync(path.join(root, 'js/mercadona-data.js'), out);
console.log(`js/mercadona-data.js (${(out.length / 1024).toFixed(1)} KB)`);

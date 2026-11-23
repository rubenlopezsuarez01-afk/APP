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

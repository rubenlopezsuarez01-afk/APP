/*
 * Ambientes del supermercado (de momento, Mercadona): adivina en qué ambiente
 * y subcategoría va cada ingrediente y ordena la lista según el recorrido que
 * elija el usuario. Sin DOM: funciona en el navegador (window.Aisles) y en Node.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Logic = isNode ? require('./logic.js') : root.Logic;
  const DATA = isNode ? require('./mercadona-data.js') : root.MERCADONA;
  const { normalize } = Logic;

  const STORE = 'Mercadona';
  const NONE = 0; // id del grupo "Sin ambiente"

  const ambientes = DATA.ambientes;
  const ambById = new Map(ambientes.map((a) => [a.id, a]));
  const subById = new Map();
  for (const a of ambientes) for (const s of a.subs) subById.set(s.id, { ...s, amb: a.id });

  const products = [];
  for (const [id, names] of Object.entries(DATA.products)) {
    products.push({ sub: Number(id), amb: subById.get(Number(id)).amb, names: names ? names.split('|').map((n) => ' ' + n + ' ') : [] });
  }

  // Recorrido por defecto: frescos primero, lo seco en medio y el frío al final.
  // El usuario lo cambia en Ajustes según su tienda.
  // "Comidas preparadas" (Listo para Comer) suele estar junto a la entrada.
  const DEFAULT_ROUTE = [1, 100, 5, 3, 2, 4, 12, 13, 14, 15, 9, 7, 8, 18, 10, 19, 26, 20, 21, 22, 23, 24, 25, 6, 11, 16, 17];

  const FRESH = new Set([1, 2, 3, 4, 5, 6]);
  const FROZEN = 17;
  const CANNED = 14;
  const READY = new Set([16, 100]); // pizzas y comidas preparadas: solo si no hay nada mejor
  // Solo cuentan si el ingrediente lo dice (si no, "ternera" acabaría en comida de perro).
  const ONLY_IF = { 25: /\b(perro|gato|mascota|pienso|arena)\b/, 24: /\b(bebe|infantil|papilla|panal|biberon|chupete|toallita)\b/ };
  const SUB_IF = { 221: /\b(perro|pienso)\b/, 222: /\b(gato|arena)\b/ }; // perro o gato, según lo que diga

  // Dónde lo buscaría cualquiera en la tienda cuando los nombres de la web
  // despistan (p. ej. el salmón fresco no se vende online y caería en ahumados).
  const FIXED_RAW = {
    // pescadería
    'salmon': 31, 'salmon fresco': 31, 'lomo de salmon': 31, 'atun fresco': 31, 'boqueron': 31, 'rape': 31,
    'pescadilla': 31, 'tinta de calamar': 31, 'almeja': 32, 'pulpo': 32, 'sepia': 31, 'calamar': 31,
    // fruta y verdura
    'fresa': 27, 'fresón': 27, 'sandia': 27, 'judia verde': 29, 'judias verdes': 29, 'maiz': 127, 'maiz dulce': 127,
    // panadería
    'pan': 59, 'pan de pueblo': 59,
    // carne y charcutería
    'alita de pollo': 38, 'secreto iberico': 37, 'presa iberica': 37, 'jamon iberico': 50, 'queso de cabra': 53,
    // despensa
    'nuez': 133, 'nueces': 133, 'almendra': 133, 'avellana': 133, 'cacahuete': 133, 'lasaña': 120, 'placa de lasaña': 120,
    'cuscus': 120, 'refresco de cola': 158, 'cola': 158,
    // comidas preparadas
    'pollo asado': 897, 'croqueta': 142, 'tortilla de patata': 142,
    // congelados
    'varita de merluza': 884, 'palito de merluza': 884,
    // perfumería y parafarmacia
    'tirita': 214, 'cuchilla de afeitar': 192, 'maquinilla de afeitar': 192, 'comida de gato': 222, 'comida para gato': 222
  };
  const FIXED = new Map(Object.entries(FIXED_RAW).map(([k, v]) => [normalize(k), v]));

  // Cómo se llama en la tienda lo que se suele escribir de otra forma.
  const SYNONYMS = [
    ['jamon york', 'jamon cocido'], ['espagueti', 'spaghetti'], ['fabe', 'alubia'], ['judion', 'alubia'],
    ['quesito', 'queso en porcion'], ['pasta de diente', 'dentifrico'], ['ternera', 'vacuno'],
    ['tinta de calamar', 'calamar en tinta'], ['queso en loncha', 'queso loncha'], ['salmon fresco', 'salmon'],
    ['merluza fresca', 'merluza'], ['papel de cocina', 'papel cocina']
  ];
  const STOP = new Set(['de', 'del', 'con', 'en', 'para', 'la', 'el', 'los', 'las', 'y', 'a', 'al']);

  function weight(p, name, wantsFrozen) {
    const only = ONLY_IF[p.amb];
    if (only && !only.test(name)) return 0;
    if (SUB_IF[p.sub] && !SUB_IF[p.sub].test(name)) return 0.1;
    const fresh = /\bfresc[oa]\b/.test(name);
    // "en lata", "bote", "conserva": conservas; "fresco": nunca conservas ni congelados.
    if (p.amb === CANNED && /\b(lata|bote|conserva)\b/.test(name)) return 5;
    if (fresh && (p.amb === CANNED || p.amb === FROZEN)) return 0.1;
    if (p.amb === FROZEN) return wantsFrozen ? 3 : 0.5;
    if (wantsFrozen) return 0.5;
    if (READY.has(p.amb)) return 0.5;
    return FRESH.has(p.amb) ? 3 : 1;
  }

  // Formatos que, si el ingrediente no los menciona, hacen que un producto cuente poco:
  // "pechuga de pollo" es de carnicería aunque haya mucha pechuga en lonchas.
  const FORMATS = ['congelad', 'ultracongelad', 'loncha'];

  /**
   * Subcategoría que mejor encaja con `q`: la que tiene más productos que
   * empiezan por esas palabras; si ninguno empieza así, los que las contienen.
   */
  function bestFor(q, name) {
    const wb = ' ' + q + ' ';
    const wantsFrozen = /congelad/.test(name);
    const skip = FORMATS.filter((f) => !name.includes(f)).map((f) => ' ' + f);
    for (const pass of ['start', 'any']) {
      let best = null;
      let bestScore = 0;
      for (const p of products) {
        const w = weight(p, name, wantsFrozen);
        if (!w) continue;
        let c = 0;
        for (const n of p.names) {
          if (pass === 'start' ? n.startsWith(wb) : n.includes(wb)) c += skip.some((f) => n.includes(f)) ? 0.3 : 1;
        }
        if (c * w > bestScore) { bestScore = c * w; best = p.sub; }
      }
      if (best) return best;
    }
    return null;
  }

  const cache = new Map();

  /** Id de la subcategoría donde se suele encontrar el ingrediente, o null. */
  function guess(rawName) {
    let n = normalize(rawName);
    if (!n) return null;
    if (cache.has(n)) return cache.get(n);
    const key = n;
    if (FIXED.has(n)) { cache.set(key, FIXED.get(n)); return FIXED.get(n); }
    for (const [from, to] of SYNONYMS) n = (' ' + n + ' ').replace(' ' + from + ' ', ' ' + to + ' ').trim();
    const words = n.split(' ');
    let found = null;
    // La frase entera y después cada vez más corta: "carne picada de ternera" -> "carne picada".
    for (let k = words.length; k >= 1 && !found; k--) {
      if (STOP.has(words[k - 1])) continue;
      found = bestFor(words.slice(0, k).join(' '), n);
    }
    // Si no, cualquier otra palabra: "tiras de ternera" -> "ternera".
    for (const w of words.slice(1)) {
      if (found) break;
      if (STOP.has(w) || w.length < 3) continue;
      found = bestFor(w, n);
    }
    cache.set(key, found);
    return found;
  }

  function isAisleStore(supermarket) {
    return normalize(supermarket) === normalize(STORE);
  }

  /** Recorrido guardado completado con los ambientes que falten (por si se añaden nuevos). */
  function routeOf(saved) {
    const ids = (Array.isArray(saved) ? saved : []).filter((id) => ambById.has(id));
    for (const id of DEFAULT_ROUTE) if (!ids.includes(id)) ids.push(id);
    return ids;
  }

  /** Subcategoría de un ingrediente: la elegida por el usuario o la adivinada. */
  function subFor(name, overrides) {
    const o = overrides && overrides[normalize(name)];
    if (o !== undefined && o !== null) return o === NONE ? null : (subById.has(o) ? o : guess(name));
    return guess(name);
  }

  /**
   * Agrupa los artículos de una tienda por ambiente, en el orden del recorrido.
   * Dentro de cada ambiente: subcategoría (orden de Mercadona), pendientes antes
   * que tachados y después por nombre. Lo que no se sabe dónde va, al final.
   */
  function groupByRoute(items, route, overrides) {
    const order = routeOf(route);
    const groups = new Map();
    for (const it of items) {
      const sub = subFor(it.name, overrides);
      const amb = sub ? subById.get(sub).amb : NONE;
      if (!groups.has(amb)) groups.set(amb, []);
      groups.get(amb).push({ item: it, sub });
    }
    const subIndex = (sub) => {
      if (!sub) return 0;
      return ambById.get(subById.get(sub).amb).subs.findIndex((s) => s.id === sub);
    };
    const pos = (amb) => (amb === NONE ? Infinity : order.indexOf(amb));
    return [...groups.entries()]
      .sort((a, b) => pos(a[0]) - pos(b[0]))
      .map(([amb, list]) => ({
        ambiente: amb === NONE ? null : ambById.get(amb),
        items: list
          .sort((a, b) => subIndex(a.sub) - subIndex(b.sub) || Number(a.item.checked) - Number(b.item.checked) || a.item.name.localeCompare(b.item.name, 'es'))
          .map((x) => ({ ...x.item, sub: x.sub }))
      }));
  }

  const api = { STORE, NONE, DEFAULT_ROUTE, ambientes, ambById, subById, guess, isAisleStore, routeOf, subFor, groupByRoute, fecha: DATA.fecha };
  if (isNode) module.exports = api;
  else root.Aisles = api;
})(typeof self !== 'undefined' ? self : this);

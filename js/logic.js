/*
 * Lógica pura del planificador (sin DOM). Funciona en el navegador
 * (window.Logic) y en Node (module.exports) para poder testearla.
 */
(function (root) {
  'use strict';

  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const NO_SUPERMARKET = 'Sin asignar';

  // Ingredientes básicos que no cuentan para decir "ya he comido esto esta semana".
  const STAPLES = [
    'sal', 'aceite', 'aceite de oliva', 'aceite de girasol', 'pimienta', 'agua', 'ajo',
    'cebolla', 'vinagre', 'azucar', 'harina', 'perejil', 'oregano', 'pimenton', 'comino',
    'laurel', 'especias', 'caldo', 'mantequilla', 'leche', 'limon', 'tomate frito',
    'nata', 'mayonesa', 'mostaza', 'salsa de soja', 'curry', 'canela', 'levadura', 'romero',
    'azafran', 'vino blanco', 'pan rallado', 'tomate triturado', 'caldo de pollo', 'caldo de verduras'
  ];

  function normalize(name) {
    let s = String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Plural sencillo palabra a palabra: "tomates" -> "tomate", "limones" -> "limon"
    s = s
      .split(' ')
      .map((w) => {
        if (w.length > 4 && /[lnrd]es$/.test(w)) return w.slice(0, -2);
        if (w.length > 3 && /[aeiou]s$/.test(w)) return w.slice(0, -1);
        return w;
      })
      .join(' ');
    return s;
  }

  const STAPLE_SET = new Set(STAPLES.map(normalize));

  function isStaple(name) {
    return STAPLE_SET.has(normalize(name));
  }

  // ---- Fechas (ISO yyyy-mm-dd, siempre en hora local) ----
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function weekStart(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - dow);
    return toISO(d);
  }

  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function daysBetween(isoA, isoB) {
    return Math.round((fromISO(isoB) - fromISO(isoA)) / 86400000);
  }

  // ---- Comidas y lista de la compra ----
  function slotKey(dayIndex, meal) {
    return `${dayIndex}|${meal}`;
  }

  function parseSlotKey(key) {
    const i = key.indexOf('|');
    return { dayIndex: Number(key.slice(0, i)), meal: key.slice(i + 1) };
  }

  /** Ingredientes que faltan para una comida (los no marcados como "lo tengo"). */
  function missingForMeal(meal) {
    if (!meal || !Array.isArray(meal.ingredients)) return [];
    return meal.ingredients.filter((ing) => ing.name && ing.name.trim() && !ing.have);
  }

  function mergeQty(a, b) {
    if (!a) return b || '';
    if (!b) return a;
    const na = parseQty(a);
    const nb = parseQty(b);
    if (na && nb && na.unit === nb.unit) {
      const total = Math.round((na.value + nb.value) * 100) / 100;
      return `${String(total).replace('.', ',')}${na.unit ? ' ' + na.unit : ''}`;
    }
    return `${a} + ${b}`;
  }

  function parseQty(q) {
    const m = String(q).trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Záéíóúñ.]*)$/);
    if (!m) return null;
    return { value: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase() };
  }

  /**
   * Une los ingredientes que faltan de todas las comidas de la semana con los
   * artículos añadidos a mano. Devuelve los artículos agrupados por supermercado.
   */
  function buildShoppingList(week, extras, checked, mealsOrder) {
    const items = new Map();
    const slots = (week && week.slots) || {};
    const keys = Object.keys(slots).sort((a, b) => {
      const pa = parseSlotKey(a);
      const pb = parseSlotKey(b);
      if (pa.dayIndex !== pb.dayIndex) return pa.dayIndex - pb.dayIndex;
      const order = mealsOrder || [];
      return order.indexOf(pa.meal) - order.indexOf(pb.meal);
    });

    for (const key of keys) {
      const meal = slots[key];
      const { dayIndex, meal: mealName } = parseSlotKey(key);
      for (const ing of missingForMeal(meal)) {
        const supermarket = ing.supermarket || NO_SUPERMARKET;
        const id = `${supermarket}::${normalize(ing.name)}`;
        const label = `${DAYS[dayIndex]} ${mealName.toLowerCase()}`;
        if (!items.has(id)) {
          items.set(id, {
            id, name: ing.name.trim(), qty: ing.qty || '', supermarket,
            sources: [{ label, meal: meal.name }], manual: false
          });
        } else {
          const it = items.get(id);
          it.qty = mergeQty(it.qty, ing.qty);
          it.sources.push({ label, meal: meal.name });
        }
      }
    }

    for (const ex of extras || []) {
      const supermarket = ex.supermarket || NO_SUPERMARKET;
      const id = `${supermarket}::${normalize(ex.name)}`;
      if (items.has(id)) {
        const it = items.get(id);
        it.qty = mergeQty(it.qty, ex.qty);
        it.extraIds = (it.extraIds || []).concat(ex.id);
        it.sources.push({ label: 'Añadido a mano' });
      } else {
        items.set(id, {
          id, name: ex.name.trim(), qty: ex.qty || '', supermarket,
          sources: [{ label: 'Añadido a mano' }], manual: true, extraIds: [ex.id]
        });
      }
    }

    const groups = new Map();
    for (const it of items.values()) {
      it.checked = !!(checked && checked[it.id]);
      if (!groups.has(it.supermarket)) groups.set(it.supermarket, []);
      groups.get(it.supermarket).push(it);
    }
    const result = [];
    for (const [supermarket, list] of groups) {
      list.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'es'));
      result.push({ supermarket, items: list });
    }
    result.sort((a, b) => {
      if (a.supermarket === NO_SUPERMARKET) return 1;
      if (b.supermarket === NO_SUPERMARKET) return -1;
      return a.supermarket.localeCompare(b.supermarket, 'es');
    });
    return result;
  }

  /**
   * Lista de la compra general: lo que falta de las comidas de hoy en adelante
   * más lo añadido a mano. Lo añadido "para más adelante" (from > hoy) no sale
   * en la lista hasta esa fecha; se devuelve aparte en `upcoming`.
   */
  function buildGeneralList(weeks, list, todayISO, mealsOrder) {
    const items = new Map();
    const order = mealsOrder || [];
    const entries = [];
    for (const [wk, week] of Object.entries(weeks || {})) {
      for (const [key, meal] of Object.entries((week && week.slots) || {})) {
        const { dayIndex, meal: mealName } = parseSlotKey(key);
        const date = addDays(wk, dayIndex);
        if (date < todayISO) continue;
        entries.push({ wk, key, meal, date, mealName, dayIndex });
      }
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || order.indexOf(a.mealName) - order.indexOf(b.mealName));

    for (const { wk, key, meal, date, mealName, dayIndex } of entries) {
      for (const ing of missingForMeal(meal)) {
        const supermarket = ing.supermarket || NO_SUPERMARKET;
        const id = `${supermarket}::${normalize(ing.name)}`;
        const label = `${DAYS[dayIndex].slice(0, 3)} ${Number(date.slice(8))} · ${mealName.toLowerCase()}`;
        const ref = { week: wk, key, name: normalize(ing.name) };
        if (!items.has(id)) {
          items.set(id, { id, name: ing.name.trim(), qty: ing.qty || '', supermarket, sources: [{ label, meal: meal.name }], refs: [ref], manual: false });
        } else {
          const it = items.get(id);
          it.qty = mergeQty(it.qty, ing.qty);
          it.sources.push({ label, meal: meal.name });
          it.refs.push(ref);
        }
      }
    }

    const upcoming = [];
    for (const ex of (list && list.extras) || []) {
      if (ex.from && ex.from > todayISO) { upcoming.push(ex); continue; }
      const supermarket = ex.supermarket || NO_SUPERMARKET;
      const id = `${supermarket}::${normalize(ex.name)}`;
      const it = items.get(id);
      if (it) {
        it.qty = mergeQty(it.qty, ex.qty);
        it.extraIds = (it.extraIds || []).concat(ex.id);
        it.sources.push({ label: 'Añadido a mano' });
      } else {
        items.set(id, { id, name: ex.name.trim(), qty: ex.qty || '', supermarket, sources: [{ label: 'Añadido a mano' }], refs: [], manual: true, extraIds: [ex.id] });
      }
    }
    upcoming.sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name, 'es'));

    const checked = (list && list.checked) || {};
    const groups = new Map();
    for (const it of items.values()) {
      it.checked = !!checked[it.id];
      if (!groups.has(it.supermarket)) groups.set(it.supermarket, []);
      groups.get(it.supermarket).push(it);
    }
    const result = [];
    for (const [supermarket, list2] of groups) {
      list2.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'es'));
      result.push({ supermarket, items: list2 });
    }
    result.sort((a, b) => {
      if (a.supermarket === NO_SUPERMARKET) return 1;
      if (b.supermarket === NO_SUPERMARKET) return -1;
      return a.supermarket.localeCompare(b.supermarket, 'es');
    });
    return { groups: result, upcoming };
  }

  /**
   * Al quitar lo comprado: los ingredientes de comidas pasan a "lo tengo" y lo
   * añadido a mano se borra. Modifica `weeks` y `list`; devuelve cuántos quitó.
   */
  function clearBought(weeks, list, groups) {
    let n = 0;
    for (const g of groups) {
      for (const it of g.items) {
        if (!it.checked) continue;
        n++;
        for (const ref of it.refs || []) {
          const meal = weeks[ref.week] && weeks[ref.week].slots[ref.key];
          if (!meal) continue;
          for (const ing of meal.ingredients) if (normalize(ing.name) === ref.name) ing.have = true;
        }
        if (it.extraIds) list.extras = list.extras.filter((x) => !it.extraIds.includes(x.id));
      }
    }
    list.checked = {};
    return n;
  }

  // ---- Sugerencias ----
  // Palabras que indican una pieza o envase: "Pechuga de pollo" -> pollo.
  const CUTS = new Set(['pechuga', 'muslo', 'contramuslo', 'filete', 'lomo', 'solomillo', 'carne picada',
    'carne', 'lata', 'bote', 'rodaja', 'tira', 'tinta', 'trozo', 'dado', 'loncha', 'medallon']);

  /** Alimento base de un ingrediente: "Pimientos rojos" -> "pimiento", "Lomo de cerdo" -> "cerdo". */
  function foodKey(name) {
    const n = normalize(name);
    const i = n.indexOf(' de ');
    if (i > 0 && CUTS.has(n.slice(0, i))) return n.slice(i + 4).split(' ')[0];
    return n.split(' ')[0];
  }

  function stapleSet(staples) {
    return staples ? new Set(staples.map(normalize)) : STAPLE_SET;
  }

  function mainIngredients(ingredients, staples) {
    const ignore = staples instanceof Set ? staples : stapleSet(staples);
    const set = new Set();
    for (const ing of ingredients || []) {
      const n = normalize(typeof ing === 'string' ? ing : ing.name);
      if (!n || ignore.has(n)) continue;
      const key = foodKey(n);
      if (key && !ignore.has(key)) set.add(key);
    }
    return set;
  }

  /** Ingredientes principales ya planificados esta semana (sin contar el hueco actual). */
  function weekMainIngredients(week, excludeKey, staples) {
    const ignore = stapleSet(staples);
    const set = new Set();
    const names = new Set();
    for (const [key, meal] of Object.entries((week && week.slots) || {})) {
      if (key === excludeKey) continue;
      names.add(normalize(meal.name));
      for (const n of mainIngredients(meal.ingredients, ignore)) set.add(n);
    }
    return { ingredients: set, mealNames: names };
  }

  /** Historial de comidas a partir de todas las semanas guardadas, agrupado por plato. */
  function buildHistory(weeks, beforeISO) {
    const map = new Map();
    for (const [wk, week] of Object.entries(weeks || {})) {
      for (const [key, meal] of Object.entries(week.slots || {})) {
        if (!meal || !meal.name) continue;
        const date = addDays(wk, parseSlotKey(key).dayIndex);
        if (beforeISO && date >= beforeISO) continue;
        const id = normalize(meal.name);
        const prev = map.get(id);
        if (!prev) {
          map.set(id, {
            name: meal.name, ingredients: meal.ingredients || [], recipeId: meal.recipeId || null,
            count: 1, lastDate: date
          });
        } else {
          prev.count += 1;
          if (date > prev.lastDate) {
            prev.lastDate = date;
            prev.name = meal.name;
            prev.ingredients = meal.ingredients || prev.ingredients;
          }
        }
      }
    }
    return [...map.values()];
  }

  function conflicts(ingredients, weekSet, ignore) {
    const out = [];
    for (const n of mainIngredients(ingredients, ignore)) if (weekSet.has(n)) out.push(n);
    return out;
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Propone comidas para un hueco:
   *  - fromHistory: platos ya comidos antes que no repiten ningún ingrediente
   *    principal de lo que ya hay planificado esta semana.
   *  - newRecipes: recetas (catálogo + mis recetas) que nunca he comido, con el mismo filtro.
   */
  function suggest(opts) {
    const {
      weeks, weekKey, key, catalog = [], myRecipes = [], todayISO,
      limit = 6, rand = Math.random, staples
    } = opts;
    const ignore = stapleSet(staples);
    const week = (weeks && weeks[weekKey]) || { slots: {} };
    const { ingredients: weekSet, mealNames } = weekMainIngredients(week, key, staples);
    const history = buildHistory(weeks, weekKey);
    const today = todayISO || weekKey;

    const historyNames = new Set(history.map((h) => normalize(h.name)));
    const excluded = [];

    const fromHistory = [];
    for (const h of history) {
      const id = normalize(h.name);
      const c = conflicts(h.ingredients, weekSet, ignore);
      if (mealNames.has(id)) continue;
      if (c.length) { excluded.push({ name: h.name, conflicts: c }); continue; }
      const daysAgo = daysBetween(h.lastDate, today);
      fromHistory.push({ ...h, daysAgo, source: 'history' });
    }
    // Primero lo que hace más tiempo que no como; a igualdad, lo que más me gusta (más veces).
    fromHistory.sort((a, b) => b.daysAgo - a.daysAgo || b.count - a.count);

    const seen = new Set();
    const pool = [];
    for (const r of [...myRecipes, ...catalog]) {
      const id = normalize(r.name);
      if (seen.has(id) || historyNames.has(id) || mealNames.has(id)) continue;
      seen.add(id);
      const c = conflicts(r.ingredients, weekSet, ignore);
      if (c.length) { excluded.push({ name: r.name, conflicts: c }); continue; }
      pool.push({ ...r, source: r.builtin ? 'catalog' : 'mine' });
    }

    return {
      weekIngredients: [...weekSet].sort(),
      historyCount: history.length,
      fromHistory: fromHistory.slice(0, limit),
      newRecipes: shuffle(pool, rand).slice(0, limit),
      excluded
    };
  }

  function shoppingListText(groups) {
    const lines = [];
    for (const g of groups) {
      const pending = g.items.filter((i) => !i.checked);
      if (!pending.length) continue;
      lines.push(`🛒 ${g.supermarket}`);
      for (const it of pending) lines.push(`- ${it.name}${it.qty ? ' (' + it.qty + ')' : ''}`);
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  const api = {
    DAYS, NO_SUPERMARKET, STAPLES, normalize, isStaple, toISO, fromISO, weekStart, addDays,
    daysBetween, slotKey, parseSlotKey, missingForMeal, mergeQty, buildShoppingList, buildGeneralList, clearBought,
    foodKey, mainIngredients, weekMainIngredients, buildHistory, suggest, shoppingListText
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);

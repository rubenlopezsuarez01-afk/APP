const test = require('node:test');
const assert = require('node:assert');
const L = require('../js/logic.js');
const CATALOG = require('../js/catalog.js');

const ing = (name, extra) => ({ name, qty: '', supermarket: '', have: false, ...extra });

test('normalize quita tildes, mayúsculas y plurales', () => {
  assert.strictEqual(L.normalize('Tomates'), 'tomate');
  assert.strictEqual(L.normalize('Limones'), 'limon');
  assert.strictEqual(L.normalize('  Huevos '), 'huevo');
  assert.strictEqual(L.normalize('Salmón'), 'salmon');
  assert.strictEqual(L.normalize('Pimientos rojos'), 'pimiento rojo');
});

test('weekStart devuelve el lunes', () => {
  assert.strictEqual(L.weekStart(new Date(2026, 9, 5)), '2026-10-05'); // lunes
  assert.strictEqual(L.weekStart(new Date(2026, 9, 11)), '2026-10-05'); // domingo
  assert.strictEqual(L.addDays('2026-10-05', 7), '2026-10-12');
});

test('missingForMeal ignora lo que ya tengo', () => {
  const meal = { name: 'X', ingredients: [ing('Pollo'), ing('Sal', { have: true }), ing('  ')] };
  assert.deepStrictEqual(L.missingForMeal(meal).map((i) => i.name), ['Pollo']);
});

test('buildShoppingList une comidas y extras agrupando por supermercado', () => {
  const week = {
    slots: {
      '0|Comida': { name: 'Pollo al horno', ingredients: [ing('Pollo', { qty: '500 g', supermarket: 'Mercadona' }), ing('Patatas', { supermarket: 'Lidl' })] },
      '1|Cena': { name: 'Pollo plancha', ingredients: [ing('pollo', { qty: '300 g', supermarket: 'Mercadona' }), ing('Sal', { have: true })] }
    }
  };
  const extras = [{ id: 'e1', name: 'Papel de cocina', qty: '', supermarket: 'Mercadona' }, { id: 'e2', name: 'Pan', qty: '' }];
  const groups = L.buildShoppingList(week, extras, { 'Lidl::patata': true }, ['Comida', 'Cena']);

  assert.deepStrictEqual(groups.map((g) => g.supermarket), ['Lidl', 'Mercadona', L.NO_SUPERMARKET]);
  const merc = groups.find((g) => g.supermarket === 'Mercadona').items;
  const pollo = merc.find((i) => L.normalize(i.name) === 'pollo');
  assert.strictEqual(pollo.qty, '800 g');
  assert.strictEqual(pollo.sources.length, 2);
  assert.ok(merc.some((i) => i.name === 'Papel de cocina' && i.manual));
  assert.strictEqual(groups[0].items[0].checked, true);
});

test('mergeQty suma cantidades con la misma unidad', () => {
  assert.strictEqual(L.mergeQty('1,5 kg', '500 kg'), '501,5 kg');
  assert.strictEqual(L.mergeQty('2', '3'), '5');
  assert.strictEqual(L.mergeQty('1 bote', '200 g'), '1 bote + 200 g');
  assert.strictEqual(L.mergeQty('', '2'), '2');
});

test('suggest excluye platos con alimentos ya comidos esta semana', () => {
  const weeks = {
    '2026-09-28': {
      slots: {
        '0|Comida': { name: 'Lentejas', ingredients: [ing('Lentejas'), ing('Chorizo'), ing('Cebolla')] },
        '2|Comida': { name: 'Salmón con verduras', ingredients: [ing('Salmón'), ing('Calabacín')] },
        '4|Cena': { name: 'Tortilla', ingredients: [ing('Huevos'), ing('Patata'), ing('Cebolla')] }
      }
    },
    '2026-10-05': {
      slots: {
        '0|Comida': { name: 'Pollo al curry', ingredients: [ing('Pollo'), ing('Cebolla'), ing('Huevo')] }
      }
    }
  };
  const res = L.suggest({
    weeks, weekKey: '2026-10-05', key: '1|Comida', catalog: CATALOG, todayISO: '2026-10-05', rand: () => 0.5, limit: 100
  });
  const hist = res.fromHistory.map((h) => h.name);
  // La tortilla lleva huevo, que ya se come el lunes -> excluida. La cebolla es básica y no cuenta.
  assert.ok(!hist.includes('Tortilla'));
  assert.ok(hist.includes('Lentejas'));
  assert.ok(hist.includes('Salmón con verduras'));
  assert.ok(res.excluded.some((e) => e.name === 'Tortilla' && e.conflicts.includes('huevo')));
  assert.deepStrictEqual(res.weekIngredients, ['huevo', 'pollo']);

  // Recetas nuevas: ninguna con pollo o huevo, y ninguna que ya esté en el historial.
  for (const r of res.newRecipes) {
    const names = r.ingredients.map((i) => L.normalize(i.name));
    assert.ok(!names.includes('huevo'), r.name);
    assert.ok(!names.includes('pollo'), r.name);
  }
  assert.ok(res.newRecipes.length > 5);
});

test('suggest no cuenta el propio hueco que se está rellenando', () => {
  const weeks = { '2026-10-05': { slots: { '1|Comida': { name: 'Pollo', ingredients: [ing('Pollo')] } } } };
  const res = L.suggest({ weeks, weekKey: '2026-10-05', key: '1|Comida', catalog: [], todayISO: '2026-10-05' });
  assert.deepStrictEqual(res.weekIngredients, []);
});

test('suggest ordena el historial por lo que hace más tiempo que no como', () => {
  const weeks = {
    '2026-08-03': { slots: { '0|Comida': { name: 'Fabada', ingredients: [ing('Fabes')] } } },
    '2026-09-28': { slots: { '0|Comida': { name: 'Paella', ingredients: [ing('Arroz')] } } }
  };
  const res = L.suggest({ weeks, weekKey: '2026-10-05', key: '0|Comida', catalog: [], todayISO: '2026-10-05' });
  assert.deepStrictEqual(res.fromHistory.map((h) => h.name), ['Fabada', 'Paella']);
});

test('staples personalizados', () => {
  const weeks = { '2026-10-05': { slots: { '0|Comida': { name: 'Puré', ingredients: [ing('Patata')] } } } };
  const catalog = [{ name: 'Tortilla', builtin: true, ingredients: [ing('Patata'), ing('Huevo')] }];
  let res = L.suggest({ weeks, weekKey: '2026-10-05', key: '1|Comida', catalog });
  assert.strictEqual(res.newRecipes.length, 0);
  res = L.suggest({ weeks, weekKey: '2026-10-05', key: '1|Comida', catalog, staples: ['patatas'] });
  assert.strictEqual(res.newRecipes.length, 1);
});

test('shoppingListText solo incluye lo pendiente', () => {
  const groups = [{ supermarket: 'Lidl', items: [{ name: 'Leche', qty: '2 l', checked: false }, { name: 'Pan', checked: true }] }];
  assert.strictEqual(L.shoppingListText(groups), '🛒 Lidl\n- Leche (2 l)');
});

test('foodKey agrupa variantes del mismo alimento', () => {
  assert.strictEqual(L.foodKey('Pechuga de pollo'), 'pollo');
  assert.strictEqual(L.foodKey('Muslos de pollo'), 'pollo');
  assert.strictEqual(L.foodKey('Lomos de salmón'), 'salmon');
  assert.strictEqual(L.foodKey('Pimientos rojos'), 'pimiento');
  assert.strictEqual(L.foodKey('Atún en lata'), 'atun');
  assert.strictEqual(L.foodKey('Carne picada de ternera'), 'ternera');
  assert.deepStrictEqual([...L.mainIngredients([{ name: 'Cebolla morada' }, { name: 'Salmón fresco' }])], ['salmon']);
});

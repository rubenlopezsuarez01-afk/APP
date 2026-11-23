const test = require('node:test');
const assert = require('node:assert');
const A = require('../js/aisles.js');

const where = (name) => {
  const sub = A.guess(name);
  return sub ? `${A.ambById.get(A.subById.get(sub).amb).name} / ${A.subById.get(sub).name}` : null;
};

test('hay 26 ambientes y el recorrido por defecto los incluye todos una vez', () => {
  assert.strictEqual(A.ambientes.length, 26);
  assert.deepStrictEqual([...A.DEFAULT_ROUTE].sort((a, b) => a - b), A.ambientes.map((a) => a.id).sort((a, b) => a - b));
});

test('adivina el ambiente de ingredientes habituales', () => {
  assert.strictEqual(where('Tomates'), 'Fruta y verdura / Verdura');
  assert.strictEqual(where('Pechuga de pollo'), 'Carne / Aves y pollo');
  assert.strictEqual(where('Carne picada de ternera'), 'Carne / Hamburguesas y picadas');
  assert.strictEqual(where('Aceite de oliva'), 'Aceite, especias y salsas / Aceite, vinagre y sal');
  assert.strictEqual(where('Tomate frito'), 'Aceite, especias y salsas / Otras salsas');
  assert.strictEqual(where('Lentejas'), 'Arroz, legumbres y pasta / Legumbres');
  assert.strictEqual(where('Jamón york'), 'Charcutería y quesos / Aves y jamón cocido');
  assert.strictEqual(where('Yogur natural'), 'Postres y yogures / Yogures naturales y sabores');
  assert.strictEqual(where('Papel higiénico'), 'Limpieza y hogar / Papel higiénico y celulosa');
});

test('no manda comida a mascotas ni a bebé salvo que se pida', () => {
  assert.strictEqual(where('Ternera'), 'Carne / Vacuno');
  assert.strictEqual(where('Pienso de perro'), 'Mascotas / Perro');
  assert.strictEqual(where('Pañales'), 'Bebé / Toallitas y pañales');
});

test('lo congelado va a congelados solo si se pide', () => {
  assert.strictEqual(where('Guisantes congelados'), 'Congelados / Fruta y verdura');
  assert.notStrictEqual(A.ambById.get(A.subById.get(A.guess('Merluza')).amb).name, 'Congelados');
});

test('routeOf completa un recorrido guardado con los ambientes que falten', () => {
  const r = A.routeOf([17, 1, 999]);
  assert.strictEqual(r[0], 17);
  assert.strictEqual(r[1], 1);
  assert.strictEqual(r.length, 26);
  assert.ok(!r.includes(999));
});

test('groupByRoute ordena por recorrido y respeta lo elegido a mano', () => {
  const items = [
    { name: 'Helado', checked: false },
    { name: 'Tomates', checked: false },
    { name: 'Pechuga de pollo', checked: true },
    { name: 'Cosa rara xyz', checked: false }
  ];
  const groups = A.groupByRoute(items, null, {});
  assert.deepStrictEqual(groups.map((g) => g.ambiente && g.ambiente.name), ['Fruta y verdura', 'Carne', 'Congelados', null]);

  // Recorrido propio: congelados primero.
  const mine = A.groupByRoute(items, [17], {});
  assert.strictEqual(mine[0].ambiente.name, 'Congelados');

  // El usuario dice que el helado no sabe dónde está, y que lo raro va en droguería.
  const lejia = A.guess('Lejía');
  const fixed = A.groupByRoute(items, null, { helado: A.NONE, 'cosa rara xyz': lejia });
  const names = fixed.map((g) => (g.ambiente ? g.ambiente.name : null));
  assert.ok(names.includes('Limpieza y hogar'));
  assert.strictEqual(names[names.length - 1], null);
  assert.strictEqual(fixed[fixed.length - 1].items[0].name, 'Helado');
});

test('isAisleStore reconoce Mercadona aunque cambien mayúsculas o tildes', () => {
  assert.ok(A.isAisleStore('mercadona'));
  assert.ok(A.isAisleStore(' MERCADONA '));
  assert.ok(!A.isAisleStore('Lidl'));
});

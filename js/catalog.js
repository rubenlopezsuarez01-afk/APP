/* Recetario incluido para proponer ideas nuevas. */
(function (root) {
  'use strict';

  const R = (name, ingredients, tags) => ({
    id: 'cat-' + name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'),
    name,
    builtin: true,
    tags: tags || [],
    ingredients: ingredients.map((s) => {
      const [n, qty] = s.split(':');
      return { name: n.trim(), qty: (qty || '').trim() };
    })
  });

  const CATALOG = [
    R('Lentejas estofadas', ['Lentejas:400 g', 'Chorizo:1', 'Zanahoria:2', 'Patata:2', 'Cebolla:1', 'Ajo:2 dientes', 'Pimentón', 'Aceite de oliva'], ['legumbre', 'cuchara']),
    R('Garbanzos con espinacas', ['Garbanzos cocidos:2 botes', 'Espinacas:300 g', 'Ajo:3 dientes', 'Pan:1 rebanada', 'Comino', 'Pimentón', 'Aceite de oliva'], ['legumbre', 'vegetariano']),
    R('Pollo al horno con patatas', ['Muslos de pollo:4', 'Patata:4', 'Cebolla:1', 'Limón:1', 'Ajo:4 dientes', 'Romero', 'Aceite de oliva'], ['carne', 'horno']),
    R('Salmón a la plancha con verduras', ['Salmón:2 lomos', 'Calabacín:1', 'Pimiento rojo:1', 'Espárragos verdes:1 manojo', 'Limón:1', 'Aceite de oliva'], ['pescado', 'ligero']),
    R('Merluza en salsa verde', ['Merluza:4 rodajas', 'Almejas:250 g', 'Perejil', 'Ajo:3 dientes', 'Harina', 'Vino blanco:100 ml', 'Aceite de oliva'], ['pescado']),
    R('Tortilla de patatas con ensalada', ['Huevos:6', 'Patata:4', 'Cebolla:1', 'Lechuga:1', 'Tomate:2', 'Aceite de oliva'], ['huevo', 'vegetariano']),
    R('Espaguetis a la boloñesa', ['Espaguetis:400 g', 'Carne picada:400 g', 'Tomate triturado:1 bote', 'Zanahoria:1', 'Cebolla:1', 'Queso parmesano'], ['pasta', 'carne']),
    R('Macarrones con atún y tomate', ['Macarrones:400 g', 'Atún en lata:3 latas', 'Tomate frito:1 bote', 'Queso rallado', 'Orégano'], ['pasta', 'pescado']),
    R('Arroz con verduras', ['Arroz:300 g', 'Pimiento verde:1', 'Pimiento rojo:1', 'Calabacín:1', 'Berenjena:1', 'Cebolla:1', 'Caldo de verduras:1 l'], ['arroz', 'vegetariano']),
    R('Paella mixta', ['Arroz:400 g', 'Pollo troceado:500 g', 'Gambas:250 g', 'Mejillones:500 g', 'Judías verdes:200 g', 'Pimiento rojo:1', 'Azafrán', 'Tomate:1'], ['arroz']),
    R('Crema de calabaza', ['Calabaza:1 kg', 'Patata:1', 'Puerro:1', 'Cebolla:1', 'Caldo de verduras:750 ml', 'Nata'], ['verdura', 'vegetariano', 'cena']),
    R('Ensalada César con pollo', ['Pechuga de pollo:2', 'Lechuga romana:1', 'Picatostes', 'Queso parmesano', 'Salsa César'], ['ensalada', 'cena']),
    R('Hamburguesas caseras', ['Carne picada de ternera:500 g', 'Pan de hamburguesa:4', 'Queso en lonchas:4', 'Tomate:1', 'Lechuga:1', 'Cebolla:1'], ['carne']),
    R('Fajitas de pollo', ['Pechuga de pollo:500 g', 'Tortillas de trigo:8', 'Pimiento rojo:1', 'Pimiento verde:1', 'Cebolla:1', 'Guacamole', 'Especias para fajitas'], ['carne', 'cena']),
    R('Lubina al horno', ['Lubina:2', 'Patata:3', 'Cebolla:1', 'Limón:1', 'Vino blanco:100 ml', 'Aceite de oliva'], ['pescado', 'horno']),
    R('Revuelto de setas y gambas', ['Huevos:4', 'Setas variadas:300 g', 'Gambas peladas:200 g', 'Ajo:2 dientes', 'Perejil'], ['huevo', 'cena']),
    R('Pisto con huevo', ['Calabacín:1', 'Berenjena:1', 'Pimiento rojo:1', 'Pimiento verde:1', 'Tomate triturado:1 bote', 'Huevos:4', 'Cebolla:1'], ['verdura', 'vegetariano']),
    R('Albóndigas en salsa', ['Carne picada mixta:500 g', 'Huevos:1', 'Pan rallado', 'Tomate triturado:1 bote', 'Cebolla:1', 'Guisantes:150 g'], ['carne']),
    R('Fabada asturiana', ['Fabes:500 g', 'Chorizo:2', 'Morcilla:2', 'Panceta:150 g', 'Azafrán'], ['legumbre', 'cuchara']),
    R('Sopa de fideos', ['Fideos:150 g', 'Caldo de pollo:1,5 l', 'Zanahoria:1', 'Huevos:2'], ['cuchara', 'cena']),
    R('Pizza casera de jamón y champiñones', ['Masa de pizza:1', 'Tomate frito', 'Mozzarella:200 g', 'Jamón york:150 g', 'Champiñones:200 g', 'Orégano'], ['cena']),
    R('Quiche de puerros', ['Masa quebrada:1', 'Puerro:3', 'Huevos:3', 'Nata:200 ml', 'Queso rallado'], ['vegetariano', 'horno']),
    R('Lomo de cerdo con pimientos', ['Lomo de cerdo:600 g', 'Pimiento rojo:2', 'Pimiento verde:2', 'Patata:3', 'Ajo:3 dientes'], ['carne']),
    R('Bacalao a la vizcaína', ['Bacalao desalado:4 lomos', 'Pimiento choricero:4', 'Cebolla:2', 'Tomate:2', 'Ajo:2 dientes'], ['pescado']),
    R('Poke bowl de salmón', ['Salmón fresco:300 g', 'Arroz:200 g', 'Aguacate:1', 'Pepino:1', 'Edamame:100 g', 'Salsa de soja', 'Sésamo'], ['pescado', 'ligero']),
    R('Curry de garbanzos', ['Garbanzos cocidos:2 botes', 'Leche de coco:1 lata', 'Tomate triturado:1 bote', 'Espinacas:200 g', 'Arroz basmati:200 g', 'Curry', 'Cebolla:1'], ['legumbre', 'vegetariano']),
    R('Wok de ternera y verduras', ['Ternera en tiras:400 g', 'Brócoli:1', 'Zanahoria:2', 'Pimiento rojo:1', 'Fideos de arroz:200 g', 'Salsa de soja'], ['carne']),
    R('Gazpacho y pechuga a la plancha', ['Tomate:1 kg', 'Pepino:1', 'Pimiento verde:1', 'Pan:1 rebanada', 'Pechuga de pollo:2', 'Vinagre', 'Aceite de oliva'], ['verano', 'ligero']),
    R('Lasaña de verduras', ['Placas de lasaña:12', 'Calabacín:1', 'Berenjena:1', 'Espinacas:200 g', 'Bechamel:500 ml', 'Queso rallado', 'Tomate triturado:1 bote'], ['pasta', 'vegetariano', 'horno']),
    R('Sándwich de pavo y aguacate', ['Pan de molde:8 rebanadas', 'Pavo en lonchas:150 g', 'Aguacate:1', 'Tomate:1', 'Queso en lonchas:4'], ['cena', 'rápido']),
    R('Huevos rotos con jamón', ['Huevos:4', 'Patata:4', 'Jamón serrano:100 g', 'Aceite de oliva'], ['huevo', 'cena']),
    R('Ensalada de quinoa', ['Quinoa:200 g', 'Tomate cherry:250 g', 'Pepino:1', 'Queso feta:150 g', 'Aceitunas negras', 'Cebolla morada:1'], ['ensalada', 'vegetariano']),
    R('Judías verdes con patata', ['Judías verdes:500 g', 'Patata:3', 'Ajo:2 dientes', 'Pimentón', 'Aceite de oliva'], ['verdura', 'vegetariano', 'cena']),
    R('Calamares en su tinta con arroz', ['Calamares:600 g', 'Tinta de calamar:2 sobres', 'Cebolla:1', 'Tomate:1', 'Arroz:200 g'], ['pescado']),
    R('Crema de calabacín', ['Calabacín:3', 'Puerro:1', 'Patata:1', 'Quesitos:4'], ['verdura', 'cena', 'vegetariano'])
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else root.CATALOG = CATALOG;
})(typeof self !== 'undefined' ? self : this);

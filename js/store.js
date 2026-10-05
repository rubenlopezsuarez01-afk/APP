/* Persistencia en localStorage. */
(function (root) {
  'use strict';

  const KEY = 'planificador-comidas-v1';
  const { STAPLES } = root.Logic;

  function defaults() {
    return {
      version: 1,
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

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('No se pudo leer el estado guardado', e);
      return defaults();
    }
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
      ingredientShop: data.ingredientShop || {}
    };
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('No se pudo guardar', e);
      alert('No se ha podido guardar. ¿Almacenamiento lleno o en modo privado?');
    }
  }

  root.Store = { load, save, defaults, migrate };
})(typeof self !== 'undefined' ? self : this);

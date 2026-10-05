/* Interfaz del planificador de comidas semanal. */
(function () {
  'use strict';

  const L = window.Logic;
  const CATALOG = window.CATALOG;
  let state = Store.load();
  let view = 'week';
  let weekKey = L.weekStart(new Date());

  // ---------- utilidades ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const persist = () => Store.save(state);

  function getWeek(key) {
    if (!state.weeks[key]) state.weeks[key] = { slots: {}, extras: [], checked: {} };
    const w = state.weeks[key];
    w.slots = w.slots || {};
    w.extras = w.extras || [];
    w.checked = w.checked || {};
    return w;
  }

  function pantrySet() {
    return new Set(state.settings.pantry.map(L.normalize));
  }

  function shopFor(name, fallback) {
    return state.ingredientShop[L.normalize(name)] || fallback || '';
  }

  function rememberShop(name, supermarket) {
    const n = L.normalize(name);
    if (!n) return;
    if (supermarket) state.ingredientShop[n] = supermarket;
  }

  /** Convierte una receta en una comida planificada (marca lo que hay en la despensa). */
  function mealFromRecipe(recipe) {
    const pantry = pantrySet();
    return {
      name: recipe.name,
      recipeId: recipe.builtin ? null : recipe.id || null,
      ingredients: (recipe.ingredients || []).map((i) => ({
        name: i.name,
        qty: i.qty || '',
        supermarket: shopFor(i.name, i.supermarket),
        have: pantry.has(L.normalize(i.name))
      }))
    };
  }

  function formatWeek(key) {
    const start = L.fromISO(key);
    const end = L.fromISO(L.addDays(key, 6));
    const fmt = (d, opts) => d.toLocaleDateString('es-ES', opts);
    const sameMonth = start.getMonth() === end.getMonth();
    return `${fmt(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`;
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function supermarketSelect(value, onchange) {
    const options = [h('option', { value: '' }, '— Súper —')];
    const list = state.settings.supermarkets.slice();
    if (value && !list.includes(value)) list.push(value);
    for (const s of list) options.push(h('option', { value: s, selected: s === value }, s));
    return h('select', { class: 'shop-select', onchange: (e) => onchange(e.target.value), 'aria-label': 'Supermercado' }, options);
  }

  // ---------- modal ----------
  const dialog = document.getElementById('modal');
  function openModal(title, body, footer) {
    dialog.replaceChildren(...[
      h('div', { class: 'modal-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', onclick: closeModal, 'aria-label': 'Cerrar' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, footer) : null
    ].filter(Boolean));
    if (!dialog.open) dialog.showModal();
  }
  function closeModal() {
    if (dialog.open) dialog.close();
    if (pendingRemote) { const next = pendingRemote; pendingRemote = null; applyRemote(next); }
  }
  dialog.addEventListener('close', () => {
    if (pendingRemote) { const next = pendingRemote; pendingRemote = null; applyRemote(next); }
  });

  // Confirmación dentro de la página (los artefactos no permiten confirm()).
  const confirmDialog = document.getElementById('confirm');
  function ask(message, okLabel, danger) {
    return new Promise((resolve) => {
      const done = (v) => { confirmDialog.close(); resolve(v); };
      confirmDialog.replaceChildren(
        h('p', { class: 'confirm-msg' }, message),
        h('div', { class: 'confirm-actions' },
          h('button', { class: 'btn', onclick: () => done(false) }, 'Cancelar'),
          h('button', { class: 'btn ' + (danger ? 'danger-solid' : 'primary'), onclick: () => done(true) }, okLabel || 'Aceptar')));
      confirmDialog.oncancel = (e) => { e.preventDefault(); done(false); };
      confirmDialog.showModal();
      confirmDialog.querySelector('.confirm-actions .btn:last-child').focus();
    });
  }

  // ---------- sincronización ----------
  let pendingRemote = null;
  let syncMode = 'local';
  function applyRemote(next) {
    if (dialog.open) { pendingRemote = next; return; }
    state = next;
    render();
  }
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeModal(); });

  // ---------- render principal ----------
  function render() {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const weekNav = document.getElementById('week-nav');
    weekNav.hidden = !(view === 'week' || view === 'list');
    document.getElementById('week-label').textContent = formatWeek(weekKey);
    document.getElementById('week-today').hidden = weekKey === L.weekStart(new Date());
    const main = document.getElementById('main');
    const renderers = { week: renderWeek, list: renderList, recipes: renderRecipes, settings: renderSettings };
    main.replaceChildren(renderers[view]());
    updateBadge();
  }

  function updateBadge() {
    const groups = L.buildShoppingList(getWeek(weekKey), getWeek(weekKey).extras, getWeek(weekKey).checked, state.settings.meals);
    const pending = groups.reduce((n, g) => n + g.items.filter((i) => !i.checked).length, 0);
    const badge = document.getElementById('list-badge');
    badge.textContent = pending;
    badge.hidden = pending === 0;
  }

  // ---------- semana ----------
  function renderWeek() {
    const week = getWeek(weekKey);
    const today = L.toISO(new Date());
    const wrap = h('div', { class: 'week' });

    L.DAYS.forEach((dayName, dayIndex) => {
      const date = L.addDays(weekKey, dayIndex);
      const d = L.fromISO(date);
      const card = h('section', { class: 'day' + (date === today ? ' today' : '') },
        h('header', { class: 'day-head' },
          h('span', { class: 'day-name' }, dayName),
          h('span', { class: 'day-date' }, d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))));

      for (const mealName of state.settings.meals) {
        const key = L.slotKey(dayIndex, mealName);
        const meal = week.slots[key];
        if (!meal) {
          card.append(h('div', { class: 'slot empty' },
            h('span', { class: 'slot-label' }, mealName),
            h('div', { class: 'slot-actions' },
              h('button', { class: 'btn small', onclick: () => openMealEditor(key) }, '＋ Añadir'),
              h('button', { class: 'btn small accent', onclick: () => openSuggestions(key) }, '💡 Ideas'))));
          continue;
        }
        const missing = L.missingForMeal(meal);
        card.append(h('div', { class: 'slot filled', onclick: () => openMealEditor(key), role: 'button', tabindex: '0' },
          h('span', { class: 'slot-label' }, mealName),
          h('div', { class: 'slot-name' }, meal.name),
          missing.length
            ? h('ul', { class: 'mini-list' }, missing.map((i) =>
              h('li', {}, h('span', {}, i.name, i.qty ? ` · ${i.qty}` : ''),
                h('span', { class: 'shop-tag' + (i.supermarket ? '' : ' none') }, i.supermarket || L.NO_SUPERMARKET))))
            : h('div', { class: 'all-good' }, '✔ Tienes todo')));
      }
      wrap.append(card);
    });
    return wrap;
  }

  // ---------- editor de comida ----------
  function openMealEditor(key, preset) {
    const week = getWeek(weekKey);
    const existing = week.slots[key];
    const draft = preset ? clone(preset) : existing ? clone(existing) : { name: '', ingredients: [] };
    const { dayIndex, meal: mealName } = L.parseSlotKey(key);
    const pantry = pantrySet();
    const knownRecipe = () => state.recipes.find((r) => L.normalize(r.name) === L.normalize(draft.name));
    let saveAsRecipe = !knownRecipe();

    const nameInput = h('input', {
      type: 'text', value: draft.name, placeholder: '¿Qué vas a comer?', list: 'recipe-names', class: 'big-input',
      oninput: (e) => { draft.name = e.target.value; },
      onchange: async () => {
        const rec = knownRecipe() || CATALOG.find((r) => L.normalize(r.name) === L.normalize(draft.name));
        if (rec && (!draft.ingredients.length || await ask(`¿Cambiar los ingredientes por los de "${rec.name}"?`, 'Cambiar'))) {
          const m = mealFromRecipe(rec);
          draft.ingredients = m.ingredients;
          draft.recipeId = m.recipeId;
          renderIngredients();
        }
        saveCheck.checked = saveAsRecipe = !knownRecipe();
      }
    });

    const datalist = h('datalist', { id: 'recipe-names' },
      [...new Set([...state.recipes.map((r) => r.name), ...L.buildHistory(state.weeks).map((x) => x.name), ...CATALOG.map((r) => r.name)])]
        .map((n) => h('option', { value: n })));

    const ingList = h('div', { class: 'ing-list' });
    const summary = h('div', { class: 'meal-summary' });

    function renderSummary() {
      const missing = L.missingForMeal(draft);
      if (!missing.length) {
        summary.replaceChildren(h('p', { class: 'muted' }, draft.ingredients.length ? '✔ Tienes todo lo necesario.' : 'Añade los ingredientes para generar la lista de la compra de esta comida.'));
        return;
      }
      const bySuper = {};
      for (const i of missing) (bySuper[i.supermarket || L.NO_SUPERMARKET] = bySuper[i.supermarket || L.NO_SUPERMARKET] || []).push(i);
      summary.replaceChildren(
        h('h3', {}, `🛒 Lista de la compra de esta comida (${missing.length})`),
        ...Object.entries(bySuper).map(([s, items]) => h('div', { class: 'sum-group' },
          h('strong', {}, s), ': ', items.map((i) => i.name + (i.qty ? ` (${i.qty})` : '')).join(', ')))
      );
    }

    function renderIngredients() {
      ingList.replaceChildren(...draft.ingredients.map((ing, idx) => {
        const row = h('div', { class: 'ing-row' + (ing.have ? ' have' : '') },
          h('label', { class: 'have-toggle', title: 'Lo tengo en casa' },
            h('input', { type: 'checkbox', checked: ing.have, onchange: (e) => { ing.have = e.target.checked; row.classList.toggle('have', ing.have); renderSummary(); } }),
            h('span', {}, 'Tengo')),
          h('input', {
            type: 'text', class: 'ing-name', value: ing.name, placeholder: 'Ingrediente',
            oninput: (e) => { ing.name = e.target.value; renderSummary(); },
            onchange: () => {
              if (!ing.supermarket && shopFor(ing.name)) { ing.supermarket = shopFor(ing.name); renderIngredients(); }
              if (pantry.has(L.normalize(ing.name)) && !ing.have) { ing.have = true; renderIngredients(); }
              renderSummary();
            }
          }),
          h('input', { type: 'text', class: 'ing-qty', value: ing.qty, placeholder: 'Cant.', oninput: (e) => { ing.qty = e.target.value; renderSummary(); } }),
          supermarketSelect(ing.supermarket, (v) => { ing.supermarket = v; renderSummary(); }),
          h('button', { class: 'icon-btn', 'aria-label': 'Quitar', onclick: () => { draft.ingredients.splice(idx, 1); renderIngredients(); } }, '🗑'));
        return row;
      }));
      renderSummary();
    }

    const saveCheck = h('input', { type: 'checkbox', checked: saveAsRecipe, onchange: (e) => { saveAsRecipe = e.target.checked; } });

    const body = h('div', { class: 'meal-editor' },
      h('p', { class: 'muted' }, `${L.DAYS[dayIndex]} · ${mealName}`),
      nameInput, datalist,
      h('div', { class: 'section-head' },
        h('h3', {}, 'Ingredientes'),
        h('span', { class: 'muted small' }, 'Marca "Tengo" lo que ya hay en casa')),
      ingList,
      h('button', {
        class: 'btn ghost', onclick: () => {
          draft.ingredients.push({ name: '', qty: '', supermarket: '', have: false });
          renderIngredients();
          const inputs = ingList.querySelectorAll('.ing-name');
          inputs[inputs.length - 1].focus();
        }
      }, '＋ Añadir ingrediente'),
      summary,
      h('label', { class: 'check-line' }, saveCheck, ' Guardar en "Mis recetas"'));

    renderIngredients();

    const footer = [
      existing ? h('button', {
        class: 'btn danger', onclick: async () => {
          if (!await ask('¿Quitar esta comida del planning?', 'Quitar', true)) return;
          delete week.slots[key];
          persist(); closeModal(); render();
        }
      }, 'Quitar') : null,
      h('button', { class: 'btn accent', onclick: () => openSuggestions(key) }, '💡 Ideas'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-cancel', onclick: closeModal }, 'Cancelar'),
      h('button', {
        class: 'btn primary', onclick: () => {
          draft.name = draft.name.trim();
          if (!draft.name) { nameInput.focus(); toast('Ponle nombre a la comida'); return; }
          draft.ingredients = draft.ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim() }));
          for (const i of draft.ingredients) rememberShop(i.name, i.supermarket);
          if (saveAsRecipe) upsertRecipe({ name: draft.name, ingredients: draft.ingredients });
          else {
            const rec = knownRecipe();
            if (rec) draft.recipeId = rec.id;
          }
          week.slots[key] = draft;
          persist(); closeModal(); render();
          toast('Comida guardada');
        }
      }, 'Guardar')
    ];
    openModal(existing ? 'Editar comida' : 'Nueva comida', body, footer);
    if (!draft.name) setTimeout(() => nameInput.focus(), 50);
  }

  function upsertRecipe(data) {
    const ingredients = data.ingredients.map((i) => ({ name: i.name, qty: i.qty || '', supermarket: i.supermarket || '' }));
    const existing = data.id
      ? state.recipes.find((r) => r.id === data.id)
      : state.recipes.find((r) => L.normalize(r.name) === L.normalize(data.name));
    if (existing) {
      existing.name = data.name;
      existing.ingredients = ingredients;
      if (data.notes !== undefined) existing.notes = data.notes;
      return existing;
    }
    const rec = { id: uid(), name: data.name, ingredients, notes: data.notes || '' };
    state.recipes.push(rec);
    return rec;
  }

  // ---------- sugerencias ----------
  function openSuggestions(key) {
    const { dayIndex, meal: mealName } = L.parseSlotKey(key);
    let query = '';

    const content = h('div', {});
    function draw() {
      const res = L.suggest({
        weeks: state.weeks, weekKey, key, catalog: CATALOG, myRecipes: state.recipes,
        todayISO: L.toISO(new Date()), staples: state.settings.staples, limit: query ? 50 : 6
      });
      const match = (r) => !query || L.normalize(r.name + ' ' + r.ingredients.map((i) => i.name).join(' ')).includes(L.normalize(query));

      const card = (r, extra) => h('div', { class: 'sugg' },
        h('div', { class: 'sugg-main' },
          h('div', { class: 'sugg-name' }, r.name),
          h('div', { class: 'sugg-ings' }, r.ingredients.map((i) => i.name).join(', ')),
          extra ? h('div', { class: 'sugg-extra' }, extra) : null),
        h('button', {
          class: 'btn primary small', onclick: () => {
            const src = r.source === 'mine' ? state.recipes.find((x) => x.id === r.id) || r : r;
            openMealEditor(key, mealFromRecipe(src));
          }
        }, 'Elegir'));

      const hist = res.fromHistory.filter(match);
      const fresh = res.newRecipes.filter(match);
      const ago = (d) => d <= 0 ? 'esta semana' : d < 14 ? `hace ${d} días` : d < 60 ? `hace ${Math.round(d / 7)} semanas` : `hace ${Math.round(d / 30)} meses`;

      content.replaceChildren(
        res.weekIngredients.length
          ? h('div', { class: 'excluded' },
            h('span', { class: 'muted small' }, 'Esta semana ya comes: '),
            h('div', { class: 'chips' }, res.weekIngredients.map((n) => h('span', { class: 'chip' }, n))),
            h('p', { class: 'muted small' }, 'Las ideas de abajo no repiten ninguno de estos alimentos.'))
          : h('p', { class: 'muted small' }, 'Aún no hay nada planificado esta semana: cualquier idea vale.'),
        h('h3', {}, '🕘 De tu historial'),
        hist.length
          ? h('div', { class: 'sugg-list' }, hist.map((r) => card(r, `Comido ${r.count} ${r.count === 1 ? 'vez' : 'veces'} · última ${ago(r.daysAgo)}`)))
          : h('p', { class: 'muted' }, res.historyCount ? 'No hay platos del historial que encajen.' : 'Todavía no hay historial. ¡Se irá llenando a medida que planifiques!'),
        h('div', { class: 'section-head' },
          h('h3', {}, '✨ Recetas nuevas'),
          h('button', { class: 'btn small ghost', onclick: draw }, '🔀 Otras')),
        fresh.length
          ? h('div', { class: 'sugg-list' }, fresh.map((r) => card(r, r.source === 'mine' ? 'De tus recetas (aún sin probar)' : null)))
          : h('p', { class: 'muted' }, 'No hay recetas nuevas que encajen.')
      );
    }

    const search = h('input', { type: 'search', placeholder: 'Filtrar (ej. pasta, pescado…)', class: 'search', oninput: (e) => { query = e.target.value; draw(); } });
    draw();
    openModal(`Ideas para ${L.DAYS[dayIndex].toLowerCase()} · ${mealName.toLowerCase()}`, h('div', {}, search, content));
  }

  // ---------- lista de la compra ----------
  function renderList() {
    const week = getWeek(weekKey);
    const groups = L.buildShoppingList(week, week.extras, week.checked, state.settings.meals);
    const wrap = h('div', { class: 'list-view' });

    const nameIn = h('input', { type: 'text', placeholder: 'Añadir algo (ej. papel de cocina)', list: 'ingredient-names', required: true });
    const qtyIn = h('input', { type: 'text', placeholder: 'Cant.', class: 'qty' });
    let shop = '';
    const shopSel = supermarketSelect('', (v) => { shop = v; });
    nameIn.addEventListener('change', () => {
      const s = shopFor(nameIn.value);
      if (s) { shop = s; shopSel.value = s; }
    });
    wrap.append(h('form', {
      class: 'add-form card', onsubmit: (e) => {
        e.preventDefault();
        const name = nameIn.value.trim();
        if (!name) return;
        week.extras.push({ id: uid(), name, qty: qtyIn.value.trim(), supermarket: shop });
        rememberShop(name, shop);
        persist(); render();
        toast(`"${name}" añadido`);
      }
    },
    h('datalist', { id: 'ingredient-names' }, Object.keys(state.ingredientShop).map((n) => h('option', { value: n }))),
    nameIn, qtyIn, shopSel, h('button', { class: 'btn primary', type: 'submit' }, 'Añadir')));

    if (!groups.length) {
      wrap.append(h('div', { class: 'empty-state' },
        h('p', {}, '🧺 La lista está vacía.'),
        h('p', { class: 'muted' }, 'Los ingredientes que falten en las comidas de la semana aparecerán aquí, agrupados por supermercado.')));
      return wrap;
    }

    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const done = groups.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);
    wrap.append(h('div', { class: 'list-toolbar' },
      h('span', { class: 'muted' }, `${done}/${total} comprados`),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn small ghost', onclick: shareList }, '📤 Compartir'),
      done ? h('button', { class: 'btn small ghost', onclick: () => { week.checked = {}; persist(); render(); } }, 'Desmarcar todo') : null));

    for (const g of groups) {
      const pending = g.items.filter((i) => !i.checked).length;
      wrap.append(h('section', { class: 'card shop-group' },
        h('header', { class: 'shop-head' }, h('h3', {}, g.supermarket), h('span', { class: 'count' }, pending ? `${pending} pendientes` : '✔ completo')),
        h('ul', { class: 'shop-items' }, g.items.map((it) => h('li', { class: it.checked ? 'checked' : '' },
          h('label', {},
            h('input', {
              type: 'checkbox', checked: it.checked, onchange: (e) => {
                if (e.target.checked) week.checked[it.id] = true; else delete week.checked[it.id];
                persist(); render();
              }
            }),
            h('span', { class: 'item-text' },
              h('span', { class: 'item-name' }, it.name, it.qty ? h('span', { class: 'item-qty' }, ` · ${it.qty}`) : null),
              h('span', { class: 'item-src' }, it.sources.map((s) => s.meal ? `${s.label}: ${s.meal}` : s.label).join(' · ')))),
          it.extraIds ? h('button', {
            class: 'icon-btn', 'aria-label': 'Eliminar', onclick: () => {
              week.extras = week.extras.filter((x) => !it.extraIds.includes(x.id));
              persist(); render();
            }
          }, '✕') : null)))));
    }
    return wrap;
  }

  async function shareList() {
    const week = getWeek(weekKey);
    const text = `Lista de la compra (${formatWeek(weekKey)})\n\n` +
      L.shoppingListText(L.buildShoppingList(week, week.extras, week.checked, state.settings.meals));
    const inFrame = window.top !== window;
    try {
      if (navigator.share && !inFrame) { await navigator.share({ title: 'Lista de la compra', text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Lista copiada: pégala en WhatsApp o en Notas');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      const area = h('textarea', { rows: 14, readonly: true }, text);
      openModal('Copia la lista', h('div', {}, h('p', { class: 'muted small' }, 'Selecciona el texto y cópialo.'), area));
      area.select();
    }
  }

  // ---------- recetas ----------
  let recipeQuery = '';
  function renderRecipes() {
    const wrap = h('div', { class: 'recipes-view' });
    const listBox = h('div', {});
    const match = (r) => !recipeQuery || L.normalize(r.name + ' ' + r.ingredients.map((i) => i.name).join(' ')).includes(L.normalize(recipeQuery));

    function drawList() {
      const mine = state.recipes.filter(match).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      const mineNames = new Set(state.recipes.map((r) => L.normalize(r.name)));
      const cat = CATALOG.filter((r) => !mineNames.has(L.normalize(r.name)) && match(r));
      listBox.replaceChildren(
        h('h3', {}, `Mis recetas (${state.recipes.length})`),
        mine.length ? h('div', { class: 'recipe-list' }, mine.map((r) => h('div', { class: 'recipe card', onclick: () => openRecipeEditor(r) },
          h('div', { class: 'sugg-name' }, r.name),
          h('div', { class: 'sugg-ings' }, r.ingredients.map((i) => i.name).join(', ') || 'Sin ingredientes')))) :
          h('p', { class: 'muted' }, 'Todavía no tienes recetas guardadas. Se guardan solas al planificar una comida.'),
        h('h3', {}, 'Recetario de ideas'),
        h('div', { class: 'recipe-list' }, cat.map((r) => h('div', { class: 'recipe card catalog' },
          h('div', { class: 'sugg-main' },
            h('div', { class: 'sugg-name' }, r.name),
            h('div', { class: 'sugg-ings' }, r.ingredients.map((i) => i.name).join(', '))),
          h('button', {
            class: 'btn small', onclick: (e) => {
              e.stopPropagation();
              upsertRecipe({ name: r.name, ingredients: r.ingredients.map((i) => ({ ...i, supermarket: shopFor(i.name) })) });
              persist(); drawList(); toast('Añadida a tus recetas');
            }
          }, '＋ Mías')))));
    }

    wrap.append(h('div', { class: 'list-toolbar' },
      h('input', { type: 'search', class: 'search', placeholder: 'Buscar receta o ingrediente', value: recipeQuery, oninput: (e) => { recipeQuery = e.target.value; drawList(); } }),
      h('button', { class: 'btn primary', onclick: () => openRecipeEditor(null) }, '＋ Nueva')));
    wrap.append(listBox);
    drawList();
    return wrap;
  }

  function openRecipeEditor(recipe) {
    const draft = recipe ? clone(recipe) : { name: '', ingredients: [], notes: '' };
    const ingList = h('div', { class: 'ing-list' });
    function drawIngs() {
      ingList.replaceChildren(...draft.ingredients.map((ing, idx) => h('div', { class: 'ing-row' },
        h('input', { type: 'text', class: 'ing-name', value: ing.name, placeholder: 'Ingrediente', oninput: (e) => { ing.name = e.target.value; }, onchange: () => { if (!ing.supermarket && shopFor(ing.name)) { ing.supermarket = shopFor(ing.name); drawIngs(); } } }),
        h('input', { type: 'text', class: 'ing-qty', value: ing.qty, placeholder: 'Cant.', oninput: (e) => { ing.qty = e.target.value; } }),
        supermarketSelect(ing.supermarket, (v) => { ing.supermarket = v; }),
        h('button', { class: 'icon-btn', onclick: () => { draft.ingredients.splice(idx, 1); drawIngs(); } }, '🗑'))));
    }
    drawIngs();
    const nameIn = h('input', { type: 'text', class: 'big-input', value: draft.name, placeholder: 'Nombre de la receta', oninput: (e) => { draft.name = e.target.value; } });
    const body = h('div', { class: 'meal-editor' },
      nameIn,
      h('h3', {}, 'Ingredientes'),
      ingList,
      h('button', { class: 'btn ghost', onclick: () => { draft.ingredients.push({ name: '', qty: '', supermarket: '' }); drawIngs(); const all = ingList.querySelectorAll('.ing-name'); all[all.length - 1].focus(); } }, '＋ Añadir ingrediente'),
      h('h3', {}, 'Notas'),
      h('textarea', { rows: 3, placeholder: 'Pasos, trucos, enlace…', oninput: (e) => { draft.notes = e.target.value; } }, draft.notes || ''));

    openModal(recipe ? 'Editar receta' : 'Nueva receta', body, [
      recipe ? h('button', {
        class: 'btn danger', onclick: async () => {
          if (!await ask(`¿Borrar la receta "${recipe.name}"? El historial de comidas no se toca.`, 'Borrar', true)) return;
          state.recipes = state.recipes.filter((r) => r.id !== recipe.id);
          persist(); closeModal(); render();
        }
      }, 'Borrar') : null,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-cancel', onclick: closeModal }, 'Cancelar'),
      h('button', {
        class: 'btn primary', onclick: () => {
          draft.name = draft.name.trim();
          if (!draft.name) { nameIn.focus(); return; }
          draft.ingredients = draft.ingredients.filter((i) => i.name.trim());
          for (const i of draft.ingredients) rememberShop(i.name, i.supermarket);
          upsertRecipe(draft);
          persist(); closeModal(); render();
        }
      }, 'Guardar')
    ]);
  }

  // ---------- ajustes ----------
  function renderSettings() {
    const s = state.settings;
    const lines = (arr) => arr.join('\n');
    const parse = (txt) => [...new Set(txt.split(/\n|,/).map((x) => x.trim()).filter(Boolean))];

    const field = (label, help, value, onSave, rows) => h('section', { class: 'card setting' },
      h('h3', {}, label),
      h('p', { class: 'muted small' }, help),
      h('textarea', { rows: rows || 5, onchange: (e) => { onSave(parse(e.target.value)); persist(); toast('Guardado'); } }, lines(value)));

    const fileIn = h('input', {
      type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          e.target.value = '';
          if (!await ask('Esto sustituirá todos tus datos actuales por los del archivo.', 'Importar', true)) return;
          state = Store.migrate(data);
          persist(); render(); toast('Datos importados');
        } catch (err) {
          toast('Ese archivo no es una copia de seguridad válida.');
        }
      }
    });

    return h('div', { class: 'settings-view' },
      field('Comidas del día', 'Una por línea (ej. Desayuno, Comida, Cena).', s.meals, (v) => { if (v.length) s.meals = v; }, 3),
      field('Supermercados', 'Uno por línea. Aparecerán al lado de cada ingrediente.', s.supermarkets, (v) => { s.supermarkets = v; }),
      field('Siempre tengo en casa', 'Estos ingredientes se marcan como "Tengo" automáticamente y no van a la lista.', s.pantry, (v) => { s.pantry = v; }),
      field('No cuentan para repetir', 'Al proponer ideas se evitan platos con alimentos que ya comes esta semana. Estos básicos no cuentan.', s.staples, (v) => { s.staples = v; }, 6),
      h('section', { class: 'card setting' },
        h('h3', {}, 'Copia de seguridad'),
        h('p', { class: 'muted small' }, syncMode === 'remote'
          ? 'Tus datos se guardan en tu cuenta de Claude y se ven igual en el móvil y en el ordenador. Puedes exportar una copia por si acaso.'
          : 'Los datos se guardan en este navegador. Exporta un archivo para pasarlos a otro móvil u ordenador.'),
        h('div', { class: 'row' },
          h('button', {
            class: 'btn', onclick: () => exportData()
          }, '⬇ Exportar'),
          h('button', { class: 'btn', onclick: () => fileIn.click() }, '⬆ Importar'),
          fileIn,
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'btn danger', onclick: async () => {
              if (!await ask('¿Borrar TODOS los datos (planning, historial y recetas)? No se puede deshacer.', 'Borrar todo', true)) return;
              state = Store.defaults(); persist(); render();
            }
          }, 'Borrar todo'))));
  }

  async function exportData() {
    const json = JSON.stringify(state, null, 2);
    const filename = `planificador-comidas-${L.toISO(new Date())}.json`;
    if (window.top !== window) {
      const downloads = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
      if (downloads) {
        try { await downloads.save({ filename, data: json }); } catch (e) { if (e && e.code !== 'declined') toast('No se pudo guardar el archivo.'); }
        return;
      }
      const area = h('textarea', { rows: 14, readonly: true }, json);
      openModal('Copia de seguridad', h('div', {}, h('p', { class: 'muted small' }, 'Copia este texto y guárdalo en un archivo .json.'), area));
      return;
    }
    const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: filename });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------- arranque ----------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); window.scrollTo(0, 0); }));
  document.getElementById('week-prev').addEventListener('click', () => { weekKey = L.addDays(weekKey, -7); render(); });
  document.getElementById('week-next').addEventListener('click', () => { weekKey = L.addDays(weekKey, 7); render(); });
  document.getElementById('week-today').addEventListener('click', () => { weekKey = L.weekStart(new Date()); render(); });

  render();

  Store.connect(
    (next) => { syncMode = 'remote'; applyRemote(next); },
    (e) => toast(e && e.code === 'quota_exceeded' ? 'No queda espacio para guardar más datos.' : 'No se pudo guardar el último cambio. Revisa la conexión.')
  ).then((ok) => { if (ok) { syncMode = 'remote'; if (view === 'settings') render(); } });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && window.top === window) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

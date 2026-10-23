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
    if (!state.weeks[key]) state.weeks[key] = { slots: {} };
    const w = state.weeks[key];
    w.slots = w.slots || {};
    return w;
  }

  const todayISO = () => L.toISO(new Date());

  function generalList() {
    return L.buildGeneralList(state.weeks, state.list, todayISO(), state.settings.meals);
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

  /**
   * Sugerencias bajo un campo de texto mientras se escribe. Sustituye a
   * <datalist>, que en Safari (sobre todo en iPhone) apenas se ve o no se abre.
   * Devuelve el elemento de la lista, que hay que colocar justo después del campo.
   */
  function autocomplete(input, getOptions, onPick, max) {
    const box = h('div', { class: 'suggest', role: 'listbox', hidden: true });
    let hideTimer = null;
    function show() {
      clearTimeout(hideTimer);
      const q = L.normalize(input.value);
      if (!q) { box.hidden = true; return; }
      const starts = [];
      const contains = [];
      for (const opt of getOptions()) {
        const n = L.normalize(opt);
        if (n === q) continue;
        if (n.startsWith(q)) starts.push(opt);
        else if (n.includes(q)) contains.push(opt);
      }
      const matches = starts.sort((a, b) => a.localeCompare(b, 'es')).concat(contains.sort((a, b) => a.localeCompare(b, 'es'))).slice(0, max || 6);
      box.replaceChildren(...matches.map((opt) => h('button', {
        type: 'button', class: 'suggest-item', role: 'option',
        // pointerdown: elegir antes de que el campo pierda el foco (en iPhone el blur llega antes que el click)
        onpointerdown: (e) => { e.preventDefault(); },
        onclick: () => { box.hidden = true; onPick(opt); }
      }, opt)));
      box.hidden = !matches.length;
    }
    input.addEventListener('input', show);
    input.addEventListener('focus', show);
    input.addEventListener('blur', () => { hideTimer = setTimeout(() => { box.hidden = true; }, 200); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; });
    return box;
  }

  // ---------- modal ----------
  const dialog = document.getElementById('modal');
  // Safari anterior a iOS 15.4 no tiene <dialog>: se muestra igual con una clase.
  const isOpen = (d) => d.hasAttribute('open');
  function showDialog(d) {
    if (typeof d.showModal === 'function') d.showModal();
    else { d.setAttribute('open', ''); d.classList.add('dialog-fallback'); }
  }
  function hideDialog(d) {
    if (typeof d.close === 'function') d.close();
    else { d.removeAttribute('open'); d.dispatchEvent(new Event('close')); }
  }
  function openModal(title, body, footer) {
    dialog.replaceChildren(...[
      h('div', { class: 'modal-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', onclick: closeModal, 'aria-label': 'Cerrar' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, footer) : null
    ].filter(Boolean));
    if (!isOpen(dialog)) showDialog(dialog);
  }
  function closeModal() {
    if (isOpen(dialog)) hideDialog(dialog);
    if (pendingRemote) { const next = pendingRemote; pendingRemote = null; applyRemote(next); }
  }
  dialog.addEventListener('close', () => {
    if (pendingRemote) { const next = pendingRemote; pendingRemote = null; applyRemote(next); }
  });

  // Confirmación dentro de la página (los artefactos no permiten confirm()).
  const confirmDialog = document.getElementById('confirm');
  function ask(message, okLabel, danger) {
    return new Promise((resolve) => {
      const done = (v) => { hideDialog(confirmDialog); resolve(v); };
      confirmDialog.replaceChildren(
        h('p', { class: 'confirm-msg' }, message),
        h('div', { class: 'confirm-actions' },
          h('button', { class: 'btn', onclick: () => done(false) }, 'Cancelar'),
          h('button', { class: 'btn ' + (danger ? 'danger-solid' : 'primary'), onclick: () => done(true) }, okLabel || 'Aceptar')));
      confirmDialog.oncancel = (e) => { e.preventDefault(); done(false); };
      showDialog(confirmDialog);
      confirmDialog.querySelector('.confirm-actions .btn:last-child').focus();
    });
  }

  // ---------- sincronización ----------
  let pendingRemote = null;
  let syncMode = 'local';
  function applyRemote(next) {
    if (isOpen(dialog)) { pendingRemote = next; return; }
    state = next;
    render();
  }
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeModal(); });

  // ---------- render principal ----------
  function render() {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const weekNav = document.getElementById('week-nav');
    weekNav.hidden = view !== 'week';
    document.getElementById('week-label').textContent = formatWeek(weekKey);
    document.getElementById('week-today').hidden = weekKey === L.weekStart(new Date());
    const main = document.getElementById('main');
    const renderers = { week: renderWeek, list: renderList, recipes: renderRecipes, settings: renderSettings };
    main.replaceChildren(renderers[view]());
    const banner = updateBanner();
    if (banner) main.prepend(banner);
    updateBadge();
  }

  function updateBadge() {
    const { groups } = generalList();
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
    const reminder = backupReminder();
    if (reminder) wrap.append(reminder);

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

  // ---------- copias de seguridad ----------
  const BACKUP_EVERY_DAYS = 14;

  function countMeals() {
    return Object.values(state.weeks).reduce((n, w) => n + Object.keys(w.slots || {}).length, 0);
  }

  function daysSinceBackup() {
    const last = Store.getMeta().lastBackup;
    return last ? L.daysBetween(last, L.toISO(new Date())) : null;
  }

  /** Aviso para guardar una copia si hace tiempo que no se hace (solo con datos en el navegador). */
  function backupReminder() {
    if (syncMode !== 'local' || countMeals() < 3) return null;
    const meta = Store.getMeta();
    const today = L.toISO(new Date());
    if (meta.snoozeUntil && meta.snoozeUntil > today) return null;
    const days = daysSinceBackup();
    if (days !== null && days < BACKUP_EVERY_DAYS) return null;
    return h('div', { class: 'backup-banner' },
      h('div', {},
        h('strong', {}, days === null ? 'Aún no tienes copia de seguridad' : `Tu última copia es de hace ${days} días`),
        h('p', { class: 'small' }, 'Tus comidas solo están en este móvil. Guarda una copia (en Drive, Archivos o enviándotela) por si cambias de móvil o se borra la app.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary small', onclick: () => exportData() }, 'Guardar copia'),
        h('button', { class: 'btn small ghost', onclick: () => { Store.setMeta({ snoozeUntil: L.addDays(today, 3) }); render(); } }, 'Luego')));
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

    // Al elegir un plato conocido se cargan sus ingredientes.
    let lastLoaded = L.normalize(draft.name);
    async function applyName() {
      const n = L.normalize(draft.name);
      if (n === lastLoaded) return;
      const rec = knownRecipe() || CATALOG.find((r) => L.normalize(r.name) === n);
      const past = !rec && L.buildHistory(state.weeks).find((x) => L.normalize(x.name) === n);
      const source = rec || past;
      if (source && (!draft.ingredients.length || await ask(`¿Cambiar los ingredientes por los de "${source.name}"?`, 'Cambiar'))) {
        const m = mealFromRecipe(source);
        draft.ingredients = m.ingredients;
        draft.recipeId = rec ? m.recipeId : null;
        renderIngredients();
      }
      lastLoaded = n;
      saveCheck.checked = saveAsRecipe = !knownRecipe();
    }

    const nameInput = h('input', {
      type: 'text', value: draft.name, placeholder: '¿Qué vas a comer?', class: 'big-input', autocomplete: 'off',
      oninput: (e) => { draft.name = e.target.value; },
      onchange: () => applyName()
    });
    const nameSuggestions = autocomplete(nameInput,
      () => [...new Set([...state.recipes.map((r) => r.name), ...L.buildHistory(state.weeks).map((x) => x.name), ...CATALOG.map((r) => r.name)])],
      (v) => { nameInput.value = v; draft.name = v; applyName(); });

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
            type: 'text', class: 'ing-name', value: ing.name, placeholder: 'Ingrediente', autocomplete: 'off',
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
      nameInput, nameSuggestions,
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
    const { groups, upcoming } = generalList();
    const list = state.list;
    const wrap = h('div', { class: 'list-view' });

    // Añadir algo a mano, ahora o para más adelante.
    const nameIn = h('input', { type: 'text', id: 'add-name', placeholder: 'Añadir algo (ej. papel de cocina)', autocomplete: 'off', required: true });
    const qtyIn = h('input', { type: 'text', id: 'add-qty', placeholder: 'Cant.', class: 'qty' });
    let shop = '';
    const shopSel = supermarketSelect('', (v) => { shop = v; });
    const pickShop = () => {
      const s = shopFor(nameIn.value);
      if (s) { shop = s; shopSel.value = s; }
    };
    nameIn.addEventListener('change', pickShop);
    const whenSel = h('select', { id: 'add-when', 'aria-label': 'Cuándo lo necesitas' },
      h('option', { value: '0' }, 'Lo necesito ya'),
      h('option', { value: '7' }, 'Dentro de 1 semana'),
      h('option', { value: '14' }, 'Dentro de 2 semanas'),
      h('option', { value: '21' }, 'Dentro de 3 semanas'),
      h('option', { value: 'date' }, 'Elegir fecha…'));
    const dateIn = h('input', { type: 'date', id: 'add-date', min: L.addDays(todayISO(), 1), hidden: true, 'aria-label': 'Fecha' });
    const nameSug = autocomplete(nameIn, () => Object.keys(state.ingredientShop), (v) => { nameIn.value = v; pickShop(); qtyIn.focus(); });
    whenSel.addEventListener('change', () => { dateIn.hidden = whenSel.value !== 'date'; if (!dateIn.hidden && !dateIn.value) dateIn.value = L.addDays(todayISO(), 14); });

    wrap.append(h('form', {
      class: 'add-form card', onsubmit: (e) => {
        e.preventDefault();
        const name = nameIn.value.trim();
        if (!name) return;
        let from = null;
        if (whenSel.value === 'date') from = dateIn.value || null;
        else if (whenSel.value !== '0') from = L.addDays(todayISO(), Number(whenSel.value));
        if (from && from <= todayISO()) from = null;
        list.extras.push({ id: uid(), name, qty: qtyIn.value.trim(), supermarket: shop, from });
        rememberShop(name, shop);
        persist(); render();
        toast(from ? `"${name}" saldrá en la lista el ${formatDay(from)}` : `"${name}" añadido`);
      }
    },
    nameIn, nameSug, qtyIn, shopSel, whenSel, dateIn, h('button', { class: 'btn primary', type: 'submit' }, 'Añadir')));

    if (!groups.length) {
      wrap.append(h('div', { class: 'empty-state' },
        h('p', {}, '🧺 La lista está vacía.'),
        h('p', { class: 'muted' }, 'Aquí aparece lo que falta para las comidas planificadas de hoy en adelante, agrupado por supermercado, y lo que añadas a mano.')));
    } else {
      const total = groups.reduce((n, g) => n + g.items.length, 0);
      const done = groups.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);
      wrap.append(h('div', { class: 'list-toolbar' },
        h('span', { class: 'muted' }, `${done}/${total} comprados`),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost', onclick: shareList }, '📤 Compartir'),
        done ? h('button', {
          class: 'btn small primary', onclick: () => {
            const n = L.clearBought(state.weeks, list, groups);
            persist(); render();
            toast(n === 1 ? 'Quitado 1 artículo comprado' : `Quitados ${n} artículos comprados`);
          }
        }, `Quitar comprados (${done})`) : null));

      for (const g of groups) {
        const pending = g.items.filter((i) => !i.checked).length;
        wrap.append(h('section', { class: 'card shop-group' },
          h('header', { class: 'shop-head' }, h('h3', {}, g.supermarket), h('span', { class: 'count' }, pending ? `${pending} pendientes` : '✔ completo')),
          h('ul', { class: 'shop-items' }, g.items.map((it) => h('li', { class: it.checked ? 'checked' : '' },
            h('label', {},
              h('input', {
                type: 'checkbox', checked: it.checked, onchange: (e) => {
                  if (e.target.checked) list.checked[it.id] = true; else delete list.checked[it.id];
                  persist(); render();
                }
              }),
              h('span', { class: 'item-text' },
                h('span', { class: 'item-name' }, it.name, it.qty ? h('span', { class: 'item-qty' }, ` · ${it.qty}`) : null),
                h('span', { class: 'item-src' }, it.sources.map((s) => s.meal ? `${s.label}: ${s.meal}` : s.label).join(' · ')))),
            it.extraIds ? h('button', {
              class: 'icon-btn', 'aria-label': 'Eliminar', onclick: () => {
                list.extras = list.extras.filter((x) => !it.extraIds.includes(x.id));
                delete list.checked[it.id];
                persist(); render();
              }
            }, '✕') : null)))));
      }
    }

    if (upcoming.length) {
      wrap.append(h('section', { class: 'card upcoming' },
        h('header', { class: 'shop-head' }, h('h3', {}, '🗓 Para más adelante'), h('span', { class: 'count' }, `${upcoming.length}`)),
        h('p', { class: 'muted small' }, 'Aparecerán en la lista el día indicado.'),
        h('ul', { class: 'shop-items' }, upcoming.map((ex) => h('li', {},
          h('span', { class: 'item-text upcoming-text' },
            h('span', { class: 'item-name' }, ex.name, ex.qty ? h('span', { class: 'item-qty' }, ` · ${ex.qty}`) : null),
            h('span', { class: 'item-src' }, `Desde el ${formatDay(ex.from)}${ex.supermarket ? ' · ' + ex.supermarket : ''}`)),
          h('button', {
            class: 'btn small ghost', onclick: () => { ex.from = null; persist(); render(); toast(`"${ex.name}" ya está en la lista`); }
          }, 'Ya'),
          h('button', {
            class: 'icon-btn', 'aria-label': 'Eliminar', onclick: () => {
              list.extras = list.extras.filter((x) => x.id !== ex.id);
              persist(); render();
            }
          }, '✕'))))));
    }
    return wrap;
  }

  function formatDay(iso) {
    return L.fromISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  async function shareList() {
    const text = 'Lista de la compra\n\n' + L.shoppingListText(generalList().groups);
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
      ingList.replaceChildren(...draft.ingredients.map((ing, idx) => h('div', { class: 'ing-row no-have' },
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
      renderUpdateSection(),
      renderShareSection(),
      field('Comidas del día', 'Una por línea (ej. Desayuno, Comida, Cena).', s.meals, (v) => { if (v.length) s.meals = v; }, 3),
      field('Supermercados', 'Uno por línea. Aparecerán al lado de cada ingrediente.', s.supermarkets, (v) => { s.supermarkets = v; }),
      field('Siempre tengo en casa', 'Estos ingredientes se marcan como "Tengo" automáticamente y no van a la lista.', s.pantry, (v) => { s.pantry = v; }),
      field('No cuentan para repetir', 'Al proponer ideas se evitan platos con alimentos que ya comes esta semana. Estos básicos no cuentan.', s.staples, (v) => { s.staples = v; }, 6),
      h('section', { class: 'card setting' },
        h('h3', {}, 'Copia de seguridad'),
        h('p', { class: 'muted small' }, syncMode === 'claude'
          ? 'Tus datos se guardan en tu cuenta de Claude y se ven igual en el móvil y en el ordenador. Puedes exportar una copia por si acaso.'
          : syncMode === 'shared'
            ? 'Tus datos están en el espacio compartido y en este móvil. Si desinstalas la app, vuelve a unirte con el código y aparecerán. Puedes exportar una copia por si acaso.'
            : 'Los datos se guardan en este móvil. Las actualizaciones de la app llegan solas y no los borran: no hace falta desinstalarla. Si la desinstalas o cambias de móvil, importa una copia.'),
        syncMode !== 'local' ? null : h('ul', { class: 'data-status small' },
          h('li', {}, (() => { const d = daysSinceBackup(); return d === null ? 'Última copia: nunca' : d === 0 ? 'Última copia: hoy' : `Última copia: hace ${d} ${d === 1 ? 'día' : 'días'}`; })()),
          h('li', {}, storagePersisted === true ? 'Protección contra borrado automático: activada' : storagePersisted === false ? 'Protección contra borrado automático: no concedida (instala la app en la pantalla de inicio)' : 'Protección contra borrado automático: no disponible en este navegador')),
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

  // ---------- actualizaciones ----------
  const canUpdate = 'serviceWorker' in navigator && location.protocol.startsWith('http') && window.top === window;
  const currentVersion = Number(window.APP_VERSION) || 0;
  let newVersion = null;
  let lastCheck = 0;

  /** Mira la versión publicada. Devuelve el número nuevo, null si no hay, o undefined sin conexión. */
  async function checkForUpdate() {
    if (!canUpdate) return null;
    lastCheck = Date.now();
    try {
      const res = await fetch('js/version.js?t=' + Date.now(), { cache: 'no-store' });
      const m = (await res.text()).match(/APP_VERSION\s*=\s*(\d+)/);
      const v = m ? Number(m[1]) : 0;
      const before = newVersion;
      newVersion = v > currentVersion ? v : null;
      if (newVersion !== before) render();
      return newVersion;
    } catch (e) {
      return undefined;
    }
  }

  async function updateNow() {
    toast('Actualizando…');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        await waitForActivation(reg.installing || reg.waiting);
      }
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* se recarga igualmente */ }
    Store.setMeta({ updatedFrom: currentVersion });
    location.reload();
  }

  /** Espera (como mucho 8 s) a que el service worker nuevo termine de instalarse. */
  function waitForActivation(worker) {
    if (!worker) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, 8000);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' || worker.state === 'redundant') done();
      });
    });
  }

  function updateBanner() {
    if (!newVersion) return null;
    return h('div', { class: 'update-banner', role: 'status' },
      h('span', {}, 'Hay una versión nueva de la app.'),
      h('button', { class: 'btn small primary', onclick: updateNow }, 'Actualizar ahora'));
  }

  function renderUpdateSection() {
    if (!canUpdate) return null;
    const btn = h('button', {
      class: 'btn' + (newVersion ? ' primary' : ''), onclick: async () => {
        if (newVersion) { updateNow(); return; }
        btn.disabled = true;
        btn.textContent = 'Buscando…';
        const v = await checkForUpdate();
        btn.disabled = false;
        btn.textContent = 'Buscar actualización';
        if (v) updateNow();
        else if (v === undefined) toast('Sin conexión. Inténtalo con internet.');
        else toast('Ya tienes la última versión');
      }
    }, newVersion ? `Actualizar a la versión ${newVersion}` : 'Buscar actualización');
    return h('section', { class: 'card setting' },
      h('h3', {}, 'Versión de la app'),
      h('p', { class: 'muted small' }, newVersion
        ? `Tienes la versión ${currentVersion} y hay una nueva. Al actualizar se recarga la app; tus datos no se tocan.`
        : `Versión ${currentVersion}. La app busca actualizaciones sola al abrirla; con este botón lo haces al momento. Tus datos no se tocan.`),
      h('div', { class: 'row' }, btn));
  }

  // ---------- compartir con otra persona ----------
  const Sync = window.FirebaseSync;
  const inArtifact = window.top !== window && !!window.claude;

  function renderShareSection() {
    const section = (...children) => h('section', { class: 'card setting share' }, h('h3', {}, 'Compartir con otra persona'), ...children);
    if (inArtifact) {
      return section(h('p', { class: 'muted small' },
        'Para que otra persona use este planning, invítala desde el menú Compartir de Claude como editora. Veréis los mismos datos.'));
    }
    if (!Sync || !Sync.isConfigured()) {
      return section(
        h('p', { class: 'muted small' }, 'Para compartir el planning y la lista con otro móvil hace falta conectar la app a Firebase (gratis). Se hace una sola vez: sigue los pasos de "Compartir con otra persona" en el README del proyecto.'));
    }
    const code = Store.getMeta().household;
    if (code) {
      const link = Sync.inviteLink(code);
      return section(
        h('p', { class: 'muted small' }, 'Este móvil está en un espacio compartido. Todo lo que cambiéis cualquiera de los dos aparece en el otro móvil al momento.'),
        h('div', { class: 'share-code' },
          h('span', { class: 'muted small' }, 'Código'),
          h('strong', { class: 'code' }, Sync.formatCode(code))),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => shareInvite(link) }, 'Invitar a alguien'),
          h('button', { class: 'btn', onclick: () => copyText(Sync.formatCode(code), 'Código copiado') }, 'Copiar código'),
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'btn danger', onclick: async () => {
              if (!await ask('Este móvil dejará de recibir los cambios del espacio compartido. Se queda con una copia de los datos actuales.', 'Dejar de compartir', true)) return;
              Store.disconnect();
              Store.setMeta({ household: null });
              setSync('local');
              render();
              toast('Has salido del espacio compartido');
            }
          }, 'Dejar de compartir')));
    }
    const codeIn = h('input', { type: 'text', id: 'join-code', placeholder: 'Código o enlace de invitación', autocomplete: 'off', autocapitalize: 'characters' });
    return section(
      h('p', { class: 'muted small' }, 'Crea un espacio compartido y envía la invitación a la otra persona. Los dos veréis y editaréis el mismo planning, las recetas y la lista de la compra.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: createSpace }, 'Crear espacio compartido')),
      h('p', { class: 'muted small join-label' }, '¿Te han invitado? Escribe aquí el código o pega el enlace:'),
      h('form', {
        class: 'row', onsubmit: (e) => { e.preventDefault(); joinSpace(codeIn.value); }
      }, codeIn, h('button', { class: 'btn', type: 'submit' }, 'Unirme')));
  }

  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) {
      const area = h('textarea', { rows: 3, readonly: true }, text);
      openModal('Copia el texto', area);
      area.select();
    }
  }

  async function shareInvite(link) {
    const text = `Únete a nuestro planning de comidas. Abre este enlace o, en la app, ve a Ajustes → Compartir y pega este código: ${Sync.formatCode(Store.getMeta().household)}\n${link}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Planning de comidas', text }); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    copyText(text, 'Invitación copiada: pégala en WhatsApp');
  }

  async function createSpace() {
    const code = Sync.newCode();
    try {
      setSync('connecting');
      await startShared(code, { initial: state });
      Store.setMeta({ household: code });
      render();
      toast('Espacio creado. Ahora invita a la otra persona.');
    } catch (e) {
      setSync('local');
      toast(e && e.code === 'offline' ? 'Sin conexión. Inténtalo con internet.' : 'No se pudo crear el espacio compartido.');
    }
  }

  async function joinSpace(text) {
    const code = Sync.cleanCode(text);
    if (!code) { toast('Ese código no es válido. Revisa que esté completo.'); return; }
    if (code === Store.getMeta().household) { toast('Ya estás en este espacio'); return; }
    try {
      setSync('connecting');
      if (!await Sync.exists(code)) { setSync(Store.getMeta().household ? 'shared' : 'local'); toast('No existe ningún espacio con ese código.'); return; }
    } catch (e) {
      setSync(Store.getMeta().household ? 'shared' : 'local');
      toast('Sin conexión. Para unirte hace falta internet.');
      return;
    }
    const hasData = countMeals() > 0 || state.recipes.length > 0;
    if (hasData && !await ask('Los datos de este móvil se sustituirán por los del espacio compartido. Se guardará una copia de los actuales por si acaso.', 'Unirme', true)) {
      setSync(Store.getMeta().household ? 'shared' : 'local');
      return;
    }
    Store.backupLocal('antes-de-unirse');
    Store.setMeta({ household: code });
    await startShared(code, {});
    if (location.hash.startsWith('#unirse=')) history.replaceState(null, '', location.pathname);
    view = 'week';
    render();
    toast('¡Listo! Ya compartís el planning.');
  }

  async function startShared(code, opts) {
    const db = await Sync.open(code);
    Store.connect(db, {
      ...opts,
      onRemote: (next) => applyRemote(next),
      onError: (e) => toast(e && e.code === 'permission-denied' ? 'El servidor ha rechazado el cambio. Revisa las reglas de Firebase.' : 'No se pudo sincronizar el último cambio. Se reintentará con conexión.'),
      onStatus: (st) => setSync(st === 'pending' ? 'pending' : 'shared')
    });
    setSync('shared');
  }

  // Indicador de sincronización en la barra superior.
  function setSync(mode) {
    const el = document.getElementById('sync-status');
    if (mode === 'pending' || mode === 'connecting') {
      if (syncMode === 'local') syncMode = 'shared';
    } else {
      syncMode = mode;
    }
    if (!el) return;
    const labels = { shared: 'Compartido', pending: navigator.onLine ? 'Enviando…' : 'Sin conexión', connecting: 'Conectando…' };
    el.hidden = !labels[mode];
    el.textContent = labels[mode] || '';
    el.dataset.state = mode;
  }
  window.addEventListener('online', () => { if (syncMode === 'shared') setSync('shared'); });

  async function exportData() {
    const json = JSON.stringify(state, null, 2);
    const filename = `planificador-comidas-${L.toISO(new Date())}.json`;
    if (window.top !== window) {
      const downloads = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
      if (downloads) {
        try { await downloads.save({ filename, data: json }); backupDone(); } catch (e) { if (e && e.code !== 'declined') toast('No se pudo guardar el archivo.'); }
        return;
      }
      const area = h('textarea', { rows: 14, readonly: true }, json);
      openModal('Copia de seguridad', h('div', {}, h('p', { class: 'muted small' }, 'Copia este texto y guárdalo en un archivo .json.'), area));
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    // En el móvil, compartir el archivo permite guardarlo en Drive, Archivos, WhatsApp…
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Copia de Planning de comidas' });
        backupDone();
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a); a.click(); a.remove();
    backupDone();
  }

  function backupDone() {
    Store.setMeta({ lastBackup: L.toISO(new Date()), snoozeUntil: null });
    toast('Copia de seguridad guardada');
    render();
  }

  // ---------- arranque ----------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); window.scrollTo(0, 0); }));
  document.getElementById('week-prev').addEventListener('click', () => { weekKey = L.addDays(weekKey, -7); render(); });
  document.getElementById('week-next').addEventListener('click', () => { weekKey = L.addDays(weekKey, 7); render(); });
  document.getElementById('week-today').addEventListener('click', () => { weekKey = L.weekStart(new Date()); render(); });

  let storagePersisted = null;
  render();

  Store.persist().then((ok) => { storagePersisted = ok; if (view === 'settings') render(); });

  const household = Store.getMeta().household;
  if (inArtifact || !Sync) {
    Store.connectClaude({
      onRemote: (next) => { syncMode = 'claude'; applyRemote(next); },
      onError: (e) => toast(e && e.code === 'quota_exceeded' ? 'No queda espacio para guardar más datos.' : 'No se pudo guardar el último cambio. Revisa la conexión.')
    }).then((ok) => { if (ok) { syncMode = 'claude'; if (view === 'settings') render(); } });
  } else if (household && Sync.isConfigured()) {
    setSync('connecting');
    startShared(household, {}).catch(() => setSync('pending'));
  }

  // Enlace de invitación: #unirse=CODIGO
  if (location.hash.startsWith('#unirse=') && Sync && Sync.isConfigured() && !inArtifact) {
    view = 'settings';
    render();
    joinSpace(location.hash);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && window.top === window) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !Store.getMeta().updatedFrom) toast('App actualizada. Tus datos siguen aquí.');
    });
    // Enlace directo para actualizar: …/APP/#actualizar
    const updateFromLink = () => {
      if (location.hash !== '#actualizar') return false;
      history.replaceState(null, '', location.pathname);
      checkForUpdate().then((v) => {
        if (v) updateNow();
        else if (v === undefined) toast('Sin conexión. Inténtalo con internet.');
        else toast('Ya tienes la última versión');
      });
      return true;
    };
    window.addEventListener('hashchange', updateFromLink);
    if (!updateFromLink()) {
      // Busca versión nueva al abrir la app y al volver a ella (como mucho una vez por minuto).
      setTimeout(checkForUpdate, 1500);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60000) checkForUpdate();
    });
  }

  const updatedFrom = Store.getMeta().updatedFrom;
  if (updatedFrom) {
    Store.setMeta({ updatedFrom: null });
    toast(updatedFrom < currentVersion ? `App actualizada a la versión ${currentVersion}. Tus datos siguen aquí.` : 'App recargada. Ya tienes la última versión.');
  }
})();

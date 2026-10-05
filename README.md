# 🥗 Planning de comidas

App web (instalable en el móvil y usable sin conexión) para organizar las comidas de la semana y hacer la compra.

## Qué hace

- **Planning semanal**: cada día tiene sus comidas (por defecto *Comida* y *Cena*; se cambian en Ajustes). Puedes moverte entre semanas.
- **Lista de la compra por comida**: al añadir una comida escribes sus ingredientes, marcas **"Tengo"** lo que ya hay en casa y eliges el **supermercado** de cada uno. La tarjeta del día muestra lo que falta con el súper al lado.
- **Lista de la compra general**: une todo lo que falta de la semana, **agrupado por supermercado**, suma cantidades iguales (`300 g` + `500 g` → `800 g`) e indica para qué comida es cada cosa. Puedes **añadir artículos a mano**, tacharlos al comprar y compartir/copiar la lista (p. ej. por WhatsApp).
- **💡 Ideas** para cuando no sabes qué comer:
  - **De tu historial**: platos que ya has comido otras semanas, primero los que hace más tiempo que no comes.
  - **Recetas nuevas**: de tus recetas sin probar y de un recetario incluido (~35 recetas).
  - En ambos casos **se excluyen los platos que llevan algún alimento que ya comes esa semana** (p. ej. si el lunes hay pollo, no te propone nada con pollo). Los básicos (sal, aceite, cebolla, ajo…) no cuentan; la lista es editable en Ajustes.
- **Recetas**: se guardan solas al planificar y se pueden editar. Al escribir el nombre de una receta conocida se cargan sus ingredientes.
- **Memoria de supermercado**: recuerda en qué súper compras cada ingrediente.
- **Despensa** ("Siempre tengo en casa"): esos ingredientes se marcan como "Tengo" automáticamente.
- **Copia de seguridad**: exportar/importar los datos en JSON (los datos se guardan en el navegador del dispositivo).

## Usarla

No necesita instalar nada ni compilar. Sirve la carpeta con cualquier servidor estático:

```bash
npm start            # o: python3 -m http.server 8080
```

y abre <http://localhost:8080>. También funciona abriendo `index.html` directamente (sin modo offline).

Para tenerla en el móvil, publícala con **GitHub Pages** (Settings → Pages → rama `main`, carpeta `/`), ábrela en el móvil y elige *"Añadir a pantalla de inicio"*.

## Tests

```bash
npm test
```

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html`, `styles.css` | Interfaz |
| `js/logic.js` | Lógica pura: lista de la compra, historial y sugerencias |
| `js/catalog.js` | Recetario incluido |
| `js/store.js` | Guardado en `localStorage` |
| `js/app.js` | Pantallas y eventos |
| `sw.js`, `manifest.json` | Modo offline e instalación (PWA) |

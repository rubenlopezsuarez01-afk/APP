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

## Actualizar sin perder datos

**No hace falta desinstalar ni reinstalar la app para actualizarla.** Los datos se guardan en el almacenamiento del navegador ligado a la dirección de la app, y una actualización solo cambia los archivos de la app.

1. Sube los cambios a la rama que publica GitHub Pages.
2. En `sw.js`, sube el número de `CACHE` (`v2` → `v3`…) para que el móvil descargue los archivos nuevos y borre los viejos.
3. Abre la app en el móvil con conexión: cargará la versión nueva y verás el aviso "App actualizada. Tus datos siguen aquí". Si no aparece, ciérrala del todo y ábrela otra vez.

Los datos **sí se pierden** si:

- **Desinstalas la app** de la pantalla de inicio (en iPhone siempre; en Android, si eliges borrar los datos).
- **Cambias la dirección** donde está publicada (otro dominio u otra ruta = almacenamiento nuevo y vacío).
- Borras los datos de navegación del navegador.

Para esos casos están las **copias de seguridad**: en *Ajustes → Copia de seguridad → Exportar* (en el móvil se puede guardar directamente en Drive, Archivos o enviar por WhatsApp) y luego *Importar* en la app nueva. La app avisa en la pantalla de la semana si hace más de 14 días que no haces una copia, y pide al navegador que no borre sus datos automáticamente.

Para desarrolladores: la clave de `localStorage` (`planificador-comidas-v1`) no debe cambiar. Si algún día cambia la forma de los datos, sube `DATA_VERSION` en `js/store.js` y añade la conversión en `upgrade()`; antes de convertir se guarda una copia intacta de los datos antiguos.

## Como artefacto de Claude

`npm run build` genera `artifact/planning-comidas.html`, la app en un solo archivo lista para publicarse como artefacto de Claude. Ahí los datos se guardan en la base de datos del artefacto (capacidad `db`), así que se ven igual en el móvil y en el ordenador. Fuera de Claude la app sigue usando el almacenamiento del navegador.

Artefacto publicado: <https://claude.ai/artifact/Di5SGVsvtf1mGoe9LwgpAX>

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
| `js/store.js` | Guardado en `localStorage` o en la base de datos del artefacto |
| `js/app.js` | Pantallas y eventos |
| `sw.js`, `manifest.json` | Modo offline e instalación (PWA) |
| `scripts/build-artifact.js` | Genera el HTML único del artefacto |

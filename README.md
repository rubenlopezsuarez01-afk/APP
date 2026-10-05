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

### Instalarla en el móvil

1. Publícala con **GitHub Pages**: *Settings → Pages → Build and deployment → Source: Deploy from a branch*, elige la rama de la app y la carpeta `/ (root)`, y pulsa *Save*. En uno o dos minutos estará en `https://<usuario>.github.io/APP/`.
2. Abre esa dirección en el móvil:
   - **Android (Chrome):** menú ⋮ → *Instalar aplicación* (o *Añadir a pantalla de inicio*).
   - **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.
3. Se abre a pantalla completa desde su icono y funciona sin conexión.

## Compartir con otra persona

Dos móviles (o más) pueden usar el mismo planning: lo que uno añade, cambia o tacha en la lista aparece en el otro en un par de segundos. Funciona sin conexión: los cambios se envían al volver la cobertura. Los datos se guardan en **Firebase** (de Google), gratis para este uso.

### 1. Crear el proyecto de Firebase (una sola vez, unos 10 minutos)

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google y pulsa **Crear proyecto** (por ejemplo, `planning-comidas`). Google Analytics no hace falta.
2. En el menú, **Compilación → Firestore Database → Crear base de datos**. Elige una ubicación en Europa (por ejemplo `eur3`) y el **modo de producción**.
3. En la pestaña **Reglas** de Firestore, borra lo que haya, pega el contenido del archivo [`firestore.rules`](firestore.rules) y pulsa **Publicar**.
4. Ve a **Configuración del proyecto** (rueda dentada) → **Tus apps** → icono web **`</>`**. Ponle un nombre y registra la app (Firebase Hosting no hace falta).
5. Copia el objeto `firebaseConfig` que aparece y pégalo en [`js/firebase-config.js`](js/firebase-config.js), así:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

   Estos datos no son secretos (van en la página web de todas formas); lo que protege la información son las reglas del paso 3.
6. Sube el cambio a GitHub (y sube el número de `CACHE` en `sw.js`).

### 2. Conectar los móviles

1. **Tu móvil:** *Ajustes → Compartir con otra persona → Crear espacio compartido*. Lo que ya tengas se sube al espacio. Pulsa **Invitar a alguien** y envía la invitación por WhatsApp.
2. **El otro móvil:** instala la app, abre *Ajustes → Compartir con otra persona*, pega el código (o el enlace entero) y pulsa **Unirme**. También vale abrir el enlace de la invitación.
   - En **iPhone**, la app instalada en la pantalla de inicio guarda sus datos aparte de Safari: únete **desde la app instalada** pegando el código.
3. Arriba aparece **Compartido**. Si pone **Sin conexión**, los cambios se enviarán solos al volver la cobertura.

Quien tenga el código puede ver y cambiar el planning, así que compártelo solo con quien quieras. *Dejar de compartir* desconecta ese móvil (se queda con una copia de los datos).

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
| `js/store.js` | Guardado en `localStorage` y sincronización (Firebase o base de datos del artefacto) |
| `js/sync-firebase.js`, `js/firebase-config.js`, `firestore.rules` | Espacio compartido entre móviles |
| `js/app.js` | Pantallas y eventos |
| `sw.js`, `manifest.json` | Modo offline e instalación (PWA) |
| `scripts/build-artifact.js` | Genera el HTML único del artefacto |

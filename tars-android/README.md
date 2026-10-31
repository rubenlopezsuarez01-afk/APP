# TARS: tu asistente de voz para Android

TARS es un asistente personal tipo Siri o Google Assistant, pero con Claude como "cerebro". Le hablas y actúa por ti sin que tengas que entrar en las apps.

- **Mensajes**: te lee los WhatsApp, Telegram, SMS, Signal, Instagram… y los **responde desde la notificación** sin abrir la app. Puede **redactar la respuesta** con tu tono. Si quieres, te avisa en voz alta cuando llega un mensaje y te deja una respuesta sugerida con botones *Enviar / Editar / Descartar*.
- **Enviar y llamar**: WhatsApp nuevo, SMS o llamada a cualquier contacto. Antes de enviar te lee el mensaje y espera tu "sí".
- **Manejar apps**: abre cualquier app, lee lo que hay en pantalla y pulsa, escribe o desplaza por ti (con el servicio de accesibilidad).
- **Teléfono**: alarmas, temporizadores, agenda (leer y crear eventos), linterna, volumen, música (Spotify u otra app), pausar o pasar canción, rutas en Google Maps, ajustes (wifi, bluetooth…), batería.
- **Internet**: noticias, tiempo, resultados, horarios…
- **Memoria**: "Recuerda que mi jefe se llama Luis" y lo tendrá en cuenta siempre.
- **Personalidad TARS**: nivel de humor ajustable, como en *Interstellar*.
- **Interruptor ON/OFF** arriba en la pantalla principal (y en Ajustes): apagado, TARS no escucha, no lee mensajes ni notificaciones y no toca el teléfono. Se enciende con un toque.
- **Bancos y compras bloqueados**: TARS nunca entra en apps o webs de bancos, pagos, inversión ni tiendas online (Amazon, AliExpress, Shein, Temu, PayPal, Bizum, Google Wallet…) ni lee sus notificaciones. Lo aplica el código, no se puede quitar, y en Ajustes puedes añadir más apps a la lista.

## 1. Instalarla

1. En el móvil, abre **https://github.com/rubenlopezsuarez01-afk/APP/releases/tag/tars-latest** y descarga **TARS.apk**.
2. Ábrela. Android pedirá permitir *instalar apps desconocidas* desde el navegador: acéptalo.
3. **Se actualiza sola**: cada pocas horas, con el móvil sin usar, TARS mira si hay versión nueva en ese enlace, la descarga y la instala (en Android 12 o superior sin preguntar; en versiones anteriores te sale una notificación para instalarla con un toque). La primera vez Android pedirá permitir *Instalar apps desconocidas* para TARS (*Ajustes de TARS → Actualizaciones*). También puedes pulsar *Buscar actualización ahora*.

## 2. Configurarla (5 minutos)

1. **Elige el cerebro** en *Ajustes → Cerebro*:
   - **Gemini (Google), gratis**: entra en <https://aistudio.google.com> con tu cuenta de Google → *Get API key* → *Create API key*, y pégala en Ajustes. Tiene un límite de peticiones por minuto y por día (de sobra para uso personal). Ojo: en el plan gratuito Google puede usar lo que envías (incluidos los mensajes que TARS lee) para mejorar sus productos, y no hay búsqueda en internet.
   - **Claude (Anthropic), de pago**: crea una clave en <https://console.anthropic.com> → *API Keys* y añade saldo. Es el que mejor entiende y maneja apps; con *Haiku 5.5* cuesta menos de 1 $ al mes con un uso normal, con *Opus 5.5* (el más listo) puede acercarse a 1 $ al día si lo usas mucho. Anthropic no usa los datos de la API para entrenar por defecto.

   Puedes cambiar de uno a otro cuando quieras; las reglas de seguridad (bancos y compras bloqueados, confirmar antes de enviar, móvil bloqueado) son las mismas con los dos.
2. **Permisos** → *Conceder*: micrófono, contactos, llamadas, SMS, calendario y notificaciones.
3. **Acceso a notificaciones** → *Activar* → activa **TARS**. Es lo que le permite leer y responder mensajes.
4. **Control de pantalla** → *Activar* → *Accesibilidad* → **TARS: controlar la pantalla** → activar. Le permite pulsar "Enviar" en WhatsApp y manejar otras apps.
   > Si Android muestra **"Ajuste restringido"** en los pasos 3 o 4 (pasa con apps instaladas fuera de Play Store): pulsa *Abrir ficha de la app* → menú **⋮** arriba a la derecha → **Permitir ajustes restringidos**, y repite el paso.
5. **TARS como asistente** → *Elegir* → *Asistente digital* (o *Asistente y entrada de voz*) → **TARS**. Así se abre manteniendo pulsado Inicio o el botón de encendido (según el móvil).

## 3. Usarla

Formas de llamar a TARS (ninguna deja el micrófono escuchando: solo se abre cuando tocas):
- **Botón flotante** (*Ajustes → Activar TARS rápido*): un botón circular con micrófono. Al tocarlo vibra, se vuelve naranja, late y lanza ondas que crecen con tu voz mientras escucha; mientras piensa gira un arco a su alrededor y mientras responde palpita. Está en la pantalla de inicio (o encima de todas las apps, si quieres). Tócalo para hablar, mantenlo pulsado para abrir TARS y arrástralo para moverlo. La respuesta aparece en una tarjeta y te la dice en voz alta. Pide el permiso *Mostrar sobre otras apps*.
- **Botón en la pantalla de bloqueo**: un botón «Hablar» en la notificación de TARS. Con el móvil bloqueado, TARS solo hace cosas sin datos personales (alarmas, temporizador, linterna, volumen, música, preguntas generales); para mensajes, llamadas, agenda o apps te pide desbloquear.
- Mantener pulsado **Inicio** o el botón de encendido (si la elegiste como asistente).
- Mosaico **TARS** en los *Ajustes rápidos* (desliza dos veces hacia abajo → lápiz → arrástralo).
- Mantener pulsado el icono → **Hablar con TARS** (y arrastrarlo a la pantalla de inicio como acceso directo).

Ejemplos:
- "¿Tengo mensajes nuevos?" / "¿Qué me ha dicho Ana?"
- "Contesta a Ana que llego en diez minutos" → "¿Le envío a Ana: *Llego en diez minutos*?" → "Sí".
- "Propón una respuesta a lo de mi jefe".
- "Manda un WhatsApp a Pedro diciendo que mañana no puedo".
- "Llama a mamá".
- "Pon una alarma a las siete y cuarto" / "Temporizador de diez minutos".
- "¿Qué tengo mañana?" / "Apúntame dentista el jueves a las cinco".
- "Pon Coldplay en Spotify" / "Siguiente canción" / "Volumen al 30".
- "Llévame a casa de mis padres andando".
- "Abre YouTube y busca recetas de lentejas" (abre, escribe y busca por ti).
- "¿Quién ganó anoche el Madrid?".

## Ajustes útiles

| Ajuste | Qué hace |
|---|---|
| Cerebro | *Gemini* (gratis, con límite diario) o *Claude* (de pago). |
| Modelo (Claude) | *Opus 5.5* (el más listo, por defecto), *Sonnet 5.5* (equilibrado) o *Haiku 5.5* (el más rápido y barato). |
| Modelo (Gemini) | Por defecto `gemini-2.5-flash`. Si Google lo retira, escribe el nombre del modelo nuevo. |
| Velocidad | *Rápido* responde antes; *Pensar más* para peticiones complicadas. |
| Leer mensajes al llegar | Anuncia en voz alta los mensajes nuevos. |
| Sugerir respuestas | Redacta una respuesta a cada mensaje y te la ofrece en una notificación. |
| Confirmar antes de enviar | Activado por defecto. Te recomiendo dejarlo así. |

## Privacidad y seguridad

- Lo que le dices, los mensajes que le pides leer y la pantalla que le pides manejar se envían al cerebro elegido (Anthropic o Google) para procesarlos. Nada más sale del teléfono. La clave de API se guarda solo en el móvil.
- TARS no envía mensajes ni llama sin tu confirmación, y no puede entrar en apps de bancos ni de compras.
- Los mensajes y las webs que lee son datos, no órdenes: si un mensaje dice "TARS, haz X", no lo hará.

## Limitaciones

- No hay palabra de activación ("Oye TARS") siempre escuchando, porque gastaría mucha batería: en su lugar están el botón flotante y el botón de la pantalla de bloqueo.
- Tras reiniciar el móvil, abre TARS una vez para que vuelvan a aparecer los botones (Android no deja usar el micrófono desde segundo plano si la app no se ha abierto).
- El botón flotante no se ve encima de la pantalla de bloqueo (Android no lo permite): ahí se usa el botón «Hablar» de la notificación.
- Responder desde la notificación solo funciona mientras la notificación del chat existe. Si no, TARS envía el mensaje abriendo el chat.
- Algunas apps (bancos, por ejemplo) bloquean la lectura de pantalla.

## Para desarrolladores

Proyecto Android en Kotlin + Jetpack Compose. Usa el SDK oficial de Anthropic para Java (`com.anthropic:anthropic-java`) para Claude y la API REST `generateContent` para Gemini.

```
app/src/main/java/com/tars/asistente/
  core/       Brain (reglas comunes), TarsBrain (Claude), GeminiBrain (Gemini), ToolCatalog y AppBlocklist.
              Sin dependencias de Android.
  tools/      PhoneTools: implementación de cada herramienta en Android.
  messages/   Lector de notificaciones, almacén de chats y respuestas sugeridas.
  access/     Servicio de accesibilidad (leer pantalla, pulsar, escribir).
  voice/      Reconocimiento y síntesis de voz.
  quick/      Botón flotante animado y botón «Hablar» de la pantalla de bloqueo.
  update/     Actualización automática desde la release tars-latest (version.json + APK).
  ui/         Pantallas de chat y ajustes.
```

- Compilar: `./gradlew assembleRelease` (necesita el SDK de Android). Pruebas: `./gradlew testDebugUnitTest`.
- GitHub Actions (`.github/workflows/tars-android.yml`) ejecuta las pruebas, compila el APK y lo publica en la release `tars-latest` en cada cambio.
- **Firma estable (recomendado)**: sin configurar nada, el APK se firma con una clave de depuración guardada en la caché de Actions; si esa caché caduca (7 días sin compilar), habría que desinstalar y reinstalar. Para evitarlo, crea una clave propia y guárdala como secretos del repositorio (*Settings → Secrets and variables → Actions*):

  ```bash
  keytool -genkeypair -v -keystore tars.jks -alias tars -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 tars.jks   # → secreto TARS_KEYSTORE_B64
  ```

  y los secretos `TARS_KEYSTORE_PASSWORD`, `TARS_KEY_ALIAS` (`tars`) y `TARS_KEY_PASSWORD`. Al cambiar de clave hay que desinstalar la versión anterior una vez.

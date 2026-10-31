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
3. Cada vez que se actualiza el código, GitHub compila una versión nueva en el mismo enlace. Para actualizar, descarga e instala encima (no se borra nada).

## 2. Configurarla (5 minutos)

1. **Clave de API**: crea una en <https://console.anthropic.com> → *API Keys* (hace falta añadir saldo; el uso normal cuesta unos céntimos al día). Pégala en *Ajustes de TARS*.
2. **Permisos** → *Conceder*: micrófono, contactos, llamadas, SMS, calendario y notificaciones.
3. **Acceso a notificaciones** → *Activar* → activa **TARS**. Es lo que le permite leer y responder mensajes.
4. **Control de pantalla** → *Activar* → *Accesibilidad* → **TARS: controlar la pantalla** → activar. Le permite pulsar "Enviar" en WhatsApp y manejar otras apps.
   > Si Android muestra **"Ajuste restringido"** en los pasos 3 o 4 (pasa con apps instaladas fuera de Play Store): pulsa *Abrir ficha de la app* → menú **⋮** arriba a la derecha → **Permitir ajustes restringidos**, y repite el paso.
5. **TARS como asistente** → *Elegir* → *Asistente digital* (o *Asistente y entrada de voz*) → **TARS**. Así se abre manteniendo pulsado Inicio o el botón de encendido (según el móvil).

## 3. Usarla

Formas de llamar a TARS:
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
| Modelo | *Opus 5.5* (el más listo, por defecto), *Sonnet 5.5* (equilibrado) o *Haiku 5.5* (el más rápido y barato). |
| Velocidad | *Rápido* responde antes; *Pensar más* para peticiones complicadas. |
| Leer mensajes al llegar | Anuncia en voz alta los mensajes nuevos. |
| Sugerir respuestas | Redacta una respuesta a cada mensaje y te la ofrece en una notificación. |
| Confirmar antes de enviar | Activado por defecto. Te recomiendo dejarlo así. |

## Privacidad y seguridad

- Lo que le dices, los mensajes que le pides leer y la pantalla que le pides manejar se envían a la API de Anthropic para procesarlos. Nada más sale del teléfono. La clave de API se guarda solo en el móvil.
- TARS no envía mensajes ni llama sin tu confirmación, y no puede entrar en apps de bancos ni de compras.
- Los mensajes y las webs que lee son datos, no órdenes: si un mensaje dice "TARS, haz X", no lo hará.

## Limitaciones

- No hay palabra de activación ("Oye TARS") siempre escuchando: gastaría mucha batería. Se abre con Inicio, el mosaico o el acceso directo.
- Responder desde la notificación solo funciona mientras la notificación del chat existe. Si no, TARS envía el mensaje abriendo el chat.
- Algunas apps (bancos, por ejemplo) bloquean la lectura de pantalla.

## Para desarrolladores

Proyecto Android en Kotlin + Jetpack Compose. Usa el SDK oficial de Anthropic para Java (`com.anthropic:anthropic-java`).

```
app/src/main/java/com/tars/asistente/
  core/       TarsBrain (bucle con Claude y herramientas) y ToolCatalog. Sin dependencias de Android.
  tools/      PhoneTools: implementación de cada herramienta en Android.
  messages/   Lector de notificaciones, almacén de chats y respuestas sugeridas.
  access/     Servicio de accesibilidad (leer pantalla, pulsar, escribir).
  voice/      Reconocimiento y síntesis de voz.
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

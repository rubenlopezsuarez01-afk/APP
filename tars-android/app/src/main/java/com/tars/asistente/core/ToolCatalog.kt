package com.tars.asistente.core

import com.anthropic.core.JsonValue
import com.anthropic.models.messages.Tool

/**
 * Herramientas que TARS puede usar en el teléfono. Las define el cerebro (Claude)
 * y las ejecuta [ToolExecutor] en Android. Sin dependencias de Android para poder
 * compilarlas y probarlas en la JVM.
 */
object ToolCatalog {

    private fun str(description: String, enum: List<String>? = null): Map<String, Any> =
        buildMap {
            put("type", "string")
            put("description", description)
            if (enum != null) put("enum", enum)
        }

    private fun int(description: String) = mapOf("type" to "integer", "description" to description)
    private fun bool(description: String) = mapOf("type" to "boolean", "description" to description)

    private const val CONFIRMED =
        "true solo si el usuario ya ha confirmado explícitamente este envío/acción con este texto exacto."

    /** Definición de una herramienta, independiente del proveedor (Claude o Gemini). */
    data class ToolSpec(
        val name: String,
        val description: String,
        val properties: Map<String, Map<String, Any>>,
        val required: List<String>,
    ) {
        fun toAnthropic(): Tool {
            val props = Tool.InputSchema.Properties.builder()
            properties.forEach { (key, schema) -> props.putAdditionalProperty(key, JsonValue.from(schema)) }
            return Tool.builder()
                .name(name)
                .description(description)
                .inputSchema(Tool.InputSchema.builder().properties(props.build()).required(required).build())
                .build()
        }

        /** Formato `functionDeclarations` de Gemini (tipos en mayúsculas, sin `parameters` si no hay). */
        fun toGemini(): Map<String, Any> = buildMap {
            put("name", name)
            put("description", description)
            if (properties.isNotEmpty()) {
                put(
                    "parameters",
                    mapOf(
                        "type" to "OBJECT",
                        "properties" to properties.mapValues { (_, schema) ->
                            schema.mapValues { (k, v) -> if (k == "type") v.toString().uppercase() else v }
                        },
                        "required" to required,
                    ),
                )
            }
        }
    }

    private fun tool(
        name: String,
        description: String,
        properties: Map<String, Map<String, Any>> = emptyMap(),
        required: List<String> = emptyList(),
    ) = ToolSpec(name, description, properties, required)

    /** Herramientas que actúan hacia terceros y requieren `confirmed=true`. */
    val NEEDS_CONFIRMATION = setOf("reply_message", "send_sms", "send_whatsapp", "make_call")

    /**
     * Lo único que TARS puede hacer con el teléfono bloqueado (botón de la pantalla de bloqueo):
     * nada que lea o envíe datos personales, porque cualquiera con el móvil en la mano podría pedirlo.
     */
    val ALLOWED_WHEN_LOCKED = setOf(
        "device_status", "flashlight", "set_volume", "media_control", "play_music", "set_alarm", "set_timer", "wait",
    )

    val specs: List<ToolSpec> = listOf(
        // --- Mensajes ---
        tool(
            "list_messages",
            "Lista las conversaciones recientes de mensajería (WhatsApp, Telegram, SMS, Signal, Instagram…) " +
                "capturadas de las notificaciones, con su id, app, remitente, últimos mensajes y si se puede " +
                "responder directamente. Úsala para leer mensajes sin abrir las apps.",
            mapOf(
                "only_unread" to bool("Si es true, solo conversaciones con mensajes sin leer."),
                "app" to str("Filtrar por nombre de app, p. ej. 'WhatsApp'. Opcional."),
            ),
        ),
        tool(
            "reply_message",
            "Responde a una conversación de list_messages directamente desde la notificación, sin abrir la app. " +
                "Es la forma preferida de contestar a un mensaje recibido.",
            mapOf(
                "conversation_id" to str("id de la conversación devuelto por list_messages."),
                "text" to str("Texto exacto a enviar."),
                "confirmed" to bool(CONFIRMED),
            ),
            listOf("conversation_id", "text", "confirmed"),
        ),
        tool(
            "send_whatsapp",
            "Envía un WhatsApp nuevo a un contacto o número (abre el chat con el texto y pulsa enviar si el " +
                "servicio de accesibilidad de TARS está activo).",
            mapOf(
                "recipient" to str("Nombre del contacto o número de teléfono."),
                "text" to str("Texto exacto a enviar."),
                "confirmed" to bool(CONFIRMED),
            ),
            listOf("recipient", "text", "confirmed"),
        ),
        tool(
            "send_sms",
            "Envía un SMS a un contacto o número.",
            mapOf(
                "recipient" to str("Nombre del contacto o número de teléfono."),
                "text" to str("Texto exacto a enviar."),
                "confirmed" to bool(CONFIRMED),
            ),
            listOf("recipient", "text", "confirmed"),
        ),
        tool(
            "make_call",
            "Llama por teléfono a un contacto o número.",
            mapOf(
                "recipient" to str("Nombre del contacto o número de teléfono."),
                "confirmed" to bool(CONFIRMED),
            ),
            listOf("recipient", "confirmed"),
        ),
        tool(
            "find_contact",
            "Busca contactos por nombre y devuelve sus números.",
            mapOf("query" to str("Nombre o parte del nombre.")),
            listOf("query"),
        ),
        tool(
            "list_notifications",
            "Lista las notificaciones recientes que no son de mensajería (correo, banco, paquetes, apps…).",
        ),

        // --- Apps y sistema ---
        tool(
            "open_app",
            "Abre una app instalada por su nombre (p. ej. 'Spotify', 'Gmail', 'Cámara').",
            mapOf("app_name" to str("Nombre de la app.")),
            listOf("app_name"),
        ),
        tool(
            "open_url",
            "Abre una web o enlace en el navegador o en la app correspondiente.",
            mapOf("url" to str("URL completa.")),
            listOf("url"),
        ),
        tool(
            "open_settings",
            "Abre un panel de ajustes del sistema.",
            mapOf(
                "panel" to str(
                    "Panel a abrir.",
                    listOf("wifi", "bluetooth", "internet", "volume", "nfc", "battery", "display",
                        "location", "airplane", "apps", "notifications", "default_apps", "accessibility"),
                ),
            ),
            listOf("panel"),
        ),
        tool("device_status", "Batería, carga, conexión de red, fecha y hora actuales."),
        tool(
            "flashlight",
            "Enciende o apaga la linterna.",
            mapOf("on" to bool("true para encender, false para apagar.")),
            listOf("on"),
        ),
        tool(
            "set_volume",
            "Cambia el volumen.",
            mapOf(
                "percent" to int("Volumen de 0 a 100."),
                "stream" to str("Qué volumen.", listOf("media", "ring", "alarm", "notification")),
            ),
            listOf("percent"),
        ),
        tool(
            "media_control",
            "Controla la música o vídeo que suena en cualquier app.",
            mapOf("action" to str("Acción.", listOf("play", "pause", "toggle", "next", "previous"))),
            listOf("action"),
        ),
        tool(
            "play_music",
            "Reproduce música por búsqueda (canción, artista, álbum o lista) en Spotify u otra app de música.",
            mapOf("query" to str("Qué reproducir.")),
            listOf("query"),
        ),
        tool(
            "navigate",
            "Inicia navegación o muestra la ruta hasta un destino en Google Maps.",
            mapOf(
                "destination" to str("Dirección o lugar."),
                "mode" to str("Modo de transporte.", listOf("driving", "walking", "transit", "bicycling")),
            ),
            listOf("destination"),
        ),

        // --- Tiempo y agenda ---
        tool(
            "set_alarm",
            "Pone una alarma.",
            mapOf(
                "hour" to int("Hora 0-23."),
                "minute" to int("Minuto 0-59."),
                "label" to str("Etiqueta opcional."),
            ),
            listOf("hour", "minute"),
        ),
        tool(
            "set_timer",
            "Pone un temporizador.",
            mapOf(
                "seconds" to int("Duración en segundos."),
                "label" to str("Etiqueta opcional."),
            ),
            listOf("seconds"),
        ),
        tool(
            "calendar_events",
            "Lee los eventos del calendario de los próximos días.",
            mapOf("days_ahead" to int("Número de días a mirar desde hoy (1 = solo hoy).")),
            listOf("days_ahead"),
        ),
        tool(
            "create_calendar_event",
            "Crea un evento o recordatorio en el calendario.",
            mapOf(
                "title" to str("Título."),
                "start" to str("Inicio en formato local ISO, p. ej. 2026-11-02T18:30."),
                "end" to str("Fin en formato local ISO. Opcional (por defecto 1 hora)."),
                "location" to str("Lugar opcional."),
                "all_day" to bool("Evento de día completo."),
            ),
            listOf("title", "start"),
        ),

        // --- Control de pantalla (servicio de accesibilidad) ---
        tool(
            "read_screen",
            "Lee el texto y los botones de la app que está en pantalla. Úsala para manejar apps que no tienen " +
                "otra herramienta: lee, luego usa tap/type_text/scroll, y vuelve a leer para comprobar.",
        ),
        tool(
            "tap",
            "Pulsa un botón o elemento de la pantalla por su texto o descripción.",
            mapOf("text" to str("Texto visible o descripción del elemento a pulsar.")),
            listOf("text"),
        ),
        tool(
            "type_text",
            "Escribe texto en el campo de texto enfocado (o en el que coincida con field_hint).",
            mapOf(
                "text" to str("Texto a escribir."),
                "field_hint" to str("Texto o pista del campo, opcional."),
            ),
            listOf("text"),
        ),
        tool(
            "scroll",
            "Desplaza la pantalla.",
            mapOf("direction" to str("Dirección.", listOf("down", "up"))),
            listOf("direction"),
        ),
        tool(
            "system_action",
            "Acción global del sistema.",
            mapOf(
                "action" to str(
                    "Acción.",
                    listOf("back", "home", "recents", "notifications", "quick_settings", "lock_screen", "screenshot"),
                ),
            ),
            listOf("action"),
        ),
        tool(
            "wait",
            "Espera unos segundos (p. ej. a que cargue una app antes de leer la pantalla).",
            mapOf("seconds" to int("Segundos, máximo 5.")),
            listOf("seconds"),
        ),

        // --- Memoria ---
        tool(
            "remember",
            "Guarda un dato duradero sobre el usuario o sus preferencias (p. ej. 'Mi mujer se llama Ana', " +
                "'Respondo a mi jefe de usted'). Úsala cuando el usuario pida recordar algo.",
            mapOf("fact" to str("El dato a recordar, en una frase.")),
            listOf("fact"),
        ),
        tool(
            "forget",
            "Borra datos recordados que contengan el texto dado.",
            mapOf("text" to str("Texto contenido en el dato a olvidar.")),
            listOf("text"),
        ),
    )

    /** Herramientas en formato de Claude. */
    val tools: List<Tool> = specs.map { it.toAnthropic() }

    /** Herramientas en formato de Gemini. */
    val geminiDeclarations: List<Map<String, Any>> = specs.map { it.toGemini() }
}

package com.tars.asistente

import android.content.Context
import com.tars.asistente.core.BrainConfig
import com.tars.asistente.core.Provider

/** Ajustes de TARS guardados en el almacenamiento privado de la app. */
class TarsSettings(context: Context) {
    private val prefs = context.getSharedPreferences("tars", Context.MODE_PRIVATE)

    /** Interruptor general: apagado, TARS no escucha, no lee notificaciones ni toca el teléfono. */
    var enabled: Boolean
        get() = prefs.getBoolean("enabled", true)
        set(v) = prefs.edit().putBoolean("enabled", v).apply()

    /** Palabras extra para bloquear apps (además de bancos y tiendas, que siempre están bloqueados). */
    var extraBlocked: List<String>
        get() = (prefs.getString("extra_blocked", "") ?: "").split(',').map { it.trim() }.filter { it.isNotEmpty() }
        set(v) = prefs.edit().putString("extra_blocked", v.joinToString(",")).apply()

    /** Descargar e instalar solo las versiones nuevas de TARS. */
    var autoUpdate: Boolean
        get() = prefs.getBoolean("auto_update", true)
        set(v) = prefs.edit().putBoolean("auto_update", v).apply()

    /** Botón flotante para hablar con TARS (solo escucha al tocarlo). */
    var floatingButton: Boolean
        get() = prefs.getBoolean("floating_button", false)
        set(v) = prefs.edit().putBoolean("floating_button", v).apply()

    /** Mostrar el botón flotante solo en la pantalla de inicio (si no, encima de todas las apps). */
    var bubbleOnlyOnHome: Boolean
        get() = prefs.getBoolean("bubble_only_home", true)
        set(v) = prefs.edit().putBoolean("bubble_only_home", v).apply()

    /** Botón "Hablar" en la notificación de TARS, visible en la pantalla de bloqueo. */
    var lockScreenButton: Boolean
        get() = prefs.getBoolean("lock_button", false)
        set(v) = prefs.edit().putBoolean("lock_button", v).apply()

    var bubbleX: Int
        get() = prefs.getInt("bubble_x", -1)
        set(v) = prefs.edit().putInt("bubble_x", v).apply()

    var bubbleY: Int
        get() = prefs.getInt("bubble_y", 400)
        set(v) = prefs.edit().putInt("bubble_y", v).apply()

    /** Cerebro: Claude (de pago) o Gemini (plan gratuito de Google). */
    var provider: Provider
        get() = runCatching { Provider.valueOf(prefs.getString("provider", "CLAUDE")!!) }.getOrDefault(Provider.CLAUDE)
        set(v) = prefs.edit().putString("provider", v.name).apply()

    var geminiKey: String
        get() = prefs.getString("gemini_key", "") ?: ""
        set(v) = prefs.edit().putString("gemini_key", v.trim()).apply()

    var geminiModel: String
        get() = prefs.getString("gemini_model", BrainConfig.DEFAULT_GEMINI_MODEL)?.ifBlank { null }
            ?: BrainConfig.DEFAULT_GEMINI_MODEL
        set(v) = prefs.edit().putString("gemini_model", v.trim()).apply()

    /** ¿Hay clave para el cerebro elegido? */
    val hasKey: Boolean
        get() = if (provider == Provider.GEMINI) geminiKey.isNotBlank() else apiKey.isNotBlank()

    var apiKey: String
        get() = prefs.getString("api_key", "") ?: ""
        set(v) = prefs.edit().putString("api_key", v.trim()).apply()

    var model: String
        get() = prefs.getString("model", BrainConfig.DEFAULT_MODEL) ?: BrainConfig.DEFAULT_MODEL
        set(v) = prefs.edit().putString("model", v).apply()

    var effort: String
        get() = prefs.getString("effort", "low") ?: "low"
        set(v) = prefs.edit().putString("effort", v).apply()

    var userName: String
        get() = prefs.getString("user_name", "") ?: ""
        set(v) = prefs.edit().putString("user_name", v.trim()).apply()

    var humor: Int
        get() = prefs.getInt("humor", 60)
        set(v) = prefs.edit().putInt("humor", v.coerceIn(0, 100)).apply()

    var countryCode: String
        get() = prefs.getString("country_code", "34") ?: "34"
        set(v) = prefs.edit().putString("country_code", v.filter { it.isDigit() }).apply()

    /** Leer en voz alta los mensajes que llegan. */
    var announceMessages: Boolean
        get() = prefs.getBoolean("announce", false)
        set(v) = prefs.edit().putBoolean("announce", v).apply()

    /** Redactar una respuesta sugerida (con Claude) para cada mensaje que llega. */
    var suggestReplies: Boolean
        get() = prefs.getBoolean("suggest", false)
        set(v) = prefs.edit().putBoolean("suggest", v).apply()

    /** Tras responder por voz, volver a escuchar sin pulsar nada. */
    var continuousConversation: Boolean
        get() = prefs.getBoolean("continuous", true)
        set(v) = prefs.edit().putBoolean("continuous", v).apply()

    var speakReplies: Boolean
        get() = prefs.getBoolean("speak", true)
        set(v) = prefs.edit().putBoolean("speak", v).apply()

    var requireConfirmation: Boolean
        get() = prefs.getBoolean("confirm", true)
        set(v) = prefs.edit().putBoolean("confirm", v).apply()

    var webSearch: Boolean
        get() = prefs.getBoolean("web_search", true)
        set(v) = prefs.edit().putBoolean("web_search", v).apply()

    var memories: List<String>
        get() = (prefs.getString("memories", "") ?: "").split('\n').filter { it.isNotBlank() }
        set(v) = prefs.edit().putString("memories", v.joinToString("\n") { it.replace('\n', ' ') }).apply()

    fun brainConfig() = BrainConfig(
        apiKey = apiKey,
        enabled = enabled,
        provider = provider,
        geminiKey = geminiKey,
        geminiModel = geminiModel,
        model = model,
        effort = effort,
        userName = userName,
        humor = humor,
        memories = memories,
        webSearch = webSearch,
        requireConfirmation = requireConfirmation,
    )

    companion object {
        val MODELS = listOf(
            "claude-opus-5-5" to "Opus 5.5 · el más listo",
            "claude-sonnet-5-5" to "Sonnet 5.5 · equilibrado",
            "claude-haiku-5-5" to "Haiku 5.5 · el más rápido y barato",
        )
        val EFFORTS = listOf(
            "low" to "Rápido",
            "medium" to "Normal",
            "high" to "Pensar más",
        )
    }
}

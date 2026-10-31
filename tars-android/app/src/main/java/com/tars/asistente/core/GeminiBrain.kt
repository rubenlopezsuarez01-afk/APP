package com.tars.asistente.core

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.time.LocalDateTime
import java.util.concurrent.TimeUnit

/**
 * Cerebro con Google Gemini (API de Google AI Studio, con plan gratuito).
 * Habla con la API REST `generateContent` directamente.
 */
class GeminiBrain(
    config: () -> BrainConfig,
    executor: ToolExecutor,
    now: () -> LocalDateTime = { LocalDateTime.now() },
    private val baseUrl: String = "https://generativelanguage.googleapis.com",
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build(),
) : BaseBrain<ObjectNode>(config, executor, now) {

    private val json = ObjectMapper()

    override fun keyOf(cfg: BrainConfig) = cfg.geminiKey
    override val noKeyMessage = NO_KEY_MESSAGE

    override fun userMessage(text: String): ObjectNode = content("user").also {
        it.withArray("parts").addObject().put("text", text)
    }

    override suspend fun runLoop(cfg: BrainConfig, onTool: (String) -> Unit): String {
        repeat(MAX_STEPS) {
            val body = json.createObjectNode().apply {
                set<JsonNode>("systemInstruction", content(null).also {
                    it.withArray("parts").addObject()
                        .put("text", Brains.SYSTEM_PROMPT + "\n\n" + Brains.NO_WEB_NOTE + "\n\n" + personalBlock(cfg))
                })
                set<JsonNode>("contents", json.valueToTree(history))
                set<JsonNode>("tools", json.valueToTree(listOf(mapOf("functionDeclarations" to ToolCatalog.geminiDeclarations))))
                set<JsonNode>("generationConfig", json.valueToTree(mapOf("maxOutputTokens" to 4096)))
            }
            val response = post(cfg, body)
            val candidate = response.path("candidates").path(0)
            val modelContent = candidate.path("content")
            if (candidate.isMissingNode || !modelContent.has("parts")) {
                history.clear()
                return if (response.path("promptFeedback").has("blockReason") ||
                    candidate.path("finishReason").asText() in setOf("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST")
                ) {
                    "Prefiero no hacer eso. Prueba a pedírmelo de otra forma."
                } else {
                    "No he recibido respuesta. Inténtalo de nuevo."
                }
            }
            // Se guarda la respuesta tal cual: Gemini exige recibir de vuelta sus "thoughtSignature".
            history += (modelContent.deepCopy<JsonNode>() as ObjectNode).put("role", "model")

            val parts = modelContent.path("parts")
            val calls = parts.filter { it.has("functionCall") }.map { it.path("functionCall") }
            if (calls.isEmpty()) {
                return parts.filter { it.has("text") && !it.path("thought").asBoolean(false) }
                    .joinToString("\n") { it.path("text").asText() }.trim().ifBlank { "Hecho." }
            }

            val reply = content("user")
            for (call in calls) {
                val name = call.path("name").asText()
                @Suppress("UNCHECKED_CAST")
                val args = (json.convertValue(call.path("args"), Map::class.java) as? Map<String, Any?>) ?: emptyMap()
                onTool(executor.label(name, args))
                val result = guardedExecute(cfg, name, args)
                reply.withArray("parts").addObject().putObject("functionResponse").apply {
                    if (call.has("id")) put("id", call.path("id").asText())
                    put("name", name)
                    putObject("response").put(if (result.isError) "error" else "result", result.text)
                }
            }
            history += reply
        }
        return "He necesitado demasiados pasos y he parado. ¿Lo intentamos de otra forma?"
    }

    override suspend fun draftOnce(cfg: BrainConfig, system: String, user: String): String? {
        val body = json.createObjectNode().apply {
            set<JsonNode>("systemInstruction", content(null).also { it.withArray("parts").addObject().put("text", system) })
            set<JsonNode>("contents", json.createArrayNode().add(userMessage(user)))
        }
        val parts = post(cfg, body).path("candidates").path(0).path("content").path("parts")
        return parts.filter { it.has("text") && !it.path("thought").asBoolean(false) }
            .joinToString("") { it.path("text").asText() }
    }

    private fun content(role: String?): ObjectNode = json.createObjectNode().also {
        if (role != null) it.put("role", role)
    }

    private fun post(cfg: BrainConfig, body: ObjectNode): JsonNode {
        val request = Request.Builder()
            .url("$baseUrl/v1beta/models/${cfg.geminiModel.trim()}:generateContent")
            .header("x-goog-api-key", cfg.geminiKey)
            .post(json.writeValueAsString(body).toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching { json.readTree(text).path("error").path("message").asText() }.getOrNull()
                throw GeminiException(response.code, message.orEmpty())
            }
            return json.readTree(text)
        }
    }

    class GeminiException(val code: Int, message: String) : IOException("Gemini $code: $message")

    override fun errorMessage(e: Exception): String = when {
        e is GeminiException && e.code == 429 ->
            "He llegado al límite gratuito de Gemini por ahora. Espera un minuto o, si es el límite diario, hasta mañana."
        e is GeminiException && (e.code == 401 || e.code == 403 ||
            (e.code == 400 && e.message.orEmpty().contains("API key", ignoreCase = true))) ->
            "La clave de API de Gemini no es válida. Revísala en Ajustes."
        e is GeminiException && e.code == 404 ->
            "El modelo de Gemini no existe o ya no está disponible. Cámbialo en Ajustes (prueba gemini-2.5-flash)."
        e is GeminiException -> "Error de Gemini (${e.code}). Inténtalo de nuevo."
        e is IOException -> "No tengo conexión a internet ahora mismo."
        else -> "Algo ha fallado: ${e.message ?: e.javaClass.simpleName}"
    }

    companion object {
        const val NO_KEY_MESSAGE =
            "Necesito una clave de Gemini para pensar. Consíguela gratis en aistudio.google.com y ponla en Ajustes."
    }
}

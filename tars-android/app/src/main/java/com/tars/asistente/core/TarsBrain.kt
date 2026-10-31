package com.tars.asistente.core

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.CacheControlEphemeral
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.TextBlockParam
import com.anthropic.models.messages.ToolResultBlockParam
import com.anthropic.models.messages.ToolUseBlockParam
import com.anthropic.models.messages.WebSearchTool20260209
import com.fasterxml.jackson.core.type.TypeReference
import java.time.LocalDateTime

/** Cerebro con Claude (API de Anthropic, de pago). */
class TarsBrain(
    config: () -> BrainConfig,
    executor: ToolExecutor,
    now: () -> LocalDateTime = { LocalDateTime.now() },
    private val clientFactory: (String) -> AnthropicClient = { key ->
        AnthropicOkHttpClient.builder().apiKey(key).build()
    },
) : BaseBrain<MessageParam>(config, executor, now) {
    private var client: AnthropicClient? = null
    private var clientKey: String? = null

    override fun keyOf(cfg: BrainConfig) = cfg.apiKey
    override val noKeyMessage = NO_KEY_MESSAGE
    override fun userMessage(text: String): MessageParam = MessageParam.ofUser(text)

    override suspend fun runLoop(cfg: BrainConfig, onTool: (String) -> Unit): String {
        val api = clientFor(cfg.apiKey)
        repeat(MAX_STEPS) {
            val response = api.messages().create(buildParams(cfg, history))
            val stop = response.stopReason().orElse(null)

            if (stop == StopReason.REFUSAL) {
                history.clear()
                return "Prefiero no hacer eso. Prueba a pedírmelo de otra forma."
            }
            history += toParam(response)

            if (stop == StopReason.PAUSE_TURN) return@repeat // búsqueda web en curso: continuar

            val toolUses = response.content().mapNotNull { it.toolUse().orElse(null) }
            if (toolUses.isEmpty()) return textOf(response).ifBlank { "Hecho." }

            val results = toolUses.map { use ->
                val args: Map<String, Any?> = try {
                    use._input().convert(object : TypeReference<Map<String, Any?>>() {}) ?: emptyMap()
                } catch (e: Exception) {
                    emptyMap()
                }
                onTool(executor.label(use.name(), args))
                val result = guardedExecute(cfg, use.name(), args)
                ContentBlockParam.ofToolResult(
                    ToolResultBlockParam.builder()
                        .toolUseId(use.id())
                        .content(result.text)
                        .isError(result.isError)
                        .build()
                )
            }
            history += MessageParam.ofUserOfContentBlockParams(results)
        }
        return "He necesitado demasiados pasos y he parado. ¿Lo intentamos de otra forma?"
    }

    override suspend fun draftOnce(cfg: BrainConfig, system: String, user: String): String? {
        val params = MessageCreateParams.builder()
            .model(cfg.model)
            .maxTokens(2000L)
            .system(system)
            .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
            .addUserMessage(user)
            .also { addFallbacks(it, cfg.model) }
            .build()
        val response = clientFor(cfg.apiKey).messages().create(params)
        return if (response.stopReason().orElse(null) == StopReason.REFUSAL) null else textOf(response)
    }

    private fun buildParams(cfg: BrainConfig, messages: List<MessageParam>): MessageCreateParams {
        val builder = MessageCreateParams.builder()
            .model(cfg.model)
            .maxTokens(16000L)
            .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.of(cfg.effort)).build())
            .systemOfTextBlockParams(
                listOf(
                    TextBlockParam.builder().text(Brains.SYSTEM_PROMPT).build(),
                    // El bloque variable va al final y marca el punto de caché.
                    TextBlockParam.builder()
                        .text(
                            (if (cfg.webSearch) Brains.WEB_SEARCH_NOTE else Brains.NO_WEB_NOTE) +
                                "\n\n" + personalBlock(cfg)
                        )
                        .cacheControl(CacheControlEphemeral.builder().build())
                        .build(),
                )
            )
            .messages(messages)
        ToolCatalog.tools.forEach { builder.addTool(it) }
        if (cfg.webSearch) builder.addTool(WebSearchTool20260209.builder().maxUses(3L).build())
        addFallbacks(builder, cfg.model)
        return builder.build()
    }

    /** Si el modelo rechaza una petición, el servidor la reintenta con el modelo de respaldo recomendado. */
    private fun addFallbacks(builder: MessageCreateParams.Builder, model: String) {
        if (model in FALLBACK_MODELS) {
            builder.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
            builder.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
        }
    }

    private fun clientFor(apiKey: String): AnthropicClient {
        val existing = client
        if (existing != null && clientKey == apiKey) return existing
        existing?.close()
        return clientFactory(apiKey).also {
            client = it
            clientKey = apiKey
        }
    }

    private fun textOf(message: Message): String =
        message.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString("\n").trim()

    /** Convierte la respuesta en un turno de historial; si el SDK no reconoce algún bloque, conserva texto y herramientas. */
    private fun toParam(message: Message): MessageParam = try {
        message.toParam()
    } catch (e: Exception) {
        val blocks = message.content().mapNotNull { block ->
            block.text().orElse(null)?.let {
                ContentBlockParam.ofText(TextBlockParam.builder().text(it.text()).build())
            } ?: block.toolUse().orElse(null)?.let {
                ContentBlockParam.ofToolUse(
                    ToolUseBlockParam.builder().id(it.id()).name(it.name()).input(it._input()).build()
                )
            }
        }
        MessageParam.ofAssistantOfContentBlockParams(blocks.ifEmpty {
            listOf(ContentBlockParam.ofText(TextBlockParam.builder().text("…").build()))
        })
    }

    override fun errorMessage(e: Exception): String = when (e) {
        is UnauthorizedException -> "La clave de API de Anthropic no es válida. Revísala en Ajustes."
        is RateLimitException -> "Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo."
        is AnthropicIoException -> "No tengo conexión a internet ahora mismo."
        is AnthropicServiceException -> "Error del servicio (${e.statusCode()}). Inténtalo de nuevo."
        else -> "Algo ha fallado: ${e.message ?: e.javaClass.simpleName}"
    }

    companion object {
        private val FALLBACK_MODELS = setOf("claude-opus-5-5", "claude-sonnet-5-5")

        const val NO_KEY_MESSAGE =
            "Necesito una clave de API de Anthropic para pensar. Ponla en Ajustes (icono de engranaje)."
    }
}

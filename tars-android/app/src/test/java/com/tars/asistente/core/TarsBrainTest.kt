package com.tars.asistente.core

import com.anthropic.client.okhttp.AnthropicOkHttpClient
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDateTime

/** Prueba el bucle de herramientas contra un servidor falso que imita la API de mensajes. */
class TarsBrainTest {

    private lateinit var server: MockWebServer
    private val replies = mutableListOf<String>()

    /** Cuerpos de las peticiones recibidas, en orden. */
    private val requests by lazy { List(server.requestCount) { server.takeRequest().body.readUtf8() } }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() = server.shutdown()

    private fun enqueueReplies() = replies.forEach {
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody(it))
    }

    private class FakeExecutor : ToolExecutor {
        val calls = mutableListOf<Pair<String, Map<String, Any?>>>()
        override suspend fun execute(name: String, args: Map<String, Any?>): ToolResult {
            calls += name to args
            return ToolResult("ok: $name")
        }
    }

    private fun brain(executor: ToolExecutor, enabled: Boolean = true, locked: () -> Boolean = { false }) = TarsBrain(
        config = {
            BrainConfig(
                apiKey = "test-key",
                enabled = enabled,
                locked = locked(),
                memories = listOf("Mi perro se llama Toby"),
            )
        },
        executor = executor,
        now = { LocalDateTime.of(2026, 10, 30, 18, 30) },
        clientFactory = { key ->
            AnthropicOkHttpClient.builder()
                .apiKey(key)
                .baseUrl(server.url("/").toString().trimEnd('/'))
                .maxRetries(0)
                .build()
        },
    )

    private fun toolUse(id: String, name: String, input: String) = """
        {"id":"msg_$id","type":"message","role":"assistant","model":"claude-opus-5-5",
         "content":[{"type":"tool_use","id":"toolu_$id","name":"$name","input":$input}],
         "stop_reason":"tool_use","stop_sequence":null,
         "usage":{"input_tokens":10,"output_tokens":5}}
    """.trimIndent()

    private fun text(id: String, text: String) = """
        {"id":"msg_$id","type":"message","role":"assistant","model":"claude-opus-5-5",
         "content":[{"type":"text","text":"$text"}],
         "stop_reason":"end_turn","stop_sequence":null,
         "usage":{"input_tokens":10,"output_tokens":5}}
    """.trimIndent()

    @Test
    fun runsToolsAndReturnsFinalText() = runBlocking {
        replies += toolUse("1", "flashlight", """{"on":true}""")
        replies += text("2", "Linterna encendida.")
        enqueueReplies()
        val executor = FakeExecutor()
        val labels = mutableListOf<String>()

        val answer = brain(executor).ask("enciende la linterna") { labels += it }

        assertEquals("Linterna encendida.", answer)
        assertEquals(listOf("flashlight" to mapOf<String, Any?>("on" to true)), executor.calls)
        assertEquals(listOf("flashlight"), labels)
        assertEquals(2, requests.size)
        assertTrue(requests[0].contains("\"fallbacks\":\"default\""))
        assertTrue(requests[0].contains("\"name\":\"read_screen\""))
        assertTrue(requests[0].contains("Mi perro se llama Toby"))
        assertTrue(requests[0].contains("viernes 30 de octubre de 2026, 18:30"))
        assertTrue(requests[1].contains("\"tool_use_id\":\"toolu_1\""))
        assertTrue(requests[1].contains("ok: flashlight"))
    }

    @Test
    fun blocksUnconfirmedMessages() = runBlocking {
        replies += toolUse("1", "send_sms", """{"recipient":"Ana","text":"Llego tarde","confirmed":false}""")
        replies += text("2", "¿Le envío a Ana: llego tarde?")
        enqueueReplies()
        val executor = FakeExecutor()

        val answer = brain(executor).ask("dile a Ana que llego tarde")

        assertEquals("¿Le envío a Ana: llego tarde?", answer)
        assertTrue(executor.calls.isEmpty())
        assertTrue(requests[1].contains("NO EJECUTADO"))
    }

    @Test
    fun keepsConversationBetweenTurns() = runBlocking {
        replies += text("1", "¿A quién?")
        replies += text("2", "Vale.")
        enqueueReplies()
        val brain = brain(FakeExecutor())

        brain.ask("llama")
        brain.ask("a Pedro")

        assertTrue(requests[1].contains("¿A quién?"))
        assertFalse(requests[0].contains("a Pedro"))
        assertTrue(requests[1].contains("a Pedro"))
    }

    @Test
    fun doesNothingWhenSwitchedOff() = runBlocking {
        val executor = FakeExecutor()
        val brain = brain(executor, enabled = false)

        assertEquals(Brains.OFF_MESSAGE, brain.ask("enciende la linterna"))
        assertEquals(null, brain.draftReply("WhatsApp", "Ana", "Ana: hola"))
        assertEquals(0, server.requestCount)
        assertTrue(executor.calls.isEmpty())
    }

    @Test
    fun lockedPhoneOnlyAllowsHarmlessTools() = runBlocking {
        replies += toolUse("1", "list_messages", "{}")
        replies += toolUse("2", "flashlight", """{"on":true}""")
        replies += text("3", "Desbloquea el móvil para leer mensajes. Linterna encendida.")
        enqueueReplies()
        val executor = FakeExecutor()

        brain(executor, locked = { true }).ask("lee mis mensajes y enciende la linterna")

        assertEquals(listOf("flashlight"), executor.calls.map { it.first })
        assertTrue(requests[1].contains("el teléfono está bloqueado"))
        assertFalse(requests[0].contains("Mi perro se llama Toby"))
    }

    @Test
    fun forgetsConversationWhenPhoneGetsLocked() = runBlocking {
        replies += text("1", "Ana dice: llego a las 8.")
        replies += text("2", "Vale.")
        enqueueReplies()
        var locked = false
        val brain = brain(FakeExecutor(), locked = { locked })

        brain.ask("¿qué dice Ana?")
        locked = true
        brain.ask("¿y qué más?")

        assertFalse(requests[1].contains("llego a las 8"))
    }
}

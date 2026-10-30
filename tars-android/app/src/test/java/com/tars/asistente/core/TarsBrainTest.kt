package com.tars.asistente.core

import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress
import java.time.LocalDateTime

/** Prueba el bucle de herramientas contra un servidor falso que imita la API de mensajes. */
class TarsBrainTest {

    private lateinit var server: HttpServer
    private val requests = mutableListOf<String>()
    private val replies = ArrayDeque<String>()

    @Before
    fun setUp() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/v1/messages") { exchange ->
            requests += exchange.requestBody.readBytes().decodeToString()
            val body = replies.removeFirst().toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()
    }

    @After
    fun tearDown() = server.stop(0)

    private class FakeExecutor : ToolExecutor {
        val calls = mutableListOf<Pair<String, Map<String, Any?>>>()
        override suspend fun execute(name: String, args: Map<String, Any?>): ToolResult {
            calls += name to args
            return ToolResult("ok: $name")
        }
    }

    private fun brain(executor: ToolExecutor) = TarsBrain(
        config = { BrainConfig(apiKey = "test-key", memories = listOf("Mi mujer se llama Ana")) },
        executor = executor,
        now = { LocalDateTime.of(2026, 10, 30, 18, 30) },
        clientFactory = { key ->
            AnthropicOkHttpClient.builder()
                .apiKey(key)
                .baseUrl("http://127.0.0.1:${server.address.port}")
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
        val executor = FakeExecutor()
        val labels = mutableListOf<String>()

        val answer = brain(executor).ask("enciende la linterna") { labels += it }

        assertEquals("Linterna encendida.", answer)
        assertEquals(listOf("flashlight" to mapOf<String, Any?>("on" to true)), executor.calls)
        assertEquals(listOf("flashlight"), labels)
        assertEquals(2, requests.size)
        assertTrue(requests[0].contains("\"fallbacks\":\"default\""))
        assertTrue(requests[0].contains("\"name\":\"read_screen\""))
        assertTrue(requests[0].contains("Mi mujer se llama Ana"))
        assertTrue(requests[0].contains("viernes 30 de octubre de 2026, 18:30"))
        assertTrue(requests[1].contains("\"tool_use_id\":\"toolu_1\""))
        assertTrue(requests[1].contains("ok: flashlight"))
    }

    @Test
    fun blocksUnconfirmedMessages() = runBlocking {
        replies += toolUse("1", "send_sms", """{"recipient":"Ana","text":"Llego tarde","confirmed":false}""")
        replies += text("2", "¿Le envío a Ana: llego tarde?")
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
        val brain = brain(FakeExecutor())

        brain.ask("llama")
        brain.ask("a Pedro")

        assertTrue(requests[1].contains("¿A quién?"))
        assertFalse(requests[0].contains("a Pedro"))
        assertTrue(requests[1].contains("a Pedro"))
    }
}

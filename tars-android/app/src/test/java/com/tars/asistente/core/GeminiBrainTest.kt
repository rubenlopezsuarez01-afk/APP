package com.tars.asistente.core

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDateTime

/** Prueba el cerebro de Gemini contra un servidor falso que imita generateContent. */
class GeminiBrainTest {

    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() = server.shutdown()

    private class FakeExecutor : ToolExecutor {
        val calls = mutableListOf<Pair<String, Map<String, Any?>>>()
        override suspend fun execute(name: String, args: Map<String, Any?>): ToolResult {
            calls += name to args
            return ToolResult("ok: $name")
        }
    }

    private fun brain(executor: ToolExecutor, locked: Boolean = false) = GeminiBrain(
        config = { BrainConfig(apiKey = "", provider = Provider.GEMINI, geminiKey = "g-key", locked = locked) },
        executor = executor,
        now = { LocalDateTime.of(2026, 10, 31, 12, 0) },
        baseUrl = server.url("/").toString().trimEnd('/'),
    )

    private fun reply(body: String) =
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody(body))

    @Test
    fun runsFunctionCallsAndReturnsText() = runBlocking {
        reply("""{"candidates":[{"content":{"role":"model","parts":[
            {"functionCall":{"name":"set_alarm","args":{"hour":7,"minute":15}},"thoughtSignature":"sig123"}]}}]}""")
        reply("""{"candidates":[{"content":{"role":"model","parts":[{"text":"Alarma a las siete y cuarto."}]}}]}""")
        val executor = FakeExecutor()

        val answer = brain(executor).ask("pon una alarma a las 7:15")

        assertEquals("Alarma a las siete y cuarto.", answer)
        assertEquals("set_alarm", executor.calls.single().first)
        assertEquals(7, (executor.calls.single().second["hour"] as Number).toInt())

        val first = server.takeRequest()
        assertEquals("/v1beta/models/gemini-2.5-flash:generateContent", first.path)
        assertEquals("g-key", first.getHeader("x-goog-api-key"))
        val firstBody = first.body.readUtf8()
        assertTrue(firstBody.contains("\"functionDeclarations\""))
        assertTrue(firstBody.contains("\"type\":\"OBJECT\""))

        val second = server.takeRequest().body.readUtf8()
        assertTrue(second.contains("\"thoughtSignature\":\"sig123\""))
        assertTrue(second.contains("\"functionResponse\""))
        assertTrue(second.contains("ok: set_alarm"))
    }

    @Test
    fun appliesSameSafetyRules() = runBlocking {
        reply("""{"candidates":[{"content":{"role":"model","parts":[
            {"functionCall":{"name":"send_sms","args":{"recipient":"Ana","text":"hola","confirmed":true}}}]}}]}""")
        reply("""{"candidates":[{"content":{"role":"model","parts":[{"text":"Desbloquea el móvil."}]}}]}""")
        val executor = FakeExecutor()

        brain(executor, locked = true).ask("manda un sms a Ana")

        assertTrue(executor.calls.isEmpty())
        server.takeRequest()
        assertTrue(server.takeRequest().body.readUtf8().contains("el teléfono está bloqueado"))
    }

    @Test
    fun explainsFreeQuotaLimit() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(429).setBody("""{"error":{"code":429,"message":"quota"}}"""))

        val answer = brain(FakeExecutor()).ask("hola")

        assertTrue(answer.contains("límite gratuito"))
    }
}

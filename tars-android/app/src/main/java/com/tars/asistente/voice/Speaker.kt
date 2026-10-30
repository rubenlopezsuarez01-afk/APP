package com.tars.asistente.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** Voz de TARS (síntesis de voz del sistema). */
class Speaker(context: Context) {
    private var ready = false
    private val pending = mutableListOf<Pair<String, (() -> Unit)?>>()
    private val callbacks = ConcurrentHashMap<String, () -> Unit>()

    private val tts: TextToSpeech

    init {
        tts = TextToSpeech(context.applicationContext) { status -> onInit(status) }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) = Unit
            override fun onDone(utteranceId: String) {
                callbacks.remove(utteranceId)?.invoke()
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) {
                callbacks.remove(utteranceId)?.invoke()
            }
        })
    }

    private fun onInit(status: Int) {
        ready = status == TextToSpeech.SUCCESS
        if (!ready) return
        tts.language = Locale("es", "ES")
        tts.setSpeechRate(1.1f)
        val queued = synchronized(pending) { pending.toList().also { pending.clear() } }
        queued.forEach { (text, done) -> speak(text, done) }
    }

    /** Lee [text] en voz alta; [onDone] se llama (en otro hilo) al terminar. */
    fun speak(text: String, onDone: (() -> Unit)? = null) {
        if (!ready) {
            synchronized(pending) { pending += text to onDone }
            return
        }
        val id = UUID.randomUUID().toString()
        if (onDone != null) callbacks[id] = onDone
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
    }

    fun stop() {
        callbacks.clear()
        tts.stop()
    }

    val isSpeaking get() = ready && tts.isSpeaking
}

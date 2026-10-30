package com.tars.asistente.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tars.asistente.TarsApp
import com.tars.asistente.voice.VoiceInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

enum class Role { USER, TARS, TOOL }

data class ChatItem(val role: Role, val text: String)

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as TarsApp
    val settings get() = app.settings

    val items = mutableStateListOf<ChatItem>()
    var listening by mutableStateOf(false)
        private set
    var thinking by mutableStateOf(false)
        private set
    var partial by mutableStateOf("")
        private set

    /** Se incrementa al volver a la app para refrescar el estado de permisos. */
    var refreshTick by mutableIntStateOf(0)
        private set

    private val voice = VoiceInput(
        context = application,
        onPartial = { partial = it },
        onResult = { text ->
            partial = ""
            send(text, fromVoice = true)
        },
        onError = { message ->
            partial = ""
            if (message != null) items += ChatItem(Role.TOOL, message)
        },
        onListeningChanged = { listening = it },
    )

    fun refresh() {
        refreshTick++
    }

    fun toggleMic() {
        if (listening) voice.stop() else startListening()
    }

    fun startListening() {
        app.speaker.stop()
        if (!voice.available) {
            items += ChatItem(Role.TOOL, "Este teléfono no tiene reconocimiento de voz disponible.")
            return
        }
        voice.start()
    }

    fun send(text: String, fromVoice: Boolean = false) {
        val clean = text.trim()
        if (clean.isEmpty() || thinking) return
        items += ChatItem(Role.USER, clean)
        thinking = true
        viewModelScope.launch {
            val answer = app.brain.ask(clean) { label ->
                viewModelScope.launch(Dispatchers.Main) { items += ChatItem(Role.TOOL, label) }
            }
            thinking = false
            items += ChatItem(Role.TARS, answer)
            // Lo que se pregunta por voz se responde por voz; lo escrito, solo en pantalla.
            if (fromVoice && settings.speakReplies) {
                app.speaker.speak(answer) {
                    if (settings.continuousConversation && answer.trimEnd().endsWith("?")) {
                        viewModelScope.launch(Dispatchers.Main) { startListening() }
                    }
                }
            }
        }
    }

    fun newConversation() {
        app.brain.reset()
        app.speaker.stop()
        items.clear()
    }

    override fun onCleared() {
        voice.stop()
    }
}

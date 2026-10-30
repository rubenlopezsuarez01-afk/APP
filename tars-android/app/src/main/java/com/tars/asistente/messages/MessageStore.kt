package com.tars.asistente.messages

import android.app.Notification
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.os.Bundle
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ChatLine(val sender: String, val text: String, val time: Long, val fromMe: Boolean)

/** Una conversación de mensajería vista en las notificaciones, con su acción de responder si la tiene. */
class Conversation(
    val id: String,
    val packageName: String,
    val appName: String,
    val title: String,
) {
    val lines = ArrayDeque<ChatLine>()
    var unread = 0
    var replyAction: Notification.Action? = null
    var lastUpdate = 0L

    val canReply get() = replyAction != null

    fun transcript(max: Int = 12): String = lines.takeLast(max).joinToString("\n") {
        "${if (it.fromMe) "Yo" else it.sender}: ${it.text}"
    }
}

data class OtherNotification(val app: String, val title: String, val text: String, val time: Long)

/** Memoria en RAM de los mensajes y notificaciones recientes que llegan al teléfono. */
object MessageStore {
    private const val MAX_LINES = 30
    private const val MAX_CONVERSATIONS = 40
    private const val MAX_OTHER = 40

    private val conversations = LinkedHashMap<String, Conversation>()
    private val keyToId = HashMap<String, String>()
    private val others = ArrayDeque<OtherNotification>()
    private var nextId = 1

    @Synchronized
    fun conversation(packageName: String, appName: String, title: String): Conversation {
        val key = "$packageName|$title"
        val id = keyToId.getOrPut(key) { "c${nextId++}" }
        conversations[id]?.let { return it }
        if (conversations.size >= MAX_CONVERSATIONS) {
            conversations.values.minByOrNull { it.lastUpdate }?.let { conversations.remove(it.id) }
        }
        return Conversation(id, packageName, appName, title).also {
            it.lastUpdate = System.currentTimeMillis()
            conversations[id] = it
        }
    }

    /** Añade las líneas nuevas (por hora) y devuelve las que no se habían visto. */
    @Synchronized
    fun addLines(conversation: Conversation, incoming: List<ChatLine>): List<ChatLine> {
        val newest = conversation.lines.lastOrNull()?.time ?: 0L
        val fresh = incoming.filter { line ->
            line.time > newest || (line.time == newest && conversation.lines.none { it.text == line.text })
        }
        fresh.sortedBy { it.time }.forEach {
            conversation.lines.addLast(it)
            if (!it.fromMe) conversation.unread++
        }
        while (conversation.lines.size > MAX_LINES) conversation.lines.removeFirst()
        if (fresh.isNotEmpty()) conversation.lastUpdate = System.currentTimeMillis()
        return fresh
    }

    @Synchronized
    fun addOther(n: OtherNotification) {
        others.removeAll { it.app == n.app && it.title == n.title && it.text == n.text }
        others.addFirst(n)
        while (others.size > MAX_OTHER) others.removeLast()
    }

    @Synchronized
    fun get(id: String): Conversation? = conversations[id]

    @Synchronized
    fun recent(): List<Conversation> = conversations.values.sortedByDescending { it.lastUpdate }

    @Synchronized
    fun otherNotifications(): List<OtherNotification> = others.toList()

    @Synchronized
    fun markRead(c: Conversation) {
        c.unread = 0
    }

    /** Envía [text] usando la acción "Responder" de la notificación, sin abrir la app. */
    fun reply(context: Context, conversation: Conversation, text: String): Boolean {
        val action = conversation.replyAction ?: return false
        val inputs = action.remoteInputs ?: return false
        val intent = Intent()
        val results = Bundle()
        inputs.forEach { results.putCharSequence(it.resultKey, text) }
        RemoteInput.addResultsToIntent(inputs, intent, results)
        return try {
            action.actionIntent.send(context, 0, intent)
            synchronized(this) {
                conversation.lines.addLast(ChatLine("Yo", text, System.currentTimeMillis(), fromMe = true))
                conversation.unread = 0
            }
            true
        } catch (e: PendingIntent.CanceledException) {
            conversation.replyAction = null
            false
        }
    }

    fun formatTime(time: Long): String = SimpleDateFormat("HH:mm", Locale("es", "ES")).format(Date(time))
}

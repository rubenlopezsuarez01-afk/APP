package com.tars.asistente

import android.Manifest
import android.app.Application
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import com.tars.asistente.core.TarsBrain
import com.tars.asistente.messages.ChatLine
import com.tars.asistente.messages.Conversation
import com.tars.asistente.messages.ReplyReceiver
import com.tars.asistente.tools.PhoneTools
import com.tars.asistente.ui.MainActivity
import com.tars.asistente.voice.Speaker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class TarsApp : Application() {

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    lateinit var settings: TarsSettings
        private set
    lateinit var brain: TarsBrain
        private set
    val speaker by lazy { Speaker(this) }

    override fun onCreate() {
        super.onCreate()
        settings = TarsSettings(this)
        brain = TarsBrain(
            config = { settings.brainConfig().copy(locked = isPhoneLocked()) },
            executor = PhoneTools(this, settings),
        )
        createChannels()
    }

    fun isPhoneLocked(): Boolean = getSystemService(KeyguardManager::class.java).isKeyguardLocked

    private fun createChannels() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_BUTTON, "Botón de TARS", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Botón «Hablar» para activar TARS, también en la pantalla de bloqueo"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_SUGGESTIONS, "Respuestas sugeridas", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "TARS propone una respuesta a los mensajes que recibes"
            }
        )
    }

    /** Llamado por el lector de notificaciones cuando llegan mensajes nuevos de otra persona. */
    fun onIncomingMessages(conversation: Conversation, fresh: List<ChatLine>) {
        if (!settings.enabled) return
        if (settings.announceMessages) {
            val last = fresh.last()
            val who = if (last.sender == conversation.title) last.sender else "${last.sender} en ${conversation.title}"
            speaker.speak("Mensaje de $who por ${conversation.appName}: ${last.text.take(300)}")
        }
        if (settings.suggestReplies && conversation.canReply && settings.apiKey.isNotBlank()) {
            scope.launch {
                val draft = brain.draftReply(conversation.appName, conversation.title, conversation.transcript())
                    ?: return@launch
                postSuggestion(conversation, draft)
            }
        }
    }

    private fun postSuggestion(conversation: Conversation, draft: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val notificationId = conversation.id.hashCode()
        fun replyIntent(action: String, requestCode: Int, mutable: Boolean): PendingIntent {
            val intent = Intent(this, ReplyReceiver::class.java)
                .setAction(action)
                .putExtra(ReplyReceiver.EXTRA_CONVERSATION, conversation.id)
                .putExtra(ReplyReceiver.EXTRA_TEXT, draft)
                .putExtra(ReplyReceiver.EXTRA_NOTIFICATION_ID, notificationId)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (mutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
            return PendingIntent.getBroadcast(this, notificationId * 10 + requestCode, intent, flags)
        }

        val editAction = NotificationCompat.Action.Builder(
            R.drawable.ic_tars, "Editar",
            replyIntent(ReplyReceiver.ACTION_SEND, 2, mutable = true),
        ).addRemoteInput(RemoteInput.Builder(ReplyReceiver.KEY_EDITED).setLabel("Edita la respuesta").build())
            .build()

        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_SUGGESTIONS)
            .setSmallIcon(R.drawable.ic_tars)
            .setContentTitle("Respuesta para ${conversation.title} (${conversation.appName})")
            .setContentText(draft)
            .setStyle(NotificationCompat.BigTextStyle().bigText(draft))
            .setContentIntent(open)
            .setAutoCancel(true)
            .addAction(R.drawable.ic_tars, "Enviar", replyIntent(ReplyReceiver.ACTION_SEND, 1, mutable = false))
            .addAction(editAction)
            .addAction(R.drawable.ic_tars, "Descartar", replyIntent(ReplyReceiver.ACTION_DISMISS, 3, mutable = false))
            .build()
        getSystemService(NotificationManager::class.java).notify(notificationId, notification)
    }

    companion object {
        const val CHANNEL_SUGGESTIONS = "suggestions"
        const val CHANNEL_BUTTON = "button"
    }
}

package com.tars.asistente.messages

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.app.RemoteInput

/** Botones "Enviar" / "Editar" / "Descartar" de la notificación de respuesta sugerida por TARS. */
class ReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val conversationId = intent.getStringExtra(EXTRA_CONVERSATION) ?: return
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        val nm = context.getSystemService(NotificationManager::class.java)

        if (intent.action == ACTION_DISMISS) {
            nm.cancel(notificationId)
            return
        }
        val edited = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY_EDITED)?.toString()
        val text = edited?.takeIf { it.isNotBlank() } ?: intent.getStringExtra(EXTRA_TEXT) ?: return
        val conversation = MessageStore.get(conversationId)
        val ok = conversation != null && MessageStore.reply(context, conversation, text)
        nm.cancel(notificationId)
        Toast.makeText(
            context,
            if (ok) "Enviado a ${conversation!!.title}" else "No se pudo enviar: abre la conversación",
            Toast.LENGTH_SHORT,
        ).show()
    }

    companion object {
        const val ACTION_SEND = "com.tars.asistente.SEND_REPLY"
        const val ACTION_DISMISS = "com.tars.asistente.DISMISS_REPLY"
        const val EXTRA_CONVERSATION = "conversation"
        const val EXTRA_TEXT = "text"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
        const val KEY_EDITED = "edited_reply"
    }
}

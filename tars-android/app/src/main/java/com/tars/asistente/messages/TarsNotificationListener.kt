package com.tars.asistente.messages

import android.app.Notification
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import com.tars.asistente.TarsApp
import com.tars.asistente.core.AppBlocklist

/**
 * Recibe las notificaciones del teléfono para que TARS pueda leer los mensajes y
 * responderlos con la acción "Responder" de la propia notificación.
 */
class TarsNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        connected = true
        try {
            activeNotifications?.forEach { handle(it, announce = false) }
        } catch (_: Exception) {
        }
    }

    override fun onListenerDisconnected() {
        connected = false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        handle(sbn, announce = true)
    }

    private fun handle(sbn: StatusBarNotification, announce: Boolean) {
        if (sbn.packageName == packageName) return
        val app = application as TarsApp
        // Apagado: no se captura nada. Bancos y tiendas: sus notificaciones nunca se leen.
        if (!app.settings.enabled) return
        if (AppBlocklist.isBlockedApp(sbn.packageName, appLabel(sbn.packageName), app.settings.extraBlocked)) return
        val n = sbn.notification ?: return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = n.extras
        val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(n)
        val replyAction = n.actions?.firstOrNull { action ->
            action.remoteInputs?.any { it.allowFreeFormInput } == true
        }
        val isMessage = n.category == Notification.CATEGORY_MESSAGE || style != null ||
            sbn.packageName in MESSAGING_PACKAGES
        val appName = appLabel(sbn.packageName)
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()

        if (!isMessage) {
            if (n.flags and Notification.FLAG_ONGOING_EVENT == 0 && (title.isNotBlank() || text.isNotBlank())) {
                MessageStore.addOther(OtherNotification(appName, title, text, sbn.postTime))
            }
            return
        }

        val chatTitle = style?.conversationTitle?.toString()?.takeIf { it.isNotBlank() } ?: title
        if (chatTitle.isBlank()) return
        val me = style?.user?.name?.toString()
        val lines = style?.messages?.mapNotNull { m ->
            val body = m.text?.toString() ?: return@mapNotNull null
            val sender = m.person?.name?.toString()
            val fromMe = sender == null || sender == me
            ChatLine(sender ?: "Yo", body, m.timestamp, fromMe)
        } ?: if (text.isNotBlank()) listOf(ChatLine(title, text, sbn.postTime, fromMe = false)) else emptyList()

        val conversation = MessageStore.conversation(sbn.packageName, appName, chatTitle)
        if (replyAction != null) conversation.replyAction = replyAction
        val fresh = MessageStore.addLines(conversation, lines).filter { !it.fromMe }
        if (announce && fresh.isNotEmpty()) {
            app.onIncomingMessages(conversation, fresh)
        }
    }

    private fun appLabel(pkg: String): String = try {
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) {
        pkg
    }

    companion object {
        @Volatile
        var connected = false
            private set

        private val MESSAGING_PACKAGES = setOf(
            "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thoughtcrime.securesms",
            "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.facebook.orca",
            "com.instagram.android", "com.discord", "com.Slack", "com.microsoft.teams", "com.viber.voip",
            "com.android.mms",
        )
    }
}

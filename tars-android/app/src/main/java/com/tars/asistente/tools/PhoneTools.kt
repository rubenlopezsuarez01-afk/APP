package com.tars.asistente.tools

import android.Manifest
import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Settings
import android.telephony.SmsManager
import android.view.KeyEvent
import androidx.core.content.ContextCompat
import com.tars.asistente.TarsSettings
import com.tars.asistente.access.TarsAccessibilityService
import com.tars.asistente.core.AppBlocklist
import com.tars.asistente.core.ToolExecutor
import com.tars.asistente.core.ToolResult
import com.tars.asistente.messages.MessageStore
import com.tars.asistente.messages.TarsNotificationListener
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.net.URLEncoder
import java.text.Normalizer
import java.text.SimpleDateFormat
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Implementación en Android de las herramientas de [com.tars.asistente.core.ToolCatalog]. */
class PhoneTools(private val context: Context, private val settings: TarsSettings) : ToolExecutor {

    override fun label(name: String, args: Map<String, Any?>): String = when (name) {
        "list_messages" -> "Leyendo mensajes"
        "reply_message" -> "Respondiendo"
        "send_whatsapp" -> "Enviando WhatsApp a ${args.str("recipient")}"
        "send_sms" -> "Enviando SMS a ${args.str("recipient")}"
        "make_call" -> "Llamando a ${args.str("recipient")}"
        "find_contact" -> "Buscando contacto"
        "list_notifications" -> "Mirando notificaciones"
        "open_app" -> "Abriendo ${args.str("app_name")}"
        "open_url" -> "Abriendo enlace"
        "open_settings" -> "Abriendo ajustes"
        "device_status" -> "Mirando el teléfono"
        "flashlight" -> "Linterna"
        "set_volume" -> "Volumen"
        "media_control", "play_music" -> "Música"
        "navigate" -> "Ruta a ${args.str("destination")}"
        "set_alarm" -> "Poniendo alarma"
        "set_timer" -> "Poniendo temporizador"
        "calendar_events" -> "Mirando la agenda"
        "create_calendar_event" -> "Creando evento"
        "read_screen" -> "Leyendo la pantalla"
        "tap" -> "Pulsando «${args.str("text")}»"
        "type_text" -> "Escribiendo"
        "scroll" -> "Desplazando"
        "system_action" -> "Acción del sistema"
        "wait" -> "Esperando"
        "remember" -> "Guardando en memoria"
        "forget" -> "Olvidando"
        else -> name
    }

    override suspend fun execute(name: String, args: Map<String, Any?>): ToolResult {
        if (!settings.enabled) return ToolResult("TARS está apagado: no se ejecuta nada.", true)
        return dispatch(name, args)
    }

    private suspend fun dispatch(name: String, args: Map<String, Any?>): ToolResult = when (name) {
        "list_messages" -> listMessages(args.bool("only_unread"), args.strOrNull("app"))
        "reply_message" -> replyMessage(args.str("conversation_id"), args.str("text"))
        "send_whatsapp" -> sendWhatsApp(args.str("recipient"), args.str("text"))
        "send_sms" -> sendSms(args.str("recipient"), args.str("text"))
        "make_call" -> makeCall(args.str("recipient"))
        "find_contact" -> findContact(args.str("query"))
        "list_notifications" -> listNotifications()
        "open_app" -> openApp(args.str("app_name"))
        "open_url" -> openUrl(args.str("url"))
        "open_settings" -> openSettings(args.str("panel"))
        "device_status" -> deviceStatus()
        "flashlight" -> flashlight(args.bool("on"))
        "set_volume" -> setVolume(args.int("percent"), args.strOrNull("stream") ?: "media")
        "media_control" -> mediaControl(args.str("action"))
        "play_music" -> playMusic(args.str("query"))
        "navigate" -> navigate(args.str("destination"), args.strOrNull("mode") ?: "driving")
        "set_alarm" -> setAlarm(args.int("hour"), args.int("minute"), args.strOrNull("label"))
        "set_timer" -> setTimer(args.int("seconds"), args.strOrNull("label"))
        "calendar_events" -> calendarEvents(args.int("days_ahead").coerceIn(1, 31))
        "create_calendar_event" -> createEvent(
            args.str("title"), args.str("start"), args.strOrNull("end"),
            args.strOrNull("location"), args.bool("all_day"),
        )
        "read_screen" -> withScreen { ToolResult(it.readScreen()) }
        "tap" -> withScreen {
            if (!it.tap(args.str("text"))) {
                ToolResult("No encuentro «${args.str("text")}» en pantalla. Lee la pantalla de nuevo.", true)
            } else {
                // Si el toque ha abierto una app bloqueada (p. ej. su icono en el escritorio), salir de ella.
                delay(800)
                if (isBlockedForeground(it)) {
                    it.systemAction("home")
                    ToolResult(AppBlocklist.REFUSAL, true)
                } else {
                    ToolResult("Pulsado.")
                }
            }
        }
        "type_text" -> withScreen {
            if (it.typeText(args.str("text"), args.strOrNull("field_hint"))) ToolResult("Escrito.")
            else ToolResult("No hay ningún campo de texto donde escribir.", true)
        }
        "scroll" -> withScreen {
            if (it.scroll(args.str("direction") != "up")) ToolResult("Desplazado.")
            else ToolResult("No hay nada que desplazar.", true)
        }
        "system_action" -> withScreen(allowOnBlocked = true) {
            if (it.systemAction(args.str("action"))) ToolResult("Hecho.") else ToolResult("No disponible.", true)
        }
        "wait" -> {
            delay(args.int("seconds").coerceIn(1, 5) * 1000L)
            ToolResult("Esperado.")
        }
        "remember" -> {
            val fact = args.str("fact").trim()
            settings.memories = (settings.memories - fact) + fact
            ToolResult("Guardado.")
        }
        "forget" -> {
            val needle = args.str("text").lowercase()
            val before = settings.memories
            settings.memories = before.filterNot { it.lowercase().contains(needle) }
            ToolResult("Olvidados ${before.size - settings.memories.size} datos.")
        }
        else -> ToolResult("Herramienta desconocida: $name", true)
    }

    // ---------- Mensajes ----------

    private fun listMessages(onlyUnread: Boolean, app: String?): ToolResult {
        if (!TarsNotificationListener.connected) {
            return ToolResult(
                "No tengo acceso a las notificaciones. El usuario debe activarlo en Ajustes de TARS → " +
                    "'Acceso a notificaciones'.", true,
            )
        }
        val list = MessageStore.recent()
            .filter { !onlyUnread || it.unread > 0 }
            .filter { app == null || it.appName.contains(app, ignoreCase = true) }
            .take(10)
        if (list.isEmpty()) return ToolResult(if (onlyUnread) "No hay mensajes sin leer." else "No hay mensajes recientes.")
        val text = list.joinToString("\n\n") { c ->
            val header = "[${c.id}] ${c.appName} · ${c.title} — ${c.unread} sin leer" +
                if (c.canReply) ", se puede responder directamente" else ", sin respuesta directa"
            val lines = c.lines.takeLast(6).joinToString("\n") {
                "  ${MessageStore.formatTime(it.time)} ${if (it.fromMe) "Yo" else it.sender}: ${it.text}"
            }
            "$header\n$lines"
        }
        list.forEach { MessageStore.markRead(it) }
        return ToolResult(text)
    }

    private fun replyMessage(id: String, text: String): ToolResult {
        val c = MessageStore.get(id) ?: return ToolResult("No existe la conversación $id. Vuelve a listar.", true)
        if (!c.canReply) return ToolResult("Esa conversación no admite respuesta directa. Usa send_whatsapp o send_sms.", true)
        return if (MessageStore.reply(context, c, text)) ToolResult("Enviado a ${c.title} por ${c.appName}.")
        else ToolResult("La notificación ya no permite responder. Usa send_whatsapp o send_sms.", true)
    }

    private suspend fun sendWhatsApp(recipient: String, text: String): ToolResult {
        val phone = resolvePhone(recipient).getOrElse { return ToolResult(it.message ?: "Contacto no encontrado", true) }
        val digits = internationalDigits(phone)
        val uri = Uri.parse("https://api.whatsapp.com/send?phone=$digits&text=${enc(text)}")
        val pkg = listOf("com.whatsapp", "com.whatsapp.w4b").firstOrNull { installed(it) }
            ?: return ToolResult("WhatsApp no está instalado.", true)
        val opened = start(Intent(Intent.ACTION_VIEW, uri).setPackage(pkg), "")
        if (opened.isError) return opened
        val service = TarsAccessibilityService.instance
            ?: return ToolResult(
                "He abierto el chat con el mensaje escrito, pero falta pulsar Enviar: activa el control de " +
                    "pantalla de TARS (accesibilidad) para que lo envíe solo.",
            )
        return if (service.pressWhatsAppSend()) {
            service.systemAction("back")
            ToolResult("WhatsApp enviado a $recipient.")
        } else {
            ToolResult("He abierto el chat con el texto pero no encontré el botón Enviar.", true)
        }
    }

    private fun sendSms(recipient: String, text: String): ToolResult {
        if (!granted(Manifest.permission.SEND_SMS)) return missing("SMS")
        val phone = resolvePhone(recipient).getOrElse { return ToolResult(it.message ?: "Contacto no encontrado", true) }
        val sms = if (Build.VERSION.SDK_INT >= 31) context.getSystemService(SmsManager::class.java)
        else @Suppress("DEPRECATION") SmsManager.getDefault()
        sms.sendMultipartTextMessage(phone, null, sms.divideMessage(text), null, null)
        return ToolResult("SMS enviado a $recipient ($phone).")
    }

    private fun makeCall(recipient: String): ToolResult {
        val phone = resolvePhone(recipient).getOrElse { return ToolResult(it.message ?: "Contacto no encontrado", true) }
        return if (granted(Manifest.permission.CALL_PHONE)) {
            start(Intent(Intent.ACTION_CALL, Uri.parse("tel:$phone")), "Llamando a $recipient.")
        } else {
            start(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")), "He marcado el número; falta pulsar llamar.")
        }
    }

    private fun findContact(query: String): ToolResult {
        if (!granted(Manifest.permission.READ_CONTACTS)) return missing("Contactos")
        val found = queryContacts(query)
        if (found.isEmpty()) return ToolResult("No hay contactos que coincidan con «$query».")
        return ToolResult(found.joinToString("\n") { "${it.first}: ${it.second}" })
    }

    private fun queryContacts(query: String): List<Pair<String, String>> {
        val uri = Uri.withAppendedPath(ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI, Uri.encode(query))
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.TYPE,
        )
        val rows = mutableListOf<Triple<String, String, Int>>()
        context.contentResolver.query(uri, projection, null, null, null)?.use { c ->
            while (c.moveToNext() && rows.size < 30) {
                rows += Triple(c.getString(0) ?: "", c.getString(1) ?: "", c.getInt(2))
            }
        }
        // Un número por contacto, prefiriendo el móvil.
        return rows.groupBy { it.first }.map { (name, numbers) ->
            val best = numbers.firstOrNull { it.third == ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE } ?: numbers.first()
            name to best.second
        }
    }

    private fun resolvePhone(recipient: String): Result<String> {
        val digits = recipient.filter { it.isDigit() || it == '+' }
        if (digits.count { it.isDigit() } >= 6) return Result.success(digits)
        if (!granted(Manifest.permission.READ_CONTACTS)) {
            return Result.failure(Exception("Falta el permiso de Contactos para buscar a «$recipient»."))
        }
        val found = queryContacts(recipient)
        val exact = found.filter { it.first.equals(recipient, ignoreCase = true) }
        return when {
            exact.size == 1 -> Result.success(exact[0].second)
            found.size == 1 -> Result.success(found[0].second)
            found.isEmpty() -> Result.failure(Exception("No encuentro a «$recipient» en los contactos."))
            else -> Result.failure(
                Exception("Hay varios contactos: ${found.joinToString { it.first }}. Pregunta al usuario cuál.")
            )
        }
    }

    private fun internationalDigits(phone: String): String {
        val trimmed = phone.trim()
        val digits = trimmed.filter { it.isDigit() }
        return when {
            trimmed.startsWith("+") -> digits
            digits.startsWith("00") -> digits.drop(2)
            digits.length <= 10 -> settings.countryCode + digits
            else -> digits
        }
    }

    private fun listNotifications(): ToolResult {
        if (!TarsNotificationListener.connected) return ToolResult("No tengo acceso a las notificaciones.", true)
        val list = MessageStore.otherNotifications().take(15)
        if (list.isEmpty()) return ToolResult("No hay notificaciones recientes.")
        return ToolResult(list.joinToString("\n") {
            "${MessageStore.formatTime(it.time)} ${it.app}: ${it.title} — ${it.text.take(200)}"
        })
    }

    // ---------- Apps y sistema ----------

    private fun openApp(name: String): ToolResult {
        val pm = context.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(launcher, 0).map {
            it.activityInfo.packageName to it.loadLabel(pm).toString()
        }
        val q = normalize(name)
        val match = apps.firstOrNull { normalize(it.second) == q }
            ?: apps.firstOrNull { normalize(it.second).startsWith(q) }
            ?: apps.firstOrNull { normalize(it.second).contains(q) }
            ?: apps.firstOrNull { q.contains(normalize(it.second)) && it.second.length > 3 }
            ?: return ToolResult("No encuentro ninguna app llamada «$name».", true)
        if (AppBlocklist.isBlockedApp(match.first, match.second, settings.extraBlocked)) {
            return ToolResult(AppBlocklist.REFUSAL, true)
        }
        val intent = pm.getLaunchIntentForPackage(match.first) ?: return ToolResult("No se puede abrir ${match.second}.", true)
        return start(intent, "Abierta ${match.second}.")
    }

    private fun openUrl(url: String): ToolResult {
        if (AppBlocklist.isBlockedUrl(url, settings.extraBlocked)) return ToolResult(AppBlocklist.REFUSAL, true)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        // Un enlace puede abrirse directamente en la app de una tienda o banco: comprobar qué app lo recibiría.
        val handler = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo
        if (handler != null && AppBlocklist.isBlockedApp(handler.packageName, "", settings.extraBlocked)) {
            return ToolResult(AppBlocklist.REFUSAL, true)
        }
        return start(intent, "Abierto.")
    }

    private fun openSettings(panel: String): ToolResult {
        val action = when (panel) {
            "wifi" -> Settings.ACTION_WIFI_SETTINGS
            "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
            "internet" -> if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_INTERNET_CONNECTIVITY else Settings.ACTION_WIRELESS_SETTINGS
            "volume" -> if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_VOLUME else Settings.ACTION_SOUND_SETTINGS
            "nfc" -> Settings.ACTION_NFC_SETTINGS
            "battery" -> Intent.ACTION_POWER_USAGE_SUMMARY
            "display" -> Settings.ACTION_DISPLAY_SETTINGS
            "location" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
            "airplane" -> Settings.ACTION_AIRPLANE_MODE_SETTINGS
            "apps" -> Settings.ACTION_APPLICATION_SETTINGS
            "notifications" -> "android.settings.NOTIFICATION_SETTINGS"
            "default_apps" -> Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS
            "accessibility" -> Settings.ACTION_ACCESSIBILITY_SETTINGS
            else -> Settings.ACTION_SETTINGS
        }
        val result = start(Intent(action), "Abiertos los ajustes.")
        return if (result.isError) start(Intent(Settings.ACTION_SETTINGS), "Abiertos los ajustes generales.") else result
    }

    private fun deviceStatus(): ToolResult {
        val bm = context.getSystemService(BatteryManager::class.java)
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val charging = bm.isCharging
        val cm = context.getSystemService(ConnectivityManager::class.java)
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val network = when {
            caps == null -> "sin conexión"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "datos móviles"
            else -> "conectado"
        }
        val now = SimpleDateFormat("EEEE d 'de' MMMM, HH:mm", Locale("es", "ES")).format(Date())
        return ToolResult("Batería $level%${if (charging) " (cargando)" else ""}. Red: $network. Ahora: $now.")
    }

    private fun flashlight(on: Boolean): ToolResult {
        val cm = context.getSystemService(CameraManager::class.java)
        val id = cm.cameraIdList.firstOrNull {
            cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        } ?: return ToolResult("Este teléfono no tiene linterna.", true)
        cm.setTorchMode(id, on)
        return ToolResult(if (on) "Linterna encendida." else "Linterna apagada.")
    }

    private fun setVolume(percent: Int, stream: String): ToolResult {
        val am = context.getSystemService(AudioManager::class.java)
        val type = when (stream) {
            "ring" -> AudioManager.STREAM_RING
            "alarm" -> AudioManager.STREAM_ALARM
            "notification" -> AudioManager.STREAM_NOTIFICATION
            else -> AudioManager.STREAM_MUSIC
        }
        val max = am.getStreamMaxVolume(type)
        return try {
            am.setStreamVolume(type, (percent.coerceIn(0, 100) * max + 50) / 100, AudioManager.FLAG_SHOW_UI)
            ToolResult("Volumen al $percent%.")
        } catch (e: SecurityException) {
            ToolResult("No puedo cambiar ese volumen con el modo No molestar activo.", true)
        }
    }

    private fun mediaControl(action: String): ToolResult {
        val key = when (action) {
            "play" -> KeyEvent.KEYCODE_MEDIA_PLAY
            "pause" -> KeyEvent.KEYCODE_MEDIA_PAUSE
            "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
            "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
            else -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
        }
        val am = context.getSystemService(AudioManager::class.java)
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, key))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, key))
        return ToolResult("Hecho.")
    }

    private fun playMusic(query: String): ToolResult {
        val intent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH)
            .putExtra(SearchManager.QUERY, query)
            .putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*")
        val spotify = "com.spotify.music"
        if (installed(spotify)) {
            val r = start(Intent(intent).setPackage(spotify), "Poniendo $query en Spotify.")
            if (!r.isError) return r
        }
        val r = start(intent, "Poniendo $query.")
        if (!r.isError) return r
        return start(
            Intent(Intent.ACTION_VIEW, Uri.parse("https://music.youtube.com/search?q=${enc(query)}")),
            "He buscado $query en YouTube Music.",
        )
    }

    private fun navigate(destination: String, mode: String): ToolResult {
        val uri = Uri.parse(
            "https://www.google.com/maps/dir/?api=1&destination=${enc(destination)}&travelmode=$mode&dir_action=navigate"
        )
        return start(Intent(Intent.ACTION_VIEW, uri), "Ruta a $destination abierta.")
    }

    // ---------- Tiempo y agenda ----------

    private fun setAlarm(hour: Int, minute: Int, label: String?): ToolResult {
        val intent = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        if (label != null) intent.putExtra(AlarmClock.EXTRA_MESSAGE, label)
        return start(intent, "Alarma puesta a las %02d:%02d.".format(hour, minute))
    }

    private fun setTimer(seconds: Int, label: String?): ToolResult {
        val intent = Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        if (label != null) intent.putExtra(AlarmClock.EXTRA_MESSAGE, label)
        return start(intent, "Temporizador de $seconds segundos en marcha.")
    }

    private fun calendarEvents(days: Int): ToolResult {
        if (!granted(Manifest.permission.READ_CALENDAR)) return missing("Calendario")
        val start = LocalDateTime.now().toLocalDate().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = start + days * 24L * 3600 * 1000
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().also {
            ContentUris.appendId(it, start)
            ContentUris.appendId(it, end)
        }.build()
        val projection = arrayOf(
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.EVENT_LOCATION,
        )
        val fmt = SimpleDateFormat("EEE d MMM HH:mm", Locale("es", "ES"))
        val dayFmt = SimpleDateFormat("EEE d MMM", Locale("es", "ES")).apply { timeZone = TimeZone.getTimeZone("UTC") }
        val lines = mutableListOf<String>()
        context.contentResolver.query(uri, projection, null, null, "${CalendarContract.Instances.BEGIN} ASC")?.use { c ->
            while (c.moveToNext() && lines.size < 40) {
                val allDay = c.getInt(2) == 1
                val time = if (allDay) "${dayFmt.format(Date(c.getLong(1)))} (todo el día)" else fmt.format(Date(c.getLong(1)))
                val place = c.getString(3)?.takeIf { it.isNotBlank() }?.let { " en $it" } ?: ""
                lines += "$time: ${c.getString(0)}$place"
            }
        }
        return ToolResult(if (lines.isEmpty()) "No hay eventos." else lines.joinToString("\n"))
    }

    private fun createEvent(title: String, start: String, end: String?, location: String?, allDay: Boolean): ToolResult {
        val begin = try {
            LocalDateTime.parse(start)
        } catch (e: Exception) {
            return ToolResult("Fecha de inicio no válida: $start (usa 2026-11-02T18:30).", true)
        }
        val finish = end?.let { runCatching { LocalDateTime.parse(it) }.getOrNull() } ?: begin.plusHours(1)
        val zone = if (allDay) ZoneOffset.UTC else ZoneId.systemDefault()
        val startMs = (if (allDay) begin.toLocalDate().atStartOfDay() else begin).atZone(zone).toInstant().toEpochMilli()
        val endMs = if (allDay) startMs + 24L * 3600 * 1000 else finish.atZone(zone).toInstant().toEpochMilli()

        val calendarId = if (granted(Manifest.permission.WRITE_CALENDAR)) writableCalendar() else null
        if (calendarId == null) {
            val intent = Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, title)
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMs)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMs)
                .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, allDay)
            if (location != null) intent.putExtra(CalendarContract.Events.EVENT_LOCATION, location)
            return start(intent, "He abierto el calendario con el evento; falta pulsar Guardar.")
        }
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calendarId)
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DTSTART, startMs)
            put(CalendarContract.Events.DTEND, endMs)
            put(CalendarContract.Events.ALL_DAY, if (allDay) 1 else 0)
            put(CalendarContract.Events.EVENT_TIMEZONE, if (allDay) "UTC" else TimeZone.getDefault().id)
            if (location != null) put(CalendarContract.Events.EVENT_LOCATION, location)
        }
        context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: return ToolResult("No se pudo crear el evento.", true)
        return ToolResult("Evento «$title» creado.")
    }

    private fun writableCalendar(): Long? {
        val projection = arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY)
        val selection = "${CalendarContract.Calendars.VISIBLE} = 1 AND " +
            "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ${CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR}"
        var first: Long? = null
        context.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, projection, selection, null, null)?.use { c ->
            while (c.moveToNext()) {
                if (c.getInt(1) == 1) return c.getLong(0)
                if (first == null) first = c.getLong(0)
            }
        }
        return first
    }

    // ---------- Utilidades ----------

    private suspend fun withScreen(
        allowOnBlocked: Boolean = false,
        block: suspend (TarsAccessibilityService) -> ToolResult,
    ): ToolResult {
        val service = TarsAccessibilityService.instance ?: return ToolResult(
            "El control de pantalla está desactivado. El usuario debe activar 'TARS' en Ajustes → Accesibilidad.",
            true,
        )
        return withContext(Dispatchers.Main) {
            if (!allowOnBlocked && isBlockedForeground(service)) ToolResult(AppBlocklist.REFUSAL, true)
            else block(service)
        }
    }

    /** ¿La app que hay ahora en pantalla es de un banco, pagos o compras? */
    private fun isBlockedForeground(service: TarsAccessibilityService): Boolean {
        val pkg = service.foregroundPackage() ?: return false
        return AppBlocklist.isBlockedApp(pkg, appLabel(pkg), settings.extraBlocked)
    }

    private fun appLabel(pkg: String): String = try {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) {
        ""
    }

    private fun start(intent: Intent, ok: String): ToolResult = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        ToolResult(ok)
    } catch (e: ActivityNotFoundException) {
        ToolResult("No hay ninguna app que pueda hacer eso.", true)
    } catch (e: SecurityException) {
        ToolResult("Android no me deja hacer eso: ${e.message}", true)
    }

    private fun installed(pkg: String) = try {
        context.packageManager.getPackageInfo(pkg, 0)
        true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    private fun missing(what: String) =
        ToolResult("Falta el permiso de $what. El usuario debe concederlo en Ajustes de TARS → Permisos.", true)

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    private fun normalize(s: String) = Normalizer.normalize(s.lowercase().trim(), Normalizer.Form.NFD)
        .replace(Regex("\\p{M}"), "")

    private fun Map<String, Any?>.str(key: String) = this[key]?.toString() ?: ""
    private fun Map<String, Any?>.strOrNull(key: String) = this[key]?.toString()?.takeIf { it.isNotBlank() }
    private fun Map<String, Any?>.bool(key: String) = this[key] == true || this[key] == "true"
    private fun Map<String, Any?>.int(key: String) = when (val v = this[key]) {
        is Number -> v.toInt()
        is String -> v.toDoubleOrNull()?.toInt() ?: 0
        else -> 0
    }
}

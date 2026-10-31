package com.tars.asistente.quick

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.tars.asistente.R
import com.tars.asistente.TarsApp
import com.tars.asistente.ui.MainActivity
import com.tars.asistente.voice.VoiceInput
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Acceso rápido a TARS sin abrir la app: un botón flotante (en la pantalla de inicio o encima de
 * las apps) y un botón «Hablar» en la notificación, visible en la pantalla de bloqueo.
 *
 * No escucha nada hasta que se toca uno de los botones: el micrófono solo se abre durante la petición,
 * así que apenas gasta batería.
 */
class FloatingService : Service() {

    private val app get() = application as TarsApp
    private val main = Handler(Looper.getMainLooper())
    private lateinit var wm: WindowManager
    private lateinit var voice: VoiceInput

    private var bubble: BubbleView? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var card: TextView? = null
    private var onHome = true
    private var busy = false
    private val hideCard = Runnable { removeCard() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(WindowManager::class.java)
        voice = VoiceInput(
            context = this,
            onPartial = { showCard("«$it»") },
            onResult = { ask(it) },
            onError = { message ->
                busy = false
                setBubbleState(BubbleView.State.IDLE)
                if (message != null) showCard(message, autoHideMs = 3000) else removeCard()
            },
            onListeningChanged = { listening ->
                if (listening) setBubbleState(BubbleView.State.LISTENING)
            },
            onLevel = { bubble?.setVoiceLevel(it) },
        )
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startInForeground()
        refresh()
        return START_STICKY
    }

    override fun onDestroy() {
        instance = null
        voice.stop()
        removeBubble()
        removeCard()
        super.onDestroy()
    }

    private fun startInForeground() {
        val type = if (Build.VERSION.SDK_INT >= 30) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
        } catch (e: Exception) {
            // Android no deja usar el micrófono si no se inició desde la app (p. ej. tras actualizarse):
            // se volverá a iniciar al abrir TARS.
            stopSelf()
        }
    }

    private fun buildNotification(): Notification {
        val s = app.settings
        val listen = PendingIntent.getBroadcast(
            this, 0, Intent(this, ListenReceiver::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, TarsApp.CHANNEL_BUTTON)
            .setSmallIcon(R.drawable.ic_tars)
            .setContentTitle("TARS")
            .setContentText("Toca «Hablar» para pedirle algo")
            .setContentIntent(open)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            // En la pantalla de bloqueo solo se ve si el usuario lo ha activado.
            .setVisibility(
                if (s.lockScreenButton) NotificationCompat.VISIBILITY_PUBLIC else NotificationCompat.VISIBILITY_SECRET
            )
            .addAction(R.drawable.ic_mic, "Hablar", listen)
            .build()
    }

    /** Vuelve a aplicar los ajustes (mostrar u ocultar el botón, notificación…). */
    fun refresh() {
        startInForeground()
        val s = app.settings
        val wantBubble = s.enabled && s.floatingButton && Settings.canDrawOverlays(this) &&
            (!s.bubbleOnlyOnHome || onHome || busy)
        if (wantBubble) addBubble() else removeBubble()
    }

    /** Lo llama el servicio de accesibilidad cuando cambia la app en primer plano. */
    fun onForegroundApp(pkg: String) {
        if (pkg == "com.android.systemui" || isKeyboard(pkg)) return
        val home = pkg in launchers()
        if (home != onHome) {
            onHome = home
            refresh()
        }
    }

    private fun launchers(): Set<String> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
            .map { it.activityInfo.packageName }.toSet()
    }

    private fun isKeyboard(pkg: String): Boolean =
        getSystemService(InputMethodManager::class.java).enabledInputMethodList.any { it.packageName == pkg }

    // ---------- Escuchar y responder ----------

    fun listen() {
        val s = app.settings
        if (!s.enabled || busy) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            showCard("Falta el permiso de micrófono: abre TARS para concederlo.", autoHideMs = 4000)
            return
        }
        app.speaker.stop()
        busy = true
        refresh()
        setBubbleState(BubbleView.State.LISTENING)
        bubble?.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        showCard("Te escucho…")
        voice.start()
    }

    private fun ask(text: String) {
        showCard("«$text»\n…")
        setBubbleState(BubbleView.State.THINKING)
        app.scope.launch {
            val answer = app.brain.ask(text)
            showCard(answer)
            if (app.settings.speakReplies) {
                setBubbleState(BubbleView.State.SPEAKING)
                app.speaker.speak(answer) {
                    main.post {
                        busy = false
                        setBubbleState(BubbleView.State.IDLE)
                        if (app.settings.continuousConversation && answer.trimEnd().endsWith("?")) {
                            listen()
                        } else {
                            scheduleHide(2500)
                            refresh()
                        }
                    }
                }
            } else {
                busy = false
                setBubbleState(BubbleView.State.IDLE)
                scheduleHide(6000)
                refresh()
            }
        }
    }

    // ---------- Vistas flotantes ----------

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun overlayParams(width: Int, height: Int, flags: Int) = WindowManager.LayoutParams(
        width, height,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT,
    )

    /** Tamaño de la ventana del botón: justo el círculo en reposo; más grande para las ondas al escuchar. */
    private val idleSize get() = dp(68)
    private val activeSize get() = dp(150)

    @SuppressLint("ClickableViewAccessibility")
    private fun addBubble() {
        if (bubble != null) return
        val size = idleSize
        val view = BubbleView(this)
        val params = overlayParams(size, size, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS).apply {
            gravity = Gravity.TOP or Gravity.START
            val s = app.settings
            x = if (s.bubbleX >= 0) s.bubbleX else resources.displayMetrics.widthPixels - size - dp(8)
            y = s.bubbleY
        }
        view.setOnTouchListener(BubbleTouch(params))
        wm.addView(view, params)
        bubble = view
        bubbleParams = params
        setBubbleState(if (busy) BubbleView.State.THINKING else BubbleView.State.IDLE)
    }

    private fun removeBubble() {
        bubble?.let { runCatching { wm.removeView(it) } }
        bubble = null
    }

    /** Cambia la animación del botón y agranda o encoge su ventana manteniendo el centro en su sitio. */
    private fun setBubbleState(state: BubbleView.State) {
        val view = bubble ?: return
        val params = bubbleParams ?: return
        view.state = state
        val wanted = if (state == BubbleView.State.IDLE) idleSize else activeSize
        if (params.width != wanted) {
            val delta = (wanted - params.width) / 2
            params.x -= delta
            params.y -= delta
            params.width = wanted
            params.height = wanted
            runCatching { wm.updateViewLayout(view, params) }
        }
    }

    /** Posición guardada = esquina de la ventana en reposo, aunque ahora esté agrandada. */
    private fun saveBubblePosition(params: WindowManager.LayoutParams) {
        val offset = (params.width - idleSize) / 2
        app.settings.bubbleX = params.x + offset
        app.settings.bubbleY = params.y + offset
    }

    /** Toque: hablar. Mantener: abrir TARS. Arrastrar: mover el botón. */
    private inner class BubbleTouch(private val params: WindowManager.LayoutParams) : View.OnTouchListener {
        private val slop = ViewConfiguration.get(this@FloatingService).scaledTouchSlop
        private var startX = 0f
        private var startY = 0f
        private var origX = 0
        private var origY = 0
        private var dragging = false
        private val longPress = Runnable {
            if (!dragging) {
                startActivity(Intent(this@FloatingService, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                dragging = true // que soltar no cuente como toque
            }
        }

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = e.rawX; startY = e.rawY
                    origX = params.x; origY = params.y
                    dragging = false
                    main.postDelayed(longPress, 600)
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - startX
                    val dy = e.rawY - startY
                    if (!dragging && (abs(dx) > slop || abs(dy) > slop)) {
                        dragging = true
                        main.removeCallbacks(longPress)
                    }
                    if (dragging) {
                        params.x = (origX + dx).toInt()
                        params.y = (origY + dy).toInt()
                        runCatching { wm.updateViewLayout(v, params) }
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    main.removeCallbacks(longPress)
                    if (dragging) {
                        saveBubblePosition(params)
                    } else if (e.actionMasked == MotionEvent.ACTION_UP) {
                        if (busy) stopAll() else listen()
                    }
                }
            }
            return true
        }
    }

    private fun stopAll() {
        voice.stop()
        app.speaker.stop()
        busy = false
        setBubbleState(BubbleView.State.IDLE)
        removeCard()
        refresh()
    }

    private fun showCard(text: String, autoHideMs: Long = 0) {
        main.removeCallbacks(hideCard)
        if (!Settings.canDrawOverlays(this)) return
        val view = card ?: createCard() ?: return
        view.text = text
        if (autoHideMs > 0) scheduleHide(autoHideMs)
    }

    private fun createCard(): TextView? {
        val view = TextView(this).apply {
            setTextColor(0xFFE6EAF0.toInt())
            textSize = 16f
            setPadding(dp(16), dp(12), dp(16), dp(12))
            maxLines = 8
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(0xF0171B22.toInt())
                setStroke(dp(1), STEEL)
            }
            setOnClickListener { removeCard() }
        }
        val params = overlayParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT, 0)
            .apply {
                gravity = Gravity.BOTTOM
                y = dp(96)
                horizontalMargin = 0.04f
            }
        return runCatching { wm.addView(view, params) }.map { view }.getOrNull()?.also { card = it }
    }

    private fun scheduleHide(ms: Long) {
        main.removeCallbacks(hideCard)
        main.postDelayed(hideCard, ms)
    }

    private fun removeCard() {
        card?.let { runCatching { wm.removeView(it) } }
        card = null
    }

    companion object {
        private const val NOTIFICATION_ID = 7
        private const val STEEL = 0xFF9FB4C7.toInt()

        @Volatile
        var instance: FloatingService? = null
            private set

        /** ¿Hace falta el servicio con los ajustes actuales? */
        fun wanted(context: Context): Boolean {
            val s = (context.applicationContext as TarsApp).settings
            return s.enabled && (s.floatingButton || s.lockScreenButton)
        }

        /**
         * Arranca, actualiza o para el servicio según los ajustes. Llamar desde la app en primer plano:
         * Android solo deja abrir el micrófono en segundo plano si el servicio se inició así.
         */
        fun sync(context: Context) {
            val running = instance
            if (!wanted(context)) {
                running?.stopSelf()
                return
            }
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                return
            }
            if (running != null) {
                running.refresh()
                return
            }
            try {
                ContextCompat.startForegroundService(context, Intent(context, FloatingService::class.java))
            } catch (e: Exception) {
                // Android no deja iniciarlo ahora (app en segundo plano): se reintentará al abrir TARS.
            }
        }
    }
}

package com.tars.asistente.access

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.tars.asistente.quick.FloatingService
import kotlinx.coroutines.delay

/**
 * Permite a TARS leer la pantalla y pulsar/escribir en otras apps. Solo actúa cuando
 * TARS se lo pide; no registra ni envía nada por su cuenta.
 */
class TarsAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        instance = this
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Solo se usa para saber si estás en la pantalla de inicio (botón flotante de TARS).
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            event.packageName?.toString()?.let { FloatingService.instance?.onForegroundApp(it) }
        }
    }
    override fun onInterrupt() = Unit

    private fun root(): AccessibilityNodeInfo? = rootInActiveWindow

    fun foregroundPackage(): String? = root()?.packageName?.toString()

    /** Texto y elementos pulsables de la pantalla actual, resumidos para el modelo. */
    fun readScreen(): String {
        val root = root() ?: return "No puedo leer la pantalla ahora mismo."
        val out = StringBuilder("App en pantalla: ${root.packageName}\n")
        var count = 0
        fun walk(node: AccessibilityNodeInfo?, depth: Int) {
            if (node == null || count > MAX_NODES || depth > 40) return
            if (!node.isVisibleToUser) return
            val label = labelOf(node)
            if (label.isNotBlank()) {
                val tags = buildList {
                    if (node.isClickable) add("pulsable")
                    if (node.isEditable) add("campo de texto")
                    if (node.isCheckable) add(if (node.isChecked) "activado" else "desactivado")
                    if (node.isScrollable) add("desplazable")
                }
                out.append("- ").append(label.take(200))
                if (tags.isNotEmpty()) out.append(" [").append(tags.joinToString(", ")).append(']')
                out.append('\n')
                count++
            } else if (node.isEditable) {
                out.append("- (campo de texto vacío)\n")
                count++
            }
            for (i in 0 until node.childCount) walk(node.getChild(i), depth + 1)
        }
        walk(root, 0)
        if (count > MAX_NODES) out.append("… (pantalla recortada)\n")
        return out.toString().take(8000)
    }

    private fun labelOf(node: AccessibilityNodeInfo): String {
        if (node.isPassword) return "(contraseña oculta)"
        val text = node.text?.toString().orEmpty()
        val desc = node.contentDescription?.toString().orEmpty()
        return when {
            text.isNotBlank() && desc.isNotBlank() && desc != text -> "$text ($desc)"
            text.isNotBlank() -> text
            else -> desc
        }.replace('\n', ' ').trim()
    }

    /** Pulsa el elemento cuyo texto o descripción coincide con [query]. */
    fun tap(query: String): Boolean {
        val node = find(query) ?: return false
        var target: AccessibilityNodeInfo? = node
        while (target != null && !target.isClickable) target = target.parent
        if (target != null && target.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
        val bounds = Rect().also { node.getBoundsInScreen(it) }
        return tapAt(bounds.exactCenterX(), bounds.exactCenterY())
    }

    private fun tapAt(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    private fun find(query: String): AccessibilityNodeInfo? {
        val root = root() ?: return null
        val q = query.trim().lowercase()
        val candidates = root.findAccessibilityNodeInfosByText(query).filter { it.isVisibleToUser }
        return candidates.firstOrNull { labelOf(it).lowercase() == q }
            ?: candidates.firstOrNull()
            ?: findByDescription(root, q)
    }

    private fun findByDescription(node: AccessibilityNodeInfo?, q: String): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isVisibleToUser && labelOf(node).lowercase().contains(q)) return node
        for (i in 0 until node.childCount) findByDescription(node.getChild(i), q)?.let { return it }
        return null
    }

    /** Escribe en el campo enfocado o en el primero que coincida con [hint]. */
    fun typeText(text: String, hint: String?): Boolean {
        val root = root() ?: return false
        val field = hint?.let { h -> find(h)?.takeIf { it.isEditable } }
            ?: root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }
            ?: firstEditable(root)
            ?: return false
        field.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun firstEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isVisibleToUser) return node
        for (i in 0 until node.childCount) firstEditable(node.getChild(i))?.let { return it }
        return null
    }

    fun scroll(down: Boolean): Boolean {
        val scrollable = firstScrollable(root()) ?: return false
        return scrollable.performAction(
            if (down) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        )
    }

    private fun firstScrollable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isScrollable && node.isVisibleToUser) return node
        for (i in 0 until node.childCount) firstScrollable(node.getChild(i))?.let { return it }
        return null
    }

    fun systemAction(action: String): Boolean {
        val code = when (action) {
            "back" -> GLOBAL_ACTION_BACK
            "home" -> GLOBAL_ACTION_HOME
            "recents" -> GLOBAL_ACTION_RECENTS
            "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
            "quick_settings" -> GLOBAL_ACTION_QUICK_SETTINGS
            "lock_screen" -> if (Build.VERSION.SDK_INT >= 28) GLOBAL_ACTION_LOCK_SCREEN else return false
            "screenshot" -> if (Build.VERSION.SDK_INT >= 28) GLOBAL_ACTION_TAKE_SCREENSHOT else return false
            else -> return false
        }
        return performGlobalAction(code)
    }

    /** Espera a que aparezca el botón de enviar de WhatsApp y lo pulsa. */
    suspend fun pressWhatsAppSend(timeoutMs: Long = 8000): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val root = root()
            if (root != null && root.packageName?.startsWith("com.whatsapp") == true) {
                val byId = root.findAccessibilityNodeInfosByViewId("${root.packageName}:id/send").firstOrNull()
                val button = byId ?: listOf("Enviar", "Send").firstNotNullOfOrNull { label ->
                    root.findAccessibilityNodeInfosByText(label).firstOrNull { it.isClickable }
                }
                if (button != null && button.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
            }
            delay(400)
        }
        return false
    }

    companion object {
        private const val MAX_NODES = 150

        @Volatile
        var instance: TarsAccessibilityService? = null
            private set
    }
}

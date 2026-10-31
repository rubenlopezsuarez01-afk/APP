package com.tars.asistente.quick

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RectF
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import androidx.core.content.ContextCompat
import com.tars.asistente.R
import kotlin.math.PI
import kotlin.math.sin

/**
 * Botón flotante de TARS: un círculo con micrófono que se anima según lo que está haciendo.
 * - Reposo: círculo gris acero.
 * - Escuchando: naranja, late y lanza ondas que crecen con tu voz.
 * - Pensando: un arco gira alrededor.
 * - Hablando: palpita suavemente.
 */
class BubbleView(context: Context) : View(context) {

    enum class State { IDLE, LISTENING, THINKING, SPEAKING }

    var state = State.IDLE
        set(value) {
            field = value
            if (value != State.LISTENING) targetLevel = 0f
            invalidate()
        }

    private var targetLevel = 0f
    private var level = 0f
    private val startTime = SystemClock.uptimeMillis()

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)

    /** Radio del círculo en reposo. */
    val bodyRadius = dp(30f)

    private val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(70, 0, 0, 0) }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(3f)
    }
    private val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(3.5f)
        strokeCap = Paint.Cap.ROUND
        color = STEEL
    }
    private val arcRect = RectF()
    private val mic = ContextCompat.getDrawable(context, R.drawable.ic_mic)!!.mutate().apply {
        colorFilter = PorterDuffColorFilter(DARK, PorterDuff.Mode.SRC_IN)
    }

    init {
        contentDescription = "Hablar con TARS"
    }

    /** Volumen de la voz que llega del reconocedor (dB aproximados, de -2 a 10). */
    fun setVoiceLevel(rmsDb: Float) {
        targetLevel = ((rmsDb + 2f) / 12f).coerceIn(0f, 1f)
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val t = (SystemClock.uptimeMillis() - startTime).toFloat()
        level += (targetLevel - level) * 0.25f
        val maxRadius = minOf(cx, cy) - dp(2f)

        var scale = 1f
        when (state) {
            State.LISTENING -> {
                // Tres ondas que salen del botón; más grandes cuanto más alto hablas.
                for (i in 0 until 3) {
                    val phase = ((t / 1400f) + i / 3f) % 1f
                    val reach = 0.55f + 0.45f * level
                    val r = bodyRadius + phase * (maxRadius - bodyRadius) * reach
                    ringPaint.color = AMBER
                    ringPaint.alpha = ((1f - phase) * 200).toInt()
                    canvas.drawCircle(cx, cy, r, ringPaint)
                }
                scale = 1f + 0.06f * sin(t / 220f * PI.toFloat() / 2f) + 0.10f * level
            }
            State.THINKING -> {
                val r = bodyRadius + dp(7f)
                arcRect.set(cx - r, cy - r, cx + r, cy + r)
                val start = (t / 2.5f) % 360f
                canvas.drawArc(arcRect, start, 100f, false, arcPaint)
                canvas.drawArc(arcRect, start + 180f, 100f, false, arcPaint)
            }
            State.SPEAKING -> scale = 1f + 0.05f * sin(t / 160f)
            State.IDLE -> Unit
        }

        val r = bodyRadius * scale
        canvas.drawCircle(cx, cy + dp(2f), r, shadowPaint)
        bodyPaint.color = if (state == State.LISTENING) AMBER else STEEL
        canvas.drawCircle(cx, cy, r, bodyPaint)

        val icon = (r * 0.9f).toInt()
        mic.setBounds((cx - icon / 2).toInt(), (cy - icon / 2).toInt(), (cx + icon / 2).toInt(), (cy + icon / 2).toInt())
        mic.draw(canvas)

        if (state != State.IDLE) postInvalidateOnAnimation()
    }

    companion object {
        const val STEEL = 0xFF9FB4C7.toInt()
        const val AMBER = 0xFFFFB454.toInt()
        const val DARK = 0xFF0E1116.toInt()
    }
}

package com.tars.asistente.quick

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Botón «Hablar» de la notificación de TARS (funciona también con el móvil bloqueado). */
class ListenReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        FloatingService.instance?.listen()
    }
}

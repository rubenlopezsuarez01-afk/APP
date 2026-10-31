package com.tars.asistente.update

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import com.tars.asistente.TarsApp
import com.tars.asistente.quick.FloatingService
import com.tars.asistente.ui.MainActivity

/** Resultado de la instalación de una actualización, y aviso cuando TARS se ha actualizado. */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_STATUS -> onStatus(context, intent)
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                val version = Updater.installedVersion(context)
                val settings = (context.applicationContext as TarsApp).settings
                // Volver a poner el botón flotante; si Android no lo deja desde segundo plano, basta abrir TARS.
                FloatingService.sync(context)
                val extra = if (settings.floatingButton || settings.lockScreenButton) {
                    " Si el botón flotante no aparece, abre TARS una vez."
                } else {
                    ""
                }
                Updater.notify(context, "TARS actualizado", "Ya tienes la versión $version.$extra", openApp(context))
            }
        }
    }

    private fun onStatus(context: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // Android pide confirmación (versiones anteriores a Android 12): avisar para instalar con un toque.
                @Suppress("DEPRECATION")
                val confirm = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                } ?: return
                val tap = PendingIntent.getActivity(
                    context, 1, confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )
                Updater.notify(context, "Actualización de TARS lista", "Toca para instalarla.", tap)
            }
            PackageInstaller.STATUS_SUCCESS -> Unit // el aviso lo da ACTION_MY_PACKAGE_REPLACED
            PackageInstaller.STATUS_FAILURE_CONFLICT, PackageInstaller.STATUS_FAILURE_INCOMPATIBLE ->
                Updater.notify(
                    context, "No se pudo actualizar TARS",
                    "La versión nueva está firmada con otra clave. Desinstala TARS y vuelve a instalarla " +
                        "desde el enlace de descarga (solo hace falta una vez).",
                )
            PackageInstaller.STATUS_FAILURE_STORAGE ->
                Updater.notify(context, "No se pudo actualizar TARS", "No hay espacio suficiente en el teléfono.")
            else -> {
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE).orEmpty()
                Updater.notify(context, "No se pudo actualizar TARS", "Se volverá a intentar más tarde. $message".trim())
            }
        }
    }

    private fun openApp(context: Context) = PendingIntent.getActivity(
        context, 2, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
    )

    companion object {
        const val ACTION_STATUS = "com.tars.asistente.UPDATE_STATUS"
    }
}

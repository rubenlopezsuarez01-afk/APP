package com.tars.asistente.update

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** Comprobación de actualizaciones en segundo plano (periódica o desde el botón de Ajustes). */
class UpdateWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val manual = inputData.getBoolean(KEY_MANUAL, false)
        return try {
            when (val r = Updater.checkAndInstall(applicationContext)) {
                Updater.Result.UpToDate -> {
                    if (manual) Updater.notify(applicationContext, "TARS está al día", "Ya tienes la última versión.")
                }
                is Updater.Result.Installing -> Unit // el resultado llega a UpdateReceiver
                is Updater.Result.Failed -> {
                    val fix = PendingIntent.getActivity(
                        applicationContext, 0,
                        Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:${applicationContext.packageName}"),
                        ),
                        PendingIntent.FLAG_IMMUTABLE,
                    )
                    Updater.notify(applicationContext, "No se pudo actualizar TARS", r.reason, fix)
                }
            }
            Result.success()
        } catch (e: Exception) {
            if (manual) Updater.notify(applicationContext, "No se pudo buscar actualizaciones", "Revisa la conexión.")
            if (manual) Result.success() else Result.retry()
        }
    }

    companion object {
        const val KEY_MANUAL = "manual"
    }
}

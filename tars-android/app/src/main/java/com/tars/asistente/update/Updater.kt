package com.tars.asistente.update

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.pm.PackageInfoCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.fasterxml.jackson.databind.ObjectMapper
import com.tars.asistente.R
import com.tars.asistente.TarsApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Actualización automática: consulta la última versión publicada por GitHub Actions
 * (release `tars-latest`), descarga el APK y lo instala. En Android 12 o superior se instala
 * sola, sin preguntar; en versiones anteriores Android pide confirmarlo con un toque.
 */
object Updater {
    private const val RELEASE = "https://github.com/rubenlopezsuarez01-afk/APP/releases/download/tars-latest"
    private const val VERSION_URL = "$RELEASE/version.json"
    private const val PERIODIC_WORK = "tars-auto-update"
    private const val NOW_WORK = "tars-update-now"
    const val NOTIFICATION_ID = 9

    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    sealed interface Result {
        data object UpToDate : Result
        data class Installing(val version: Long) : Result
        data class Failed(val reason: String) : Result
    }

    fun installedVersion(context: Context): Long =
        PackageInfoCompat.getLongVersionCode(context.packageManager.getPackageInfo(context.packageName, 0))

    /** Programa (o cancela) la comprobación periódica según el ajuste. */
    fun schedule(context: Context) {
        val wm = WorkManager.getInstance(context)
        val settings = (context.applicationContext as TarsApp).settings
        if (!settings.autoUpdate) {
            wm.cancelUniqueWork(PERIODIC_WORK)
            return
        }
        // Cada 6 horas, con internet y con el móvil sin usar, para no cortar a TARS mientras le hablas.
        val request = PeriodicWorkRequestBuilder<UpdateWorker>(6, TimeUnit.HOURS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .setRequiresBatteryNotLow(true)
                    .setRequiresDeviceIdle(true)
                    .build()
            )
            .build()
        wm.enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** Busca e instala una actualización ya (botón de Ajustes). */
    fun checkNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<UpdateWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(androidx.work.workDataOf(UpdateWorker.KEY_MANUAL to true))
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(NOW_WORK, ExistingWorkPolicy.REPLACE, request)
    }

    suspend fun checkAndInstall(context: Context): Result = withContext(Dispatchers.IO) {
        val json = ObjectMapper().readTree(fetch(VERSION_URL).use { it.body!!.string() })
        val latest = json.path("versionCode").asLong(0)
        val apkUrl = json.path("apkUrl").asText("$RELEASE/TARS.apk")
        if (latest <= installedVersion(context)) return@withContext Result.UpToDate

        if (!context.packageManager.canRequestPackageInstalls()) {
            return@withContext Result.Failed(
                "Falta el permiso «Instalar apps desconocidas» para TARS (Ajustes de TARS → Actualizaciones)."
            )
        }

        val apk = File(context.cacheDir, "update.apk")
        fetch(apkUrl).use { response -> apk.outputStream().use { response.body!!.byteStream().copyTo(it) } }

        // Comprobación básica antes de instalar: que sea TARS y más nuevo. Android además exige la misma firma.
        val info = context.packageManager.getPackageArchiveInfo(apk.path, 0)
        if (info == null || info.packageName != context.packageName ||
            PackageInfoCompat.getLongVersionCode(info) <= installedVersion(context)
        ) {
            apk.delete()
            return@withContext Result.Failed("El archivo descargado no es una versión válida de TARS.")
        }

        install(context, apk)
        Result.Installing(latest)
    }

    private fun fetch(url: String): okhttp3.Response {
        val response = http.newCall(Request.Builder().url(url).build()).execute()
        if (!response.isSuccessful) {
            response.close()
            throw java.io.IOException("HTTP ${response.code} al descargar $url")
        }
        return response
    }

    private fun install(context: Context, apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            if (Build.VERSION.SDK_INT >= 31) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
        }
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("TARS.apk", 0, apk.length()).use { out ->
                apk.inputStream().use { it.copyTo(out) }
                session.fsync(out)
            }
            val statusIntent = Intent(context, UpdateReceiver::class.java).setAction(UpdateReceiver.ACTION_STATUS)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
            val pending = PendingIntent.getBroadcast(context, sessionId, statusIntent, flags)
            session.commit(pending.intentSender)
        }
    }

    /** Aviso en la barra de notificaciones sobre la actualización. */
    fun notify(context: Context, title: String, text: String, tap: PendingIntent? = null) {
        val notification = NotificationCompat.Builder(context, TarsApp.CHANNEL_UPDATES)
            .setSmallIcon(R.drawable.ic_tars)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .apply { if (tap != null) setContentIntent(tap) }
            .build()
        try {
            context.getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            // Sin permiso de notificaciones: no se avisa.
        }
    }
}

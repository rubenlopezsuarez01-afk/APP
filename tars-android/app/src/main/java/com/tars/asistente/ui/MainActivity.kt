package com.tars.asistente.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import com.tars.asistente.quick.FloatingService

class MainActivity : ComponentActivity() {
    private val vm: ChatViewModel by viewModels()
    private var listenWhenAllowed = false

    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        vm.refresh()
        FloatingService.sync(this)
        if (listenWhenAllowed && hasMic()) vm.startListening()
        listenWhenAllowed = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TarsTheme {
                var showSettings by rememberSaveable { mutableStateOf(!vm.settings.hasKey) }
                BackHandler(enabled = showSettings) { showSettings = false }
                if (showSettings) {
                    SettingsScreen(vm, onBack = { showSettings = false }, onRequestPermissions = {
                        permissions.launch(RUNTIME_PERMISSIONS)
                    })
                } else {
                    ChatScreen(vm, onSettings = { showSettings = true })
                }
            }
        }
        if (savedInstanceState == null) handle(intent, firstLaunch = true)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent, firstLaunch = false)
    }

    override fun onResume() {
        super.onResume()
        vm.refresh()
        FloatingService.sync(this)
    }

    /** Si nos abren como asistente (pulsación larga, mosaico o acceso directo), empezar a escuchar. */
    private fun handle(intent: Intent?, firstLaunch: Boolean) {
        val listen = intent?.action?.let { it in LISTEN_ACTIONS } == true || intent?.getBooleanExtra(EXTRA_LISTEN, false) == true
        when {
            listen && hasMic() -> vm.startListening()
            listen || (firstLaunch && !hasMic()) -> {
                listenWhenAllowed = listen
                permissions.launch(RUNTIME_PERMISSIONS)
            }
        }
    }

    private fun hasMic() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    companion object {
        const val EXTRA_LISTEN = "listen"
        private val LISTEN_ACTIONS = setOf(Intent.ACTION_ASSIST, Intent.ACTION_VOICE_COMMAND, "com.tars.asistente.LISTEN")
    }
}

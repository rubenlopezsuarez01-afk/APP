package com.tars.asistente.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.tars.asistente.access.TarsAccessibilityService

val RUNTIME_PERMISSIONS: Array<String> = buildList {
    add(Manifest.permission.RECORD_AUDIO)
    add(Manifest.permission.READ_CONTACTS)
    add(Manifest.permission.CALL_PHONE)
    add(Manifest.permission.SEND_SMS)
    add(Manifest.permission.READ_CALENDAR)
    add(Manifest.permission.WRITE_CALENDAR)
    if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
}.toTypedArray()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: ChatViewModel, onBack: () -> Unit, onRequestPermissions: () -> Unit) {
    val s = vm.settings
    val context = LocalContext.current
    @Suppress("UNUSED_VARIABLE") val tick = vm.refreshTick // recalcular estados al volver de Ajustes

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ajustes de TARS") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(if (vm.enabled) "TARS encendido" else "TARS apagado", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Apagado no escucha, no lee mensajes ni notificaciones y no toca el teléfono.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = vm.enabled, onCheckedChange = vm::switchPower)
            }

            Section("Cerebro (Claude)")
            var key by remember { mutableStateOf(s.apiKey) }
            OutlinedTextField(
                value = key,
                onValueChange = { key = it; s.apiKey = it },
                label = { Text("Clave de API de Anthropic") },
                placeholder = { Text("sk-ant-…") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Consíguela en console.anthropic.com → API Keys. Se guarda solo en este teléfono.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            var model by remember { mutableStateOf(s.model) }
            Choice("Modelo", com.tars.asistente.TarsSettings.MODELS, model) { model = it; s.model = it }
            var effort by remember { mutableStateOf(s.effort) }
            Choice("Velocidad", com.tars.asistente.TarsSettings.EFFORTS, effort) { effort = it; s.effort = it }

            Section("Personalidad")
            var name by remember { mutableStateOf(s.userName) }
            OutlinedTextField(
                value = name,
                onValueChange = { name = it; s.userName = it },
                label = { Text("Tu nombre") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            var humor by remember { mutableFloatStateOf(s.humor.toFloat()) }
            Text("Nivel de humor: ${humor.toInt()}%")
            Slider(
                value = humor,
                onValueChange = { humor = it },
                onValueChangeFinished = { s.humor = humor.toInt() },
                valueRange = 0f..100f,
                steps = 9,
            )

            Section("Voz y mensajes")
            Toggle("Responder en voz alta", "Cuando le hablas, TARS contesta hablando.", s.speakReplies) { s.speakReplies = it }
            Toggle(
                "Seguir escuchando si pregunta",
                "Si TARS te hace una pregunta (p. ej. confirmar un envío), vuelve a escuchar solo.",
                s.continuousConversation,
            ) { s.continuousConversation = it }
            Toggle(
                "Leer mensajes al llegar",
                "Anuncia en voz alta los mensajes nuevos de WhatsApp, Telegram, SMS…",
                s.announceMessages,
            ) { s.announceMessages = it }
            Toggle(
                "Sugerir respuestas",
                "Cuando llega un mensaje, TARS redacta una respuesta y te la ofrece en una notificación con " +
                    "Enviar / Editar. El texto del chat se envía a Claude para redactarla.",
                s.suggestReplies,
            ) { s.suggestReplies = it }
            Toggle(
                "Confirmar antes de enviar",
                "TARS te lee el mensaje y espera tu «sí» antes de enviar o llamar.",
                s.requireConfirmation,
            ) { s.requireConfirmation = it }
            Toggle("Buscar en internet", "Para noticias, tiempo, resultados, horarios…", s.webSearch) { s.webSearch = it }
            var cc by remember { mutableStateOf(s.countryCode) }
            OutlinedTextField(
                value = cc,
                onValueChange = { cc = it; s.countryCode = it },
                label = { Text("Prefijo de país para WhatsApp") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Section("Permisos")
            val runtimeOk = RUNTIME_PERMISSIONS.all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
            Status(
                "Micrófono, contactos, llamadas, SMS, calendario",
                runtimeOk,
                "Conceder",
                onRequestPermissions,
            )
            val listenerOk = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
            Status("Acceso a notificaciones (leer y responder mensajes)", listenerOk, "Activar") {
                context.open(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            }
            Status("Control de pantalla (accesibilidad)", TarsAccessibilityService.instance != null, "Activar") {
                context.open(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            }
            Status("TARS como asistente (pulsación larga de Inicio)", null, "Elegir") {
                context.open(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
            }
            Text(
                "Si Android dice «Ajuste restringido» al activar notificaciones o accesibilidad: abre la ficha " +
                    "de la app, pulsa ⋮ (arriba a la derecha) → «Permitir ajustes restringidos» y vuelve a intentarlo.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedButton(onClick = {
                context.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
                )
            }) { Text("Abrir ficha de la app") }

            Section("Apps bloqueadas")
            Text(
                "TARS nunca entra en apps ni webs de bancos, pagos, inversión ni compras (Amazon, AliExpress, " +
                    "Shein, Temu, PayPal, Bizum, Google Wallet…), ni lee sus notificaciones. Este bloqueo no se " +
                    "puede quitar.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            var extra by remember { mutableStateOf(s.extraBlocked.joinToString(", ")) }
            OutlinedTextField(
                value = extra,
                onValueChange = { extra = it; s.extraBlocked = it.split(',') },
                label = { Text("Bloquear también (separado por comas)") },
                placeholder = { Text("p. ej. mediamarkt, glovo") },
                modifier = Modifier.fillMaxWidth(),
            )

            Section("Memoria")
            var memories by remember { mutableStateOf(s.memories) }
            if (memories.isEmpty()) {
                Text(
                    "Vacía. Di «Recuerda que…» y TARS lo guardará aquí.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            memories.forEach { fact ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(fact, Modifier.weight(1f))
                    IconButton(onClick = {
                        s.memories = s.memories - fact
                        memories = s.memories
                    }) { Icon(Icons.Default.Delete, "Borrar") }
                }
            }
            Spacer(Modifier.size(32.dp))
        }
    }
}

private fun Context.open(action: String) {
    try {
        startActivity(Intent(action))
    } catch (e: Exception) {
        startActivity(Intent(Settings.ACTION_SETTINGS))
    }
}

@Composable
private fun Section(title: String) {
    Spacer(Modifier.size(8.dp))
    Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
    HorizontalDivider()
}

@Composable
private fun Toggle(title: String, subtitle: String, initial: Boolean, onChange: (Boolean) -> Unit) {
    var checked by remember { mutableStateOf(initial) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = { checked = it; onChange(it) })
    }
}

@Composable
private fun Choice(title: String, options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Text(title)
    options.forEach { (value, label) ->
        Row(
            Modifier
                .fillMaxWidth()
                .selectable(selected = value == selected, onClick = { onSelect(value) }),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = value == selected, onClick = { onSelect(value) })
            Text(label)
        }
    }
}

@Composable
private fun Status(title: String, ok: Boolean?, button: String, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        when (ok) {
            true -> Icon(Icons.Default.CheckCircle, "Activo", tint = Color(0xFF6FCF97))
            false -> Icon(Icons.Default.Warning, "Inactivo", tint = Amber)
            null -> Spacer(Modifier.size(24.dp))
        }
        Spacer(Modifier.size(8.dp))
        Text(title, Modifier.weight(1f))
        if (ok == true) OutlinedButton(onClick = onClick) { Text("Ver") } else Button(onClick = onClick) { Text(button) }
    }
}

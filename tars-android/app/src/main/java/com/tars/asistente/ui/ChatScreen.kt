package com.tars.asistente.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tars.asistente.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(vm: ChatViewModel, onSettings: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TARS", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 6.sp) },
                actions = {
                    IconButton(onClick = vm::newConversation) { Icon(Icons.Default.Add, "Nueva conversación") }
                    IconButton(onClick = onSettings) { Icon(Icons.Default.Settings, "Ajustes") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
        ) {
            val listState = rememberLazyListState()
            LaunchedEffect(vm.items.size, vm.thinking) {
                val last = vm.items.size + (if (vm.thinking) 1 else 0) - 1
                if (last >= 0) listState.animateScrollToItem(last)
            }
            if (vm.items.isEmpty() && !vm.thinking) {
                Hints(Modifier.weight(1f))
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(vm.items) { Bubble(it) }
                    if (vm.thinking) item { Thinking() }
                }
            }

            if (vm.partial.isNotBlank()) {
                Text(
                    vm.partial,
                    Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            InputBar(vm)
        }
    }
}

@Composable
private fun Hints(modifier: Modifier) {
    Column(
        modifier.fillMaxWidth().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(painterResource(R.drawable.ic_tars), null, Modifier.size(72.dp), tint = Steel)
        Spacer(Modifier.size(16.dp))
        Text("Pulsa el micrófono y habla", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(16.dp))
        listOf(
            "«¿Tengo mensajes nuevos?»",
            "«Contesta a Ana que llego en diez minutos»",
            "«Pon una alarma a las siete y cuarto»",
            "«¿Qué tengo mañana en la agenda?»",
            "«Pon música de Coldplay en Spotify»",
            "«Llévame al aeropuerto»",
            "«Recuerda que mi jefe se llama Luis»",
        ).forEach {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(3.dp))
        }
    }
}

@Composable
private fun Bubble(item: ChatItem) {
    when (item.role) {
        Role.TOOL -> Text(
            "› ${item.text}",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        else -> {
            val mine = item.role == Role.USER
            Box(Modifier.fillMaxWidth(), contentAlignment = if (mine) Alignment.CenterEnd else Alignment.CenterStart) {
                Text(
                    item.text,
                    modifier = Modifier
                        .widthIn(max = 320.dp)
                        .background(
                            if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(16.dp),
                        )
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    color = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun Thinking() {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(8.dp)) {
        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
        Spacer(Modifier.size(8.dp))
        Text("Pensando…", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun InputBar(vm: ChatViewModel) {
    var text by remember { mutableStateOf("") }
    val pulse = rememberInfiniteTransition(label = "pulse")
    val scale by pulse.animateFloat(
        initialValue = 1f,
        targetValue = if (vm.listening) 1.15f else 1f,
        animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
        label = "scale",
    )
    Row(
        Modifier.fillMaxWidth().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            modifier = Modifier.weight(1f),
            placeholder = { Text("Escribe a TARS…") },
            maxLines = 4,
            shape = RoundedCornerShape(24.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = {
                vm.send(text)
                text = ""
            }),
            trailingIcon = {
                if (text.isNotBlank()) {
                    IconButton(onClick = {
                        vm.send(text)
                        text = ""
                    }) { Icon(Icons.Default.Send, "Enviar") }
                }
            },
        )
        Spacer(Modifier.size(12.dp))
        FloatingActionButton(
            onClick = vm::toggleMic,
            shape = CircleShape,
            containerColor = if (vm.listening) Amber else MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(64.dp).scale(scale),
        ) {
            if (vm.listening) Icon(Icons.Default.Close, "Dejar de escuchar")
            else Icon(painterResource(R.drawable.ic_mic), "Hablar", Modifier.size(28.dp))
        }
    }
}

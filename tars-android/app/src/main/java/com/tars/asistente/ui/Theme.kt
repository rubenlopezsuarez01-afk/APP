package com.tars.asistente.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Steel = Color(0xFF9FB4C7)
val Amber = Color(0xFFFFB454)

private val TarsColors = darkColorScheme(
    primary = Steel,
    onPrimary = Color(0xFF0E1116),
    secondary = Amber,
    onSecondary = Color(0xFF0E1116),
    background = Color(0xFF0E1116),
    onBackground = Color(0xFFE6EAF0),
    surface = Color(0xFF171B22),
    onSurface = Color(0xFFE6EAF0),
    surfaceVariant = Color(0xFF222833),
    onSurfaceVariant = Color(0xFFAAB4C0),
)

@Composable
fun TarsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TarsColors, content = content)
}

package com.example.sangam.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = Accent,
    secondary = Accent2,
    tertiary = Accent3,
    background = White,
    surface = OffWhite,
    onPrimary = White,
    onSecondary = White,
    onTertiary = White,
    onBackground = TextColor,
    onSurface = TextColor,
    surfaceVariant = SurfaceColor,
    onSurfaceVariant = Text2,
    outline = BorderColor,
    outlineVariant = BorderLight
)

@Composable
fun SangamTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
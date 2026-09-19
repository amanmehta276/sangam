package com.example.sangam.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sangam.theme.*

data class EventData(
    val date: String,
    val name: String,
    val detail: String,
    val badge: String,
    val isBlue: Boolean = false
)

val events = listOf(
    EventData("28 OCT", "Tech Symposium 2026", "Main Auditorium • 10:00 AM", "UPCOMING", false),
    EventData("15 NOV", "Alumni Meet & Greet", "CGIT Campus • 04:00 PM", "UPCOMING", false),
    EventData("05 DEC", "Annual Cultural Fest", "Open Grounds • 06:00 PM", "REGISTRATION OPEN", true)
)

@Composable
fun EventsSection(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(White)
            .padding(vertical = 64.dp)
    ) {
        Column(modifier = Modifier.padding(horizontal = 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier
                    .width(20.dp)
                    .height(1.dp)
                    .background(Accent2))
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "UPCOMING",
                    color = Accent2,
                    style = MaterialTheme.typography.labelSmall,
                    letterSpacing = 2.5.sp
                )
            }
            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = buildAnnotatedString {
                    append("Network ")
                    withStyle(style = SpanStyle(fontStyle = FontStyle.Italic, color = Text3)) {
                        append("Events")
                    }
                },
                style = MaterialTheme.typography.headlineLarge,
                color = TextColor,
                lineHeight = 40.sp
            )
            Spacer(modifier = Modifier.height(36.dp))
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .border(1.dp, BorderLight)
                .background(BorderLight)
        ) {
            events.forEachIndexed { index, event ->
                EventCard(event = event)
                if (index < events.size - 1) {
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(BorderLight))
                }
            }
        }
    }
}

@Composable
fun EventCard(event: EventData) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(White)
            .padding(vertical = 18.dp, horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Text(
                text = event.date,
                style = MaterialTheme.typography.titleLarge,
                color = TextColor,
                modifier = Modifier.padding(end = 12.dp)
            )
            
            Box(
                modifier = Modifier
                    .background(
                        color = if (event.isBlue) BlueBadgeBg else GreenBadgeBg,
                        shape = RoundedCornerShape(3.dp)
                    )
                    .padding(horizontal = 9.dp, vertical = 3.dp)
            ) {
                Text(
                    text = event.badge,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.SemiBold,
                        color = if (event.isBlue) BlueBadgeText else GreenBadgeText
                    ),
                    letterSpacing = 0.5.sp
                )
            }
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = event.name,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = TextColor
        )
        
        Spacer(modifier = Modifier.height(4.dp))
        
        Text(
            text = event.detail,
            style = MaterialTheme.typography.bodyMedium,
            color = Text3,
            fontSize = 12.sp
        )
    }
}

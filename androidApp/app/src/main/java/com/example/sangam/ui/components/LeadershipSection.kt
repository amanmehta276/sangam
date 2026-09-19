package com.example.sangam.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sangam.theme.*

@Composable
fun LeadershipSection(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Accent)
            .padding(vertical = 64.dp)
    ) {
        Column(modifier = Modifier.padding(horizontal = 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier
                    .width(20.dp)
                    .height(1.dp)
                    .background(Color(0xFFF4C7C7)))
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "LEADERSHIP",
                    color = Color(0xFFF4C7C7),
                    style = MaterialTheme.typography.labelSmall,
                    letterSpacing = 2.5.sp
                )
            }
            Spacer(modifier = Modifier.height(14.dp))
            
            Text(
                text = buildAnnotatedString {
                    append("Message from our ")
                    withStyle(style = SpanStyle(fontStyle = FontStyle.Italic, color = Color(0xFFF4C7C7))) {
                        append("leaders")
                    }
                },
                style = MaterialTheme.typography.headlineLarge,
                color = White,
                lineHeight = 40.sp
            )
            Spacer(modifier = Modifier.height(36.dp))
        }

        LazyRow(
            contentPadding = PaddingValues(horizontal = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            item {
                LeaderCard(
                    name = "Shri Vishnu Deo Sai",
                    role = "CHIEF MINISTER, CHHATTISGARH",
                    message = "\"Education is the foundation of a progressive society. Sangam bridges the gap between knowledge and opportunity for our youth.\""
                )
            }
            item {
                LeaderCard(
                    name = "Shri Guru Khushwant Saheb",
                    role = "TECHNICAL EDUCATION MINISTER",
                    message = "\"We are committed to building world-class institutions and empowering students with the resources they need to excel.\""
                )
            }
        }
    }
}

@Composable
fun LeaderCard(
    name: String,
    role: String,
    message: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .width(280.dp)
            .background(AccentDark)
            .border(1.dp, White.copy(alpha = 0.22f))
            .padding(32.dp)
    ) {
        Box(
            modifier = Modifier
                .size(88.dp)
                .clip(CircleShape)
                .background(SurfaceColor)
                .border(2.dp, BorderLight, CircleShape)
        )
        // Image would go here, we are using a placeholder box
        Spacer(modifier = Modifier.height(20.dp))
        
        Text(
            text = name,
            style = MaterialTheme.typography.titleLarge,
            color = White
        )
        Spacer(modifier = Modifier.height(4.dp))
        
        Text(
            text = role,
            style = MaterialTheme.typography.labelSmall,
            color = Accent,
            letterSpacing = 1.5.sp
        )
        Spacer(modifier = Modifier.height(20.dp))
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(White.copy(alpha = 0.22f)))
        Spacer(modifier = Modifier.height(20.dp))
        
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic),
            color = White.copy(alpha = 0.72f),
            lineHeight = 24.sp
        )
    }
}

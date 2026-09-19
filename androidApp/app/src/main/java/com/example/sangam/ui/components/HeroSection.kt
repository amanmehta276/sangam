package com.example.sangam.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
fun HeroSection(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Ink)
            .padding(vertical = 48.dp, horizontal = 24.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier
                .width(24.dp)
                .height(1.dp)
                .background(Accent2))
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "OFFICIAL ALUMNI NETWORK · CGIT RAIPUR",
                color = Accent2,
                style = MaterialTheme.typography.labelSmall,
                letterSpacing = 2.5.sp
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = buildAnnotatedString {
                append("Where knowledge\n")
                withStyle(style = SpanStyle(fontStyle = FontStyle.Italic, color = White.copy(alpha = 0.3f))) {
                    append("connects us all")
                }
            },
            style = MaterialTheme.typography.displayMedium,
            color = White,
            lineHeight = 44.sp
        )
        
        Spacer(modifier = Modifier.height(20.dp))
        
        Text(
            text = "Sangam is the official student and alumni network of Chhattisgarh Institute of Technology — connecting graduates, students, and opportunities.",
            style = MaterialTheme.typography.bodyLarge,
            color = White.copy(alpha = 0.4f),
            fontWeight = androidx.compose.ui.text.font.FontWeight.Light
        )
        
        Spacer(modifier = Modifier.height(36.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = { },
                colors = ButtonDefaults.buttonColors(containerColor = Accent),
                shape = RoundedCornerShape(3.dp)
            ) {
                Text(text = "Join the Network", style = MaterialTheme.typography.labelSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, color = White))
            }
            
            OutlinedButton(
                onClick = { },
                colors = ButtonDefaults.outlinedButtonColors(contentColor = White.copy(alpha = 0.4f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, White.copy(alpha = 0.12f)),
                shape = RoundedCornerShape(3.dp)
            ) {
                Text(text = "Learn more", style = MaterialTheme.typography.labelSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Normal))
            }
        }
        
        Spacer(modifier = Modifier.height(48.dp))
        
        // Hero Stats
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(6.dp))
                .border(1.dp, BorderColor, RoundedCornerShape(6.dp))
                .background(BorderColor)
        ) {
            Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                HeroStatItem(
                    label = "CURRENT STUDENTS",
                    value = "1,000",
                    suffix = "+",
                    modifier = Modifier.weight(1f).fillMaxHeight()
                )
                Box(modifier = Modifier.width(1.dp).fillMaxHeight().background(BorderColor))
                HeroStatItem(
                    label = "ALUMNI NETWORK",
                    value = "6,000",
                    suffix = "+",
                    modifier = Modifier.weight(1f).fillMaxHeight()
                )
            }
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(BorderColor))
            Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                HeroStatItem(
                    label = "BRANCHES",
                    value = "8",
                    suffix = "",
                    modifier = Modifier.weight(1f).fillMaxHeight()
                )
                Box(modifier = Modifier.width(1.dp).fillMaxHeight().background(BorderColor))
                HeroStatItem(
                    label = "PLACEMENT RATE",
                    value = "95",
                    suffix = "%",
                    modifier = Modifier.weight(1f).fillMaxHeight()
                )
            }
        }
    }
}

@Composable
fun HeroStatItem(
    label: String,
    value: String,
    suffix: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .background(Ink2)
            .padding(24.dp)
    ) {
        Text(
            text = label,
            color = White.copy(alpha = 0.3f),
            style = MaterialTheme.typography.labelSmall,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = value,
                color = White,
                style = MaterialTheme.typography.headlineLarge,
                lineHeight = 40.sp
            )
            if (suffix.isNotEmpty()) {
                Text(
                    text = suffix,
                    color = Accent2,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(bottom = 4.dp, start = 2.dp)
                )
            }
        }
    }
}

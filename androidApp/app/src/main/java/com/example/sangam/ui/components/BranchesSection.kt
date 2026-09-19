package com.example.sangam.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sangam.theme.*

data class BranchData(val code: String, val name: String)

val branches = listOf(
    BranchData("CSE", "Computer Science"),
    BranchData("AI", "Artificial Intelligence"),
    BranchData("DS", "Data Science"),
    BranchData("IT", "Information Technology"),
    BranchData("CIV", "Civil Engineering"),
    BranchData("MEC", "Mechanical Engineering"),
    BranchData("EEE", "Electrical Engineering"),
    BranchData("ETC", "Electronics & Telecom")
)

@Composable
fun BranchesSection(modifier: Modifier = Modifier) {
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
                    text = "ACADEMICS",
                    color = Color(0xFFF4C7C7),
                    style = MaterialTheme.typography.labelSmall,
                    letterSpacing = 2.5.sp
                )
            }
            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = buildAnnotatedString {
                    append("Our Core ")
                    withStyle(style = SpanStyle(fontStyle = FontStyle.Italic, color = Color(0xFFF4C7C7))) {
                        append("Branches")
                    }
                },
                style = MaterialTheme.typography.headlineLarge,
                color = White,
                lineHeight = 40.sp
            )
            Spacer(modifier = Modifier.height(36.dp))
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .border(1.dp, White.copy(alpha = 0.22f))
                .background(White.copy(alpha = 0.22f))
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                val chunked = branches.chunked(2)
                chunked.forEachIndexed { index, rowItems ->
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                        BranchCard(
                            branch = rowItems[0],
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                        Box(modifier = Modifier.width(1.dp).fillMaxHeight().background(White.copy(alpha = 0.22f)))
                        if (rowItems.size > 1) {
                            BranchCard(
                                branch = rowItems[1],
                                modifier = Modifier.weight(1f).fillMaxHeight()
                            )
                        } else {
                            Spacer(modifier = Modifier.weight(1f).fillMaxHeight().background(AccentDark))
                        }
                    }
                    if (index < chunked.size - 1) {
                        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(White.copy(alpha = 0.22f)))
                    }
                }
            }
        }
    }
}

@Composable
fun BranchCard(branch: BranchData, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(AccentDark)
            .padding(vertical = 32.dp, horizontal = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = branch.code,
            style = MaterialTheme.typography.titleLarge,
            color = White
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = branch.name,
            style = MaterialTheme.typography.labelSmall,
            color = White.copy(alpha = 0.68f),
            letterSpacing = 0.5.sp
        )
    }
}

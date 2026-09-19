package com.example.sangam.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sangam.theme.Accent
import com.example.sangam.theme.AccentDark
import com.example.sangam.theme.White
import com.example.sangam.ui.components.BranchesSection
import com.example.sangam.ui.components.EventsSection
import com.example.sangam.ui.components.HeroSection
import com.example.sangam.ui.components.LeadershipSection

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onItemClick: (Any) -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = buildAnnotatedString {
                            append("Sangam ")
                            withStyle(style = SpanStyle(fontSize = 12.sp, color = White.copy(alpha = 0.72f), fontWeight = FontWeight.Normal)) {
                                append("CGIT RAIPUR")
                            }
                        },
                        color = White,
                        style = MaterialTheme.typography.titleLarge
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { /* TODO: Open Drawer */ }) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menu",
                            tint = White.copy(alpha = 0.7f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AccentDark,
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(White)
        ) {
            item { HeroSection() }
            item { LeadershipSection() }
            item { BranchesSection() }
            item { EventsSection() }
            
            // Footer
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AccentDark)
                        .padding(vertical = 40.dp, horizontal = 24.dp)
                ) {
                    Column {
                        Text(
                            text = "Sangam",
                            style = MaterialTheme.typography.titleLarge,
                            color = White
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "© 2026 VyomTech. All rights reserved.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = White.copy(alpha = 0.68f),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview
@Composable
fun MainScreenPreview() {
    com.example.sangam.theme.SangamTheme {
        MainScreen(onItemClick = {})
    }
}

/* ============================================================
   sidebar.js — Hamburger menu toggle (shared)
   ============================================================ */

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!sidebar) return;
  sidebar.classList.toggle("open");
  overlay.classList.toggle("open");
  document.body.style.overflow = sidebar.classList.contains("open") ? "hidden" : "";
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!sidebar) return;
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

// Close on ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
});
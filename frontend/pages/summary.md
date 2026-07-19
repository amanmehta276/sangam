// renderPost function mein yeh line dhundo:
const color    = getColor((a.name||"A")[0]);

// Neeche avatar HTML yeh hai:
<div class="post-av" style="background:${color}">${initial}</div>

// Ise replace karo:
const avatarUrl = a.avatar_url
  ? (a.avatar_url.startsWith("/uploads/")
      ? "https://sangam-z93f.onrender.com" + a.avatar_url
      : a.avatar_url)
  : "";

// Aur HTML mein:
${avatarUrl
  ? `<div class="post-av" style="background:${color};padding:0;overflow:hidden">
       <img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"
         onerror="this.parentElement.style.background='${color}';this.parentElement.textContent='${initial}'">
     </div>`
  : `<div class="post-av" style="background:${color}">${initial}</div>`
}













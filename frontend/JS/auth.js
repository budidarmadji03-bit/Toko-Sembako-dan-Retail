// Versi demo tidak memakai autentikasi/password.
// File ini sengaja dipertahankan agar struktur project konsisten.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("enterAppBtn");
  btn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });
});

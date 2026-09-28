# RetailPro V4

Web app penjualan dan persediaan toko retail/sembako.

## Fitur
- Dashboard
- CRUD kategori
- CRUD produk
- Stok masuk
- Status stok aman/menipis/habis
- Keranjang penjualan
- Cash/QRIS/Transfer
- Perhitungan total, pembayaran, kembalian
- Pengurangan stok otomatis
- Laporan penjualan berdasarkan periode
- Mode Supabase PostgreSQL
- Mode Demo Lokal tanpa login/password sebagai fallback

## Struktur
frontend/HTML, frontend/CSS, frontend/JS
backend/SUPABASE, backend/SQL

## Menjalankan
Paling mudah: buka `frontend/HTML/index.html` dengan Live Server.

Untuk Supabase, isi `frontend/JS/config.js`, lalu jalankan SQL 01, 02, 03 secara berurutan.

Jika ingin langsung mencoba tanpa backend, biarkan config.js kosong. Data demo tersimpan di localStorage browser.

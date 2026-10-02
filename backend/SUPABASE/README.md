# Setup Supabase RetailPro V4

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan `SQL/01_schema.sql`.
4. Jalankan `SQL/02_rpc.sql`.
5. Jalankan `SQL/03_seed.sql`.
6. Buka `frontend/JS/config.js`.
7. Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari Project Settings > API.
8. Gunakan Publishable/Anon key, bukan service_role.
9. Jalankan `frontend/HTML/index.html` dengan VS Code Live Server.

Jika config.js dikosongkan, aplikasi otomatis memakai Mode Demo Lokal dan data tersimpan di browser. Ini berguna untuk menguji tampilan/fitur tanpa Supabase.

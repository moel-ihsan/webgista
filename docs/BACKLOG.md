# Backlog Proyek — WebGIS Traffic Banda Aceh

> **Status Dokumen:** Daftar perbaikan di luar ruang lingkup **Fase 4.5 (Audit & Enhance UI/UX)**.  
> **ATURAN:** **Jangan dikerjakan sekarang.** Seluruh item di bawah ditunda ke fase setelah Fase 4.5 (atau pasca-deployment demo) dan baru dieksekusi jika disetujui eksplisit.

---

## 1. Pembersihan Dead Code & Aset Warisan v1

Berdasarkan temuan di [docs/ANALYSIS.md](file:///Users/moel_04/work/ta_webgis/docs/ANALYSIS.md):
- **Komponen Vue lama yang tidak terpakai setelah refactor Fase 3:** `CardVehicle.vue`, `GraphVehicle.vue`, `LineChart.js`, `SearchCard.vue`, `NavTop.vue`, `C_Register.vue`, dan komponen `Totalveh*`.
- **View Blade sisa template bawaan Jetstream/starter:** `dashboard.blade.php` dan `selamat.blade.php`.
- **Rute vendor yang tidak dipakai antarmuka demo:** Rute bawaan Laravel Fortify, Jetstream, dan Livewire (`/user/profile`, `/forgot-password`, `/two-factor-challenge`, `/livewire/...`) yang masih terdaftar pada `php artisan route:list` dan perlu ditinjau untuk dinonaktifkan/dibatasi di produksi.

## 2. Arsitektur Frontend & Build Modern (Pasca-Demo v1 Stabil)

- **Migrasi Vue 2.6 + Laravel Mix 6 / Webpack 5 ke Vue 3 + Vite:** Sesuai catatan pengguna pada Fase 3 (ditunda sampai demo v1 + UI/UX 4.5 stabil dan ter-deploy).
- **Optimasi Eksekusi TensorFlow.js + COCO-SSD (`/detail/video/{id}`):** Pemisahan *dynamic import* atau Web Worker untuk pemrosesan video/ML agar tidak membekukan *main thread* atau menggagalkan kondisi *idle* Lighthouse.

## 3. Penyempurnaan Skema Database & Parameter IHCM 1997

- **Migrasi Nama Kolom `lattitude` -> `latitude`:** Saat ini tabel `cctv_points`, `map_settings`, dan `users` masih menyimpan kolom bernama `lattitude` demi menjaga kompatibilitas skema/API lama (pada Fase 4.5 cukup merapikan label tampilan UI menjadi `"Latitude"`).
- **Konfigurasi Parameter Kapasitas IHCM Per Kamera:** Saat ini rumus IHCM 1997 memakai parameter tetap 3 lajur (`C = 1.485 x 3 = 4.455 smp/jam`) sesuai kedua simpang pada artikel. Di pengembangan lanjutan dapat ditambah kolom jumlah lajur dan faktor koreksi (`FCw`, `FCsp`, `FCsf`, `FCcs`) per CCTV jika cakupan diperluas ke simpang baru.
- **Konversi Volume 30 Detik ke Jam & Mode Deteksi Lanjutan:** Penyimpanan riwayat *time-series* hasil deteksi per 30 detik untuk analitik historis (saat ini hanya memperbarui status terkini di tabel utama), serta konfigurasi bobot/mapping kelas (`person` -> `motorcycle`) agar dapat diatur per skenario kamera.

## 4. Infrastruktur Produksi & Deployment (Menjelang / Pasca Fase 5)

- **Database Produksi Gratis (PostgreSQL / MySQL Managed) vs SQLite Demo:** Menyiapkan migrasi dan *seeding* otomatis agar data demo tetap terjaga di lingkungan serverless/PaaS Rp0 yang bersifat *ephemeral*.
- **Penanganan Upload File Media Permanen:** Menyimpan unggahan gambar profil dan thumbnail CCTV pada *object storage* gratis (atau fallback aset bawaan) jika target hosting demo memiliki filesystem *read-only*.
- **Rate Limiting & Keamanan Produksi:** Pengetatan header keamanan (CSP, HSTS), penghapusan rute publik sensitif yang tidak diperlukan, serta dokumentasi `ROUTES.md` resmi pasca finalisasi demo.

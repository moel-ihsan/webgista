# Panduan Deployment — WebGIS Traffic Banda Aceh (Fase 5 / Rp0 Tanpa Kartu Kredit)

Panduan ini menjelaskan langkah reproduksi deployment publik **Rp0 tanpa kartu kredit** untuk proyek `traffic-condition-webgista` di Vercel menggunakan mode **Opsi A — Demo Statis + Client State Adapter**, sementara backend Laravel + MySQL/SQLite tetap utuh untuk pengembangan & demo lokal.

---

## 1. Ringkasan Arsitektur Deployment

- **Hosting Publik (`Rp0`, Tanpa Kartu):** **Vercel Hobby Plan** (`https://traffic-condition-webgista.vercel.app`), batas free tier `100 GB`/bulan *Fast Data Transfer* (berhenti otomatis bila kuota terlampaui — nol risiko tagihan), tanpa *sleep/cold start*.
- **Peta Dasar (`Rp0`, Tanpa Kartu):** **MapLibre GL JS** + **OpenFreeMap** (*Street/Light/Dark*) & **OpenTopoMap** (*Outdoor*) (`MAP_PROVIDER=auto`), tanpa token Mapbox maupun kartu kredit. Opsional dapat menautkan `MAPTILER_API_KEY` atau `STADIA_API_KEY` di *Environment Variables* dengan pembatasan domain URL (*URL restrictions*).
- **Deteksi Kendaraan (`Rp0 Server`):** Berjalan **100% di browser pengunjung** menggunakan TensorFlow.js (`@tensorflow/tfjs`) + model `@tensorflow-models/coco-ssd`, dilengkapi cadangan JSON pra-hitung sinkron waktu video (`public/demo/detections/*.json`) serta 2 klip simulasi MP4 berlisensi Creative Commons (`public/demo/videos/*.mp4`).
- **State Rute Dinamis & Persistensi Statis:**
  - Flag build `MIX_STATIC_DEMO=true` mengaktifkan [staticStore.js](../resources/js/services/api/staticStore.js) yang menyimpan perubahan CRUD CCTV, status deteksi `1000 ms`, poligon ROI, pengaturan peta, agensi, profil, dan sesi admin secara lokal di `localStorage` masing-masing pengunjung (`15` titik awal dari [staticSeed.js](../resources/js/data/staticSeed.js)).
  - Skrip [build-static.js](../scripts/build-static.js) menyalin aset terkompilasi ke `dist/` dan membangkitkan shell HTML per rute dengan aturan rewrite pada [vercel.json](../vercel.json).

---

## 2. Langkah Menjalankan & Membangun Ulang Secara Lokal

### A. Mode Laravel Penuh (Backend PHP + SQLite/MySQL)
```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
# Sesuaikan DB_CONNECTION / DB_DATABASE (mysql atau sqlite)
php artisan migrate --seed
npm run prod
php artisan serve
```

### B. Mode Build Statis (Target `dist/` seperti Vercel)
```bash
npm ci
npm run build:static
```
Hasil build siap saji berada di direktori `dist/` (di-ignore oleh Git) dan dapat diuji lokal dengan HTTP server statis apa pun yang mendukung rewrite URL bersih.

---

## 3. Langkah Mengulang Deploy ke Vercel (CLI atau GitHub Integration)

### Opsi 1 — Lewat Vercel CLI (Manual / Lokal)
1. Login ke akun Vercel tanpa kartu kredit:
   ```bash
   npx vercel login
   ```
2. Pastikan Anda berada di branch `main`:
   ```bash
   git checkout main
   ```
3. Build dan deploy ke proyek `traffic-condition-webgista`:
   ```bash
   vercel link --yes --project traffic-condition-webgista
   vercel --prod --yes
   ```
   Konfigurasi `buildCommand` (`npm run build:static`), `outputDirectory` (`dist`), dan `rewrites` otomatis dibaca dari [vercel.json](../vercel.json).

### Opsi 2 — Otomatis via Integrasi GitHub + Vercel
1. Hubungkan repositori GitHub `moel-ihsan/webgista` (branch produksi: **`main`**) ke proyek Vercel `traffic-condition-webgista` melalui dashboard Vercel.
2. Pengaturan Build & Output (otomatis terdeteksi dari `vercel.json`):
   - **Framework Preset:** Other
   - **Build Command:** `npm run build:static`
   - **Output Directory:** `dist`
3. *Environment Variables* (semua opsional, default gratis aktif):
   - `MAP_PROVIDER=auto`
   - `SIMULATION_ENABLED=true`
   - `SIMULATION_DEFAULT_MODE=live`
4. Setiap *push* ke branch `main` akan menjalankan **GitHub Actions CI** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) meliputi Laravel Pint, PHPUnit, ESLint, Prettier check, Jest (`test:js`), dan verifikasi `npm run build:static`.

---

## 4. Kredensial Demo Admin pada Mode Statis
- **URL Login:** `/login`
- **Email:** `admin@webgista.test`
- **Password awal sesi browser:** `password`
*(Perubahan data CRUD/profil/password pada mode statis tersimpan khusus di browser pengunjung masing-masing sehingga aman dari perusakan data pengunjung lain.)*

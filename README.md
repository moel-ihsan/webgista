# WebGISTA — Real-Time Traffic Condition Mapping

> **PERHATIAN:** Data lalu lintas yang ditampilkan di demo bukan kondisi lalu lintas aktual Kota Banda Aceh saat ini.

WebGIS pemetaan kondisi lalu lintas persimpangan jalan di Kota Banda Aceh berbasis pengenalan objek kendaraan (*computer vision*) pada aliran video CCTV. Proyek ini dikembangkan berdasarkan penelitian dan tugas akhir di Universitas Syiah Kuala.

- **Live Demo:** [https://traffic-condition-webgista.vercel.app](https://traffic-condition-webgista.vercel.app)

---

## Referensi Penelitian & Tugas Akhir

- **Artikel Ilmiah:** Maulana Ihsan Ahmad, Muzailin Affan, dan Ardiansyah, *"Banda Aceh Traffic Conditions Real-Time Mapping at Intersections Based on WebGIS and Machine Learning"*, *AIP Conf. Proc.* **3082**, 050013 (2024) — DOI: [`10.1063/5.0203203`](https://doi.org/10.1063/5.0203203)
- **Tugas Akhir (Skripsi):** *"Pemetaan Real Time Kondisi Lalu Lintas Pada Persimpangan Jalan di Kota Banda Aceh Berbasis Web GIS dan Machine Learning"* — [ETD Universitas Syiah Kuala (`id=97872`)](https://etd.usk.ac.id/search/?p=show_detail&id=97872)

---

## Ringkasan Sistem & Teknologi

- **Backend:** Laravel 8 (`PHP ^8.2`), MySQL / SQLite, autentikasi berbasis session/Sanctum, serta kontrol akses peran admin.
- **Frontend:** Vue 2 (`2.6.x`), Laravel Mix 6 (webpack 5), Element UI, MapLibre GL JS (OpenFreeMap / OpenTopoMap; mendukung MapTiler/Stadia via `.env`), Chart.js, Flickity, dan Axios.
- **Deteksi Kendaraan:** Inferensi di browser menggunakan TensorFlow.js (`@tensorflow/tfjs`) dan model pra-latih `@tensorflow-models/coco-ssd` untuk mendeteksi `car`, `truck`/`bus`, serta `motorcycle`/`bicycle`/`person` di dalam poligon *Region of Interest* (ROI), lengkap dengan mode data deteksi pra-hitung (`public/demo/detections/*.json`).
- **Klasifikasi Lalu Lintas (MKJI / IHCM 1997):**
  - Pembobotan kendaraan: `LV` = `1,0`, `HV` = `1,3`, `MC` = `0,4`.
  - Kapasitas simpang 3 lajur: `C = 1.650 × 1 × 1 × 1 × 0,90 × 3 = 4.455 smp/jam`.
  - Evaluasi per jendela `30 detik` menjadi klasifikasi tingkat pelayanan **A** (`V/C < 0,6`) hingga **F** (`V/C > 1,0`).
- **Evaluasi Sistem:** Pengujian usabilitas pada publikasi penelitian menggunakan *System Usability Scale* (SUS) terhadap 20 responden menghasilkan skor **81** (grade **B** / *Excellent*). Akurasi deteksi kendaraan dipengaruhi oleh sudut kamera CCTV lapangan terhadap model pra-latih COCO-SSD.

---

## Fitur Utama

1. **Dashboard (`/`)**: Peta ringkasan sebaran kamera CCTV (*Analytic* dan *Regular*), kartu profil instansi pengelola, serta carousel kamera yang baru diperbarui.
2. **Map View (`/map`)**: Peta interaktif dengan 4 gaya (*Street*, *Light*, *Dark*, *Outdoor*), layer titik CCTV dan batas administrasi kecamatan Kota Banda Aceh (`public/geojson/bandaacehgeojson.geojson`), pencarian persimpangan, serta legenda kondisi **A–F** dan tipe kamera *Regular*.
3. **Table View (`/table`)**: Daftar titik CCTV dengan pencarian, paginasi (`5–100`), halaman detail kamera (`/detail/{id}`), halaman analisis deteksi video (`/detail/video/{id}`), serta manajemen CRUD admin (`/table/add`, `/table/edit/{id}`).
4. **Map Settings (`/setting/{id}`, Admin)**: Konfigurasi koordinat pusat peta, tingkat zoom default, dan pengelolaan daftar instansi.

---

## Tampilan Antarmuka

| Dashboard (`1440px`) | Video Detection & ROI (`1440px` Dark) |
| --- | --- |
| ![Dashboard](docs/screenshots/phase45_after/dashboard_1440.png) | ![Video Detection Dark](docs/screenshots/phase45_after/video_detail_1440_dark.png) |

| Map View Light (`1440px`) | Map View Dark (`1440px`) |
| --- | --- |
| ![Map View Light](docs/screenshots/phase45_after/map_1440.png) | ![Map View Dark](docs/screenshots/phase45_after/map_1440_dark.png) |

---

## Menjalankan Secara Lokal

Prasyarat: **PHP `^8.2`**, **Composer**, dan **Node.js** (lihat [`.nvmrc`](.nvmrc)).

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
# Sesuaikan konfigurasi DB_* di .env (opsional: MAPTILER_API_KEY / STADIA_API_KEY)
php artisan migrate --seed
npm run dev
php artisan serve
```

Pengujian dan pemeriksaan kode:

```bash
php artisan test
./vendor/bin/pint --test app/Http/Controllers app/Services app/Http/Requests app/Http/Resources database/seeders tests/Feature
npm run test:js
npm run lint
npm run format:check
npm run build:static
```

---

## Atribusi Media Simulasi

- [`public/demo/videos/simpang-pdam.mp4`](public/demo/videos/simpang-pdam.mp4) diadaptasi dari [File:A intersection with traffic in Chiang Mai, Thailand.ogv](https://commons.wikimedia.org/wiki/File:A_intersection_with_traffic_in_Chiang_Mai,_Thailand.ogv) oleh **Amada44** ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)).
- [`public/demo/videos/simpang-jambo-tape.mp4`](public/demo/videos/simpang-jambo-tape.mp4) diadaptasi dari [File:Changing lanes in Gothenburg ubt.ogv](https://commons.wikimedia.org/wiki/File:Changing_lanes_in_Gothenburg_ubt.ogv) oleh **Tomasz Sienicki (`User:tsca`)** ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0)).

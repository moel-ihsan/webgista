# Dokumentasi Demo Deteksi Lalu Lintas (Video Simulasi)

> **PERINGATAN SIMULASI DEMO:** Seluruh video dan hasil deteksi pada halaman demo ini **menggunakan video simulasi berlisensi terbuka** dan **bukan siaran langsung maupun data resmi CCTV Dishub/Diskominfotik Kota Banda Aceh**. Izin akses kamera CCTV asli tidak lagi tersedia untuk publikasi.

---

## 1. Sumber, Spesifikasi, dan Lisensi Video Simulasi

Kedua klip berdurasi **30,0 detik** (resolusi `640x360`, 15 fps, H.264 `yuv420p`, tanpa trek audio, `-movflags +faststart`) disajikan secara *same-origin* dari `public/demo/videos/` agar elemen `<canvas>` di browser dapat membaca frame video untuk inferensi TensorFlow.js tanpa hambatan CORS maupun batasan *embed* YouTube.

| Titik Simulasi (Artikel) | File Lokal & Ukuran | Sumber Asli (Wikimedia Commons) | Pencipta / Pemilik | Lisensi | Spesifikasi Kompresi (`ffmpeg`) | Koordinat ROI Biru Default (`640x360`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Simpang PDAM** *(arah Darussalam)* | [`public/demo/videos/simpang-pdam.mp4`](../public/demo/videos/simpang-pdam.mp4) (`1.150.600` byte / `1,1 MB`) | [File:A intersection with traffic in Chiang Mai, Thailand.ogv](https://commons.wikimedia.org/wiki/File:A_intersection_with_traffic_in_Chiang_Mai,_Thailand.ogv) | Amada44 | **CC BY-SA 4.0** | `-stream_loop 2`, `-t 30`, `scale/pad 640:360`, `fps=15`, `libx264 -crf 28 -an` | `(195,148)`, `(475,148)`, `(625,255)`, `(595,352)`, `(55,352)` |
| **Simpang Jambo Tape** *(arah Simpang Lima)* | [`public/demo/videos/simpang-jambo-tape.mp4`](../public/demo/videos/simpang-jambo-tape.mp4) (`994.353` byte / `971 KB`) | [File:Changing lanes in Gothenburg ubt.ogv](https://commons.wikimedia.org/wiki/File:Changing_lanes_in_Gothenburg_ubt.ogv) | Tomasz Sienicki (`User:tsca`) | **CC BY 3.0** / GFDL 1.2+ | `-t 30`, `crop=640:360:0:90`, `fps=15`, `libx264 -crf 28 -an` | `(250,38)`, `(450,48)`, `(625,230)`, `(390,352)`, `(10,330)` |

### Peringatan Risiko Hak Cipta untuk Publikasi

1. **Kewajiban Atribusi & ShareAlike (`CC BY 3.0` / `CC BY-SA 4.0`):** Selama klip Wikimedia Commons di atas dipublikasikan pada situs demo publik, halaman dokumentasi/kredit **wajib** mencantumkan nama pencipta, tautan sumber asli, jenis lisensi, serta keterangan bahwa video telah dipotong/dikompresi dari aslinya. Klip turunan `simpang-pdam.mp4` (`CC BY-SA 4.0`) mewajibkan klip video modifikasinya tetap dibagikan di bawah lisensi yang kompatibel (*ShareAlike*).
2. **File Lokal Lama `public/assets/video/tes.mp4` Tidak Digunakan:** File `tes.mp4` (`19 MB`, di-ignore oleh `.gitignore`) berisi video klip musik berhak cipta sehingga **tidak boleh** dipakai atau di-commit ke repositori publik.
3. **Opsi Tanpa Kewajiban Atribusi/ShareAlike:** Jika ingin bebas kewajiban atribusi/ShareAlike di masa depan, ganti klip video dengan **rekaman lalu lintas sendiri** atau materi **domain publik / CC0**, lalu arahkan path-nya lewat variabel `.env` tanpa mengubah kode aplikasi.

---

## 2. Arsitektur Dual-Mode Deteksi & Klasifikasi IHCM 1997

Komponen [`VideoDetectorPlayer.vue`](../resources/js/components/cctv/VideoDetectorPlayer.vue) mendukung dua mode operasi yang berjalan 100% di browser (**biaya komputasi server = Rp0**):

1. **Mode Utama — Live TensorFlow.js (`live`)**
   - Memuat `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` secara *lazy* saat halaman analisis video dibuka ([`cocoSsdLoader.js`](../resources/js/services/traffic/cocoSsdLoader.js)).
   - Frame video disalin ke `canvasy`, di-*clip* ke poligon ROI biru 5 titik di `canvasv`, lalu dianalisis oleh `model.detect(canvasv)` setiap interval `400 ms`.
   - Poligon biru dan kotak pembatas merah kendaraan digambar ulang pada lapisan atas `canvasx`.
2. **Mode Cadangan — Pra-hitung JSON Sinkron (`precomputed`)**
   - Aktif otomatis jika model TF.js gagal dimuat / melewati batas waktu (`25` detik), atau dapat dipilih manual lewat tombol **Ganti ke Pra-hitung (JSON)** pada halaman analisis video maupun `SIMULATION_DEFAULT_MODE=precomputed`.
   - Data prahitung dihasilkan dengan menjalankan inferensi nyata **COCO-SSD (`lite_mobilenet_v2`)** di browser pada 60 sampel frame (`0,0s` s.d. `29,5s`, interval `0,5s`, ambang skor `>= 0,3`):
     - [`public/demo/detections/simpang-pdam.json`](../public/demo/detections/simpang-pdam.json) (`93.095` byte / `91 KB`): total `257` `car`, `49` `person`, `18` `motorcycle`, `6` `truck`, dan `165` `traffic light` *(diabaikan oleh `ihcmClassifier`)*.
     - [`public/demo/detections/simpang-jambo-tape.json`](../public/demo/detections/simpang-jambo-tape.json) (`26.412` byte / `26 KB`): total `127` `car` dan `2` `bus`.
   - Modul [`precomputedPlayer.js`](../resources/js/services/traffic/precomputedPlayer.js) menyinkronkan frame JSON terhadap `video.currentTime`, menyesuaikan skala bounding box terhadap ukuran kanvas, dan menyaring objek berdasarkan titik tengah kotak di dalam poligon ROI biru ([`filterDetectionsByRoi`](../resources/js/services/traffic/roiGeometry.js)).

### Konsistensi Rumus IHCM 1997 ([`ihcmClassifier.js`](../resources/js/services/traffic/ihcmClassifier.js) & [`windowTracker.js`](../resources/js/services/traffic/windowTracker.js))

- **Pemetaan kelas COCO-SSD:** `car` -> `LV`; `truck`, `bus` -> `HV`; `motorcycle`, `bicycle`, `person` -> `MC` *(`person` dipertahankan dalam `MC` karena pengendara/sepeda motor sering terklasifikasi sebagai `person`)*. Kelas lain diabaikan.
- **Bobot smp:** `LV = 1,0`, `HV = 1,3`, `MC = 0,4`.
- **Kapasitas 3 lajur:** `C = 1.650 x 1 x 1 x 1 x 0,90 x 3 = 4.455 smp/jam`.
- **Jendela analisis 30 detik:** Hitungan dimulai dari `0` setiap awal jendela 30 detik atau saat video mengulang (*loop*). Volume jendela dikonversi ke laju per jam melalui faktor `3600 / 30` sebelum dibagi `4.455` untuk memperoleh rasio `V/C`:
  - **A (`Great`, `#98FB98`):** `< 0,6`
  - **B (`Good`, `#0B6623`):** `0,6 – 0,7`
  - **C (`Average`, `#FFFF00`):** `0,7 – 0,8`
  - **D (`Poor`, `#D4A328`):** `0,8 – 0,9`
  - **E (`Bad`, `#FF5F00`):** `0,9 – 1,0`
  - **F (`Terrible`, `#FF0000`):** `> 1,0`
- Jika user admin sedang masuk, perubahan status dikirim ke database lewat `POST /update/keterangan/{id}` dan dipantau ulang oleh `Map View` setiap `1000 ms`.

---

## 3. Konfigurasi `.env` & Menjalankan Demo Lokal

Konfigurasi sumber video dan mode demo dikelola melalui [`config/simulation.php`](../config/simulation.php) dan tidak di-*hardcode* di komponen Vue:

```env
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
DEMO_ADMIN_EMAIL=admin@webgista.test
DEMO_ADMIN_PASSWORD=your-demo-password

SIMULATION_ENABLED=true
SIMULATION_DEFAULT_MODE=live
SIMULATION_BANNER_TEXT="SIMULASI DEMO — Menggunakan video contoh lalu lintas, bukan data CCTV resmi Kota Banda Aceh."
SIMULATION_PDAM_VIDEO_URL=/demo/videos/simpang-pdam.mp4
SIMULATION_PDAM_PRECOMPUTED_URL=/demo/detections/simpang-pdam.json
SIMULATION_JAMBO_TAPE_VIDEO_URL=/demo/videos/simpang-jambo-tape.mp4
SIMULATION_JAMBO_TAPE_PRECOMPUTED_URL=/demo/detections/simpang-jambo-tape.json
```

Langkah menjalankan lokal (Node `18.17.1`, PHP `^8.2`):

```bash
cp .env.example .env
php artisan key:generate
# Atur DB_* dan MAPBOX_ACCESS_TOKEN di .env
php artisan migrate --seed
php artisan serve
```

Lalu buka:
- Dashboard: `http://127.0.0.1:8000/`
- Peta Real-Time (polling `1000 ms`): `http://127.0.0.1:8000/map`
- Tabel CCTV: `http://127.0.0.1:8000/table`
- Detail Kamera & Tombol *Detection View*: `http://127.0.0.1:8000/detail/1` dan `/detail/2`
- Analisis Deteksi Langsung / Pra-hitung: `http://127.0.0.1:8000/detail/video/1` dan `/detail/video/2`

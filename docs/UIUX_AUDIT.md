# Audit UI/UX — WebGIS Traffic Banda Aceh (Fase 4.5 / Step 1)

**Tanggal Audit:** 21 November 2026  
**Baseline Kode:** Branch `v1-restore`, commit `ffedaf2` (tanpa perubahan kode aplikasi selama audit)  
**Target Demo:** `http://127.0.0.1:8000` (SQLite demo, 2 titik CCTV: *Simpang PDAM* & *Simpang Jambo Tape*)  
**Alat Uji:** Google Chrome `157.0.8103.79`, Lighthouse `13.6.0`, `axe-core`, Puppeteer Core  
**Viewport Uji:** `360x800` (Mobile), `768x1024` (Tablet), `1024x768` (Small Desktop), `1440x900` (Desktop Light & Dark)

> **Catatan Kontrak Rute:** File `ROUTES.md` tidak ada di repositori. Seluruh daftar rute pada audit ini diambil langsung dari [routes/web.php](file:///Users/moel_04/work/ta_webgis/routes/web.php), [routes/api.php](file:///Users/moel_04/work/ta_webgis/routes/api.php), dan keluaran `php artisan route:list --compact`.

---

## 1. Ringkasan Eksekutif

Aplikasi v1 yang dipulihkan sudah bekerja secara fungsional, namun secara standar web modern masih memiliki sejumlah kendala **aksesibilitas**, **responsivitas mobile (`360px`)**, **kontras warna WCAG AA**, **sinkronisasi Light/Dark mode**, **konsistensi layout**, dan **performa pemuatan mobile**.

### 1.1 Skor Lighthouse (`13.6.0`) & Jumlah Pelanggaran `axe-core`

| Rute | Halaman | LH Mobile (Perf / A11y / BP / SEO) | LCP Mobile | LH Desktop (Perf / A11y / BP / SEO) | LCP Desktop | Pelanggaran axe (`360_L` / `1440_L` / `1440_D`) |
| --- | --- | --- | --- | --- | --- | --- |
| `/login` | Login | `55 / 75 / 96 / 83` | `15.1 s` | `64 / 75 / 96 / 83` | `4.0 s` | `9 / 9 / 9` |
| `/` | Dashboard | `51 / 69 / 100 / 83` | `29.0 s` | `60 / 69 / 96 / 83` | `6.1 s` | `10 / 10 / 10` |
| `/map` | Map View | `55 / 71 / 96 / 83` | `15.1 s` | `68 / 71 / 96 / 83` | `2.9 s` | `10 / 10 / 10` |
| `/table` | Table View (Guest) | `51 / 68 / 100 / 83` | `15.1 s` | `69 / 68 / 100 / 83` | `2.8 s` | `12 / 12 / 12` |
| `/detail/1` | CCTV Detail | `55 / 70 / 96 / 83` | `16.0 s` | `64 / 70 / 96 / 83` | `4.0 s` | `10 / 10 / 10` |
| `/detail/video/1` | Video Detection | *Timeout (`ETIMEDOUT`)*[^1] | *N/A* | *Gagal / Timeout*[^1] | *N/A* | `9 / 9 / 9` |
| `/table/add` | Add CCTV (Admin) | — | — | — | — | `10 / 10 / 10` |
| `/table/edit/1` | Edit CCTV (Admin) | — | — | — | — | `10 / 10 / 10` |
| `/setting/1` | Map Settings (Admin) | `52 / 70 / 96 / 83` | `14.9 s` | `69 / 70 / 96 / 83` | `2.8 s` | `9 / 9 / 9` |
| `/profile/1` | Profile (Admin) | — | — | — | — | `10 / 10 / 10` |
| `/password` | Password (Admin) | — | — | — | — | `10 / 10 / 10` |

[^1]: Lighthouse pada `/detail/video/1` mengalami timeout (>90–150 detik) karena `<video>` MP4 yang berputar kontinu serta eksekusi TensorFlow.js / COCO-SSD menghambat kondisi *network/CPU idle* Lighthouse. Skor aksesibilitas tetap terukur lengkap via `axe-core` (`9` jenis pelanggaran di semua mode).

**Audit Lighthouse A11y yang gagal konsisten di hampir semua halaman:**
- `aria-command-name`, `aria-required-children`, `aria-required-parent` (kecuali `/login` untuk `aria-required-parent`)
- `aria-toggle-field-name`
- `button-name` (khusus `/table` — tombol `.btn-prev` & `.btn-next`)
- `color-contrast`
- `image-alt`
- `label`

---

## 2. Inventaris Rute Lengkap (Kontrak yang Tidak Boleh Diubah)

### 2.1 Rute Halaman & Aksi Web ([routes/web.php](file:///Users/moel_04/work/ta_webgis/routes/web.php))

| Method | URI | Nama Rute | Middleware | Fungsi |
| --- | --- | --- | --- | --- |
| `GET` | `/` | `home` | `web` | Halaman Dashboard |
| `GET` | `/map` | `map` | `web` | Halaman Map View |
| `GET` | `/table` | `table` | `web` | Halaman Table View (Guest & Admin) |
| `GET` | `/detail/{cctvPoint:id}` | `show` | `web` | Halaman Detail CCTV |
| `GET` | `/detail/video/{cctvPoint:id}` | `showvideo` | `web` | Halaman Deteksi Video & Editor ROI Biru |
| `GET` | `/api/table` | `table_api` | `web` | Data JSON daftar CCTV |
| `GET` | `/api/setting` | `table_setting` | `web` | Data JSON Map Settings |
| `GET` | `/api/agency` | `table_agency` | `web` | Data JSON daftar Agency |
| `GET` | `/profileUser` | `profil.user` | `web` | Data profil user untuk Dashboard |
| `GET` | `/authUser` | `auth.user` | `web` | Status login / admin aktif |
| `GET` | `/login` | `login` | `web` | Halaman Login |
| `POST` | `/login/enter` | `auth.enter` | `web` | Proses autentikasi |
| `GET` | `/logout` | `auth.logout` | `web`, `auth` | Keluar sesi |
| `GET` | `/table/add` | `cctv.create` | `web`, `auth`, `admin` | Form Tambah CCTV |
| `GET` | `/table/edit/{cctvPoint:id}` | `edit` | `web`, `auth`, `admin` | Form Edit CCTV |
| `GET` | `/setting/{mapSetting:id}` | `setting` | `web`, `auth`, `admin` | Halaman Map Settings |
| `GET` | `/profile/{user:id}` | `auth.edit` | `web`, `auth`, `admin` | Halaman Edit Profile |
| `GET` | `/password` | `auth.password` | `web`, `auth`, `admin` | Halaman Ubah Password |
| `POST`/`PATCH`/`DELETE` | `/store`, `/update/{cctvPoint:id}`, `/destroy/{cctvPoint:id}`, `/upload`, `/uploadEdit/{cctvPoint:id}`, `/update/keterangan/{cctvPoint:id}`, `/update/roi/{cctvPoint:id}` | `store`, `update`, `destroy`, `upload`, `uploadEdit`, `cctv_keterangan`, `cctv.roi` | `web`, `auth`, `admin` | Operasi CRUD CCTV, gambar, hasil analitik, & ROI |
| `POST`/`PATCH` | `/store/mapSetting`, `/updateSetting/{mapSetting:id}` | `storeSetting`, `updateSetting` | `web`, `auth`, `admin` | Penyimpanan Map Settings |
| `POST`/`DELETE` | `/store/agency`, `/destroyAgent/{agencyList:agency}` | `storeAgency`, `destroyAgent` | `web`, `auth`, `admin` | Manajemen Agency tag |
| `PATCH`/`POST` | `/updateProfile/{user:id}`, `/uploadEditProfile/{user:id}`, `/changePassword/{user:id}` | `auth.update`, `auth.uploadEdit`, `auth.changePassword` | `web`, `auth`, `admin` | Update profil admin, avatar, & password |

### 2.2 Rute API ([routes/api.php](file:///Users/moel_04/work/ta_webgis/routes/api.php))

| Method | URI | Nama Rute | Middleware | Fungsi |
| --- | --- | --- | --- | --- |
| `POST` | `/api/traffic/{cctvPoint:id}` | `api.traffic.update` | `api`, `auth:sanctum`, `admin` | Pembaruan status kondisi lalu lintas CCTV |
| `GET` | `/api/detail/{cctvPoint:id}` | `showCCTV` | `api` | Detail JSON satu titik CCTV |

> **Catatan Rute Vendor:** `php artisan route:list` juga menampilkan rute bawaan Laravel Fortify, Jetstream (`/user/profile`, `/forgot-password`, dll.), Livewire (`/livewire/...`), dan Sanctum (`/sanctum/csrf-cookie`) yang tidak digunakan oleh antarmuka Vue v1; ini dicatat ke [docs/BACKLOG.md](file:///Users/moel_04/work/ta_webgis/docs/BACKLOG.md).

---

## 3. Audit Lintas Halaman

### 3.1 Tipografi
- **Ukuran dasar vs teks mikro:** `body` sudah memakai `16px`, tetapi teks penting (sub-label koordinat, timestamp, label form sekunder, tag, atribusi, counter kecil) turun hingga `10px` – `10.44px` (`0.625rem`), jauh di bawah standar keterbacaan web (`12px` minimum helper/caption, `14px` UI control, `16px` body).
- **Hierarki heading rusak:**
  - Mayoritas halaman (`9` dari `11` rute) tidak memiliki `<h1>` (`h1 = 0`).
  - Pada `/` dan `/setting/1`, elemen `<h1>` justru berada di dalam popup MapLibre (`<h1 id="isi">`), sehingga secara semantik struktur dokumen melompat dari tanpa `<h1>` langsung ke `<h4>` (pelanggaran `heading-order` di Dashboard).
- **Font eksternal (non-self-hosted):** [base.blade.php](file:///Users/moel_04/work/ta_webgis/resources/views/layouts/base.blade.php#L23-L24) memuat `Montserrat` dari Google Fonts CDN setiap muat halaman, belum self-hosted dan hanya menyediakan bobot `400,100,500,600,700` dengan rule `* { font-family: 'Montserrat', sans-serif }` yang berisiko menimpa icon font jika tidak hati-hati.

### 3.2 Palet Warna, Dark/Light Mode & Rasio Kontras WCAG AA

Token v1 yang diekstrak dari [base.blade.php](file:///Users/moel_04/work/ta_webgis/resources/views/layouts/base.blade.php#L41-L66):
- **Light (`.theme-normal`):** Surface latar `--color-primary: #f2edff` (`rgb(242, 237, 255)`), Kartu `--color-secondary: #ffffff`, Teks `--text-color: #27293d`, Aksen hijau `--green-theme: #3a976d`, Tag abu `--tag-bg-primary: #909399`.
- **Dark (`.theme-dark`):** Surface latar `--color-primary: #1e1e2e` (`rgb(30, 30, 46)`), Kartu `--color-secondary: #27293d` (`rgb(39, 41, 61)`), Teks `--text-color: #ffffff`, Aksen hijau `--green-theme: #32e18c`, Tag hijau `--tag-text-success: #32e18c` (transparent bg).

#### Hasil Uji Rasio Kontras WCAG 2.1 (Syarat AA: Teks Normal `>= 4.5:1`, Komponen UI/Large Text `>= 3.0:1`)

| Pasangan Warna v1 | Rasio Terukur | Teks Normal (`>=4.5:1`) | Komponen UI (`>=3.0:1`) | Keterangan |
| --- | --- | --- | --- | --- |
| `#27293d` di `#ffffff` (teks utama Light) | `> 14:1` | **PASS** | **PASS** | Aman |
| `#ffffff` di `#27293d` (teks utama Dark) | `> 14:1` | **PASS** | **PASS** | Aman |
| `#3a976d` di `#ffffff` (teks hijau di kartu Light) | **3.6:1** | **FAIL** | **PASS** | Koordinat hijau, info total entries, label form gagal untuk teks kecil |
| `#3a976d` di `#f2edff` (teks hijau di bg Light) | **3.15:1** | **FAIL** | **PASS** | Kontras tipis pada latar lavender |
| `#ffffff` di `#3a976d` (tombol/badge Light) | **3.6:1** | **FAIL** | **PASS** | Teks putih di tombol primer, badge `SIMULASI`, tag `Analytic` gagal teks normal |
| `#32e18c` di `#27293d` (teks hijau di kartu Dark) | **8.35:1** | **PASS** | **PASS** | Baik di Dark |
| `#ffffff` di `#32e18c` (tombol/badge Dark) | **1.71:1** | **FAIL** | **FAIL** | **Kritis!** Tombol `Sign In`, `Submit`, `Update`, `Detection View`, badge `SIMULASI`, pagination aktif memakai teks putih di atas hijau neon `#32e18c` |
| `#ffffff` di gradien sidebar `#3a9b6c` | **3.45:1** | **FAIL** | **PASS** | Ikon & tooltip sidebar di gradien hijau |
| Label form `opacity: 0.5` (`#93949e` perkiraan) di `#ffffff` | **3.01:1** | **FAIL** | **PASS** | Semua label `Name`, `Address`, `Zoom`, `Password`, `Time` di Light mode gagal |
| Label form `opacity: 0.5` di `#27293d` | **4.74:1** | **PASS** | **PASS** | Aman di Dark |

#### Rasio Kontras 6 Warna Marker/Legenda IHCM 1997 + *No Data*

| Kondisi IHCM | Hex v1 | Rasio vs Light (`#ffffff`) | Status Light | Rasio vs Dark (`#27293d`) | Status Dark |
| --- | --- | --- | --- | --- | --- |
| **A — Great** | `#98FB98` | **1.27:1** | **FAIL** (Teks & UI) | **11.28:1** | **PASS** |
| **B — Good** | `#0B6623` | **7.15:1** | **PASS** | **2.0:1** | **FAIL** (Teks & UI) |
| **C — Average** | `#FFFF00` | **1.07:1** | **FAIL** (Teks & UI) | **13.3:1** | **PASS** |
| **D — Poor** | `#D4A328` | **2.32:1** | **FAIL** (Teks & UI) | **6.17:1** | **PASS** |
| **E — Bad** | `#FF5F00` | **3.05:1** | **FAIL** Teks / UI PASS | **4.68:1** | **PASS** |
| **F — Terrible** | `#FF0000` | **4.0:1** | **FAIL** Teks / UI PASS | **3.57:1** | **FAIL** Teks / UI PASS |
| **No Data** | `#0000FF` | *Tinggi* | **PASS** | **1.66:1** | **FAIL** (Teks & UI) |

> **Temuan Aksesibilitas Non-Warna:** Legenda dan marker pada peta (`/map`) saat ini **hanya** membedakan status A–F lewat warna titik/lingkaran. Pengguna buta warna dan kondisi kontras rendah tidak bisa membedakan kelas kondisi tanpa huruf **A–F** atau simbol/badge tambahan.

#### Masalah Sinkronisasi & FOUC Dark Mode
1. **Hardcoded SSR & FOUC:** [base.blade.php](file:///Users/moel_04/work/ta_webgis/resources/views/layouts/base.blade.php#L2) menuliskan `<html class="theme-dark">` di HTML awal, sementara skrip pengubah tema baru berjalan di paling bawah `<body>` (baris 161–186). Tidak mengikuti `prefers-color-scheme` sistem bila `localStorage.theme` kosong.
2. **Desinkronisasi `<el-switch>`:** Di `AppHeader.vue` dan `LoginPage.vue`, `themeSetting` di-inisialisasi `true` sehingga posisi visual switch sering terbalik dibanding tema aktif (terlihat pada screenshot `table_admin_360.png` dan `login_1440.png`: halaman Light namun bulatan switch gelap berada di posisi kanan/ON).
3. **Peta Tetap Terang di Dark Mode:** Pada [map_1440_dark.png](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1440_dark.png) dan [dashboard_1440_dark.png](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_1440_dark.png), basemap MapLibre `liberty` tetap berwarna putih-krem terang di tengah UI gelap `#1e1e2e`, menyebabkan silau tajam (*glare*).

### 3.3 Tombol & Target Sentuh (`< 44x44 px` di Mobile)
Semua halaman memiliki elemen interaktif di bawah standar sentuh minimal `44x44 px`:
- Theme switch `.el-switch`: ~`40x20 px` (setiap halaman)
- Kontrol MapLibre (zoom `+`, `-`, compass, fullscreen, legend toggle): `29x29 px` (`/map` mencatat **14** target sentuh kecil!)
- Tombol hamburger menu & ikon header/aksi tabel (`Eye`, `Edit`, `Delete`): ~`31x16 px` – `36x36 px`
- Tombol pagination `.btn-prev` / `.btn-next` / `.number`: ~`30x28 px`

### 3.4 Responsivitas (`360`, `768`, `1024`, `1440`) & Overflow Tersembunyi
- Meskipun `documentElement.scrollWidth - innerWidth` terbaca `0 px` di DOM karena kartu induk menggunakan `overflow: hidden` / flex clipping, **secara visual konten terpotong parah di `360px`:**
  - `/table`: Kolom `Coordinate`, `Agency`, `Status`, tombol aksi (`Eye`/`Edit`/`Delete`), dan tombol `+ Add New` terpotong total ke kanan tanpa scroll maupun tampilan kartu mobile. Kolom `Name` pecah per 2–3 huruf (`Sim/pan/g P/DA/M`).
  - `/table/add`, `/table/edit/1`, `/setting/1`, `/profile/1`, `/password`: Di lebar `<= 600px`, kontainer peta/gambar kanan menggunakan CSS `position: absolute; top: 102%; height: 100%`, keluar dari tinggi kartu dan terpotong oleh kontainer luar sehingga peta `/setting/1` dan tombol form hilang/terpotong.
  - `/login`: Di `360px`, kolom input menyusut sangat sempit (~`96px`) sehingga placeholder `"Your Passw..."` terpotong.
- **Bug Canvas MapLibre Setengah Lebar (`1024px` & `1440px`):** Saat pertama dimuat di [dashboard_1440.png](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_1440.png), [map_1024.png](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1024.png), dan [map_1440.png](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1440.png), canvas MapLibre hanya merender setengah lebar kontainer (~`380–650px`) meninggalkan ruang putih/lavender kosong di sisi kanan sampai terjadi resize/toggle tema (terlihat di `map_1440_dark.png` yang mendadak penuh 100% setelah trigger DOM).

### 3.5 Aksesibilitas (`axe-core` & Navigasi Keyboard)
Pola pelanggaran kritis & serius berulang di hampir semua rute:
1. **`aria-required-children` & `aria-required-parent` (Critical):** `AppSidebar.vue` dan `AppHeader.vue` membungkus `<el-menu-item>` (`role="menuitem"`) di dalam `<a href>` di dalam `<ul role="menubar/menu">`, merusak hierarki ARIA menu serta membuat tab/Enter fokus ambigu; `<el-menu-item disabled>` pada item aktif juga memutus aktivasi keyboard.
2. **`label` (Critical) & `aria-toggle-field-name` (Serious) & `nested-interactive` (Serious):**
   - Komponen `.el-switch` meletakkan `<input type="checkbox">` di dalam `<div role="switch">` tanpa `aria-label`.
   - Seluruh form Element UI (`Login`, `Add/Edit CCTV`, `Settings`, `Profile`, `Password`) memakai `<label for="name">` yang atribut `for`-nya tidak terhubung ke `<input id="...">` internal Element UI.
3. **`image-alt` (Critical):** Gambar `.imgCont` (halaman Login/Profile/Password), thumbnail `tf1.jpg`/`tf2.jpg`/`tf5.jpg` (Dashboard/Table/Add/Edit), `.el-avatar > img`, dan `.popup-img` tidak memiliki atribut `alt`.
4. **`button-name` (Critical):** Di `/table`, tombol pagination `.btn-prev` dan `.btn-next` hanya berisi ikon panah tanpa `aria-label`.
5. **Landmark Semantik (`region`, `nav`):** Tidak ada elemen `<nav>` sama sekali (`nav = 0` di semua rute), tidak ada `<main>` yang konsisten pada bagian konten utama.

### 3.6 Performa & Pembebanan Aset
Hasil inspeksi jaringan Lighthouse pada `/` (`lh_dashboard_mobile.json`):
- **Total transfer halaman awal mencapai `6,106 KiB`** (`unused-javascript`: potensi hemat **`1,643 KiB`**; `unused-css-rules`: **`76 KiB`**).
- **`/js/app.js` berukuran `2,361.3 KiB` (`2.3 MB`)** tunggal untuk semua halaman (membuat Mobile FCP **`15.0 s`**).
- **Foto mentah tidak terkompresi di `public/assets/`:** `tf5.jpg` (`1,619.6 KiB`) dan `tf1.jpg` (`1,233.5 KiB`) menyebabkan Mobile LCP melambung hingga **`29.0 s`**.
- **Tailwind 2 belum terkompilasi penuh:** `public/css/app.css` hanya berukuran **60 bytes** (aturan mentah belum masuk pipeline Laravel Mix), sementara [base.blade.php](file:///Users/moel_04/work/ta_webgis/resources/views/layouts/base.blade.php) justru memuat **Bootstrap 4.5.2 CSS+JS**, **jQuery slim**, **Popper.js**, **Video.js (`556 KiB`)**, **videojs-youtube**, dan **Ionicons JS** dari CDN di **setiap halaman** termasuk yang tidak memakai video/modal Bootstrap.

---

## 4. Temuan Detail Per Halaman (11 Rute Aplikasi)

### 4.1 `/login` — Halaman Login
- **Skor:** Lighthouse Mobile `55 / 75 / 96 / 83` (LCP `15.1 s`), Desktop `64 / 75 / 96 / 83` (LCP `4.0 s`) | `axe-core`: `9` pelanggaran (`360_L`, `1440_L`, `1440_D`) | `smallTargets`: `4` (`360`) – `5` (`1440`).
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/login_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/login_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/login_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/login_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/login_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Pada `360px`, panel gambar di sebelah kanan tetap mengambil ruang horizontal sehingga kolom form dan input menyusut drastis (`~96px`), memotong teks placeholder (`Your Passw...`).
  2. *(Kritis)* Kontras tombol `Sign In` putih di `#3a976d` hanya `3.6:1` (Light) dan memburuk drastis menjadi **`1.71:1`** di Dark (`#32e18c`).
  3. *(Kritis)* Gambar dekoratif kanan tidak memiliki `alt`, input email/password tidak terasosiasi `<label>` visible/screen-reader, tidak ada `<h1>` untuk judul `WebGIS`, dan posisi visual `<el-switch>` tema tidak sinkron di `1440px` Light.

### 4.2 `/` — Dashboard (`Home`)
- **Skor:** Lighthouse Mobile `51 / 69 / 100 / 83` (LCP `29.0 s`), Desktop `60 / 69 / 96 / 83` (LCP `6.1 s`) | `axe-core`: `10` pelanggaran | `clipped`: `2` (`360`), `1` (`768`).
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/dashboard_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Canvas MapLibre hanya merender setengah lebar kartu peta pada muat awal di `1024px` & `1440px` Light (`dashboard_1440.png`).
  2. *(Kritis)* Mobile LCP `29.0 s` akibat gambar hero `tf5.jpg` (`1.6 MB`) + `tf1.jpg` (`1.2 MB`) + bundle `2.3 MB`.
  3. *(Kritis)* Di `360px`, kartu carousel kedua (*Simpang Jambo Tape*) terpotong di tepi kanan kontainer (`clipped`) dan atribusi `OpenStreetMap` terpotong.
  4. *(Penting)* Teks koordinat `#3a976d`, badge `SIMULASI`, dan timestamp tidak memenuhi kontras AA di Light; di Dark mode peta tetap terang; popup peta menyalahgunakan `<h1>` sementara judul halaman tidak ber-`<h1>`.

### 4.3 `/map` — Map View
- **Skor:** Lighthouse Mobile `55 / 71 / 96 / 83` (LCP `15.1 s`), Desktop `68 / 71 / 96 / 83` (LCP `2.9 s`) | `axe-core`: `10` pelanggaran | `smallTargets`: **`14`** di semua viewport!
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Bug setengah-lebar canvas MapLibre di `1024px` (`map_1024.png`) dan `1440px` (`map_1440.png`) menyisakan separuh layar kosong.
  2. *(Kritis)* Status kondisi lalu lintas **A–F** pada marker dan legenda hanya menggunakan bulatan warna (tanpa huruf A–F atau pola/ikon) dan memiliki rasio kontras gagal (`A #98FB98 = 1.27:1` di Light, `C #FFFF00 = 1.07:1` di Light, `B #0B6623 = 2.0:1` di Dark, `No Data #0000FF = 1.66:1` di Dark).
  3. *(Kritis)* **14 kontrol sentuh `< 44x44px`** (tombol zoom/compass/fullscreen/expand panel kanan/clear search/legenda), menyulitkan interaksi jari pada peta mobile.
  4. *(Penting)* Basemap tidak berubah mengikuti Dark mode; `<img>` di drawer pencarian kanan tidak punya `alt`; halaman tanpa `<h1>` dan `<nav>`.

### 4.4 `/table` — Table View (Guest & Admin)
- **Skor:** Lighthouse Mobile `51 / 68 / 100 / 83` (LCP `15.1 s`), Desktop `69 / 68 / 100 / 83` (LCP `2.8 s`) | `axe-core`: **`12`** pelanggaran (terbanyak di aplikasi) | `smallTargets`: `7` | `clipped`: `2` (`360px`).
- **Screenshot:** [360px Guest](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_360.png) · [360px Admin](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_admin_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_1024.png) · [1440px Guest](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_1440.png) · [1440px Admin](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_admin_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Pada `360px` (baik Guest maupun Admin), tabel tidak punya pembungkus gulir horizontal maupun mode kartu mobile: kolom `Coordinate`, `Agency`, `Status`, ikon `Eye/Edit/Delete`, dan tombol `+ Add New` **terpotong hilang ke kanan**, sementara teks `Simpang PDAM` patah karakter per baris (`Sim/pan/g...`) dan kotak pencarian memendek menjadi `"Type"`.
  2. *(Kritis)* `button-name` gagal di tombol pagination `.btn-prev` & `.btn-next`; `empty-table-header` di kolom aksi tanpa teks header; tombol nomor halaman aktif di Dark mode putih-di-`#32e18c` (`1.71:1`).
  3. *(Penting)* Sub-teks waktu (`24 minutes ago`, `.info-table`) dan badge hijau `Analytic` gagal kontras AA di Light mode; seluruh gambar avatar tabel tidak punya `alt`.

### 4.5 `/detail/{id}` — CCTV Detail
- **Skor:** Lighthouse Mobile `55 / 70 / 96 / 83` (LCP `16.0 s`), Desktop `64 / 70 / 96 / 83` (LCP `4.0 s`) | `axe-core`: `10` pelanggaran | `smallTargets`: `7` | `clipped`: `1` (`360`, `768`).
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/detail_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/detail_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/detail_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/detail_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/detail_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Pada `360px` (`detail_360.png`), kotak video memaksa tinggi `550px` sehingga video lanskap terpotong vertikal sangat sempit dan tinggi berlebih; tombol `Detection View` mepet/hampir menyentuh tepi kiri kartu dan atribusi OpenStreetMap terpotong.
  2. *(Penting)* Kontras tombol primer `Detection View` gagal (`3.6:1` Light, `1.71:1` Dark); koordinat `.cctvCoordinate` gagal kontras teks di Light mode; thumbnail & `<img>` tanpa `alt`; tidak ada `<h1>`.

### 4.6 `/detail/video/{id}` — Video Detection & ROI Editor
- **Skor:** Lighthouse *Timeout* (video loop + TF.js aktif mencegah *idle*); `axe-core`: `9` pelanggaran (`360_L`, `1440_L`, `1440_D`); `smallTargets`: `4`.
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/video_detail_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/video_detail_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/video_detail_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/video_detail_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/video_detail_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Di `360px`, `.cardVideoCCTV` bertinggi tetap `550px` membuat kanvas video sangat sempit namun menjulang tinggi; `.btn-video` menggunakan margin negatif (`margin-top: -20px`) sehingga menumpuk canggung; elemen dekoratif `.veh-info-card:before` menyembul di belakang kartu counter kendaraan.
  2. *(Kritis)* Tombol `#btn-manage`, `#btn-show`, `#btn-mode` gagal rasio kontras (`3.6:1` Light / `1.71:1` Dark); di mobile alur editing poligon ROI sulit disentuh akurat karena area kanvas sempit.
  3. *(Penting)* Status kondisi lalu lintas & ringkasan hitungan 30 detik belum memiliki indikator progres atau label state loading model COCO-SSD yang terstruktur (mengakses COCO-SSD memakan waktu muat besar di jaringan lambat).

### 4.7 `/table/add` & `/table/edit/{id}` — Form Tambah & Edit CCTV (Admin)
- **Skor:** `axe-core`: `10` pelanggaran pada kedua rute (`color-contrast` 11–12 node di Light, 3 node di Dark; `label` 5–6 node kritis); `smallTargets`: `13` (`/table/add`) dan `14` (`/table/edit/1`).
- **Screenshot Add:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_add_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_add_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_add_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_add_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_add_1440_dark.png)
- **Screenshot Edit:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_edit_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_edit_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_edit_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_edit_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/table_edit_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Di `360px`, panel peta kanan (`position: absolute; top: 102%`) keluar ke bawah melewati kartu pembungkus sehingga terpotong dan memblokir scrolling alami; preview gambar kosong menampilkan ikon rusak/placeholder tanpa `alt`.
  2. *(Kritis)* Seluruh label (`* Name`, `* Category`, `* Address`, `* Lattitude (N)`, `* Longitude (E)`, `* Agency`) memakai opacity redup (`3.01:1` Light FAIL) dan `for` tidak mengikat input Element UI sebenarnya; tombol `Click to upload` dan `Submit` di Dark mode berkontras `1.71:1`.
  3. *(Penting)* Label teks masih memuat salah ketik bawaan kolom DB `"Lattitude (N)"`; di `768px` layout masih memaksakan kolom sempit.

### 4.8 `/setting/{id}` — Map Settings (Admin)
- **Skor:** Lighthouse Mobile `52 / 70 / 96 / 83` (LCP `14.9 s`), Desktop `69 / 70 / 96 / 83` (LCP `2.8 s`) | `axe-core`: `9` pelanggaran (`label` 4 node, `color-contrast` 6 node Light) | `smallTargets`: `8`.
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/settings_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/settings_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/settings_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/settings_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/settings_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Pada `360px` (`settings_360.png`), bagian peta pratinjau di kanan terpotong hampir habis keluar batas kartu karena `position: absolute; top: 102%` + kontainer tak berkembang mengikuti tinggi total.
  2. *(Kritis)* Label `lattitude`, `longitude`, `zoom` tidak terhubung dengan input (`label` violation 4 node) dan redup di Light mode; di popup MapLibre Center Point terpasang `<h1 id="isi">` sementara halaman tidak punya heading utama; tombol pengelola *Agency* (`Add`, `Close` tag) berkuran sentuh terlalu kecil.
  3. *(Penting)* Salah ketik label `"Lattitude (N)"` masih muncul; di Dark mode peta pratinjau tetap terang.

### 4.9 `/profile/{id}` — Edit Profile (Admin)
- **Skor:** `axe-core`: `10` pelanggaran (`label` 6 node, `color-contrast` 8 node Light, `image-alt` 2 node) | `smallTargets`: `7`.
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/profile_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/profile_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/profile_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/profile_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/profile_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Di `360px` (`profile_360.png`), tombol `Discard` terpotong di sebelah kiri batas kartu dan panel foto kanan (beserta tombol edit gambar pensil hijau) jatuh ke posisi absolut di bawah kartu serta terpotong keluar layar.
  2. *(Kritis)* Kontras tombol `Update` di Dark mode `1.71:1`, 5 label input + description tidak terhubung dengan kontrol input dan pudar di Light mode; `.imgCont` dan `.el-avatar > img` tanpa `alt`.

### 4.10 `/password` — Change Password (Admin)
- **Skor:** `axe-core`: `10` pelanggaran (`label` 4 node, `color-contrast` 6 node Light, `image-alt` 2 node) | `smallTargets`: `6`.
- **Screenshot:** [360px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/password_360.png) · [768px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/password_768.png) · [1024px](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/password_1024.png) · [1440px Light](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/password_1440.png) · [1440px Dark](file:///Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/password_1440_dark.png)
- **Temuan:**
  1. *(Kritis)* Di `360px` (`password_360.png`), pola rusak identik dengan Profile: tombol `Discard` tergeser keluar tepi kiri dan panel gambar kanan terpotong keluar ke bawah kartu.
  2. *(Kritis)* Label `curPas`, `newPas`, `confirm` gagal kontras di Light & gagal keterhubungan `label` di semua mode; tombol `Update` gagal kontras di Light (`3.6:1`) dan Dark (`1.71:1`).

---

## 5. Matriks Prioritas Perbaikan (Masukan untuk Langkah 2: `DESIGN_PROPOSAL.md`)

| Prioritas | Kategori | Item Audit | Dampak |
| --- | --- | --- | --- |
| **Kritis** | Kontras & Warna | Perbaiki kontras tombol/badge/pagination hijau di Light & Dark (`#ffffff` di `#32e18c` `1.71:1` -> penuhi `>= 4.5:1`), serta opacity label redup `3.01:1` -> `>= 4.5:1`. | Keterbacaan & WCAG AA |
| **Kritis** | Aksesibilitas Non-Warna | Tambahkan badge/label huruf **A–F** (dan status "No Data") beserta teks/border adaptif pada marker peta, legenda, dan kartu status agar ramah buta warna & kontras tinggi di kedua tema. | Keterbacaan IHCM & A11y |
| **Kritis** | Responsif Mobile (`360px`) | Ganti `position: absolute; top: 102%` pada form split (`/table/add`, `/table/edit`, `/setting`, `/profile`, `/password`), perbaiki layout `/login`, tinggi video `/detail` & `/detail/video`, serta sediakan wrapper/card responsif untuk `/table` agar tombol `+ Add New` & kolom aksi tidak terpotong. | Kegunaan penuh di HP |
| **Kritis** | Bug Render Peta & Dark Basemap | Tambah `ResizeObserver` / `map.resize()` untuk mengatasi canvas MapLibre setengah lebar, dan hubungkan Dark mode dengan style basemap gelap + `prefers-color-scheme` tanpa FOUC `<head>`. | Fungsi inti peta |
| **Kritis** | Aksesibilitas ARIA & Form | Perbaiki markup sidebar/header (`<nav>`, hilangkan `<el-menu-item>` di dalam `<a>`), beri `aria-label` pada switch tema & pagination, sambungkan `<label>` ke input form, tambah `alt` gambar, pasang satu `<h1>` per halaman. | Skor A11y Lighthouse -> >90 & nol pelanggaran kritis axe |
| **Penting** | Target Sentuh (`>= 44x44px`) | Perbesar kontrol peta mobile, tombol header, switch tema, tag close, tombol aksi tabel, dan pagination ke minimum `44x44px` di mobile. | Usability layar sentuh |
| **Penting** | Tipografi & Token | Terapkan skala tipografi bertoken (`12px` caption min, `14px` UI, `16px` body), self-host font gratis (`Montserrat` atau `@fontsource/plus-jakarta-sans`/lokal) + ikon lokal (hapus ketergantungan Unpkg Ionicons & Google Fonts CDN), serta perbaiki typo teks UI (`"Lattitude (N)"` -> `"Latitude (N)"`). | Konsistensi, keandalan offline/Rp0, estetika |
| **Penting** | Performa & Pipeline Tailwind 2 | Aktifkan Tailwind 2 di Laravel Mix (`darkMode: 'class'`, purge `.vue`/`.js`), kompres gambar `tf*.jpg`, dan muat Video.js/TF.js secara kondisional atau terpisah agar FCP/LCP Mobile turun drastis dari `15–29 s`. | Performa Lighthouse & beban mobile |
| **Nice-to-have** | Polish & Feedback State | Standarkan radius, shadow, grid spacing, loading skeleton/spinner, empty state pencarian/tabel, error state peta/stream, serta transisi drawer/sidebar yang mulus. | Kualitas produk akhir |

# Usulan Desain & Design System — WebGIS Traffic Banda Aceh (Fase 4.5 / Step 2)

**Baseline Audit:** [docs/UIUX_AUDIT.md](file:///Users/moel_04/work/ta_webgis/docs/UIUX_AUDIT.md) (commit `ab6efd6`, branch `v1-restore`)  
**Halaman Contoh Penerapan:** Map View (`/map`) — Desktop (`1440px`) & Mobile (`360px`), Light & Dark Mode  
**Prinsip Utama:** Mempertahankan identitas visual v1 (*Lavender-Emerald Light*, *Midnight-Mint Dark*, floating green pill sidebar, alur interaksi, dan makna 6 kondisi lalu lintas IHCM 1997 A–F), sambil memenuhi standar **WCAG AA (`>= 4.5:1` teks, `>= 3.0:1` komponen UI)**, target sentuh `>= 44x44px`, serta **aset 100% gratis & self-hosted (Rp0)**.

---

## 1. Design Tokens

### 1.1 Token Warna Light Mode (`.theme-normal`)

| Token CSS | Hex Usulan | Nilai v1 Asal | Peran | Rasio Kontras Terukur | Status AA |
| --- | --- | --- | --- | --- | --- |
| `--bg-canvas` | `#F2EDFF` | `#F2EDFF` | Latar utama aplikasi | Baseline latar | — |
| `--bg-surface` | `#FFFFFF` | `#FFFFFF` | Kartu, drawer, modal, header kontrol | Baseline permukaan | — |
| `--bg-surface-subtle` | `#F7F5FC` | *Baru* | Baris zebra tabel, hover item | `15.1:1` dg `--text-primary` | **PASS** |
| `--text-primary` | `#1E2030` | `#27293D` | Judul, body teks, isi tabel | **`16.10:1`** di `#FFFFFF` / **`14.05:1`** di `#F2EDFF` | **PASS (AAA)** |
| `--text-secondary` | `#4A4D66` | *Baru* | Subjudul, alamat, metadata | **`8.25:1`** di `#FFFFFF` | **PASS (AAA)** |
| `--text-muted` | `#5B5F7A` | `opacity: 0.5` | Label form, timestamp, caption | **`6.24:1`** di `#FFFFFF` / **`5.45:1`** di `#F2EDFF` | **PASS** |
| `--border-subtle` | `#DBD4EE` | *Baru* | Pembatas kartu & sel tabel | Dekoratif / pemisah lembut | — |
| `--border-input` | `#857F9E` | *Baru* | Border input & kontrol switch | **`3.80:1`** di `#FFFFFF` | **PASS (UI)** |
| `--accent-primary` | `#237854` | `#3A976D` | Tombol primer, link hijau, koordinat | **`5.40:1`** di `#FFFFFF` / **`4.72:1`** di `#F2EDFF` | **PASS** |
| `--accent-primary-hover` | `#1B6143` | *Baru* | Hover tombol primer | **`7.40:1`** dg `#FFFFFF` | **PASS (AAA)** |
| `--accent-on-fill` | `#FFFFFF` | `#FFFFFF` | Teks di atas `--accent-primary` | **`5.40:1`** di `#237854` | **PASS** |
| `--accent-soft-bg` | `#E2F5EC` | *Baru* | Latar badge `SIMULASI`, tag `Analytic` | **`7.40:1`** dg `--accent-soft-text` | **PASS (AAA)** |
| `--accent-soft-text` | `#18583D` | *Baru* | Teks badge/tag lembut | **`7.40:1`** di `#E2F5EC` | **PASS (AAA)** |
| `--bg-sidebar-gradient` | `#278059` → `#1E6B49` | `#42B782` → `#3A9B6C` | Sidebar vertikal hijau khas v1 | **`4.86:1`–`6.45:1`** dg ikon `#FFFFFF` | **PASS** |
| `--sidebar-active-text` | `#1E6B49` | `#32E18C` | Ikon tab aktif di atas pill `#FFFFFF` | **`6.45:1`** di `#FFFFFF` | **PASS** |
| `--danger` / teks error | `#C62828` / `#B71C1C` | *Baru* | Tombol hapus & validasi error | **`5.62:1`** (`#FFF` di `#C62828`) / **`6.57:1`** | **PASS** |
| `--focus-ring` | `#1B6143` | *Tidak ada* | Outline fokus keyboard (`3px`) | **`7.40:1`** di `#FFFFFF` | **PASS (UI)** |

### 1.2 Token Warna Dark Mode (`.theme-dark` + Tailwind `.dark`)

| Token CSS | Hex Usulan | Nilai v1 Asal | Peran | Rasio Kontras Terukur | Status AA |
| --- | --- | --- | --- | --- | --- |
| `--bg-canvas` | `#1E1E2E` | `#1E1E2E` | Latar gelap khas v1 | Baseline latar | — |
| `--bg-surface` | `#27293D` | `#27293D` | Kartu, drawer, modal | Baseline permukaan | — |
| `--bg-surface-subtle` | `#2F3249` | *Baru* | Baris selang-seling, item list | `11.5:1` dg `--text-primary` | **PASS** |
| `--text-primary` | `#F5F6FA` | `#FFFFFF` | Teks utama & heading | **`13.22:1`** di `#27293D` / **`15.19:1`** di `#1E1E2E` | **PASS (AAA)** |
| `--text-secondary` | `#C7CAE0` | *Baru* | Subjudul & deskripsi | **`8.81:1`** di `#27293D` | **PASS (AAA)** |
| `--text-muted` | `#9FA4C4` | `opacity: 0.5` | Label form, timestamp | **`5.83:1`** di `#27293D` / **`6.70:1`** di `#1E1E2E` | **PASS** |
| `--border-subtle` | `#444766` | *Baru* | Garis pemisah antar elemen | Halus namun tegas | — |
| `--border-input` | `#7A7FA3` | *Baru* | Border input & switch aktif | **`3.67:1`** di `#27293D` | **PASS (UI)** |
| `--accent-primary` | `#32E18C` | `#32E18C` | Tombol primer fill, teks link, fokus ring | **`8.35:1`** teks di `#27293D` | **PASS (AAA)** |
| `--accent-on-fill` | `#0B2418` | `#FFFFFF` *(gagal 1.71:1)* | Teks tombol di atas `#32E18C` | **`9.60:1`** di `#32E18C` | **PASS (AAA)** |
| `--accent-soft-bg` / `-text` | `#1F3D34` / `#6DF2B2` | Transparent | Badge `SIMULASI` & tag `Analytic` | **`8.45:1`** | **PASS (AAA)** |
| `--bg-sidebar-gradient` | `#21714E` → `#175338` | `#42B782` → `#3A9B6C` | Sidebar gelap harmonis dengan `#1E1E2E` | **`5.94:1`–`9.01:1`** dg `#FFFFFF` | **PASS** |
| `--sidebar-active-bg` / `-text` | `#1E1E2E` / `#32E18C` | `#FFFFFF` / `#32E18C` | Pill navigasi aktif | **`9.59:1`** | **PASS (AAA)** |
| `--danger` (`fill` / `text`) | `#F87171` (teks `#2B0909`) / `#FCA5A5` | *Baru* | Tombol hapus & pesan error | **`6.63:1`** (fill) / **`7.52:1`** (teks) | **PASS** |

### 1.3 Skema Warna & Aksesibilitas Non-Warna Kondisi Lalu Lintas (IHCM 1997)

Makna 6 warna asli v1 **tetap dipertahankan**. Untuk mengatasi masalah buta warna serta kegagalan kontras pada latar Light/Dark, setiap marker peta, item legenda, dan status tabel memakai **chip huruf (`A`–`F`, `?`)** dengan warna teks internal & border luar berkontras tinggi:

| Grade & Status | Rasio V/C (IHCM) | Warna Chip | Teks Huruf Dalam Chip | Kontras Teks Chip | Border Luar Chip (Ring Kontras) |
| --- | --- | --- | --- | --- | --- |
| **A · Great** | `< 0,6` | `#98FB98` (Hijau Muda v1) | `#0F2E1A` | **`11.63:1`** | `#1B6E2D` (`6.34:1` di Light) |
| **B · Good** | `0,6 – 0,7` | `#0B6623` (Hijau Tua v1) | `#FFFFFF` | **`7.15:1`** | `#1B6E2D` (Light) / `#4ADE80` (`8.19:1` di Dark) |
| **C · Average** | `0,7 – 0,8` | `#FFFF00` (Kuning v1) | `#241F00` | **`15.39:1`** | `#856404` (`5.49:1` di Light) |
| **D · Poor** | `0,8 – 0,9` | `#D4A328` (Kuning Tua v1) | `#1F1500` | **`7.78:1`** | `#7A5908` (`6.44:1` di Light) |
| **E · Bad** | `0,9 – 1,0` | `#FF5F00` (Oranye v1) | `#1F0B00` | **`6.23:1`** | `#B44100` (`5.68:1` di Light) |
| **F · Terrible** | `> 1,0` | `#DC2626` (Merah pekat) | `#FFFFFF` | **`4.83:1`** | `#991B1B` (Light) / `#FCA5A5` (`7.52:1` di Dark) |
| **? · No Data** | *Belum ada data* | `#2563EB` (Biru jelas) | `#FFFFFF` | **`5.17:1`** | `#1D4ED8` (Light) / `#60A5FA` (`5.62:1` di Dark) |

> **Catatan teks legenda:** Teks keterangan (`Terrible (> 1.0)`, dst.) tidak lagi memakai warna status yang pudar, melainkan `--text-primary` pada permukaan kartu legenda (**`16.10:1` Light** dan **`13.22:1` Dark**).

### 1.4 Skala Tipografi, Spacing, Radius & Bayangan

- **Font Keluarga (Gratis & Self-Hosted):** `Montserrat` (di-host lokal via `@fontsource/montserrat` / `public/fonts/`, fallback `system-ui, -apple-system, sans-serif`) agar tampilan v1 tetap terjaga **tanpa** ketergantungan Google Fonts CDN dan menghilangkan rule berbahaya `* { font-family }`.
- **Ikon UI:** SVG lokal inline / komponen ikon Vue ringan menggantikan `https://unpkg.com/ionicons@5.4.0/dist/ionicons.js`.
- **Skala Tipografi:**
  - `--text-caption`: `0.75rem` (`12px`, `line-height: 1.4`, font-weight `500–700`) — batas bawah mutlak untuk timestamp, koordinat sekunder, tag.
  - `--text-sm`: `0.875rem` (`14px`, `line-height: 1.45`) — label form, kontrol UI, teks tabel.
  - `--text-base`: `1rem` (`16px`, `line-height: 1.5`) — ukuran dasar body, paragraf, input mobile.
  - `--text-lg`: `1.125rem` (`18px`, `line-height: 1.35`, weight `600–700`) — judul kartu & subjudul (`h2`/`h3`).
  - `--text-xl`: `1.375rem` (`22px`, `line-height: 1.25`, weight `700`) — satu `<h1>` per halaman untuk judul rute.
- **Grid Spacing & Radius:** Kelipatan `4px` (`4, 8, 12, 16, 20, 24, 32px`); radius `--radius-sm: 8px` (input/tombol), `--radius-md: 12px` (kontrol/drawer/banner), `--radius-lg: 16px` (kartu utama & sidebar pill).
- **Bayangan:** Light (`0 6px 20px rgba(30, 32, 48, 0.08)`), Dark (`0 8px 24px rgba(0, 0, 0, 0.35)`).

### 1.5 Strategi Light/Dark Mode Bebas FOUC & Sinkronisasi Peta/Chart

1. **Inline `<head>` Boot Script di [base.blade.php](file:///Users/moel_04/work/ta_webgis/resources/views/layouts/base.blade.php):** Membaca `localStorage.getItem('theme')`; jika belum ada, mengikuti `window.matchMedia('(prefers-color-scheme: dark)').matches`. Menetapkan `theme-dark dark` atau `theme-normal` ke `<html>` **sebelum** render pertama terjadi (nol kedipan).
2. **Sinkronisasi Global Event Bus / Store Kecil:** Perubahan switch di header memperbarui `localStorage`, kelas `<html>`, warna Chart.js (teks/grid sumbu), serta style basemap MapLibre secara otomatis (`"streets"` / OpenFreeMap `liberty` saat Light, `"dark"` / OpenFreeMap `dark` saat Dark — kecuali user memilih gaya manual seperti `Outdoor`).

---

## 2. Spesifikasi Gaya Komponen

- **Tombol (`Primary`, `Secondary`, `Danger`, `Ghost`):**
  - Ukuran: `min-height: 44px` (`padding: 0 16px`, radius `8px`, `font-size: 14px`, `font-weight: 600`).
  - State wajib jelas pada semua varian: `:hover` (perubahan background/border terukur), `:active` (`scale(0.98)` halus), `:focus-visible` (`outline: 3px solid var(--focus-ring); outline-offset: 2px`), `:disabled` (`opacity: 0.55; cursor: not-allowed`), dan state `loading` dengan spinner + `aria-busy="true"`.
- **Input, Select & Label Form:**
  - Setiap `<label>` memakai kontras penuh (`--text-secondary`, `8.25:1` Light / `8.81:1` Dark) — **tidak lagi `opacity: 0.5`** — dan selalu tertaut ke atribut `id` elemen `<input>` (`for` = `id`).
  - Tinggi input minimum `44px`, font minimal `16px` di mobile (mencegah auto-zoom iOS), border `--border-input` (`>= 3.67:1`), teks kesalahan validasi di bawah field memakai `--danger-text`.
  - Perbaikan ejaan label UI: `"Lattitude (N)"` dirapikan menjadi `"Latitude (N)"` (tanpa mengubah nama kolom DB/API `lattitude` di backend).
- **Kartu & Banner Simulasi:**
  - Permukaan `--bg-surface`, border `1px solid var(--border-subtle)`, padding `16px–24px`, radius `16px`.
  - Banner `SIMULASI DEMO` memakai `role="status"` dengan chip `--accent-soft-bg` + `--accent-soft-text` agar nyaman dibaca di mobile maupun desktop tanpa menumpuk.
- **Tabel (`Table View`):**
  - Desktop/Tablet: header aksi bertulis `"Actions"` (menghilangkan `empty-table-header`), pagination `.btn-prev` & `.btn-next` punya `aria-label` (`Halaman sebelumnya` / `Halaman berikutnya`) dan ukuran sentuh `44x44px`.
  - Mobile (`< 768px`): daftar disajikan sebagai **kartu CCTV responsif** (atau wrapper scroll horizontal aman + tombol `+ Add New` berada di bar aksi atas yang selalu terlihat penuh) sehingga nama, alamat, koordinat, agency, status, serta tombol View/Edit/Delete bisa disentuh `44x44px`.
- **Navbar & Sidebar:**
  - Menggunakan `<header>` dan `<nav aria-label="Navigasi Utama">` berisi `<ul><li><a ...>` murni (menghapus pembungkus `<a>` di luar `<el-menu-item role="menuitem">` agar nol error `aria-required-parent/children`), dan `aria-current="page"` pada halaman aktif.
  - Switch tema memakai `<button role="switch" aria-checked="true|false" aria-label="...">` **hanya dengan ikon Matahari/Bulan** (tanpa teks label "Light/Dark") dan ukuran sentuh `>= 44px` (menggantikan `<el-switch>` yang memicu error `nested-interactive`).
  - Mobile `< 768px`: sidebar pill kiri diganti tombol menu `44x44px` di header yang membuka laci navigasi (*slide-over drawer*) lengkap dengan teks menu.
- **Kontrol Peta, Popup & Legenda (`/map`):**
  - Kontrol kiri atas mempertahankan lengkap fungsi v1: **Reset Home**, **Layers & Map Style**, **Navigation (`+`, `−`, Reset Compass)**, dan **Find My Location (`GeolocateControl`)** dengan ukuran sentuh `>= 44x44px`.
  - **Popup Peta** menampilkan judul persimpangan, chip kondisi, **stream `<video>` / gambar CCTV seperti v1**, status (`Good`, `Average`, dst.), dan tautan `Detail →` **tanpa** menampakkan angka internal rasio `V/C`.
  - **Legenda Peta** memakai teks v1 yang ringkas (`Terrible`, `Bad`, `Poor`, `Average`, `Good`, `Great`, `No Data`) tanpa angka rentang `V/C`, dipasangkan dengan chip huruf `A–F` / `?` untuk aksesibilitas non-warna.

---

## 3. Penerapan pada Halaman Contoh: Map View (`/map`)

Halaman `/map` di-prototipekan dengan token dan komponen di atas menggunakan MapLibre GL + basemap gratis OpenFreeMap (`liberty` untuk Light, `dark` untuk Dark), `ResizeObserver` untuk membasmi bug kanvas setengah lebar, marker huruf+warna A–F, tombol *Find My Location*, video pada popup, serta `axe-core` audit langsung pada purwarupa.

### 3.1 Ringkasan Peningkatan Terukur (Sebelum vs Sesudah pada `/map`)

| Aspek Audit | Sebelum (`UIUX_AUDIT.md`) | Sesudah (Usulan Desain `/map`) |
| --- | --- | --- |
| **Pelanggaran `axe-core`** | **`10`** (`Light` & `Dark`, `360` & `1440`) | **`0`** di semua 4 mode (`1440_L`, `1440_D`, `360_L`, `360_D`) |
| **Target sentuh app `< 44x44px`** | **`14`** elemen (zoom, layer, clear, switch, search) | **`0`** elemen kontrol app (`100% >= 44x44px`) |
| **Kontras tombol & badge utama** | `3.6:1` (Light), **`1.71:1`** (Dark `#FFF` on `#32E18C`) | **`5.40:1`** (Light), **`9.60:1`** (Dark `#0B2418` on `#32E18C`) |
| **Aksesibilitas status IHCM A–F** | Hanya bulatan warna (kontras Light `1.07:1`–`2.32:1`) | Chip huruf **`A`–`F` / `?`** + border ring kontras + label ringkas tanpa rentang `V/C` |
| **Render kanvas peta initial** | Setengah lebar di `1024px` & `1440px` Light | Penuh `100%` lebar & tinggi (`ResizeObserver`) |
| **Sinkronisasi Dark Mode peta** | Basemap tetap putih terang di UI gelap | Peta otomatis memakai gaya `OpenFreeMap dark` + popup & atribusi gelap |

### 3.2 Perbandingan Visual Sebelum vs Sesudah

#### A. Desktop `1440px` — Light Mode
*Perbaikan tampak: kanvas peta penuh 100%, kontrol kiri lengkap (`Home`, `Layer`, `Zoom/Compass`, `Find My Location`) ukuran `>= 44x44px`, theme toggle ikon-only, popup menampilkan video CCTV langsung tanpa angka V/C internal, dan legenda ringkas berchip huruf A–F + `?`.*

| Kondisi Sebelum (`map_1440.png`) | Usulan Desain (`map_proposal_1440_light.png`) |
| --- | --- |
| ![Sebelum 1440 Light](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1440.png) | ![Sesudah 1440 Light](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_proposal/map_proposal_1440_light.png) |

#### B. Desktop `1440px` — Dark Mode
*Perbaikan tampak: basemap peta ikut gelap (`OpenFreeMap dark`), kontrol & switch ikon Bulan sinkron, tombol `Login` `#32E18C` memakai teks `#0B2418` (`9.60:1`), popup video & atribusi peta menyesuaikan tema gelap `#27293D`.*

| Kondisi Sebelum (`map_1440_dark.png`) | Usulan Desain (`map_proposal_1440_dark.png`) |
| --- | --- |
| ![Sebelum 1440 Dark](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_1440_dark.png) | ![Sesudah 1440 Dark](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_proposal/map_proposal_1440_dark.png) |

#### C. Mobile `360px` — Light & Dark Mode
*Perbaikan tampak: seluruh kontrol kiri termasuk `Find My Location` tetap tersedia berukuran `>= 44x44px`, popup video tampil di atas kontrol peta (`z-index: 20`), legenda 2 kolom ringkas, switch ikon saja, dan nol clipping horizontal.*  
*(Catatan implementasi Langkah 3: pada layar `<= 767px`, legenda juga dapat dilengkapi tombol ciutkan/buka `Legenda A–F` agar peta semakin lega dan tidak bersinggungan dengan atribusi peta di bagian paling bawah).*

| Sebelum Mobile 360px (`map_360.png`) | Usulan Mobile 360px Light (`map_proposal_360_light.png`) | Usulan Mobile 360px Dark (`map_proposal_360_dark.png`) |
| --- | --- | --- |
| ![Sebelum 360 Light](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_audit/map_360.png) | ![Sesudah 360 Light](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_proposal/map_proposal_360_light.png) | ![Sesudah 360 Dark](/Users/moel_04/work/ta_webgis/docs/screenshots/phase45_proposal/map_proposal_360_dark.png) |

---

## 4. Rencana Implementasi Bertahap (Langkah 3 — Menunggu Persetujuan)

Jika arah desain di atas disetujui, implementasi akan dijalankan bertahap per gelombang kecil:
1. **Gelombang 1 — Fondasi Token, Font Lokal, Tailwind 2, & Sinkronisasi Tema Tanpa FOUC:** Mengaktifkan Tailwind CSS 2 (`darkMode: 'class'`, purge `.vue`/`.js`) di `webpack.mix.js`, self-host font + ikon SVG, menulis variabel token Light/Dark di `resources/css/`, skrip FOUC-free di `base.blade.php`, dan mengeliminasi CDN berlebih (Bootstrap/jQuery/Ionicons global; lazy/kondisional untuk Video.js) + kompresi aset foto `public/assets/tf*.jpg`.
2. **Gelombang 2 — Shell Navigasi & Komponen Bersama:** Refactor `AppLayout`, `AppHeader`, `AppSidebar` (`<nav>`, drawer mobile, switch tema `role="switch"` sinkron), `SimulationBanner`, dan utilitas badge/chip IHCM A–F reusable.
3. **Gelombang 3 — Halaman Publik (`Dashboard`, `Map View`, `Table`, `Detail`, `Video Detail`, `Login`):** Perbaikan `ResizeObserver` peta, basemap dark otomatis, kontrol `>= 44x44px`, kartu tabel responsif mobile, layout video proporsional, serta `label` + `alt` + `<h1>`.
4. **Gelombang 4 — Halaman Admin (`Add/Edit CCTV`, `Map Settings`, `Profile`, `Password`) & Verifikasi Akhir:** Hapus `position: absolute` form split mobile, sambungkan label Element UI, dan ulangi uji **Lighthouse + `axe-core` + 4 viewport screenshot Before/After** serta `php artisan test`.

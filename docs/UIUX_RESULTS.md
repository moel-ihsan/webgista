# Hasil Implementasi & Verifikasi UI/UX — WebGIS Traffic Banda Aceh (Fase 4.5 / Step 4)

**Tanggal Verifikasi Akhir:** 21 November 2026  
**Branch:** `v1-restore` (commit implementasi: `94c8b47` → `a47b3ee`)  
**Baseline Sebelum:** [UIUX_AUDIT.md](UIUX_AUDIT.md) (commit `ab6efd6`) · **Usulan Disetujui:** [DESIGN_PROPOSAL.md](DESIGN_PROPOSAL.md) (commit `493255b`)  
**Target Uji:** `http://127.0.0.1:8000` (Google Chrome `157.0.8103.79`, Lighthouse `13.6.0`, `axe-core`, Puppeteer Core)

---

## 1. Ringkasan Implementasi (Wave 1–4 + Polish)

Seluruh peningkatan antarmuka dan aksesibilitas dikerjakan secara bertahap dengan mempertahankan **100% identitas visual v1**, kontrak rute, serta logika bisnis IHCM 1997 (`LV 1.0`, `HV 1.3`, `MC 0.4`, kapasitas `4455`, jendela `30s`, ROI poligon bebas, polling `1000 ms`):

1. **Wave 1 — Fondasi Token, Tema, & Aset Gratis Rp0 (`94c8b47`):**
   - Token warna Light (`.theme-normal`: canvas `#f2edff`, surface `#ffffff`, accent `#237854`, teks `#1e2030`/`#5b5f7a`) & Dark (`.theme-dark.dark`: canvas `#1e1e2e`, surface `#27293d`, accent `#32e18c` dengan teks `#0b2418` kontras `9.60:1`) dalam [resources/css/tokens.css](../resources/css/tokens.css) dan Tailwind CSS 2 (`darkMode: "class"`).
   - Skrip inline di `<head>` [resources/views/layouts/base.blade.php](../resources/views/layouts/base.blade.php) membaca `localStorage.theme` dan `prefers-color-scheme` sebelum render awal (*zero FOUC*); menghapus CDN berbayar/berat yang tidak terpakai (Bootstrap 4, jQuery, Popper, Video.js, Ionicons CDN, Google Fonts).
   - Font self-hosted `@fontsource/montserrat` (`400, 500, 600, 700` latin `.woff2` `18.3–18.4 KiB`/berkas) dan ikon SVG inline ringan (`AppIcon.vue`), serta optimasi foto demo `public/assets/tf1..tf5.jpg` (maks `1200px`, turun dari `590K–1.6M` menjadi `230K–454K`) dan dynamic code-splitting chunk per halaman.
2. **Wave 2 — Shell & Navigasi Semantik (`2a9413a`):**
   - Refactor [AppLayout.vue](../resources/js/components/layout/AppLayout.vue), [AppHeader.vue](../resources/js/components/layout/AppHeader.vue), [AppSidebar.vue](../resources/js/components/layout/AppSidebar.vue), dan [SimulationBanner.vue](../resources/js/components/layout/SimulationBanner.vue): landmark semantik `<header>`, `<nav aria-label="Navigasi Utama">`, `<ul><li><a>`, `<main id="main-content">`, tepat satu `<h1>` per halaman, switch tema **ikon-saja** (Sun/Moon `44px`, tanpa teks `Light/Dark`), drawer navigasi mobile dengan penutupan `Escape`, dan menu dropdown admin yang dapat diakses keyboard.
3. **Wave 3 — Halaman Publik & Peta Interaktif (`57b7570`):**
   - **Map View (`/map`):** Urutan vertikal tombol kiri dipertahankan persis **Navigation (`+`, `−`, Compass) → Geolocate (*Find My Location*) → Home (`#zoomHome`) → Layers (`MapLayerControl`)** dengan ukuran minimal `44x44px`; `ResizeObserver` mengatasi bug canvas setengah lebar di `1024px/1440px`; sinkronisasi basemap Light (`liberty`) ↔ Dark (`dark`); layer huruf non-warna **`A–F` / `?`** (`unclustered-point-grade`) + komponen `TrafficGradeBadge.vue` pada legenda dan popup; label legenda ringkas tanpa angka rasio V/C (`Terrible` .. `Great`, `No Data`); popup menampilkan video/gambar CCTV dan tombol `Detail →` tanpa angka V/C internal.
   - **Dashboard (`/`), Table (`/table`), Detail (`/detail/{id}`), Video Detection (`/detail/video/{id}`), Login (`/login`):** Grid kartu responsif `360–1440px`, daftar kartu tabel pada layar `<= 1023px`, kotak video/canvas `16:9` bersih tanpa margin negatif bertumpuk, atribut `alt` pada gambar, label pagination `aria-label`, dan penautan eksplisit `<label for>` ↔ `<input id>`.
4. **Wave 4 — Halaman Form Admin Responsif (`2290562`):**
   - Refactor [CctvForm.vue](../resources/js/components/table/CctvForm.vue), [MapSettingsPanel.vue](../resources/js/components/settings/MapSettingsPanel.vue), [AgencyTagManager.vue](../resources/js/components/settings/AgencyTagManager.vue), [ProfileForm.vue](../resources/js/components/auth/ProfileForm.vue), [PasswordForm.vue](../resources/js/components/auth/PasswordForm.vue), dan [CoordinatePickerMap.vue](../resources/js/components/map/CoordinatePickerMap.vue): mengganti panel `position: absolute; top: 102%` (yang terpotong di mobile) dengan CSS Grid 2 kolom responsif, sinkronisasi dark basemap dengan re-init `pulsing-dot` di `style.load`, label jelas `"Latitude (N)"` (tetap mengirim field DB `lattitude`), serta target sentuh `>= 44x44px`.
5. **Step A Polish — Penuntasan Audit `axe-core` & Touch Target (`a47b3ee`):**
   - Memindahkan style global `.theme-switch-btn`, `.theme-switch-thumb`, `.form-card-heading`, dan `.btn-form-submit` ke [resources/css/app.css](../resources/css/app.css); menonaktifkan atribut `aria-hidden` Flickity pada link fokus (`RecentCctvCarousel.vue`); memperlebar breakpoint kartu mobile `CctvTable` hingga `1023px` (`768px` bebas pemotongan); tinggi tombol upload & chip tag `44px`; `focusAfterOpen: false` + ruang tombol close `44px` di popup MapLibre.

---

## 2. Verifikasi Lighthouse `13.6.0` (Sebelum vs Sesudah)

Target Fase 4.5: **Accessibility `>= 90` di semua rute uji, tanpa kegagalan audit aksesibilitas kritis**.

| Rute | Halaman | Sebelum Mobile (`P / A / BP / S`, LCP) | Sesudah Mobile (`P / A / BP / S`, LCP) | Sebelum Desktop (`P / A / BP / S`, LCP) | Sesudah Desktop (`P / A / BP / S`, LCP) | Delta A11y (M / D) |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Dashboard | `51 / 69 / 100 / 83` (`29.0 s`) | `52 / 100 / 100 / 100` (`15.4 s`) | `60 / 69 / 96 / 83` (`6.1 s`) | `75 / 100 / 100 / 100` (`3.2 s`) | **`+31` / `+31`** |
| `/map` | Map View | `55 / 71 / 96 / 83` (`15.1 s`) | `53 / 100 / 100 / 100` (`7.8 s`) | `68 / 71 / 96 / 83` (`2.9 s`) | `86 / 100 / 100 / 100` (`1.7 s`) | **`+29` / `+29`** |
| `/table` | Table View (Guest) | `51 / 68 / 100 / 83` (`15.1 s`) | `53 / 100 / 100 / 100` (`7.8 s`) | `69 / 68 / 100 / 83` (`2.8 s`) | `88 / 100 / 100 / 100` (`1.5 s`) | **`+32` / `+32`** |
| `/detail/1` | CCTV Detail | `55 / 70 / 96 / 83` (`16.0 s`) | `50 / 100 / 96 / 100` (`13.9 s`) | `64 / 70 / 96 / 83` (`4.0 s`) | `81 / 100 / 96 / 100` (`2.6 s`) | **`+30` / `+30`** |
| `/login` | Login | `55 / 75 / 96 / 83` (`15.1 s`) | `53 / 100 / 100 / 100` (`10.4 s`) | `64 / 75 / 96 / 83` (`4.0 s`) | `90 / 100 / 100 / 100` (`1.5 s`) | **`+25` / `+25`** |
| `/setting/1` | Map Settings (Admin) | `52 / 70 / 96 / 83` (`14.9 s`) | `52 / 100 / 96 / 100` (`7.9 s`) | `69 / 70 / 96 / 83` (`2.8 s`) | `87 / 100 / 96 / 100` (`1.6 s`) | **`+30` / `+30`** |

- **`failedA11yAudits` Sesudah:** `[]` (**0 kegagalan audit aksesibilitas Lighthouse** di seluruh 6 rute x Mobile & Desktop).
- **SEO:** Naik dari `83` menjadi **`100`** di seluruh rute.
- **Performa Desktop & LCP:** Skor performa Desktop naik signifikan dari `60–69` menjadi **`75–90`** (`LCP` turun ke `1.5–3.2 s`), dan `LCP` Mobile turun ~50% (misal `/` `29.0 s → 15.4 s`, `/map` `15.1 s → 7.8 s`). Catatan: skor Performance Mobile (`50–53`) dipengaruhi throttling lambat 4G Lighthouse terhadap runtime Vue 2 + Element UI pada `php artisan serve` lokal tanpa kompresi gzip/Brotli HTTP produksi (Nginx di Fase 5 akan menangani kompresi HTTP).

---

## 3. Verifikasi `axe-core`, 4 Viewport × 2 Tema, & Navigasi Keyboard

### 3.1 Pelanggaran `axe-core` (Sebelum vs Sesudah) & Cek DOM 48 Rute-Viewport

| Rute / Mode | Pelanggaran axe Sebelum (`360_L / 1440_L / 1440_D`) | Pelanggaran axe Sesudah (`360_L / 1440_L / 1440_D`) | Overflow (`360/768/1024/1440`) | El Terpotong / Target `<44px` | Landmark (`main / nav / header / h1`) @1440 |
| --- | --- | --- | --- | --- | --- |
| `/login` | `9 / 9 / 9` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 0 / 1 / 1` |
| `/` (Dashboard) | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/map` (Map View) | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/table` (Guest) | `12 / 12 / 12` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/detail/1` | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/detail/video/1` | `9 / 9 / 9` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/table` (Admin) | `12 / 12 / 12` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/table/add` (Admin) | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/table/edit/1` (Admin) | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/setting/1` (Admin) | `9 / 9 / 9` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/profile/1` (Admin) | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |
| `/password` (Admin) | `10 / 10 / 10` | **`0 / 0 / 0`** | `0 px` di 4 viewport | `0` / `0` | `1 / 1 / 1 / 1` |

- Ukuran font dasar terukur: **`16px`** konsisten pada `body`.
- Di `Map View` (`/map`), sebelum perbaikan terdapat **14** target sentuh `<44x44px` dan canvas hanya merender **50% lebar** di `1024px` & `1440px`; sesudah perbaikan menjadi **`0` target kecil** dan **100% lebar kanvas peta** pada seluruh viewport.

### 3.2 Uji Navigasi Keyboard (`/map`, Desktop `1440px` & Mobile `360px`)

- **Urutan `Tab` Desktop:** `button.header-menu-btn` (*Toggle menu navigasi*) → `button.theme-switch-btn` (`role="switch"`, *Aktifkan mode gelap*) → `a.header-login-btn` (*Login*) → link navigasi `<nav>` (*Dashboard*, *View Map*, *Data Table*) → kolom pencarian & item `#1`/`#2` → tombol panel pencarian → kanvas peta (`role="region"`) → kontrol peta (`Zoom in`, `Zoom out`, `Compass`, `Geolocate`, `Home`, `Layers`).
- **Aktivasi `Enter` & `Escape`:**
  - `Enter` pada switch tema mengubah `theme-normal` → `theme-dark dark` sekaligus menyinkronkan gaya peta MapLibre.
  - `Enter` pada `Pilih gaya dan layer peta` membuka popover *Map Style & Layer*.
  - `Enter` pada tombol panel pencarian membuka sidebar pencarian kanan (`#right` tidak lagi `.collapsed`).
  - Di Mobile `360x800`, `Enter` pada `Toggle menu navigasi` membuka drawer `.sidebar-nav--mobile-open` (`true`) dan `Escape` menutupnya kembali (`false`); `Enter` pada `.legend-toggle-btn` mengubah `aria-expanded` `"false"` → `"true"`.

---

## 4. Kontrak Rute, Logika Bisnis IHCM, & Pengujian Otomatis

- **Paritas Rute & Backend:** `git diff --stat ab6efd6..HEAD -- routes/ app/` kosong (nol perubahan pada [routes/web.php](../routes/web.php), [routes/api.php](../routes/api.php), controller, middleware, ataupun model).
- **Jest Unit/Smoke (`npm run test:js -- --silent`):** **6 suites, 30 tests passed** (`ihcmClassifier.spec.js`, `roiGeometry.spec.js`, `precomputedPlayer.spec.js`, `windowTracker.spec.js`, `mapConfig.spec.js`, `smoke.spec.js`).
- **Laravel Feature/Unit (`php artisan test`):** **15 passed** (`ExampleTest`, `AuthAndProfileTest`, `CctvApiTest`, `MapSettingAndAgencyTest`).
- **ESLint (`npm run lint`):** Lulus (`0 errors`).
- **Build Produksi (`npm run prod`):** `css/app.css` `17.1 KiB`, `js/app.js` `1.24 MiB`, chunk halaman `8.51 KiB – 830 KiB`.

---

## 5. Perbandingan Visual Sebelum vs Sesudah (`docs/screenshots/`)

| Halaman & Viewport | Sebelum (`phase45_audit/`) | Sesudah (`phase45_after/`) | Ringkasan Perubahan |
| --- | --- | --- | --- |
| Map View `1440px` Light | [map_1440.png](screenshots/phase45_audit/map_1440.png) | [map_1440.png](screenshots/phase45_after/map_1440.png) | Canvas peta penuh 100%, kontrol urut +/Geo/Home/Layers `44px`, badge huruf `A`/`F`, legenda ringkas |
| Map View `1440px` Dark | [map_1440_dark.png](screenshots/phase45_audit/map_1440_dark.png) | [map_1440_dark.png](screenshots/phase45_after/map_1440_dark.png) | Basemap berubah ke `Dark`, teks/switch kontras tinggi AA |
| Map View `360px` Mobile | [map_360.png](screenshots/phase45_audit/map_360.png) | [map_360.png](screenshots/phase45_after/map_360.png) | Kontrol `44x44px` ramah sentuh, legenda dapat diciutkan |
| Dashboard `1440px` Light & Dark | [dashboard_1440.png](screenshots/phase45_audit/dashboard_1440.png) | [dashboard_1440.png](screenshots/phase45_after/dashboard_1440.png) · [Dark](screenshots/phase45_after/dashboard_1440_dark.png) | Peta tidak lagi setengah lebar; popup tidak menutup tombol close; foto hero terkompresi |
| Dashboard `360px` | [dashboard_360.png](screenshots/phase45_audit/dashboard_360.png) | [dashboard_360.png](screenshots/phase45_after/dashboard_360.png) | Grid 2 kolom di *Recently Updated*, tidak ada item terpotong |
| Table View `360px` Admin | [table_admin_360.png](screenshots/phase45_audit/table_admin_360.png) | [table_admin_360.png](screenshots/phase45_after/table_admin_360.png) | Tampilan kartu mobile lengkap dengan `+ Add New` dan aksi `Detail/Edit/Delete` `44px` |
| Video Detail `1440px` Dark | [video_detail_1440_dark.png](screenshots/phase45_audit/video_detail_1440_dark.png) | [video_detail_1440_dark.png](screenshots/phase45_after/video_detail_1440_dark.png) | Kotak video `16:9` + poligon ROI biru rapi, tombol `Manage Video`/`Show Video` kontras AA, chip huruf `F` |
| Map Settings `1440px` Dark & `360px` | [settings_1440_dark.png](screenshots/phase45_audit/settings_1440_dark.png) · [360px](screenshots/phase45_audit/settings_360.png) | [settings_1440_dark.png](screenshots/phase45_after/settings_1440_dark.png) · [360px](screenshots/phase45_after/settings_360.png) | Grid responsif menggantikan `position: absolute`, basemap gelap sinkron, chip agensi `44px` |
| Login `1440px` Dark | [login_1440_dark.png](screenshots/phase45_audit/login_1440_dark.png) | [login_1440_dark.png](screenshots/phase45_after/login_1440_dark.png) | Tombol `Sign In` `#0b2418` di `#32e18c` (`9.60:1`), switch ikon-saja, label terhubung |

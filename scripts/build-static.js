const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const ASSET_SUBDIRS = ["assets", "css", "demo", "fonts", "geojson", "js"];

function copyRecursive(src, dest, excludeRelPaths = new Set()) {
  if (!fs.existsSync(src)) {
    return;
  }

  const stat = fs.statSync(src);
  const rel = path.relative(PUBLIC_DIR, src).split(path.sep).join("/");
  if (excludeRelPaths.has(rel)) {
    return;
  }

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === ".DS_Store") {
        continue;
      }
      copyRecursive(path.join(src, entry), path.join(dest, entry), excludeRelPaths);
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function readMixManifest() {
  const manifestPath = path.join(PUBLIC_DIR, "mix-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { "/css/app.css": "/css/app.css", "/js/app.js": "/js/app.js" };
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function buildMetaConfigs() {
  const mapConfig = {
    provider: process.env.MAP_PROVIDER || "auto",
    maptiler_key: process.env.MAPTILER_API_KEY || "",
    stadia_key: process.env.STADIA_API_KEY || ""
  };

  const simulationConfig = {
    enabled: process.env.SIMULATION_ENABLED !== "false",
    default_mode: process.env.SIMULATION_DEFAULT_MODE || "live",
    banner_text: "",
    cameras: {
      "simpang-pdam": {
        name: "Simpang PDAM",
        video_url: "/demo/videos/simpang-pdam.mp4",
        precomputed_url: "/demo/detections/simpang-pdam.json",
        default_roi: {
          rec1x: 195.0,
          rec1y: 148.0,
          rec2x: 475.0,
          rec2y: 148.0,
          rec3x: 625.0,
          rec3y: 255.0,
          rec4x: 595.0,
          rec4y: 352.0,
          rec5x: 55.0,
          rec5y: 352.0
        }
      },
      "simpang-jambo-tape": {
        name: "Simpang Jambo Tape",
        video_url: "/demo/videos/simpang-jambo-tape.mp4",
        precomputed_url: "/demo/detections/simpang-jambo-tape.json",
        default_roi: {
          rec1x: 250.0,
          rec1y: 38.0,
          rec2x: 450.0,
          rec2y: 48.0,
          rec3x: 625.0,
          rec3y: 230.0,
          rec4x: 390.0,
          rec4y: 352.0,
          rec5x: 10.0,
          rec5y: 330.0
        }
      }
    }
  };

  return { mapConfig, simulationConfig };
}

function renderHtmlShell({ title, mountTag, cssPath, jsPath, mapConfig, simulationConfig, inlineScript = "" }) {
  return `<!DOCTYPE html>
<html lang="en" class="theme-normal">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Pemetaan Kondisi Lalu Lintas Persimpangan Kota Banda Aceh secara Real-Time berbasis WebGIS dan Pembelajaran Mesin.">
    <meta name="csrf-token" content="">
    <meta name="map-config" content="${escapeAttr(JSON.stringify(mapConfig))}">
    <meta name="webgista-simulation" content="${escapeAttr(JSON.stringify(simulationConfig))}">

    <title>${escapeAttr(title)}</title>

    <script>
        (function () {
            try {
                var saved = window.localStorage.getItem('theme');
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var useDark = saved === 'theme-dark' || (!saved && prefersDark);
                document.documentElement.className = useDark ? 'theme-dark dark' : 'theme-normal';
            } catch (_e) {
                document.documentElement.className = 'theme-normal';
            }
        })();
    </script>

    <link rel="stylesheet" href="${escapeAttr(cssPath)}">
</head>
<body>
    ${inlineScript}
    <div id="app">
        ${mountTag}
    </div>

    <script>
        var BASE_URL = window.location.origin;
        window.__WEBGISTA_STATIC_MODE__ = true;
    </script>
    <script src="${escapeAttr(jsPath)}"></script>
</body>
</html>
`;
}

function main() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const excludes = new Set(["assets/video"]);
  for (const dir of ASSET_SUBDIRS) {
    copyRecursive(path.join(PUBLIC_DIR, dir), path.join(DIST_DIR, dir), excludes);
  }

  const manifestPath = path.join(PUBLIC_DIR, "mix-manifest.json");
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.join(DIST_DIR, "mix-manifest.json"));
  }

  const manifest = readMixManifest();
  const cssPath = manifest["/css/app.css"] || "/css/app.css";
  const jsPath = manifest["/js/app.js"] || "/js/app.js";
  const { mapConfig, simulationConfig } = buildMetaConfigs();

  const pages = [
    { file: "index.html", title: "Dashboard", mountTag: "<dashboard></dashboard>" },
    { file: "map.html", title: "Map View", mountTag: "<mapview></mapview>" },
    { file: "table.html", title: "Table View", mountTag: "<tableview></tableview>" },
    { file: "login.html", title: "Login", mountTag: "<login></login>" },
    { file: "add.html", title: "Table | Add", mountTag: "<add></add>" },
    { file: "edit.html", title: "CCTV | Edit", mountTag: "<edit></edit>" },
    { file: "detail.html", title: "CCTV Detail", mountTag: "<detail></detail>" },
    { file: "videodetail.html", title: "Video Detail", mountTag: "<videodetail></videodetail>" },
    { file: "setting.html", title: "Settings", mountTag: "<settings></settings>" },
    { file: "profile.html", title: "CCTV | Profile", mountTag: "<profile></profile>" },
    { file: "password.html", title: "CCTV | Password", mountTag: "<password></password>" },
    {
      file: "logout.html",
      title: "Logging Out",
      mountTag: "",
      inlineScript:
        "<script>try{window.localStorage.setItem('webgista_static_auth_v1','false');}catch(_e){}window.location.replace('/');</script>"
    }
  ];

  for (const page of pages) {
    const html = renderHtmlShell({
      title: page.title,
      mountTag: page.mountTag,
      cssPath,
      jsPath,
      mapConfig,
      simulationConfig,
      inlineScript: page.inlineScript || ""
    });
    fs.writeFileSync(path.join(DIST_DIR, page.file), html, "utf8");
  }

  console.log(`Built static distribution cleanly in ${DIST_DIR} (${pages.length} HTML entrypoints).`);
}

main();

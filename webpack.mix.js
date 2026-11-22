const fs = require("fs");
const path = require("path");
const mix = require("laravel-mix");
const tailwindcss = require("tailwindcss");

if (mix.inProduction()) {
  fs.rmSync(path.resolve(__dirname, "public/js"), { recursive: true, force: true });
}

mix
  .webpackConfig({
    output: {
      publicPath: "/",
      chunkFilename: "js/[name].[contenthash:8].js"
    }
  })
  .js("resources/js/app.js", "public/js")
  .vue()
  .postCss("resources/css/app.css", "public/css", [
    require("postcss-import"),
    tailwindcss("./tailwind.config.js")
  ])
  .copy(
    [
      "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2",
      "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2",
      "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2",
      "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2"
    ],
    "public/fonts/plus-jakarta-sans"
  )
  .version();

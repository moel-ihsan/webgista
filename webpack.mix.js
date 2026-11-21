const mix = require("laravel-mix");
const tailwindcss = require("tailwindcss");

mix
  .js("resources/js/app.js", "public/js")
  .vue()
  .postCss("resources/css/app.css", "public/css", [
    require("postcss-import"),
    tailwindcss("./tailwind.config.js")
  ])
  .copy(
    [
      "node_modules/@fontsource/montserrat/files/montserrat-latin-400-normal.woff2",
      "node_modules/@fontsource/montserrat/files/montserrat-latin-500-normal.woff2",
      "node_modules/@fontsource/montserrat/files/montserrat-latin-600-normal.woff2",
      "node_modules/@fontsource/montserrat/files/montserrat-latin-700-normal.woff2"
    ],
    "public/fonts/montserrat"
  );

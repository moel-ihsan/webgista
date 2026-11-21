const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: "class",
  purge: [
    "./resources/views/**/*.blade.php",
    "./resources/js/**/*.vue",
    "./resources/js/**/*.js"
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", ...defaultTheme.fontFamily.sans]
      }
    }
  },

  variants: {
    extend: {
      opacity: ["disabled"],
      backgroundColor: ["dark", "hover", "focus", "active"],
      textColor: ["dark", "hover", "focus"],
      borderColor: ["dark", "hover", "focus"]
    }
  },

  plugins: []
};

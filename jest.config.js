module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/tests/js/**/*.spec.js"],
  moduleFileExtensions: ["js", "json", "vue"],
  transform: {
    "^.+\\.vue$": "@vue/vue2-jest",
    "^.+\\.js$": [
      "babel-jest",
      {
        presets: [["@babel/preset-env", { targets: { node: "current" } }]]
      }
    ]
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/resources/js/$1"
  }
};

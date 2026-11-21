module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/tests/js/**/*.spec.js"],
  moduleFileExtensions: ["js", "json", "vue"],
  transform: {
    "^.+\\.vue$": "@vue/vue2-jest",
    "^.+\\.js$": "<rootDir>/tests/js/babelTransformer.js"
  },
  globals: {
    "vue-jest": {
      transform: {
        js: "./tests/js/babelTransformer.js"
      }
    }
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/resources/js/$1"
  }
};

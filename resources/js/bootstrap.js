window._ = require("lodash");

/**
 * Axios HTTP client with Laravel CSRF / XMLHttpRequest defaults.
 * Legacy Bootstrap/jQuery CDN & bundle hooks were removed in Phase 4.5
 * as Element UI + Tailwind CSS 2 handle all layout and interactive controls.
 */
window.axios = require("axios");

window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

import axios from "axios";

const httpClient = axios.create({
  headers: {
    "X-Requested-With": "XMLHttpRequest"
  }
});

httpClient.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta && csrfMeta.content) {
      config.headers["X-CSRF-TOKEN"] = csrfMeta.content;
    }
  }

  return config;
});

export default httpClient;

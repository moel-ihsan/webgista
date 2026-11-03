/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_STYLE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*?worker&url' {
  const workerUrl: string
  export default workerUrl
}

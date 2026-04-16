/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKET_URL: string;
  /** Set to "true" to show dev bypass button on login (pair with backend AUTH_DEV_BYPASS). */
  readonly VITE_AUTH_DEV_BYPASS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

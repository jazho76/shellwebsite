interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_COMMIT?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_HOSTNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the shared dataset bucket. Defaults to the production Firebase
   * Storage bucket when unset — see src/lib/dataSource.ts.
   */
  readonly VITE_DATA_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the shared data site. Defaults to the production Firebase
   * Hosting data site when unset — see src/lib/dataSource.ts.
   */
  readonly VITE_DATA_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

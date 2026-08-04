/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Endpoint that dispatches the stock scrape workflow (the worker/ Worker).
   * Unset in dev and until deployed — "Check now" then just re-pulls the file.
   */
  readonly VITE_STOCK_REFRESH_URL?: string
}

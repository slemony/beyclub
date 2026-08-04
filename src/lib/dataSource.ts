/**
 * Where the app reads its datasets at runtime.
 *
 * The five JSON snapshots — stock, catalogue, tournament, tiers-jp and
 * part-notes — are served from a dedicated Firebase Hosting site
 * (the project's default site, beyclub-90e95.web.app) under /data/, not from
 * this repository. The production app (beyclub.web.app) and the test site on
 * GitHub Pages both fetch that one URL, so there is a single source of truth and
 * no scraped data is ever committed to git. Firebase Hosting is free on the
 * Spark plan, which is why the data lives here rather than in Cloud Storage.
 *
 * Overridable at build time with VITE_DATA_BASE_URL (point a staging build at a
 * different data site); the default is the production data site so a plain
 * `vite build` or `vite dev` just works.
 */
const DEFAULT_DATA_BASE = 'https://beyclub-90e95.web.app/'

const configured = import.meta.env.VITE_DATA_BASE_URL || DEFAULT_DATA_BASE

/** Normalised to exactly one trailing slash so `${dataBase}data/x.json` is well-formed. */
export const dataBase = configured.endsWith('/') ? configured : `${configured}/`

/** URL of a dataset JSON on the data site, e.g. `dataUrl('stock.json')`. */
export const dataUrl = (name: string): string => `${dataBase}data/${name}`

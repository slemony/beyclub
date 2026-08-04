/**
 * Where the app reads its datasets at runtime.
 *
 * The five JSON snapshots — stock, catalogue, tournament, tiers-jp and
 * part-notes — live in a public Firebase Cloud Storage bucket, not in this
 * repository. The test site on GitHub Pages and production on beyclub.web.app
 * both fetch the same bucket, so there is a single source of truth and no
 * scraped data is ever committed to git.
 *
 * Overridable at build time with VITE_DATA_BASE_URL (point a staging build at a
 * different bucket); the default is the production bucket so a plain
 * `vite build` or `vite dev` just works.
 */
const DEFAULT_DATA_BASE = 'https://storage.googleapis.com/beyclub-90e95.firebasestorage.app/'

const configured = import.meta.env.VITE_DATA_BASE_URL || DEFAULT_DATA_BASE

/** Normalised to exactly one trailing slash so `${dataBase}data/x.json` is well-formed. */
export const dataBase = configured.endsWith('/') ? configured : `${configured}/`

/** URL of a dataset JSON in the shared bucket, e.g. `dataUrl('stock.json')`. */
export const dataUrl = (name: string): string => `${dataBase}data/${name}`

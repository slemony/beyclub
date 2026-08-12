#!/usr/bin/env node
/**
 * Runner for build-product-tiers.ts.
 *
 * That script imports the app's own ranking code so the published tier is the
 * tier the app shows. Node cannot load those modules directly — they use
 * extensionless TypeScript imports and import JSON without an import attribute,
 * both of which Vite allows and Node does not — so this bundles the script with
 * esbuild first and runs the bundle.
 *
 * esbuild is used through its JS API rather than node_modules/.bin/esbuild,
 * which is a dangling symlink in this install, and directly naming the platform
 * package (@esbuild/darwin-arm64) would not survive a Linux CI runner.
 */
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const bundle = join(tmpdir(), `beyclub-product-tiers-${process.pid}.mjs`)

await build({
  entryPoints: [join(HERE, 'build-product-tiers.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: bundle,
  logLevel: 'warning',
  // Vite injects import.meta.env; Node has no such thing, and stock.ts reads it
  // at module scope. Nothing here needs a real value — the ranking does not
  // depend on it — it just has to exist so the module can load.
  define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', VITE_STOCK_REFRESH_URL: '' }) },
})

process.env.BEYCLUB_ROOT = join(HERE, '..')
await import(pathToFileURL(bundle).href)

# Data architecture

_Part of the split manual. Index: [../../CLAUDE.md](../../CLAUDE.md)._

## Two kinds of data, and never confuse them

Everything under `public/data/` that a **script writes is generated — do not
hand-edit it**. Your change will be overwritten on the next refresh:

| File | Written by | Refreshed |
|---|---|---|
| `public/data/catalogue.json` | `npm run refresh:catalogue` | daily |
| `public/data/tournament.json` | `npm run refresh:tournament` | weekly |
| `public/data/stock.json` | `npm run refresh:stock` | twice daily |

Everything **hand-curated** lives in `src/data/` (bundled) or is a
non-generated file under `public/data/`. Each opens with a `_note` explaining
itself — read it before touching. See [curated-data.md](curated-data.md) for
the full list and how to edit each.

## How data becomes UI

- `src/lib/loadData.ts` — `loadCatalogue()` reads the generated catalogue,
  folds in the hand-curated `src/data/` files, and `merge()` blends the three
  ranking sources (tournament / community / Japan) into one `Part[]`.
- `src/lib/partIndex.ts` — resolves bare part codes (`9-70`, `LO`) to real
  parts, and answers "which blades use this part."
- `src/components/PartSheet.tsx` — the blade/part detail sheet, the one screen
  that renders builds, notes, records and stock.
- `src/lib/types.ts` — all the shared types (`Part`, `CustomBuild`, `Credit`,
  `PartNotes`, …). Update a type here whenever a data file grows a new field.

## Per-blade keying (important)

Blades are keyed **per blade, not per product code**. Colour variants and metal
coatings share one base-name `key` (computed by `baseName()` in
`src/lib/text.ts`), so they share one tournament record instead of two of them
looking untested. Whenever you attach data to a blade, decide deliberately:

- Match on the **base name / key** to reach every colour variant of the mold.
- Match on the **product id** to pin one specific SKU.

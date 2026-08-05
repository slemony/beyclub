# CLAUDE.md

Guidance for working in this repo. For the full "why" behind the data and
attribution model, read [README.md](README.md) — this file is the operating
manual, that one is the rationale.

## What this is

BeyClub MY: a mobile-first, static PWA (React + Vite + TypeScript) for the
Malaysian Beyblade X community — competitive tiers, local stock, tournaments,
news. No backend. Hosted on GitHub Pages. Designed at a **390px** viewport
first.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b + vite build — this is the check that must pass
npm run preview  # serve the production build
```

There is no separate lint or test script. **`npm run build` is the gate** —
it type-checks the whole app; if it passes, the change is sound. Run it before
committing.

## Two kinds of data, and never confuse them

Everything under `public/data/` that a script writes is **generated — do not
hand-edit it**, your change will be overwritten on the next refresh:

| File | Written by | Refreshed |
|---|---|---|
| `public/data/catalogue.json` | `npm run refresh:catalogue` | daily |
| `public/data/tournament.json` | `npm run refresh:tournament` | weekly |
| `public/data/stock.json` | `npm run refresh:stock` | twice daily |

Everything hand-curated lives in **`src/data/`** (bundled) or is a
non-generated file under `public/data/`. These are the files you edit by hand,
and each opens with a `_note` explaining itself — read it before touching:

| File | Holds |
|---|---|
| `src/data/customBuilds.json` | Curated modding builds (see recipe below) |
| `src/data/manualParts.json` | Announced parts the Taiwan sheet hasn't listed yet |
| `src/data/partOverrides.json` | Per-row fixes for sheet quirks, keyed by product id |
| `src/data/sourceNotes.json` | English translations of the sheet's combo comments |
| `src/data/bladeNamesEn.json`, `bladeNamesZhEn.json` | English blade names (also drive tournament matching) |
| `public/data/part-notes.json` | BeyClub's own bit profiles / pros / cons ("our own view") |
| `public/data/tiers-jp.json` | Hand-curated Japanese tier grades + per-entry credit |

## How data becomes UI

`src/lib/loadData.ts` — `loadCatalogue()` reads the generated catalogue, folds
in the hand-curated `src/data/` files, and `merge()` blends the three ranking
sources into one `Part[]`. `src/lib/partIndex.ts` resolves bare part codes
(`9-70`, `LO`) to real parts and answers "which blades use this part."
`src/components/PartSheet.tsx` is the blade/part detail sheet — the one screen
that renders builds, notes, records and stock. Types are in `src/lib/types.ts`.

Blades are keyed **per blade, not per product code**: colour variants and metal
coatings share one base-name `key` (via `baseName()`), so they share one
tournament record. Keep that in mind whenever you attach data to a blade.

## Recipe: add a custom build

A "custom build" is a curated, tuned setup richer than the sheet's one-line
combo string — it carries a mod-strength grade, a handling difficulty and
playing notes. The whole feature is data-driven: **to add one, you only edit
`src/data/customBuilds.json`.** No code change is needed.

Append an object to `builds`:

```jsonc
{
  "blade": "武士魂斬",          // blade product id (e.g. "UX-14") OR base Chinese name.
                                // Matches on either, so the base name reaches every
                                // colour variant of the mold; an id pins one SKU.
  "title": "Precision Orbit · 精致回旋",   // optional short label
  "ratchet": "9-70",           // must be a real catalogue code (chips resolve to it)
  "bit": "LO",
  "assist": "S",               // optional
  "modStrength": "T2~T2.5",    // optional, free text — community T-scale (T0 = ceiling)
  "modStrengthMax": "T0",      // optional, names the ceiling for context
  "difficulty": 4.5,           // optional, out of difficultyMax
  "difficultyMax": 5,          // optional, defaults to 5
  "notes": [                   // optional, one string per bullet; write in English
    "A precision orbit build.",
    "Best launched above 13,000 SP — low margin for error."
  ],
  "credit": {                  // required — who published it and where
    "author": "阿土",
    "sourceName": "阿土 on YouTube",
    "sourceUrl": "https://youtu.be/ZBN1WNJ8s6Y"
  }
}
```

Notes:
- The shape is the `CustomBuild` type in `src/lib/types.ts` — update both if a
  build ever needs a new field.
- **Part codes must exist in the catalogue** or the chip renders as plain text
  instead of a tappable, tier-badged link. Confirm a code is real by opening
  `public/data/catalogue.json` and searching its `parts` list.
- Notes are written in English to match the app's English-first UI (blade names
  still show their Chinese alongside). Strip tracking params like `?si=…` from
  source URLs.
- After editing, run `npm run build` and, if you can, `npm run dev` to eyeball
  the "Custom builds" block on the blade's detail sheet.

## Git

- Develop on the branch the task assigns; create it locally if missing.
- Commit only what the task changed. `npm install` can rewrite
  `package-lock.json` incidentally — revert that unless deps actually changed.
- Push with `git push -u origin <branch>`. Do **not** open a PR unless asked.

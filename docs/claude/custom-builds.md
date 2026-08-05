# Adding a custom build

_Part of the split manual. Index: [../../CLAUDE.md](../../CLAUDE.md)._

A **custom build** is a curated, tuned setup richer than the sheet's one-line
combo string — it carries a mod-strength grade, a handling difficulty and
playing notes. The feature is fully data-driven: **to add one, you only edit
[`src/data/customBuilds.json`](../../src/data/customBuilds.json). No code change
is needed.** It renders as a "Custom builds" block on the blade's detail sheet.

## The recipe

Append an object to the `builds` array:

```jsonc
{
  "blade": "武士魂斬",          // blade product id (e.g. "UX-14") OR base Chinese name.
                                // Matches on either — base name reaches every colour
                                // variant of the mold; an id pins one SKU.
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

## Gotchas

- The shape is the `CustomBuild` type in
  [`src/lib/types.ts`](../../src/lib/types.ts) — update **both** if a build ever
  needs a new field.
- **Part codes must exist in the catalogue**, or the chip renders as plain text
  instead of a tappable, tier-badged link. Confirm a code is real by searching
  the `parts` list in `public/data/catalogue.json`.
- On blade matching (`blade` field), see the per-blade keying note in
  [data-architecture.md](data-architecture.md).
- Notes are written in **English** to match the app's English-first UI (blade
  names still show their Chinese alongside). Strip tracking params like `?si=…`
  from source URLs.
- After editing, run `npm run build`, and if you can, `npm run dev` to eyeball
  the "Custom builds" block on the blade's detail sheet.

## Where it's wired (only if you're changing the feature itself)

- Data + type: `src/data/customBuilds.json`, `CustomBuild` in `src/lib/types.ts`
- Attached to blades: the `CUSTOM_BUILDS` loop in `loadCatalogue()`
  (`src/lib/loadData.ts`)
- Rendered: `CustomBuildCard` and the "Custom builds" section in
  `src/components/PartSheet.tsx`
- Styles: the "Custom builds" block in `src/index.css`

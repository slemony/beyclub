# Other hand-curated data files

_Part of the split manual. Index: [../../CLAUDE.md](../../CLAUDE.md)._

These are the hand-edited files (custom builds have their own page:
[custom-builds.md](custom-builds.md)). Each file opens with a `_note` that is
the authoritative spec — **read that note before editing**; this page is just
the map.

| File | Holds | Keyed by |
|---|---|---|
| [`src/data/manualParts.json`](../../src/data/manualParts.json) | Officially announced parts the Taiwan sheet hasn't listed yet, so a new set isn't missing on launch week | `id` + `cat`, matched exactly |
| [`src/data/partOverrides.json`](../../src/data/partOverrides.json) | Per-row fixes for sheet quirks — real id behind a placeholder code, an English name, the blade a row really is, a backfilled assist/over-blade | Sheet product id |
| [`src/data/sourceNotes.json`](../../src/data/sourceNotes.json) | English translations of the sheet's Chinese combo comments | The exact source string |
| [`src/data/bladeNamesEn.json`](../../src/data/bladeNamesEn.json), [`bladeNamesZhEn.json`](../../src/data/bladeNamesZhEn.json) | English blade names — also drive tournament name-matching, so an untranslated blade is one whose results can't be counted | Product id / base Chinese name |
| [`public/data/part-notes.json`](../../public/data/part-notes.json) | BeyClub's own bit profiles, pros and cons — shown under an "our own view" badge; never affects a ranking | `category:id` |
| [`public/data/tiers-jp.json`](../../public/data/tiers-jp.json) | Hand-curated Japanese tier grades, each with its own author + article link | Product code / English name |

## Rules that apply to all of them

- Don't hand-edit the **generated** files (`catalogue.json`, `tournament.json`,
  `stock.json`) — see [data-architecture.md](data-architecture.md).
- Match exactly. The sheet lists `NR` and `Nr` as two different bits on
  different grades, so folding case or zero-padding together to catch
  near-misses merges genuinely separate parts. `manualParts.json` says this at
  length — heed it.
- If a file grows a new field, update its consuming type in
  [`src/lib/types.ts`](../../src/lib/types.ts) too.
- After editing, `npm run build` must pass.

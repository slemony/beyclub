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
| [`src/data/partSpecs.json`](../../src/data/partSpecs.json) | Measured weight, gear/ring teeth, Burst rating and height for every bit and ratchet — shown as a chip row on the detail sheet and the only thing the weight/gears sorts read; never affects a ranking | Bit or ratchet code |
| [`src/data/creatorPicks.json`](../../src/data/creatorPicks.json) | One creator's public bit tier list — one sentence and a timestamped link under a "Creator pick" heading; never affects a ranking | Bit code |

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

## Refreshing partSpecs.json

The measurements come from go-shoot's parts index, which renders from an
IndexedDB-backed store — so the numbers exist only in the live DOM, and there is
no file to fetch. Open `https://go-shoot.github.io/x/parts/?bit` (then
`?ratchet`) and run:

```js
[...document.querySelectorAll('main > section > x-part')]
  .map(e => ({ abbr: e.Part.abbr, eng: e.Part.names?.eng, stat: e.Part.stat,
               attr: [...(e.Part.attr || [])] }))
```

`stat` is `[weight, GEAR teeth, BURST rating, exposed height]` for a bit,
`[weight, GEAR teeth, BASE height]` when `attr` holds `fused`, and
`[weight, RING blades, BASE height]` for a ratchet — the labels come from
`customElements.get('x-part').bit.terms` and `.ratchet.terms`. Weights arrive as
`"3-"` / `"2="` / `"3+"`, meaning 2.7 / 2.0 / 3.3 g, and heights as dmm.

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
| [`src/data/setContents.json`](../../src/data/setContents.json) | What a customize set actually holds — the sheet can only record parts one-per-blade, so the box is described once here and attached to every blade sharing the product string | The sheet's product string |
| [`src/data/sourceNotes.json`](../../src/data/sourceNotes.json) | English translations of the sheet's Chinese combo comments | The exact source string |
| [`src/data/bladeNamesEn.json`](../../src/data/bladeNamesEn.json), [`bladeNamesZhEn.json`](../../src/data/bladeNamesZhEn.json) | English blade names — also drive tournament name-matching, so an untranslated blade is one whose results can't be counted | Product id / base Chinese name |
| [`src/data/bladeAliasesEn.json`](../../src/data/bladeAliasesEn.json) | English spellings the tournament feed still uses for a blade we have since renamed, so a correction doesn't strand its placements | Alias → base Chinese name |
| [`public/data/part-notes.json`](../../public/data/part-notes.json) | BeyClub's own bit profiles, pros and cons — shown under an "our own view" badge; never affects a ranking | `category:id` |
| [`public/data/tiers-jp.json`](../../public/data/tiers-jp.json) | Hand-curated Japanese tier grades, each with its own author + article link | Product code / English name |
| [`src/data/partSpecs.json`](../../src/data/partSpecs.json) | Measured weight, gear/ring teeth, Burst rating, height and thickness — bits, ratchets, assists, over blades, and CX beys via their lock chip + main/metal blade. Shown as a chip row on the detail sheet and the only thing the measurement sorts read; never affects a ranking | Part code; assists by their bare letter (`A`, not `輔助A`), CX beys by blade `key` |
| [`src/data/creatorPicks.json`](../../src/data/creatorPicks.json) | One creator's public tier lists — one sentence and a timestamped link under a "Creator pick" heading; never affects a ranking. `sources` is keyed by part category, one video and one credit each: `bit` and `ratchet` today. The two videos use **different tier names**, so each label needs a colour in `PICK_TIER_COLORS` (`PartSheet.tsx`) — don't fold them into one scale | Part category, then part code |

## Rules that apply to all of them

- Don't hand-edit the **generated** files (`catalogue.json`, `tournament.json`,
  `stock.json`) — see [data-architecture.md](data-architecture.md).
- Match exactly. Folding zero-padding together to catch a near-miss merges
  product ids that only look alike — `UX-21-1` against the sheet's `UX-21-01`.
  `manualParts.json` says this at length — heed it.
- Casing is the one exception, and it is handled by name rather than by a rule.
  The sheet lists `NR`/`Nr` and `OP`/`Op` as two rows each, but each pair is one
  physical bit listed twice, from two authoring passes that never agreed on a
  grade. `partOverrides.json` drops the lowercase duplicate with `duplicateOf`;
  `forCode()` in `loadData.ts` bridges the surviving uppercase catalogue row to
  the lowercase key `partSpecs.json` and `creatorPicks.json` use. Left as two
  rows they blend separately and disagree — that is where `Nr` at A+ against
  `NR` at A came from.
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

Whole BX/UX blades are on `?blade`; CX parts are on `?blade=CX`, where
`Part.group` splits them into `chip`, `main`, `over`, `metal` and `assist`. A
blade's `stat` is `[weight, thickness]` and only assists carry the second figure.

Match a blade on the **Chinese** name, not the English. `names.chi` holds two
space-separated variants and the second is the one the Taiwan sheet uses; strip
the `\` and `/` a two-word name carries. The English is wrong often enough to
matter — `金剛王` is Optimus Primal though we call it "Bumblebee", `黃蜂要塞` is
Hornet **Fort** (a main blade) though we call it "Hornet Fortress", and `幽冥`
is **Dark**, not Eclipse, wherever it appears. The CX pairing table is `cx.beys`.

A blade whose name hides a **different mould** — not a recolour — is pinned by
product id in `bladesById`, which is checked before the base-name key. The sheet
writes Dran Sword V2 as `蒼龍神劍 版本2.0` and `baseName` stops at the space, so
without the pin it would inherit the original's 35.0 g instead of its own 37.7 g.

Blades still unweighed, and re-adding them needs a person: `雷霆天龍` is one row
here but two in the source (L-Drago rush 33.3 g / upper 33.7 g), and the four BXG
dinosaur blades (`暴龍`, `翼龍`, `棘龍`, `滄龍`) are not in the source at all.

When you correct a blade's English name, check whether the tournament feed uses
the old spelling — `scripts/fetch-tournament.mjs` matches on `slug(English name)`
and its typo pass only forgives two edits, nowhere near enough to bridge two
different words. Add the old spelling to `bladeAliasesEn.json` in the same
change. Records key on the Chinese name, so nothing already in
`tournament.json` moves; it is the *next* refresh that would drop them.

Note `幽冥`, which the two sources do not agree on. go-shoot reads it as **Dark**
(`names.chi` for the Dark main blade is `幽暗 幽冥`), but the Taiwan sheet uses it
for **Nether** — `惡魔幽冥` is UX-21-01, Hells Nether, confirmed by the site's
owner. Our own files are inconsistent about it too: `bladeNamesZhEn.json` calls
`惡魔幽冥` "Hells Eclipse", while `英仙幽冥` is "Perseus Dark". `魔犬幽冥` was
"Cerberus Eclipse" until KGB's own CX-08 listing settled it as **Cerberus Dark**;
its feed spelling is aliased. Check a product listing before tidying the rest.

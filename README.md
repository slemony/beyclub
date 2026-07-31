# BeyClub MY

Mobile-first Beyblade X hub for the Malaysian community — competitive tiers, local stock, tournaments, news and a place to trade and practice together.

Built as a static PWA (React + Vite + TypeScript) hosted on GitHub Pages. No backend, no hosting cost.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

Designed at a 390px viewport first — use a phone-sized device frame when working on the UI.

## Deployment

Live at **https://slemony.github.io/beyclub/**

```bash
npm run deploy   # build, then publish dist/ to the gh-pages branch
```

Pages serves from the `gh-pages` branch. The app uses `HashRouter` and a relative Vite `base`, so it works under any repository path without extra configuration.

### Enabling the workflows

Two workflows are ready but **not committed** — pushing workflow files needs the `workflow` OAuth scope, so `.github/` is listed in `.git/info/exclude`:

- `deploy.yml` — publishes on every push to `main`.
- `tournament.yml` — refreshes tournament data weekly (see below).

```bash
gh auth refresh -s workflow                          # grant the scope (opens a browser)
sed -i '' '/^\.github\/$/d' .git/info/exclude        # stop ignoring it locally
git add .github && git commit -m "Add Pages workflows" && git push
```

Then set **Settings → Pages → Source** to **GitHub Actions**. Until you do, Pages keeps serving the `gh-pages` branch and neither workflow changes what visitors see — confirm with `gh api repos/:owner/:repo/pages` that `build_type` reads `workflow`.

### Refreshing tournament data

```bash
npm run refresh:tournament   # rewrite public/data/tournament.json from BBXHub
```

`tournament.yml` runs this every Saturday morning MYT, just after BBXHub's own Friday rebuild, then commits, builds and publishes **in a single run**. That is deliberate: a commit pushed with `GITHUB_TOKEN` does not trigger other workflows, so a scrape-only job would update the repo and never reach the live site.

Two things keep it running unattended:

- Add a fine-grained PAT with `contents: write` as the **`DATA_PAT`** secret. GitHub disables scheduled workflows in public repositories after 60 days of inactivity, and a workflow's own runs do not reset that clock — pushing as a real account does. Without the secret the workflow still works, it just stops holding off that timer.
- The scraper exits non-zero on a parse failure or a collapse in coverage and leaves the committed dataset alone, so a bad scrape can never publish an empty tier list.

## Roadmap

Requirements and acceptance criteria for every stage live in [claude-project-master-plan.md](claude-project-master-plan.md).

| Stage | Scope | Status |
|---|---|---|
| 0 | App skeleton, glass theme, navigation, Pages deploy | Done |
| 1 | Competitive tier data (Taiwan + Japan) with sources | Done |
| 2 | KGB stock tracker via scheduled scrape | Next |
| 3 | Facebook news feeds | Planned |
| 4 | Malaysian competitions calendar | Planned |
| 5 | Where to buy & play directory | Planned |
| 6 | Community board | Planned |

## Data & attribution

The tier page shows **one ranking blended from three sources**, and names who is accountable for each. Tap "How this is ranked" on the page, or open any part, to see the arithmetic and follow every line back to its origin.

- **Tournament (45%)** — placement counts from [BBXHub](https://bbxhub.net/), which aggregates the [WBO Winning Combinations thread](https://worldbeyblade.org/Thread-Winning-Combinations-at-WBO-Organized-Events-Beyblade-X-BBX) and the German Blader League: 3,589 events, 36,819 winning combos. Scored 60% on the all-time count and 40% on the last three months, so the list follows the current meta without swinging on a single weekend.
- **Community (35%)** — subjective ratings from the Taiwanese community's public dataset behind [BeyTier](https://stan-yao.github.io/beyblade_x_tier/) by @stan_yao, with ratings by 阿土 / @RENLIgames. This is also the catalogue: which parts exist, their images and their stock combinations.
- **Japan (20%)** — hand-curated in [`public/data/tiers-jp.json`](public/data/tiers-jp.json) from Japanese community tier lists. Japanese tier data exists only as prose articles, so each entry stores its own author and a link to the specific article it came from.

Weights renormalise over whichever sources rate a given part, and **nothing reaches X, S+ or S without a tournament record** — an unproven part is capped at A+ and badged, rather than being scored as though it had lost. A part **no source has rated at all** sits in its own "Unrated" row with no buy verdict: an absence of evidence must not read as evidence of being bad.

Blades are rated per blade, not per product code. 魔導神杖, 魔導神杖(綠) and 魔導神杖 金屬塗層:燦金 are one blade sold three ways, so they share one record instead of two of them looking untested. Colour variants still appear as their own rows.

We deliberately do not read BeyTier's aggregated stats tab. Its raw rows carry `kj_*` "original" columns and a `blade_match_method`: only two thirds matched on an exact product code, and its dates are unusable, with thousands of rows sharing one timestamp and some falling in the future. BBXHub is the same lineage, one hop closer to the source, and states where it comes from.

English blade names in [`src/data/bladeNamesEn.json`](src/data/bladeNamesEn.json) and [`bladeNamesZhEn.json`](src/data/bladeNamesZhEn.json) let Malaysian users see "Wizard Rod" rather than 魔導神杖; they also drive the tournament match, so an untranslated blade is a blade whose results we cannot count. Japanese entries without a known product code have their names transliterated from katakana with a word-piece dictionary, validated against 32 known-correct names before use.

Bit profiles in [`public/data/part-notes.json`](public/data/part-notes.json) — stats, weight, pros and cons — are BeyClub's own writing, shown under an "our own view" badge. They describe parts; they never affect a ranking.

Stock data will be scraped from [Kelab Gasing Beyblade](https://kelabgasingbeyblade.my/) by a scheduled job. Facebook content is displayed through official page embeds — never scraped. No source's images are hotlinked; Japanese entries inherit artwork from the shared catalogue by product code.

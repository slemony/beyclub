# BeyClub MY

Mobile-first Beyblade X hub for the Malaysian community — competitive tiers, local stock, tournaments, news and a place to trade and practice together.

Built as a static PWA (React + Vite + TypeScript). Production runs on **Firebase Hosting** at [beyclub.web.app](https://beyclub.web.app); **GitHub Pages** stays on as the test site. Both read their datasets from a shared **Firebase Cloud Storage** bucket, so there is no backend to run and one source of truth for the data.

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
npm run data:pull # optional: cache the datasets locally (else the app reads the live bucket)
```

The datasets no longer live in the repo — the app fetches them from the shared bucket at runtime, so `npm run dev` works out of the box. `npm run data:pull` writes a local (gitignored) copy under `public/data/` for offline work.

Designed at a 390px viewport first — use a phone-sized device frame when working on the UI.

## Deployment

- **Production** — [beyclub.web.app](https://beyclub.web.app) on Firebase Hosting. `firebase-hosting.yml` builds and deploys the `live` channel on every push to `main`; `npm run deploy:firebase` does it by hand.
- **Test** — [slemony.github.io/beyclub](https://slemony.github.io/beyclub/) on GitHub Pages. `deploy.yml` publishes on every push to `main`; `npm run deploy` publishes `dist/` to the `gh-pages` branch by hand.

Both build the identical bundle and read the same datasets from the shared bucket, so the only difference between them is the host and domain. The app uses `HashRouter` and a relative Vite `base`, so it works at a domain root or under a repository path without extra configuration.

**First-time Firebase setup** — creating the project, bucket, IAM, CORS, service account, GitHub secrets and seeding the bucket — is a one-time runbook: [docs/firebase-migration.md](docs/firebase-migration.md).

### Where the data lives

The five dataset JSON files — `stock`, `catalogue`, `tournament`, `tiers-jp` and `part-notes` — live in a public Firebase Cloud Storage bucket, **not in git**. `src/lib/dataSource.ts` resolves their URLs; override the base with `VITE_DATA_BASE_URL` (see `.env.example`). Move data in and out of the bucket with:

```bash
npm run data:pull                          # download all five into public/data/ (gitignored)
npm run data:pull -- stock.json            # just one
GOOGLE_APPLICATION_CREDENTIALS=key.json \
  npm run data:push -- tiers-jp.json       # upload a changed file (auth required)
```

### The workflows

- `firebase-hosting.yml` — deploys production to beyclub.web.app on every push to `main`.
- `deploy.yml` — deploys the GitHub Pages test site on every push to `main`.
- `stock.yml` — scrapes KGB stock twice daily and pushes it to the bucket (see below).
- `catalogue.yml` — snapshots the Taiwan sheet daily and pushes it to the bucket.
- `tournament.yml` — refreshes tournament data weekly and pushes it to the bucket.
- `keepalive.yml` — a weekly heartbeat so the scheduled jobs aren't auto-disabled (see below).

Pushing workflow files needs the `workflow` OAuth scope. If a push is rejected for lacking it, run `gh auth refresh -s workflow` and try again.

For the test site, set **Settings → Pages → Source** to **GitHub Actions**.

### Refreshing data

```bash
npm run refresh:tournament   # scrape tournament.json from BBXHub
npm run refresh:stock        # scrape stock.json from kelabgasingbeyblade.my
npm run refresh:catalogue    # snapshot catalogue.json from the Taiwan sheet
```

Each scraper still writes into `public/data/`; the workflow then **uploads the result to the bucket** rather than committing it — so scraped data never touches git, and the live sites (which read the bucket) update without a deploy. The stock catalogue costs five requests: KGB's `/shop` listing already carries title, category, price, image and an in-stock button, so only the dozen products sold in several sizes need their own page fetched for the availability their card omits.

A workflow first `data:pull`s the current snapshot so the scraper's "did anything move?" check still holds, then `data:push`es only if the file actually changed. That's what keeps `updatedAt` meaning **when the data last changed** rather than when it was last checked, and leaves the bucket object — and its CDN cache — untouched on a quiet run. A scraper exits non-zero on a parse failure or a collapse in coverage (a card parsing incompletely, no bey surviving the parse, or the catalogue shrinking by more than a quarter), so a bad scrape can never overwrite good data with an empty list.

**Keeping the schedule alive:** the scrapers no longer commit, so add a fine-grained PAT with `contents: write` as the **`DATA_PAT`** secret. GitHub disables scheduled workflows in public repositories after 60 days of inactivity, and a workflow's own runs don't reset that clock — `keepalive.yml` makes a weekly one-line heartbeat commit as a real account to hold it off. Without the secret the heartbeat still runs with the default token, and normal development activity keeps the clock alive too.

## Roadmap

Requirements and acceptance criteria for every stage live in [claude-project-master-plan.md](claude-project-master-plan.md).

| Stage | Scope | Status |
|---|---|---|
| 0 | App skeleton, glass theme, navigation, Pages deploy | Done |
| 1 | Competitive tier data (Taiwan + Japan) with sources | Done |
| 2 | KGB stock tracker via scheduled scrape | Done |
| 3 | Facebook news feeds | Next |
| 4 | Malaysian competitions calendar | Planned |
| 5 | Where to buy & play directory | Planned |
| 6 | Community board | Planned |

## Data & attribution

The tier page shows **one ranking blended from three sources**, and names who is accountable for each. Tap "How this is ranked" on the page, or open any part, to see the arithmetic and follow every line back to its origin.

- **Tournament (45%)** — placement counts from [BBXHub](https://bbxhub.net/), which aggregates the [WBO Winning Combinations thread](https://worldbeyblade.org/Thread-Winning-Combinations-at-WBO-Organized-Events-Beyblade-X-BBX) and the German Blader League: 3,589 events, 36,819 winning combos. Scored 60% on the all-time count and 40% on the last three months, so the list follows the current meta without swinging on a single weekend.
- **Community (35%)** — subjective ratings from the Taiwanese community's public dataset behind [BeyTier](https://stan-yao.github.io/beyblade_x_tier/) by @stan_yao, with ratings by 阿土 / @RENLIgames. This is also the catalogue: which parts exist, their images and their stock combinations.
- **Japan (20%)** — hand-curated in `tiers-jp.json` (in the shared bucket; edit it with `data:pull` / `data:push`) from Japanese community tier lists. Japanese tier data exists only as prose articles, so each entry stores its own author and a link to the specific article it came from.

Weights renormalise over whichever sources rate a given part, and **nothing reaches X, S+ or S without a tournament record** — an unproven part is capped at A+ and badged, rather than being scored as though it had lost. A part **no source has rated at all** sits in its own "Unrated" row with no buy verdict: an absence of evidence must not read as evidence of being bad.

Blades are rated per blade, not per product code. 魔導神杖, 魔導神杖(綠) and 魔導神杖 金屬塗層:燦金 are one blade sold three ways, so they share one record instead of two of them looking untested. Colour variants still appear as their own rows.

We deliberately do not read BeyTier's aggregated stats tab. Its raw rows carry `kj_*` "original" columns and a `blade_match_method`: only two thirds matched on an exact product code, and its dates are unusable, with thousands of rows sharing one timestamp and some falling in the future. BBXHub is the same lineage, one hop closer to the source, and states where it comes from.

English blade names in [`src/data/bladeNamesEn.json`](src/data/bladeNamesEn.json) and [`bladeNamesZhEn.json`](src/data/bladeNamesZhEn.json) let Malaysian users see "Wizard Rod" rather than 魔導神杖; they also drive the tournament match, so an untranslated blade is a blade whose results we cannot count. Japanese entries without a known product code have their names transliterated from katakana with a word-piece dictionary, validated against 32 known-correct names before use.

Bit profiles in `part-notes.json` (in the shared bucket; edit it with `data:pull` / `data:push`) — stats, weight, pros and cons — are BeyClub's own writing, shown under an "our own view" badge. They describe parts; they never affect a ranking.

Stock comes from [Kelab Gasing Beyblade](https://kelabgasingbeyblade.my/) and is **prices and availability only** — the tier shown against a listing is our own blended ranking, which KGB neither supplies nor endorses. The two are joined on the product code in each shop URL: 85 of 86 bey products match the catalogue outright, and the rest resolve through the Taiwan sheet's sub-codes, which is how a Random Booster can list the five blades you might actually pull, each with its own grade. A booster is graded on the strongest blade in the box and the card says so; a product whose contents nobody has rated gets no verdict, on the same principle that leaves an unrated part unranked rather than last.

Facebook content is displayed through official page embeds — never scraped. No source's images are hotlinked; Japanese entries inherit artwork from the shared catalogue by product code.

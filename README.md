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

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. Enable Pages in the repository settings with **Source: GitHub Actions**.

The app uses `HashRouter` and a relative Vite `base`, so it works under any repository path without extra configuration.

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

The tier page carries three datasets, and every one names who is accountable for its rankings:

- **Community** — subjective ratings from the Taiwanese community's public dataset behind [BeyTier](https://stan-yao.github.io/beyblade_x_tier/) by @stan_yao, with ratings by 阿土 / @RENLIgames.
- **Tournament** — win counts and championship rates aggregated from thousands of dated placement records, so rankings rest on results rather than opinion.
- **Japan** — hand-curated in [`public/data/tiers-jp.json`](public/data/tiers-jp.json) from Japanese community tier lists. Japanese tier data exists only as prose articles, so each entry stores its own author and a link to the specific article it came from, shown on the card and in the detail sheet.

English blade names in [`src/data/bladeNamesEn.json`](src/data/bladeNamesEn.json) and [`bladeNamesZhEn.json`](src/data/bladeNamesZhEn.json) were derived from the tournament records so Malaysian users see "Wizard Rod" rather than 魔導神杖. Japanese entries without a known product code have their names transliterated from katakana with a word-piece dictionary, validated against 32 known-correct names before use.

Stock data will be scraped from [Kelab Gasing Beyblade](https://kelabgasingbeyblade.my/) by a scheduled job. Facebook content is displayed through official page embeds — never scraped. No source's images are hotlinked; Japanese entries inherit artwork from the shared catalogue by product code.

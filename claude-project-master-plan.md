# BeyClub MY — Project Master Plan

Mobile-first Beyblade X info hub for the Malaysian community. Static site on GitHub Pages; all dynamic data comes from client-side fetches of public sources or JSON committed by scheduled GitHub Actions. No paid backend, no server.

---

## Design system

Dark theme with **iOS-style glassmorphism**.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0c11` | app base |
| `--bg-glow` | radial blue/red mesh | ambient background behind glass |
| `--glass` | `rgba(255,255,255,0.06)` | card fill |
| `--glass-blur` | `blur(20px) saturate(160%)` | `backdrop-filter` |
| `--hairline` | `rgba(255,255,255,0.10)` | 1px card border |
| `--accent` | `#4da3ff → #8be8ff` | X-blue gradient, primary actions |
| `--attack` | `#ff3d5e` | attack type / warnings |
| `--radius` | 20px cards, 28px sheets | iOS-like rounding |

Display font **Michroma**, body font **Chakra Petch**. Bottom tab bar is a floating frosted pill with safe-area insets. Every surface is translucent over the ambient mesh — never flat opaque panels.

## Tech stack

React 19 + Vite + TypeScript PWA. `HashRouter` and `base: './'` so the build works under any GitHub Pages repo path. No UI framework; hand-rolled components against the CSS token set.

## Research notes that shape the plan

- **Tier data (Taiwan):** `stan-yao.github.io/beyblade_x_tier` is a static page that reads a **public Google Sheet as CSV** — `docs.google.com/spreadsheets/d/1TBHOpcsv25bBfWERq14CBIy4P1G7j-qpPhmclx_nTWI/gviz/tq?tqx=out:csv`, parts via `&sheet=零件圖鑑`, combo/tournament stats in sheet `18eTJLjyNmqDz5MH0-VD03TX4wobUCdHdrRMyo4uojDo`. Part images are `i.ibb.co` URLs stored in the sheet. CORS is open (their own site fetches it client-side), so we can consume the same data with attribution.
- **KGB stock:** the reference `kgb_stock_tracker_v2.html` calls the Anthropic API from the browser — not viable on a public static site (leaks keys, no CORS). Replaced by a scheduled GitHub Action that scrapes and commits JSON.
- **Facebook:** scraping posts violates Meta ToS. Use official Page Plugin embeds. Private groups cannot be embedded — they get link-out cards instead.

---

## Stage 0 — App Skeleton & Deployment

**Goal:** a deployable, installable PWA shell with navigation to every future section.

**User stories**
- As a visitor on a phone, I can open the site and navigate between all sections from a bottom tab bar.
- As the maintainer, I can push to `main` and the site auto-deploys to GitHub Pages.

**Functional requirements**
- FR0.1 React + Vite + TS app, HashRouter, routes `/tiers`, `/stock`, `/events`, `/news`, `/more`, `/more/places`, `/more/community`; unknown route redirects to `/tiers`.
- FR0.2 Bottom tab bar with 5 tabs (Tiers, Stock, Events, News, More) and active state; More page lists Places & Community.
- FR0.3 Glass theme tokens as CSS custom properties; every page renders inside the themed shell.
- FR0.4 Unbuilt sections show a "coming in Stage N" glass card describing what will arrive.
- FR0.5 PWA manifest + icon; installable to the iOS/Android home screen.
- FR0.6 GitHub Actions workflow: on push to `main`, build and deploy `dist/` to GitHub Pages.

**Acceptance criteria**
- AC0.1 `npm run build` completes with zero TypeScript errors.
- AC0.2 At 390×844: no horizontal scroll, all 5 tabs reachable, tab bar never overlaps content (safe-area padding respected).
- AC0.3 Every route renders its stub with the correct stage label; unknown route redirects.
- AC0.4 Cards show visible frosted blur over the ambient background; no flash of white on load.
- AC0.5 Deploy workflow present and valid; a push to GitHub with Pages enabled publishes the site.

---

## Stage 1 — Competitive Tier Data (Taiwan + Japan, with sources)

**Goal:** a tier browser for Blades / Ratchets / Bits with part images matching the TW reference site, with visible attribution and a Japanese dataset alongside.

### Source research (completed)

Three datasets, each attributed to a named person or body so a reader can judge the recommendation:

| Source tab | Data | Origin | Attribution shown |
|---|---|---|---|
| **Community (TW)** | Subjective tier list, X–E, with part images and suggested combos | `beyblade_x_database` Google Sheet, CSV over CORS | Site by @stan_yao; ratings by 阿土 / @RENLIgames |
| **Tournament** | 2,788 aggregated combos with champion rate + win counts, from 15,131 dated placement records (2025-01 → 2026-12) | `beyblade_x_combo_stats` Google Sheet | Aggregated tournament results, via BeyTier |
| **Japan** | ~40 hand-curated top-tier entries | Transcribed from Japanese community tier lists | Per-entry author name + link (おくろぐ, ベイブレ雑記/note) |

Japanese tier data exists only as prose blog articles — no tables, no API — so scraping is neither reliable nor polite. The JP tab is therefore hand-curated JSON where **every entry carries its own `sourceName`, `sourceAuthor` and `sourceUrl`**, surfaced on the card so users always see whose opinion they're reading.

English blade names (`src/data/bladeNamesEn.json`, 71 entries) were derived from the tournament records' English name column, so Malaysian users see "Wizard Rod" rather than 魔導神杖.

**User stories**
- As a competitive player, I can browse parts by category and tier and see each part's image, type, and recommended combos.
- As a buyer, I can search a part by ID or name and see whether it's worth buying.
- As a skeptic, I can see exactly where each dataset came from and when it was last updated.

**Functional requirements**
- FR1.1 Fetch the TW dataset client-side from the public Google Sheet CSV (main sheet + parts sheet); CSV parser handles quoted fields and CJK text.
- FR1.2 Category tabs All / Blade / Ratchet / Bit / Assist; tier grouping X, S+, S, A+ … E using the reference tier colour scale.
- FR1.3 Part card shows image (lazy-loaded from the sheet's URL, styled placeholder on failure), ID, name, type badge (attack/stamina/defense/balance), tier chip, buy advice, recommended combo text.
- FR1.4 Search by ID or name, normalized so case, spaces and hyphens don't matter; filters for tier and buy advice.
- FR1.5 Source switcher with three tabs: Community (TW), Tournament, Japan — see the source table above.
- FR1.6 Attribution is always visible: a per-dataset block naming the source, its author and a link, plus a per-entry credit on every JP card. A reader must never see a rating without knowing whose rating it is.
- FR1.7 Cache the last successful fetch in `localStorage`; on failure show cached data with a "stale" notice.

**Acceptance criteria**
- AC1.1 With network on, the TW tab shows live sheet data — three spot-checked parts match the source site (e.g. UX-03 魔導神杖 = tier X, stamina).
- AC1.2 Images render for ≥90% of blade entries; missing images show a styled placeholder, never a broken-image icon.
- AC1.3 Searching `wizard`, `ux-03` and `UX03` all find the same part.
- AC1.4 Switching source tabs swaps both the dataset and the attribution block; every tab cites a clickable source, and each JP entry names the person whose ranking it is.
- AC1.5 With the fetch blocked, cached data renders behind a stale banner; never a blank screen.

---

## Stage 2 — KGB Stock Tracker

**Goal:** auto-refreshed availability and pricing from kelabgasingbeyblade.my, cross-flagged with competitive tiers.

**User stories**
- As a buyer, I can see what's in stock at KGB right now at official MY prices, and whether each bey is competitively worth buying.
- As the maintainer, I never update stock by hand.

**Functional requirements**
- FR2.1 GitHub Action on a cron (twice daily) plus manual dispatch: a Node script fetches the KGB category pages, parses name / price / URL / availability, and writes `public/data/stock.json` with an `updatedAt` field; commits only when the data changed.
- FR2.2 Stock page reads `stock.json` with a category filter (Bey, Stadium, Launcher, Case, Collab).
- FR2.3 Each bey cross-references Stage 1 tier data by product code (BX-/UX-/CX-) and shows a flag: Competitive pick, Sleeper, Not for competitive, or No data.
- FR2.4 Cards link to the KGB product page and show price in RM plus last-updated time in Malaysian time.
- FR2.5 Scraper fails loudly in CI on parse errors; the site keeps serving the previous JSON.

**Acceptance criteria**
- AC2.1 Running the scraper locally produces valid `stock.json` matching live listings for five spot-checked products.
- AC2.2 The workflow runs green on schedule and on manual dispatch, and makes no commit when stock is unchanged.
- AC2.3 A bey with a known tier shows the correct flag; non-bey items show none.
- AC2.4 The page's "updated" time comes from the JSON, not the client clock.

---

## Stage 3 — News (Facebook)

**Goal:** one place to read official Beyblade announcements and selected Malaysian community pages.

**User stories**
- As a fan, I can read the latest posts from the official Beyblade pages without leaving the app.
- As a local player, I can choose which MY community pages to follow and refresh their feeds.

**Functional requirements**
- FR3.1 Curated registry `src/data/fbPages.ts` with official pages (Beyblade Official, Takara Tomy Asia) and MY community pages; each entry has name, URL and category.
- FR3.2 Feeds render through the official Facebook Page Plugin inside glass cards, lazy-mounted as they scroll into view.
- FR3.3 Tabs Official / Community; the Community tab has multi-select page chips persisted to `localStorage`.
- FR3.4 A refresh control re-mounts the embeds to pull the latest posts.
- FR3.5 Every embed has an "open on Facebook" fallback card shown when the plugin fails to load (tracking protection, blocked third-party frames).
- FR3.6 Private groups are listed as link-out cards, never embedded.

**Acceptance criteria**
- AC3.1 The Official tab renders real posts from at least two official pages.
- AC3.2 Deselecting a community page removes its feed and the choice survives a reload.
- AC3.3 Refresh visibly reloads embed content.
- AC3.4 With embeds blocked, fallback link cards appear — no blank areas.

---

## Stage 4 — Malaysian Competitions Calendar

**Goal:** upcoming Beyblade X competitions in Malaysia, in calendar and list form, sortable by proximity.

**User stories**
- As a player, I can see this month's tournaments on a calendar and tap one for details.
- As a player, I can sort events by distance from me and get directions.

**Functional requirements**
- FR4.1 `public/data/events.json` entries: id, title, date/time, venue, address, lat/lng, city/state, organizer, entry fee, format, sourceUrl, status.
- FR4.2 Month calendar view (lightweight custom component, no heavy calendar dependency): dots on event days, tap a day to list its events, arrows/swipe for adjacent months.
- FR4.3 List view toggle: upcoming sorted by date, past events collapsed.
- FR4.4 "Near me" sort via browser geolocation with haversine distance on each card; denial falls back to date sort with a hint.
- FR4.5 Event detail sheet with all fields, "Open in Google Maps", and the source link.
- FR4.6 README documents adding events by PR; community submissions arrive in Stage 6.

**Acceptance criteria**
- AC4.1 The calendar renders the current month with at least five real seeded events.
- AC4.2 Granting location shows distances and reorders nearest-first; denying keeps date order with a hint and no error.
- AC4.3 The maps link opens the correct pin for a spot-checked venue.
- AC4.4 Past events are absent from the default upcoming list.

---

## Stage 5 — Where to Buy / Where to Play

**Goal:** a trusted directory of official-price retailers and places with stadiums to play.

**User stories**
- As a parent, I can find nearby stores selling at official price rather than scalper markups.
- As a player, I can find hobby shops with stadiums where people gather to battle.

**Functional requirements**
- FR5.1 `public/data/places.json`: name, type (retail chain / hobby shop / play venue), tags (`official-price`, `has-stadium`, `hosts-events`), address, lat/lng, hours, links, notes, `verifiedAt`.
- FR5.2 Filter chips Buy / Play / Both, plus a state or city filter.
- FR5.3 Distance and nearest-first sorting when geolocation is granted, reusing the Stage 4 utility.
- FR5.4 A visible policy note: only official-price sellers are listed; markup resellers are excluded.
- FR5.5 A "suggest a place" link (GitHub issue template, later a community post).

**Acceptance criteria**
- AC5.1 Seeded with at least ten real Malaysian entries, each with a working map link.
- AC5.2 Filters and the state selector narrow the list correctly, including combinations.
- AC5.3 Every card shows `verifiedAt` and the policy note is visible on the page.

---

## Stage 6 — Community

**Goal:** a place to sell or trade, share techniques, and organize practice sessions — at zero server cost.

**User stories**
- As a member, I can post a listing or a technique thread and reply to others, signing in with GitHub.
- As a lurker, I can read everything without an account.

**Functional requirements**
- FR6.1 giscus (GitHub Discussions) embedded in the Community tab, themed to match the dark glass UI.
- FR6.2 Discussion categories mapped to sub-tabs: Buy/Sell/Trade, Techniques & Combos, Practice Meetups, Off-topic.
- FR6.3 A pinned guidelines card (no scalping, meet-up safety) above the embed.
- FR6.4 Reading needs no login; posting uses GitHub OAuth through giscus.
- FR6.5 A documented upgrade path to Supabase (auth + realtime) if the community outgrows Discussions.

**Acceptance criteria**
- AC6.1 Each sub-tab loads its own giscus category; posts sync both ways with GitHub.
- AC6.2 Anonymous visitors can read; posting prompts GitHub sign-in.
- AC6.3 The giscus theme matches the app — no white flash inside the embed frame.

---

## Cross-cutting requirements

- **NFR1 Mobile-first.** Designed at 390px first; usable up to 1280px with centered max-width content.
- **NFR2 Performance.** Initial JS under 250 kB gzipped through Stage 3; images lazy-loaded; Lighthouse mobile performance ≥ 85.
- **NFR3 Attribution and ToS.** Every external dataset shows its source and link; no Facebook scraping; TW tier data credited to stan-yao / BeyTier.
- **NFR4 Resilience.** Every remote fetch has loading, error and cached-fallback states; the app never renders a blank page.
- **NFR5 Zero-cost hosting.** GitHub Pages and Actions only.

## Stage status

| Stage | Status |
|---|---|
| 0 — Skeleton & deployment | Done — all AC met except AC0.5 (needs the GitHub repo to exist) |
| 1 — Tier data (TW + JP) | Done — all AC met. Revised into a tier-list table with build details, buy verdicts and part-to-part navigation |
| 2 — KGB stock tracker | Not started |
| 3 — Facebook news | Not started |
| 4 — Competitions calendar | Not started |
| 5 — Buy / play directory | Not started |
| 6 — Community | Not started |

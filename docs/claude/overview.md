# Overview — app, commands, git

_Part of the split manual. Index: [../../CLAUDE.md](../../CLAUDE.md)._

## What this is

BeyClub MY: a mobile-first, static PWA (React + Vite + TypeScript) for the
Malaysian Beyblade X community — competitive tiers, local stock, tournaments,
news. No backend. Hosted on GitHub Pages. Designed at a **390px** viewport
first, so use a phone-sized frame when working on UI.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b + vite build — the check that must pass
npm run preview  # serve the production build
```

There is no separate lint or test script. **`npm run build` is the gate** — it
type-checks the whole app; if it passes, the change is sound. Run it before
committing.

Data-refresh commands (`npm run refresh:*`) rewrite generated files — see
[data-architecture.md](data-architecture.md) before running them.

## Git

- Develop on the branch the task assigns; create it locally if it's missing.
- Commit only what the task changed. `npm install` can rewrite
  `package-lock.json` incidentally — revert that unless dependencies actually
  changed.
- Push with `git push -u origin <branch>`.
- Do **not** open a pull request unless explicitly asked.

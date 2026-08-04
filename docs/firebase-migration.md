# Firebase migration runbook

This is the one-time setup that moves BeyClub's datasets out of git and onto
**Firebase Hosting** (free — no billing), and stands up **beyclub.web.app** as
production alongside the existing GitHub Pages **test** site.

After it's done:

- The five dataset JSON files are served from a Firebase Hosting **data site**,
  not from the repo.
- The scraper workflows publish to that data site instead of committing to `main`.
- Both sites — test (`slemony.github.io/beyclub`) and production
  (`beyclub.web.app`) — read the **same** data site, so there is one source of
  truth and nothing separate to maintain.

## The two Hosting sites

One Firebase project (`beyclub-90e95`) with two Hosting sites:

| Site | Serves | URL | Deployed by |
|---|---|---|---|
| **app** (named `beyclub`) | the React app (`dist`) | **beyclub.web.app** | `firebase-hosting.yml` on push to `main` |
| **data** (the default site `beyclub-90e95`) | the five JSON files under `/data/` | beyclub-90e95.web.app | the scraper workflows, when data changes |

The default site's ugly URL doesn't matter — nobody visits it, it's just a JSON
endpoint the app fetches. This is why we get a clean **beyclub.web.app** for the
app without paying for Cloud Storage.

The code, config and workflows are already in place. What's left is the parts
that need console access and a secret, which can't live in the repo. Everything
below can be done from the browser — the Firebase console for clicks, and
**Cloud Shell** (the `>_` icon, top-right of the console) for the CLI bits.

> If you claimed a Hosting site id other than `beyclub` (because it was taken),
> replace `beyclub` with your id in three places before deploying:
> `firebase.json` (`site`), `package.json` (`deploy:app`), and the site name in
> `README.md`. Tell me the id and I'll do it.

---

## 1. Enable Hosting and claim the app site
1. Console → **Build → Hosting → Get started**. Click through the CLI steps it
   shows (we don't need them) to finish — the default site
   `beyclub-90e95.web.app` is created. **We don't use this for the app.**
2. On the Hosting page, click **Add another site** → enter site id **`beyclub`**.
   - Available → you get **beyclub.web.app**. 🎉
   - Taken → try a short fallback (e.g. `beyclubmy`) and note the id.

## 2. Service account for CI (Cloud Shell)
The workflows deploy as a service account. Create one with Hosting-deploy rights:

```bash
P=beyclub-90e95
gcloud iam service-accounts create beyclub-ci --project=$P --display-name="BeyClub CI"
gcloud projects add-iam-policy-binding $P \
  --member="serviceAccount:beyclub-ci@$P.iam.gserviceaccount.com" \
  --role=roles/firebasehosting.admin
gcloud projects add-iam-policy-binding $P \
  --member="serviceAccount:beyclub-ci@$P.iam.gserviceaccount.com" \
  --role=roles/firebase.viewer
gcloud iam service-accounts keys create key.json \
  --iam-account=beyclub-ci@$P.iam.gserviceaccount.com
cat key.json      # copy the whole JSON
```

## 3. GitHub secret
GitHub → repo **Settings → Secrets and variables → Actions → New repository
secret**: name **`GCP_SA_KEY`**, value = the entire `key.json`. Used by the app
deploy and the three data workflows. Then `rm key.json` in Cloud Shell.

*(Optional)* Secret **`DATA_PAT`** — a fine-grained PAT with `contents: write`.
The scrapers no longer commit, so `keepalive.yml` uses it to make a weekly
one-line heartbeat commit that keeps GitHub from auto-disabling the scheduled
workflows after 60 days of repo inactivity. Without it the heartbeat still runs
with the default token; normal development activity also keeps the clock alive.

## 4. Seed the data site (Cloud Shell, from `main` which still has the files)
The scrapers only publish the dataset they refresh; the first publish of the
other four has to be a manual seed from the JSON still committed on `main`:

```bash
git clone https://github.com/slemony/beyclub && cd beyclub
git checkout main            # main still has public/data/*.json
npm ci
npm run data:stage           # copies all five into data-dist/data/
npx firebase-tools deploy --only hosting:beyclub-90e95 --project beyclub-90e95
```

(Cloud Shell is already logged in as you, so `firebase-tools` can deploy without
a key here. In CI the `GCP_SA_KEY` service account does it.)

Already merged, so `main` no longer has the files? Recover them from the last
pre-migration commit first:

```bash
mkdir -p public/data
for f in catalogue stock tournament tiers-jp part-notes; do
  git show <pre-migration-sha>:public/data/$f.json > public/data/$f.json
done
npm run data:stage && npx firebase-tools deploy --only hosting:beyclub-90e95 --project beyclub-90e95
```

## 5. Deploy production
Merge the migration to `main`. `firebase-hosting.yml` builds and deploys the app
to your named site on every push. To deploy by hand:

```bash
npm run deploy:app
```

## 6. Verify
- `curl -I https://beyclub-90e95.web.app/data/stock.json`
  → `200`, `content-type: application/json`, and an
  `access-control-allow-origin: *` header.
- Open **beyclub.web.app** and the test site (`slemony.github.io/beyclub`) —
  both should render stock and tiers (they're reading the data site).
- Run the **Refresh KGB stock** workflow manually
  (Actions → Refresh KGB stock → Run workflow) and confirm it pulls, scrapes and,
  only if the shelf moved, deploys the data site — without touching git.

---

## Day-to-day after migration

- **Scraped data** (stock, catalogue, tournament) refreshes itself on schedule,
  publishing straight to the data site.
- **Curated data** (`tiers-jp.json`, `part-notes.json`) is now edited against the
  data site, not the repo:

  ```bash
  npm run data:pull                          # get the full current set
  # edit public/data/tiers-jp.json
  npm run deploy:data                         # stage all five + deploy (live in ~5 min)
  ```

  Pull the full set first — `deploy:data` re-publishes everything in
  `public/data/`, so editing one file without the others present would drop them.

- **Local development** with real data: `npm run data:pull` populates
  `public/data/` (gitignored). Without it, the app still reads the production
  data site over the network.

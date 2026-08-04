# Firebase migration runbook

This is the one-time setup that moves BeyClub's datasets out of git and into a
shared Firebase Cloud Storage bucket, and stands up **beyclub.web.app** on
Firebase Hosting as production alongside the existing GitHub Pages **test** site.

After it's done:

- The five dataset JSON files live only in the bucket, not in the repo.
- The scraper workflows write to the bucket instead of committing to `main`.
- Both sites — test (`slemony.github.io/beyclub`) and production
  (`beyclub.web.app`) — read the **same** bucket, so there is one source of
  truth and no separate database to maintain.

The code, config and workflows are already in place. What's left is the parts
that need console access and secrets, which can't live in the repo.

---

## What you need once

- The Firebase project **`beyclub-90e95`**, already wired into `.firebaserc`,
  `.github/workflows/firebase-hosting.yml` (`projectId`), `src/lib/dataSource.ts`
  and `.env.example`. Production is served from a **named Hosting site**, not the
  default `beyclub-90e95.web.app` — you claim `beyclub` (→ `beyclub.web.app`) or a
  short fallback in Phase 6, and its site id goes into `firebase.json`.
- Its default Cloud Storage bucket, expected to be
  **`beyclub-90e95.firebasestorage.app`** (older projects use `.appspot.com`). Keep
  it consistent everywhere — it's the default baked into `src/lib/dataSource.ts`
  and the scripts.
- The `gcloud` and `firebase` CLIs, or the Firebase console, to run the steps.

If your bucket name is **not** `beyclub-90e95.firebasestorage.app`, set it in:

- `src/lib/dataSource.ts` → `DEFAULT_DATA_BASE`
- `.env.example` (and any local `.env`)
- the `DATA_BUCKET` repo **variable** (see below), which the workflows pass through

---

## 1. Make the datasets publicly readable

The web app reads the JSON over its plain public URL
(`https://storage.googleapis.com/<bucket>/data/<file>`), so `allUsers` needs
object-read on the bucket:

```bash
gcloud storage buckets add-iam-policy-binding gs://beyclub-90e95.firebasestorage.app \
  --member=allUsers --role=roles/storage.objectViewer
```

Only the `data/` objects are ever created here, and they're public shop/tier
snapshots — nothing sensitive.

## 2. Allow the browsers to fetch it (CORS)

The test site is a different origin from the bucket, so the browser needs CORS:

```bash
gcloud storage buckets update gs://beyclub-90e95.firebasestorage.app --cors-file=firebase/cors.json
```

(`firebase/cors.json` allows `GET`/`HEAD` from any origin — fine for public data.)

## 3. Service account for the automation

One service account does both jobs — uploading data and deploying hosting:

```bash
gcloud iam service-accounts create beyclub-ci --display-name="BeyClub CI"

# Upload datasets to the bucket
gcloud projects add-iam-policy-binding beyclub-90e95 \
  --member="serviceAccount:beyclub-ci@beyclub-90e95.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin

# Deploy Firebase Hosting
gcloud projects add-iam-policy-binding beyclub-90e95 \
  --member="serviceAccount:beyclub-ci@beyclub-90e95.iam.gserviceaccount.com" \
  --role=roles/firebasehosting.admin

# A key to hand to GitHub Actions
gcloud iam service-accounts keys create key.json \
  --iam-account=beyclub-ci@beyclub-90e95.iam.gserviceaccount.com
```

## 4. GitHub secrets and variables

In **Settings → Secrets and variables → Actions**:

- Secret **`GCP_SA_KEY`** — the full contents of `key.json`. Used by the three
  data workflows (to upload) and `firebase-hosting.yml` (to deploy). Delete the
  local `key.json` afterwards.
- Variable **`DATA_BUCKET`** — your bucket name, only if it isn't the default
  `beyclub-90e95.firebasestorage.app`.
- Secret **`DATA_PAT`** *(optional)* — a fine-grained PAT with `contents: write`.
  The scrapers no longer commit, so `keepalive.yml` uses this to make a weekly
  one-line heartbeat commit that keeps GitHub from auto-disabling the scheduled
  workflows after 60 days of repo inactivity. Without it the heartbeat still runs
  with the default token; normal development activity also keeps the clock alive.

## 5. Seed the bucket

Do this **from `main`, before merging the migration** — `main` still has the
JSON files there, and this branch has removed them:

```bash
git checkout main
npm ci
GOOGLE_APPLICATION_CREDENTIALS=key.json DATA_BUCKET=beyclub-90e95.firebasestorage.app \
  npm run data:push        # uploads all five files
```

Already merged? Recover the files from the last pre-migration commit and push:

```bash
mkdir -p public/data
for f in catalogue stock tournament tiers-jp part-notes; do
  git show <pre-migration-sha>:public/data/$f.json > public/data/$f.json
done
GOOGLE_APPLICATION_CREDENTIALS=key.json npm run data:push
```

## 6. Turn on Firebase Hosting

Merge the migration to `main`. `firebase-hosting.yml` builds and deploys to the
`live` channel on every push, publishing production at **beyclub.web.app**. To
deploy by hand:

```bash
npm run deploy:firebase
```

## 7. Verify

- `curl -I https://storage.googleapis.com/beyclub-90e95.firebasestorage.app/data/stock.json`
  → `200`, `content-type: application/json`.
- Open **beyclub.web.app** and the test site — both should render stock and tiers
  (they're now reading the bucket).
- Run the **Refresh KGB stock** workflow manually
  (Actions → Refresh KGB stock → Run workflow) and confirm it pulls, scrapes and
  pushes without touching git.

---

## Day-to-day after migration

- **Scraped data** (stock, catalogue, tournament) updates itself on schedule,
  straight into the bucket.
- **Curated data** (`tiers-jp.json`, `part-notes.json`) is now edited against the
  bucket, not the repo:

  ```bash
  npm run data:pull -- tiers-jp.json          # get the current copy
  # edit public/data/tiers-jp.json
  GOOGLE_APPLICATION_CREDENTIALS=key.json \
    npm run data:push -- tiers-jp.json        # publish it (live within ~5 min)
  ```

- **Local development** with real data: `npm run data:pull` populates
  `public/data/` (gitignored). Without it, the app still reads the production
  bucket directly over the network.

# Turning on sign-in and cross-device sync

The collection, builds and decks work with no account at all — they live in
whichever browser you used. Signing in with Google is what makes them follow
you between phone and desktop.

That needs a Firebase project, and it has to be **yours**: it's tied to a
Google account and a billing-capable console, so it can't be created for you.
Everything below is a one-time setup, roughly ten minutes. The free Spark
plan is far more than enough — this app stores a few kilobytes of text per
user and needs no card.

Until it's done the app just runs local-only and the sign-in button stays
hidden. Nothing is broken in the meantime.

## 1. Create the project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and sign in with your Google account.
2. **Create a project** → name it anything (`beyclub` is fine).
3. Google Analytics is optional — **turn it off**, this app doesn't use it.

## 2. Turn on Google sign-in

1. In the left sidebar: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → toggle **Enable**.
3. Pick a support email (your own), then **Save**.

## 3. Create the database

1. Left sidebar: **Build → Firestore Database → Create database**.
2. Choose a location near you — `asia-southeast1` (Singapore) is closest to
   Malaysia. **This cannot be changed later.**
3. Start in **production mode**. The rules in step 4 replace the default.

## 4. Lock the data to its owner

Firestore's default production rules deny everything, so the app can't read
or write until you replace them. In **Firestore Database → Rules**, paste
this and hit **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This is the only thing standing between your collection and anyone else's —
it says a signed-in user may touch the document named after their own user
id, and nothing else. Don't skip it, and don't loosen it to
`allow read, write: if true`.

## 5. Copy the config into the app

1. Click the **gear icon → Project settings**.
2. Scroll to **Your apps** → click the **web** icon (`</>`).
3. Register the app (any nickname, no need for Firebase Hosting).
4. You'll get a `firebaseConfig` block. Copy the four values into
   `.env.local` in the project root — the file is already there waiting:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:123...:web:abc...
```

Ignore `storageBucket` and `messagingSenderId` — this app uses neither.

These four are **not secrets**. They identify the project, they don't grant
access to it; that's what step 4's rules are for. Google publishes them in
every web app's page source. `.env.local` is gitignored anyway, so nothing
lands in the repo.

5. Restart the dev server (`npm run dev`) — Vite only reads `.env.local` at
   startup. The **Sign in to sync** button should now appear on the
   Collection page.

## 6. Let the deployed site sign in too

Local dev works now, but the published site needs two more things.

**Authorised domains** — Firebase refuses sign-in from a domain it doesn't
know. In **Authentication → Settings → Authorised domains**, add your GitHub
Pages host (e.g. `slemony.github.io`). `localhost` is already there.

**Build-time config** — the deploy workflow reads the same four values from
repo variables. In GitHub: **Settings → Secrets and variables → Actions →
Variables** tab → **New repository variable**, four times:

| Name | Value |
|---|---|
| `FIREBASE_API_KEY` | same as `.env.local` |
| `FIREBASE_AUTH_DOMAIN` | " |
| `FIREBASE_PROJECT_ID` | " |
| `FIREBASE_APP_ID` | " |

Use the **Variables** tab, not Secrets — `.github/workflows/deploy.yml`
reads them as `${{ vars.FIREBASE_* }}`, and secrets wouldn't be found there.
If they're missing the site still builds and deploys, just without sign-in.

## 7. Check it works

1. `npm run dev`, open the Collection tab, add a part or two while signed
   out.
2. Click **Sign in to sync** — a Google popup, then the button becomes
   **Sign out** with your avatar.
3. In the Firebase console → **Firestore Database**, you should see a
   `users` collection with one document named after your user id, holding
   your entries, builds and decks. Those parts you added while signed out
   migrated up on first sign-in.
4. Open the app in a different browser or profile, sign into the same Google
   account, and the same collection should appear.

## If something goes wrong

**Sign-in button doesn't appear** — all four values must be set, non-empty,
and the dev server restarted. Check in the browser console:
`Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE'))`.

**`auth/unauthorized-domain`** — step 6's authorised domains.

**Popup closes instantly, nothing happens** — a popup blocker, or a browser
blocking third-party cookies. Try another browser to confirm it's that.

**`Missing or insufficient permissions`** — the rules from step 4 aren't
published, or were pasted under a different path than `users/{userId}`.

**Signed in but nothing syncs** — check the browser console for Firestore
errors, and confirm the document at `users/<your uid>` exists in the
console. The app is local-first, so a sync failure never loses local data.

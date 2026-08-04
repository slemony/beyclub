# Stock refresh dispatcher

A one-file [Cloudflare Worker](https://developers.cloudflare.com/workers/) that
lets the site's **"Check now"** button start a real scrape. It holds the GitHub
token — which a public static page cannot — and uses it to dispatch the
`stock.yml` workflow. That's the same workflow the two scheduled runs fire, so a
manual check and a scheduled one do exactly the same thing; the button is just
an on-demand, once-an-hour trigger.

Nothing here runs unless you deploy it and point the app at it. With
`VITE_STOCK_REFRESH_URL` unset, "Check now" falls back to simply re-pulling the
last published file.

## Deploy

1. **Create a token.** A [fine-grained PAT](https://github.com/settings/tokens?type=beta)
   scoped to **`slemony/beyclub`** only, with **Repository permissions →
   Actions: Read and write**. Nothing else.

2. **Publish the Worker** (needs [wrangler](https://developers.cloudflare.com/workers/wrangler/)):

   ```bash
   cd worker
   wrangler deploy
   wrangler secret put GH_DISPATCH_TOKEN   # paste the token
   ```

   Optionally lock it to the live origin by uncommenting `ALLOW_ORIGIN` in
   `wrangler.toml`, and add the `RATE` KV namespace for a server-side hourly cap.

3. **Point the app at it.** Add the Worker's URL as a repository **variable**
   named `STOCK_REFRESH_URL` (Settings → Secrets and variables → Actions →
   Variables). Both `deploy.yml` and `stock.yml` pass it to the build as
   `VITE_STOCK_REFRESH_URL`, so the next deploy bakes the endpoint into the
   bundle.

## How the button behaves once wired

Clicking dispatches the workflow, then the page polls the published `stock.json`
for a few minutes and updates itself the moment the run scrapes, commits and
redeploys. If nothing on the shelf moved, it says so. The click is spent whether
or not anything changed, so the shop is never scanned more than once an hour.

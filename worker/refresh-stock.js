/**
 * The one scrap of backend BeyClub needs: a token holder.
 *
 * The Stock page's "Check now" button is meant to start the real scrape — the
 * same `stock.yml` workflow the two scheduled runs fire — but a public static
 * page can't hold the GitHub token that call requires. This Worker does: the
 * page POSTs here, and here we dispatch the workflow with a token kept as a
 * Worker secret, never shipped to the browser.
 *
 * Deploy: see worker/README.md. Set the token with
 *   wrangler secret put GH_DISPATCH_TOKEN
 * and point the app at the deployed URL via VITE_STOCK_REFRESH_URL.
 */

const REPO = 'slemony/beyclub'
const WORKFLOW = 'stock.yml'
const REF = 'main'

/** Don't let a public button spin up runs faster than the shelf can move. */
const MIN_GAP_MS = 55 * 60 * 1000

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    const json = (body, status) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ ok: false, reason: 'method' }, 405)
    if (!env.GH_DISPATCH_TOKEN) return json({ ok: false, reason: 'unconfigured' }, 500)

    // Best-effort server-side throttle, mirroring the once-an-hour cap the client
    // already enforces — a second line of defence against a spammed endpoint.
    // Only active when a KV namespace is bound; a no-op otherwise.
    if (env.RATE) {
      const last = Number((await env.RATE.get('last')) || 0)
      if (Date.now() - last < MIN_GAP_MS) return json({ ok: false, reason: 'rate_limited' }, 429)
    }

    const gh = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'beyclub-stock-refresh',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: REF }),
      },
    )

    if (!gh.ok) return json({ ok: false, reason: 'github', status: gh.status, detail: await gh.text() }, 502)
    if (env.RATE) await env.RATE.put('last', String(Date.now()))
    // 202: queued. The new stock lands a few minutes later, once the run
    // scrapes, commits and redeploys; the page polls for it.
    return json({ ok: true }, 202)
  },
}

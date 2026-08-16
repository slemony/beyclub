/**
 * "Everything in stock, on one screen."
 *
 * Run this while you are signed in to Kelab Gasing Beyblade and already inside
 * the shop. Your place in the queue lasts 15 minutes; clicking through five
 * listing pages to find what is actually available spends a good part of it.
 * This gathers every page at once and shows only what is in stock, each row a
 * direct link to its product page.
 *
 * What it deliberately does NOT do, and must never be extended to do:
 *
 *   - sign in, or enter the queue. It runs only when you are already inside,
 *     on a page you opened yourself, using the session your browser already
 *     holds. It takes no place in line.
 *   - run on a schedule, or without your click.
 *   - send anything anywhere. Nothing it reads leaves the tab: no upload, no
 *     request to BeyClub, nothing written to the published stock data. The
 *     "View rank in BeyClub" button passes what it found in a URL *fragment*,
 *     which browsers never send to a server.
 *
 * The shop's own limit is 120 requests a minute; this makes five, paced, per
 * click — the same requests you would make by hand, in less of your window.
 *
 * Installation for desktop, iPhone and Android: /beyclub/grab.html
 */
;(() => {
  'use strict'

  const SHOP = 'https://kelabgasingbeyblade.my'
  const BEYCLUB = 'https://slemony.github.io/beyclub/'
  /** Pagination stops on the first empty page; this only stops a runaway. */
  const MAX_PAGES = 15
  /** Space the page requests out rather than firing five at once. */
  const PACE_MS = 300
  const HOST_ID = 'beyclub-grab-overlay'

  /**
   * iOS Shortcuts' "Run JavaScript on Web Page" hands the script a `completion`
   * it must call or the Shortcut hangs waiting. It does not exist in a
   * bookmarklet or a userscript, hence the typeof guard rather than a bare call.
   */
  const finish = () => {
    try {
      if (typeof completion === 'function') completion('done')
    } catch {
      /* not running under Shortcuts */
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const money = (n) => (n === undefined ? '' : `RM ${n.toFixed(2)}`)

  /**
   * KGB's own category labels for the things worth queueing for. Kept in step
   * with GROUPS in scripts/fetch-stock.mjs by hand — two lists, because that
   * one runs in Node and this runs on KGB's page, with no way to share.
   *
   * Anything not named here is merchandise — pillows, keychains, activity books
   * — and is hidden by default. It is counted rather than silently dropped, so
   * that a category KGB adds later shows up as "hidden" instead of vanishing.
   */
  const KIT = new Set([
    'Starter',
    'Booster',
    'Random Booster',
    'Battle Set',
    'Deck Set',
    'Dash Set',
    'Custom Set',
    'Entry Package',
    'Stadium',
    'Launcher',
    'Grip',
    'Launcher Grip',
    'Deck Case',
    'Gear Case',
  ])

  /**
   * BeyClub's blended ranking, best first. An unrecognised or missing grade
   * sorts last rather than in the middle.
   *
   * Must stay identical to BLADE_TIERS in src/lib/tiers.ts — this file runs
   * on KGB's own origin and cannot import from the bundle, so the list is
   * copied by hand. It had drifted: this copy was missing X entirely, which
   * sent the single best thing on the shelf to the bottom of the list under
   * the "unknown grade" fallback, alongside the E-tier it was also missing.
   * If you change the scale there, change it here.
   */
  const TIER_ORDER = ['X', 'S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E']
  const tierRank = (t) => {
    const i = TIER_ORDER.indexOf(t)
    return i === -1 ? 99 : i
  }

  /**
   * The product code the tier map is keyed by, read off the slug the same way
   * the scraper reads it: "ux-21-hells-nether-deck-set" → "UX-21".
   */
  const codeFromSlug = (slug) => {
    const m = /^([a-z]+)-(\d+)/i.exec(slug || '')
    return m ? `${m[1].toUpperCase()}-${m[2]}` : undefined
  }

  /**
   * Tiers cannot be computed here — they are blended from tournament results,
   * the Taiwan sheet and the Japanese list, none of which this page can reach.
   * BeyClub publishes the finished map instead, and GitHub Pages serves it with
   * `access-control-allow-origin: *`, so it is readable from KGB's origin.
   *
   * Failing to load it is not fatal: the shelf is still worth showing grouped.
   */
  async function loadTiers() {
    try {
      const res = await fetch(`${BEYCLUB}data/product-tiers.json`, { cache: 'no-store' })
      if (!res.ok) return null
      const { tiers } = await res.json()
      return tiers && Object.keys(tiers).length ? tiers : null
    } catch {
      return null
    }
  }

  /** Beys first, then the gear — the fallback when no tier is known. */
  const GROUP_RANK = {
    Starter: 0,
    Booster: 0,
    'Random Booster': 0,
    'Battle Set': 0,
    'Deck Set': 0,
    'Dash Set': 0,
    'Custom Set': 0,
    'Entry Package': 0,
    Stadium: 1,
    Launcher: 2,
    Grip: 2,
    'Launcher Grip': 2,
    'Deck Case': 3,
    'Gear Case': 3,
  }
  const rankOf = (cat) => GROUP_RANK[cat] ?? 9

  // ── Reading the shop ──────────────────────────────────────────────

  /**
   * One listing card, read through the DOM rather than by regex. The scraper in
   * scripts/fetch-stock.mjs matches HTML with a regex because it runs in Node
   * with no DOM; here there is a real parser, so use it.
   */
  function readCard(el) {
    // Historically the card is wrapped in the product link, but the shop's
    // markup has already been reworked once — so fall back to a link inside the
    // card, then to one alongside it, before giving up on the row.
    const link =
      el.closest('a[href*="/products/"]') ||
      el.querySelector('a[href*="/products/"]') ||
      el.parentElement?.querySelector('a[href*="/products/"]')
    if (!link?.href) return null

    const text = el.textContent || ''
    // A discounted card prints the old price before the payable one, so the
    // last figure on the card is the one you actually hand over.
    const prices = [...text.matchAll(/MYR\s*([\d,]+(?:\.\d+)?)/g)].map((m) =>
      Number(m[1].replace(/,/g, '')),
    )

    return {
      url: link.href,
      slug: link.href.split('?')[0].split('/').filter(Boolean).pop(),
      title: el.querySelector('.product-title')?.textContent.trim() || link.textContent.trim(),
      // The shop writes this as "[ Starter ]", spaces and all.
      category: ((el.querySelector('.product-desc')?.textContent.match(/\[([^\]]+)\]/) || [])[1] || '').trim(),
      price: prices.length ? prices[prices.length - 1] : undefined,
      // "Select Variant" in place of a button means the card says nothing about
      // availability. Left undefined and treated as unknown rather than guessed.
      inStock: /Add to Cart/i.test(text) ? true : /Out of Stock/i.test(text) ? false : undefined,
      img: el.querySelector('img')?.src,
    }
  }

  const readPage = (doc) => [...doc.querySelectorAll('.product-container')].map(readCard).filter(Boolean)

  async function fetchPage(n) {
    // Same-origin, so the browser attaches the session cookie you signed in with.
    const res = await fetch(`${SHOP}/shop?page=${n}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`The shop returned ${res.status} for page ${n}.`)

    const html = await res.text()
    if (/Sign in to (?:queue|shop)|places in line are reserved/i.test(html)) {
      throw new Error(
        'The shop is showing its sign-in queue, so this session is not inside. Sign in, wait for your place, then run this again.',
      )
    }
    return new DOMParser().parseFromString(html, 'text/html')
  }

  async function collect(onProgress) {
    const bySlug = new Map()

    for (let n = 1; n <= MAX_PAGES; n++) {
      const cards = readPage(await fetchPage(n))

      if (!cards.length) {
        // An empty page 1 is not "the shop is empty" — it means the markup this
        // reads no longer matches, which is worth saying rather than showing a
        // blank list and letting you believe there is nothing in stock.
        if (n === 1) {
          throw new Error(
            'Found no product cards on the first page. The shop\'s markup has changed since this was written, so it cannot read the listing any more.',
          )
        }
        break
      }

      // Later pages re-list nothing, but a shifting catalogue can repeat a
      // product across a page boundary. First sighting wins.
      for (const c of cards) if (!bySlug.has(c.slug)) bySlug.set(c.slug, c)
      onProgress(n, bySlug.size)
      await sleep(PACE_MS)
    }

    return [...bySlug.values()]
  }

  // ── The overlay ───────────────────────────────────────────────────

  /**
   * Rendered into a shadow root so the shop's own stylesheet cannot reach in and
   * neither can ours reach out. Sized for a phone first — that is where a
   * 15-minute window is usually spent.
   */
  function mount() {
    document.getElementById(HOST_ID)?.remove()

    const host = document.createElement('div')
    host.id = HOST_ID
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647'
    const root = host.attachShadow({ mode: 'open' })

    root.innerHTML = `
      <style>
        :host { all: initial }
        * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif }
        .back { position: fixed; inset: 0; background: rgba(4, 6, 20, .72) }
        .panel {
          position: fixed; inset: 0; display: flex; flex-direction: column;
          background: #0a0c11; color: #e8ecf5;
          max-width: 720px; margin: 0 auto; box-shadow: 0 0 60px rgba(0,0,0,.6);
        }
        header { padding: 14px 16px 10px; border-bottom: 1px solid #1e2433; flex: none }
        .row1 { display: flex; align-items: center; gap: 10px }
        /* min-width:0 lets the heading shrink instead of shoving the buttons
           off the edge of a phone once the count grows. */
        h1 { margin: 0; font-size: 15px; font-weight: 700; flex: 1; min-width: 0 }
        .rank { white-space: nowrap }
        .count { color: #7de2a8; font-weight: 600 }
        button {
          font: inherit; font-size: 13px; padding: 7px 12px; border-radius: 8px;
          border: 1px solid #2b3345; background: #151a25; color: #e8ecf5; cursor: pointer;
        }
        button:hover { background: #1d2431 }
        .x { padding: 7px 11px; font-size: 15px; line-height: 1 }
        input {
          font: inherit; font-size: 16px; width: 100%; margin-top: 10px; padding: 9px 12px;
          border-radius: 8px; border: 1px solid #2b3345; background: #0f131c; color: #e8ecf5;
        }
        input::placeholder { color: #5b6478 }
        .merch { margin-top: 8px; width: 100%; font-size: 12px; color: #8b95a9 }
        /* A grid of cards rather than a list of rows: with the picture large
           enough to recognise, a shelf is something you scan, not read. */
        ul {
          list-style: none; margin: 0; padding: 12px; overflow-y: auto; flex: 1;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;
          align-content: start;
          /*
           * Required, not cosmetic. This grid is also the scroll container and a
           * flex item with a definite height, and in that arrangement implicit
           * auto-sized rows collapse once there are more rows than fit — 60-odd
           * products crushed every card to a 9px sliver of image. Sizing rows to
           * their content instead is what keeps them whole.
           */
          grid-auto-rows: max-content;
        }
        /*
         * display:flex, not the default list-item, and no percentage height on
         * the link. A list-item's marker box is the only thing an auto grid row
         * measures here, and a percentage height inside an auto-sized row is a cyclic
         * dependency the browser resolves by ignoring the card's real content —
         * between them the rows collapsed to 9px and every card was a sliver.
         * Stretching the link as a flex child keeps cards equal height without
         * either problem.
         */
        li {
          display: flex; border: 1px solid #1a2030; border-radius: 10px;
          background: #0f131c; overflow: hidden;
        }
        li.wide { grid-column: 1 / -1; border: 0; background: none }
        a { display: block; flex: 1; padding: 10px; text-decoration: none; color: inherit }
        a:hover { background: #151b27 }
        img {
          width: 100%; height: 90px; object-fit: contain; border-radius: 6px;
          background: #11151e; display: block; margin-bottom: 8px;
        }
        .t { font-size: 12px; font-weight: 600; line-height: 1.3; display: block }
        .s { font-size: 10px; color: #8b95a9; margin-top: 3px; display: block }
        .tier { color: #8be8ff; font-weight: 700 }
        .p { font-size: 13px; font-weight: 700; color: #7de2a8; margin-top: 6px; display: block }
        .msg { padding: 22px 18px; font-size: 13px; line-height: 1.55; color: #b9c2d4 }
        .err { color: #ffb0bd }
        footer { padding: 10px 16px; border-top: 1px solid #1e2433; font-size: 11px; color: #6c7689; flex: none }
      </style>
      <div class="back" part="back"></div>
      <div class="panel">
        <header>
          <div class="row1">
            <h1>KGB — <span class="count">reading…</span></h1>
            <button class="rank" hidden>View rank in BeyClub</button>
            <button class="x">✕</button>
          </div>
          <input class="filter" placeholder="Filter by name or code…" hidden>
          <button class="merch" hidden></button>
        </header>
        <ul></ul>
        <footer>Your own view of a shop you are signed in to. Nothing here is published.</footer>
      </div>`

    const close = () => host.remove()
    root.querySelector('.x').addEventListener('click', close)
    root.querySelector('.back').addEventListener('click', close)
    document.addEventListener('keydown', function esc(e) {
      if (e.key !== 'Escape') return
      document.removeEventListener('keydown', esc)
      close()
    })

    document.body.appendChild(host)
    return root
  }

  const say = (root, html, isError) => {
    root.querySelector('ul').innerHTML = `<li><p class="msg${isError ? ' err' : ''}">${html}</p></li>`
  }

  function render(root, kit, merch) {
    const list = root.querySelector('ul')
    let showMerch = false
    let query = ''

    const rowsNow = () => {
      const base = showMerch ? [...kit, ...merch] : kit
      if (!query) return base
      return base.filter((p) => `${p.title} ${p.slug} ${p.category}`.toLowerCase().includes(query))
    }

    const draw = (rows) => {
      list.innerHTML =
        rows
          .map(
            (p) => `
        <li><a href="${p.url}" target="_blank" rel="noopener">
          ${p.img ? `<img src="${p.img}" alt="">` : '<img alt="">'}
          <span class="t">${p.title}</span>
          <span class="s">${p.tier ? `<b class="tier">${p.tier}</b> · ` : ''}${p.category || ''}</span>
          <span class="p">${money(p.price)}</span>
        </a></li>`,
          )
          .join('') || '<li class="wide"><p class="msg">Nothing matches that filter.</p></li>'
    }

    const redraw = () => {
      draw(rowsNow())
      if (merch.length) {
        toggle.textContent = showMerch
          ? `Hide ${merch.length} merch`
          : `${merch.length} merch hidden — show`
      }
    }

    // Merchandise is not what a 15-minute queue place is for, so it starts
    // hidden. Shown as a count rather than dropped, because "merch" here means
    // "a category label this script doesn't recognise" — a new kind of bey
    // would land in it, and silently swallowing that would be the worst outcome.
    const toggle = root.querySelector('.merch')
    if (merch.length) {
      toggle.hidden = false
      toggle.addEventListener('click', () => {
        showMerch = !showMerch
        redraw()
      })
    }

    const filter = root.querySelector('.filter')
    filter.hidden = false
    filter.addEventListener('input', () => {
      query = filter.value.trim().toLowerCase()
      redraw()
    })

    redraw()

    /*
     * Hands the shelf to BeyClub, which knows each blade's tier and whether it
     * is worth buying. A fragment is never sent to a server, so this stays
     * inside your browser; merch is left behind here too.
     *
     * Title, price and category travel with the slug because BeyClub's own
     * catalogue has been frozen since the shop closed: anything KGB has listed
     * since is a slug it cannot resolve, and without these fields such a
     * product could only be drawn as a bare link — not a card, and not
     * something you could add to a watchlist.
     */
    const rank = root.querySelector('.rank')
    rank.hidden = false
    rank.addEventListener('click', () => {
      const payload = rowsNow().map((p) => ({ s: p.slug, t: p.title, p: p.price, c: p.category }))
      window.open(
        `${BEYCLUB}#/stock?live=${encodeURIComponent(JSON.stringify(payload))}`,
        '_blank',
        'noopener',
      )
    })
  }

  // ── Run ───────────────────────────────────────────────────────────

  async function run() {
    if (!location.hostname.endsWith('kelabgasingbeyblade.my')) {
      const root = mount()
      root.querySelector('.count').textContent = 'wrong site'
      say(root, `Open <a href="${SHOP}/shop" style="color:#8ab4ff">the KGB shop</a> and run this there.`, true)
      return
    }

    const root = mount()
    const count = root.querySelector('.count')
    say(root, 'Reading the shop…')

    try {
      const all = await collect((page, seen) => {
        count.textContent = `page ${page}, ${seen} seen`
      })

      const inStock = all.filter((p) => p.inStock !== false)

      // Attach what BeyClub knows about each product before ordering them.
      const tiers = await loadTiers()
      for (const p of inStock) {
        const graded = tiers?.[codeFromSlug(p.slug)]
        p.tier = graded?.tier
        p.buy = graded?.buy
      }

      /*
       * Highest tier first — the question a 15-minute queue place actually asks.
       * Ungraded products (merch, and anything the ranking has no verdict on)
       * fall to the back but keep the beys-before-gear order among themselves,
       * which is also the whole ordering if the tier map could not be fetched.
       */
      inStock.sort(
        (a, b) =>
          tierRank(a.tier) - tierRank(b.tier) ||
          rankOf(a.category) - rankOf(b.category) ||
          (a.category || '').localeCompare(b.category || '') ||
          a.title.localeCompare(b.title),
      )

      const kit = inStock.filter((p) => KIT.has(p.category))
      const merch = inStock.filter((p) => !KIT.has(p.category))

      count.textContent = `${kit.length} in stock of ${all.length}`
      if (!inStock.length) {
        say(root, 'Nothing is in stock right now — every card on the shelf says sold out.')
        return
      }
      if (!kit.length) {
        say(root, `Nothing but merchandise in stock — ${merch.length} item(s), none of it beys or gear.`)
        return
      }
      render(root, kit, merch)
    } catch (err) {
      count.textContent = 'stopped'
      say(root, err.message, true)
    }
  }

  run().finally(finish)
})()

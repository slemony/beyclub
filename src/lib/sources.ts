import type { SourceId, SourceMeta } from './types'

const SHEET_DB = '1TBHOpcsv25bBfWERq14CBIy4P1G7j-qpPhmclx_nTWI'
const SHEET_STATS = '18eTJLjyNmqDz5MH0-VD03TX4wobUCdHdrRMyo4uojDo'

const csv = (id: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`

export const ENDPOINTS = {
  /** Blade database: id, name, category, type, tier, buy advice, image, combo. */
  blades: csv(SHEET_DB, '101080139'),
  /** Ratchet / bit catalogue with tier grades. */
  parts: csv(SHEET_DB, '1809991430'),
  /** Aggregated combos with champion rate and win counts. */
  comboStats: csv(SHEET_STATS, '1470857974'),
  /** Per-part tournament totals. */
  partStats: csv(SHEET_STATS, '314440822'),
}

/**
 * Every dataset names who is accountable for its rankings. A user should never
 * see a rating without being able to tell whose judgement it reflects, and
 * whether it came from an opinion or from match results.
 */
export const SOURCES: Record<SourceId, SourceMeta> = {
  community: {
    id: 'community',
    label: 'Community',
    flag: '🇹🇼',
    blurb:
      'Subjective tier ratings maintained by the Taiwanese competitive community, covering every blade, ratchet and bit.',
    credits: [
      { label: 'BeyTier by @stan_yao', url: 'https://stan-yao.github.io/beyblade_x_tier/' },
      { label: 'Ratings by 阿土 / @RENLIgames' },
    ],
    basis: 'opinion',
  },
  tournament: {
    id: 'tournament',
    label: 'Tournament',
    flag: '📊',
    blurb:
      'Ranked by actual results — win counts and championship rate aggregated from thousands of dated tournament placements.',
    credits: [
      {
        label: 'Tournament records aggregated via BeyTier',
        url: 'https://stan-yao.github.io/beyblade_x_tier/',
      },
    ],
    basis: 'results',
  },
  japan: {
    id: 'japan',
    label: 'Japan',
    flag: '🇯🇵',
    blurb:
      'Hand-curated from Japanese community tier lists. Each entry credits the writer it came from — tap a card to see the original article.',
    credits: [
      { label: 'おくろぐ (okuyama3093)', url: 'https://okuyama3093.com/beyblade-tier-strongest/' },
      { label: 'ベイブレ雑記 on note', url: 'https://note.com/bey_bee' },
    ],
    basis: 'opinion',
  },
}

export const SOURCE_ORDER: SourceId[] = ['community', 'tournament', 'japan']

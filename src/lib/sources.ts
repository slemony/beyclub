import type { SourceKey, SourceMeta } from './types'

const SHEET_DB = '1TBHOpcsv25bBfWERq14CBIy4P1G7j-qpPhmclx_nTWI'

const csv = (id: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`

export const ENDPOINTS = {
  /** Blade database: id, name, category, type, tier, buy advice, image, combo. */
  blades: csv(SHEET_DB, '101080139'),
  /** Ratchet / bit / assist catalogue with tier grades. */
  parts: csv(SHEET_DB, '1809991430'),
}

/**
 * The three inputs behind every grade, in the order they carry weight.
 *
 * A reader should never see a rating without being able to tell whose judgement
 * it reflects and whether it came from opinion or from match results — so each
 * of these is reachable from the ranking panel and from every part's breakdown.
 */
export const SOURCES: Record<SourceKey, SourceMeta> = {
  tournament: {
    label: 'Tournament',
    flag: '📊',
    // Deliberately no event or weighting figures here: the panel renders live
    // coverage a few lines below this text, and a hardcoded count would start
    // contradicting it the first Saturday the scraper runs.
    blurb:
      'Placement counts from BBXHub, which aggregates the WBO Winning Combinations thread and the German Blader League. Scored mostly on the all-time record, with recent months weighted more heavily so the list follows the current meta.',
    credits: [
      { label: 'BBXHub', url: 'https://bbxhub.net/' },
      {
        label: 'WBO Winning Combinations at Organized Events',
        url: 'https://worldbeyblade.org/Thread-Winning-Combinations-at-WBO-Organized-Events-Beyblade-X-BBX',
      },
    ],
    basis: 'results',
  },
  community: {
    label: 'Taiwan community',
    flag: '🇹🇼',
    blurb:
      'Subjective tier ratings maintained by the Taiwanese competitive community, covering every blade, ratchet and bit. Also our catalogue: which parts exist, their images and what they ship with.',
    credits: [
      { label: 'BeyTier by @stan_yao', url: 'https://stan-yao.github.io/beyblade_x_tier/' },
      { label: 'Ratings by 阿土 / @RENLIgames' },
    ],
    basis: 'opinion',
  },
  japan: {
    label: 'Japan',
    flag: '🇯🇵',
    blurb:
      'Hand-curated from Japanese community tier lists. Each entry credits the writer it came from — open a blade to read the original article.',
    credits: [
      { label: 'おくろぐ (okuyama3093)', url: 'https://okuyama3093.com/beyblade-tier-strongest/' },
      { label: 'ベイブレ雑記 on note', url: 'https://note.com/bey_bee' },
    ],
    basis: 'opinion',
  },
}

/** Heaviest first, matching how the blend is explained. */
export const SOURCE_ORDER: SourceKey[] = ['tournament', 'community', 'japan']

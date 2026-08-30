/**
 * Per-event entry fees.
 *
 * The authority on what an event costs, mirroring `src/data/fees.ts` on the
 * site. The site's copy is for display; this one is what gets charged, and the
 * client never sends an amount.
 *
 * Paise throughout, like everything else that touches money.
 */

export type FeeVariant = { id: string; label: string; amountPaise: number }

export type EventFee = {
  /** What one payment buys: a head, or a whole crew. */
  unit: 'person' | 'team'
  /** More than one when different people pay differently. */
  variants: FeeVariant[]
}

const one = (unit: EventFee['unit'], rupees: number): EventFee => ({
  unit,
  variants: [{ id: 'standard', label: 'Entry', amountPaise: rupees * 100 }],
})

/**
 * Alfresco 2026, from the informals rulebook. Everything else is still being
 * finalised; an event with no entry here costs nothing to enter.
 */
export const EVENT_FEES: Record<string, EventFee> = {
  'Evening Amore': {
    unit: 'person',
    variants: [
      { id: 'couple', label: 'Couple entry', amountPaise: 25000 },
      { id: 'single-girls', label: 'Single, girls', amountPaise: 15000 },
      { id: 'single-boys', label: 'Single, boys', amountPaise: 18000 },
    ],
  },
  'Capture and Conquer': one('team', 200),
  'Grab O Mania': one('team', 160),
  'Squid Game': one('person', 80),
  Pictionary: one('team', 200),
  'Paper Dance': one('team', 60),
  'Balloon Burst': one('team', 60),
  'Treasure Hunt': one('team', 240),
  'Songstra Vaganza': one('team', 120),
  Tambola: one('person', 60),
  'Musical Chairs': one('person', 40),
  'Soul Sync': one('team', 80),
  'Drape It': one('team', 60),
  'Dumb Charades': one('team', 160),
  'Swift Mingle': {
    unit: 'person',
    variants: [
      { id: 'boys', label: 'Boys', amountPaise: 18000 },
      { id: 'girls', label: 'Girls', amountPaise: 15000 },
    ],
  },
}

export function feeFor(eventName: string): EventFee | null {
  return EVENT_FEES[eventName] ?? null
}

/**
 * The price for one entry, given the variant the entrant picked.
 *
 * Returns null when the variant is not one this event offers, which is the
 * only thing the client could get wrong here: it sends an id, never a number.
 */
export function priceEntry(eventName: string, variantId: string | null): FeeVariant | null {
  const fee = feeFor(eventName)
  if (!fee) return null
  if (fee.variants.length === 1) return fee.variants[0]
  return fee.variants.find((v) => v.id === variantId) ?? null
}

/**
 * Per-event entry fees.
 *
 * Deliberately not printed anywhere on the public page. A visitor meets the
 * number at the point of entering the event, which is the moment it is useful
 * and the moment they can act on it.
 *
 * This is the display copy. `api/src/data/fees.ts` holds the same table in
 * paise and is what actually gets charged; the client only ever sends a
 * variant id, never an amount.
 *
 * Figures and team sizes are from the Alfresco 2026 informals rulebook.
 */

export type FeeVariant = { id: string; label: string; amount: number }

export type EventFee = {
  /** What one payment buys: a head, or a whole crew. */
  unit: 'person' | 'team'
  variants: FeeVariant[]
}

const one = (unit: EventFee['unit'], amount: number): EventFee => ({
  unit,
  variants: [{ id: 'standard', label: 'Entry', amount }],
})

export const EVENT_FEES: Record<string, EventFee> = {
  /* Alfresco */
  'Evening Amore': {
    unit: 'person',
    variants: [
      { id: 'couple', label: 'Couple entry', amount: 250 },
      { id: 'single-girls', label: 'Single, girls', amount: 150 },
      { id: 'single-boys', label: 'Single, boys', amount: 180 },
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
      { id: 'boys', label: 'Boys', amount: 180 },
      { id: 'girls', label: 'Girls', amount: 150 },
    ],
  },
}

/** The fee for one event, or `null` when it costs nothing to enter. */
export function eventFee(name: string): EventFee | null {
  return EVENT_FEES[name] ?? null
}

/** "₹160 per team", or one line per price band. */
export function feeLines(fee: EventFee): string[] {
  if (fee.variants.length === 1) {
    return [`₹${fee.variants[0].amount} per ${fee.unit === 'person' ? 'person' : 'team'}`]
  }
  return fee.variants.map((v) => `${v.label} · ₹${v.amount}`)
}

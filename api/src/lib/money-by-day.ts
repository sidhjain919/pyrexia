/** The admin dashboard's money-by-day table, grouped from paid orders. */

export type MoneyDay = {
  day: string
  payments: number
  basicPaise: number
  festivalPaise: number
  eventsPaise: number
  accommodationPaise: number
  gatewayPaise: number
  totalPaise: number
  onlinePaise: number
  cashPaise: number
  upiPaise: number
}

/**
 * What each IST day collected, by what it paid for and how it came in.
 *
 * The purpose columns and the channel columns each add up to the day's total.
 * The gateway fee is passed on to buyers, so it is money collected like any
 * other and gets its own column rather than vanishing into a product. Kind is
 * read before line items for the same reason as on Latest payments: event and
 * accommodation orders carry no items, and a desk order is any of the four.
 */
export function moneyByDay(
  orders: {
    day: string
    kind: string
    method: string | null
    amount_paise: number
    convenience_paise: number
    event_entry_id: string | null
    accommodation_booking_id: string | null
    items: string | null
  }[],
): MoneyDay[] {
  const days = new Map<string, MoneyDay>()

  for (const o of orders) {
    const d =
      days.get(o.day) ??
      days.set(o.day, {
        day: o.day, payments: 0, basicPaise: 0, festivalPaise: 0, eventsPaise: 0,
        accommodationPaise: 0, gatewayPaise: 0, totalPaise: 0, onlinePaise: 0, cashPaise: 0, upiPaise: 0,
      }).get(o.day)!

    const amount = Number(o.amount_paise) || 0
    const fee = Number(o.convenience_paise) || 0
    const net = amount - fee
    d.payments += 1
    d.totalPaise += amount
    d.gatewayPaise += fee

    if (o.kind === 'accommodation' || o.accommodation_booking_id) d.accommodationPaise += net
    else if (o.kind === 'event' || o.event_entry_id) d.eventsPaise += net
    else {
      // Split by list price. A desk discount comes off both in proportion,
      // and the last share takes the rounding so the day still sums exactly.
      const items = (o.items ?? '').split(',').filter(Boolean).map((s) => {
        const [product, paise] = s.split(':')
        return { product, paise: Number(paise) || 0 }
      })
      const listed = items.reduce((sum, i) => sum + i.paise, 0)
      let left = net
      items.forEach((i, idx) => {
        const share = idx === items.length - 1 || listed === 0 ? left : Math.round((net * i.paise) / listed)
        left -= share
        if (i.product === 'delegate') d.festivalPaise += share
        else d.basicPaise += share
      })
      if (items.length === 0) d.basicPaise += net
    }

    if (o.kind !== 'desk') d.onlinePaise += amount
    else if (o.method === 'cash') d.cashPaise += amount
    else d.upiPaise += amount
  }

  return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
}

-- 2026 pricing, gateway charges, and paid event entries.
--
-- Three changes travel together because they are one decision:
--
--   1. Basic Registration is ₹500 and the Festival Pass add-on is ₹2200.
--   2. Razorpay's cut is passed on to the payer rather than absorbed, so every
--      order carries what we added on top as its own column. It is deliberately
--      not an `order_items` row: line items grant entitlements, and nobody
--      should be entitled to anything for having paid a gateway fee.
--   3. Event entries can now cost money, which means an entry can exist before
--      it is paid for. `event_entries.status` gains 'pending', and orders gain
--      the entry they belong to.

UPDATE products SET amount_paise = 50000  WHERE id = 'basic';
UPDATE products SET amount_paise = 220000 WHERE id = 'delegate';

-- What we charged on top of the line items. `fee_paise`/`tax_paise` already
-- exist and mean the opposite: what Razorpay took out of the settlement.
ALTER TABLE orders ADD COLUMN convenience_paise INTEGER NOT NULL DEFAULT 0;

-- 'registration' buys products; 'event' buys a place in one event.
ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'registration';
ALTER TABLE orders ADD COLUMN event_entry_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_entry ON orders (event_entry_id);

-- SQLite cannot widen a CHECK constraint in place, so the table is rebuilt.
-- Same shape, one more allowed status.
CREATE TABLE event_entries_new (
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  event_name      TEXT NOT NULL,
  territory_code  TEXT NOT NULL,

  participation   TEXT NOT NULL CHECK (participation IN ('solo', 'team')),
  team_name       TEXT,
  answers         TEXT NOT NULL DEFAULT '{}',

  -- What this entry costs and which price band was picked, snapshotted at
  -- entry time so a later change to the rulebook never rewrites history.
  fee_paise       INTEGER NOT NULL DEFAULT 0,
  fee_variant     TEXT,

  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('pending', 'confirmed', 'withdrawn')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO event_entries_new
  (id, registration_id, event_name, territory_code, participation, team_name, answers, status, created_at)
SELECT id, registration_id, event_name, territory_code, participation, team_name, answers, status, created_at
  FROM event_entries;

DROP TABLE event_entries;
ALTER TABLE event_entries_new RENAME TO event_entries;

-- One live entry per person per event. A 'pending' entry does not hold the
-- slot, so an abandoned checkout never locks somebody out of trying again.
CREATE UNIQUE INDEX idx_entry_once ON event_entries (registration_id, event_name)
  WHERE status = 'confirmed';
CREATE INDEX idx_entry_event ON event_entries (event_name);
CREATE INDEX idx_entry_pending ON event_entries (registration_id, event_name)
  WHERE status = 'pending';

-- The Delegate Card is called the Festival Pass from 2026. The product id stays
-- `delegate`: it is the key every entitlement already sold points at, and
-- renaming it would orphan them. Only the name anybody reads changes.
UPDATE products SET name = 'Festival Pass' WHERE id = 'delegate';

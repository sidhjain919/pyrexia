-- A role for the registration desk.
--
-- Somebody on a counter taking cash and UPI needs to create a paid
-- registration and nothing else. Handing that person `finance` would also
-- hand them the payments export, the refund tools and the openings board,
-- which is far more than the job needs and more than most volunteers should
-- be carrying on a shared laptop at a gate.
--
-- `desk_agent` can do exactly one thing: take a registration at the desk.
-- Every one it creates is signed with the collector's email and a payment
-- reference in the audit log, because this is the only path in the system
-- that mints a paid pass without money passing through Razorpay.
--
-- SQLite cannot widen a CHECK constraint in place, so the table is rebuilt.
-- Same shape, one more allowed role.

CREATE TABLE admins_new (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('superadmin', 'core', 'finance', 'verifier',
                               'event_head', 'gate_supervisor', 'desk_agent', 'viewer')),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

INSERT INTO admins_new (id, email, name, role, active, created_at, last_login)
SELECT id, email, name, role, active, created_at, last_login FROM admins;

DROP TABLE admins;
ALTER TABLE admins_new RENAME TO admins;

-- How a desk registration was paid for, and what proves it. Neither is ever
-- read by the gateway: they exist so a treasurer can reconcile a cash box and
-- a UPI statement against the passes that were issued.
ALTER TABLE orders ADD COLUMN collected_by TEXT;
ALTER TABLE orders ADD COLUMN payment_reference TEXT;

-- What the desk gave away. The committee discounts at a counter (a contingent
-- rate, a volunteer, a comp for a guest), so the collector types what was
-- actually taken and this records the difference from the list price.
--
-- Kept as its own column rather than by lowering `order_items.amount_paise`,
-- because an item's price is what the product cost on the day and rewriting
-- it would lose the fact that a discount happened at all. The invariant
-- stays legible: amount_paise = sum(order_items) - discount_paise.
ALTER TABLE orders ADD COLUMN discount_paise INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_orders_desk ON orders (created_at) WHERE kind = 'desk';

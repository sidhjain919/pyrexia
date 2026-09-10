-- Switches for single events, and a ledger for refunds.
--
-- Two changes that both come from the first days of taking entries.
--
--   1. The committee wants to close one bracket without closing its vertical:
--      a badminton category that is full, a quiz whose date moved. A vertical
--      switch is too blunt for that, so each event gets one of its own. No
--      row means open — the vertical's switch is still the master, and an
--      event is open only when both are.
--   2. A refund made on the Razorpay dashboard was invisible here. The webhook
--      handler existed, but a webhook is one delivery over one network and
--      the dashboard only has to miss it once. Refunds now have a table of
--      their own, keyed by Razorpay's id so the same refund seen twice — once
--      by webhook, once by the sweep — is written once, and every order keeps
--      a running total so a partial refund never revokes a pass by mistake.

-- ------------------------------------------------------------------ --
-- 1. Per-event switches
-- ------------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS event_switches (
  event_name  TEXT PRIMARY KEY,
  open        INTEGER NOT NULL DEFAULT 1 CHECK (open IN (0, 1)),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT
);

-- ------------------------------------------------------------------ --
-- 2. Refunds
-- ------------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS refunds (
  id            TEXT PRIMARY KEY,               -- Razorpay's rfnd_…
  order_id      TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  payment_id    TEXT NOT NULL,                  -- Razorpay's pay_…
  amount_paise  INTEGER NOT NULL,
  status        TEXT NOT NULL,                  -- as Razorpay reports it
  -- 'webhook' or 'sweep': which path noticed it first. For the day somebody
  -- asks why the dashboard and the site disagreed.
  seen_via      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds (order_id);

-- What has come back on this order so far. Compared against the fest's share
-- (amount less the gateway charge) to decide when the order is truly undone.
ALTER TABLE orders ADD COLUMN refunded_paise INTEGER NOT NULL DEFAULT 0;

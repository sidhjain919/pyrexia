-- Accommodation, booked and paid for on the site.
--
-- Until now a bed was arranged by phoning a coordinator, which is why the
-- brochure prints six numbers. This table is that conversation, written down:
-- one row per person per stay, priced server-side, confirmed by the same
-- Razorpay webhook that confirms everything else.
--
-- Shaped after `event_entries` on purpose. A booking is written `pending`, an
-- order is attached to it, and the webhook is what turns it into a bed. That
-- is what makes a browser dying mid-payment survivable: the reconciliation
-- sweep finds the captured payment and settles the booking a few minutes
-- later, exactly as it does for a paid event entry.
--
-- Money is integer paise throughout. The ₹500 security deposit is deliberately
-- absent: it is cash, collected at the desk on arrival and refunded at
-- check-out, and has never been ours to take online.

-- The desk reads this off a phone at check-in, so it is short, unambiguous
-- read aloud, and not a credential: it identifies a booking, it never proves
-- anything. Same reasoning, and the same vowel-less alphabet, as `public_code`
-- on a registration.
CREATE TABLE accommodation_bookings (
  id                TEXT PRIMARY KEY,
  public_code       TEXT NOT NULL UNIQUE,
  registration_id   TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,

  -- Which block, which room, and for how long. `gender` decides what sharing
  -- options were on offer at all: boys' rooms go up to five to a room, girls'
  -- rooms stop at four, and a room is never mixed.
  gender            TEXT NOT NULL CHECK (gender IN ('boys', 'girls')),
  sharing           INTEGER NOT NULL CHECK (sharing BETWEEN 2 AND 5),
  ac                INTEGER NOT NULL CHECK (ac IN (0, 1)),
  days              INTEGER NOT NULL CHECK (days BETWEEN 1 AND 5),

  -- Stored rather than derived from `days`, because four days can mean
  -- arriving on the 13th or leaving on the 15th, and the desk staffs check-in
  -- by shift. Time is free text and optional: an honest "late evening" is
  -- worth more than a precise number somebody invented.
  arrival_date      TEXT NOT NULL,
  arrival_time      TEXT,

  -- Snapshotted from the registration at booking time, and editable on the
  -- form, because the number somebody actually carries at a fest is often not
  -- the one they registered with. What is written here is what the desk calls.
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,
  college           TEXT NOT NULL,
  course            TEXT NOT NULL,

  -- Ground floor, a medical condition, anything the team should know before
  -- allocating. Free text on purpose.
  requirements      TEXT,

  -- Explicit and logged, because the terms behind them have teeth: no refund
  -- on cancellation, and damage is chargeable against the deposit.
  rules_accepted    INTEGER NOT NULL DEFAULT 0 CHECK (rules_accepted IN (0, 1)),
  -- The stay is off campus with a hospitality partner, so these details leave
  -- our hands. Consent to that is its own question, asked separately.
  partner_consent   INTEGER NOT NULL DEFAULT 0 CHECK (partner_consent IN (0, 1)),

  -- What this stay cost and what it was priced from, snapshotted so a later
  -- change to the rate card never rewrites what somebody was charged.
  -- `rate_paise` is per person per day; `fee_paise` is rate × days.
  rate_paise        INTEGER NOT NULL,
  fee_paise         INTEGER NOT NULL,

  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One bed per person. A `pending` booking holds nothing, so an abandoned
-- checkout never locks somebody out of trying again with a different room.
CREATE UNIQUE INDEX idx_acc_once ON accommodation_bookings (registration_id)
  WHERE status = 'confirmed';
CREATE INDEX idx_acc_reg     ON accommodation_bookings (registration_id);
CREATE INDEX idx_acc_status  ON accommodation_bookings (status);
-- Drives the allocation view: everybody confirmed, grouped by the room they
-- are owed.
CREATE INDEX idx_acc_room    ON accommodation_bookings (gender, sharing, ac)
  WHERE status = 'confirmed';

-- `kind` becomes 'accommodation' for these, alongside 'registration' and
-- 'event'. No CHECK to widen: `orders.kind` was added as a plain defaulted
-- column and has never constrained its values.
ALTER TABLE orders ADD COLUMN accommodation_booking_id TEXT;

CREATE INDEX idx_orders_accommodation ON orders (accommodation_booking_id)
  WHERE accommodation_booking_id IS NOT NULL;

-- The kill switch. Not a capacity model: nothing here counts beds or refuses
-- the n+1th booking, because the number of beds is a thing the accommodation
-- team negotiates with partners week to week and has never been a number this
-- database could know. It is one row the committee flips from the dashboard
-- when they have run out, so closing bookings does not require a deploy.
CREATE TABLE accommodation_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  open        INTEGER NOT NULL DEFAULT 0 CHECK (open IN (0, 1)),
  -- Shown on the site when closed, so "no beds left" and "not open yet" can
  -- be told apart by somebody reading the page at midnight.
  note        TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT
);

-- Closed until the committee opens it, like every other form on the site.
INSERT INTO accommodation_settings (id, open) VALUES (1, 0);

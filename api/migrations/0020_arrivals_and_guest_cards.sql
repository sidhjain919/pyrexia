-- Two additions for the fest days themselves.
--
-- 1. Arrivals. A registered delegate shows the pass QR from their email at the
--    entry desk and is marked as arrived, once. The committee watches the list
--    fill in a Google Sheet (`__arrivals`, via the event-sheet machinery).
--    One row per person: arriving is a fact about them, not about a day, and a
--    second scan is answered with when and where they were first checked in.
CREATE TABLE arrivals (
  registration_id TEXT PRIMARY KEY REFERENCES registrations (id) ON DELETE CASCADE,
  checked_in_at   TEXT NOT NULL DEFAULT (datetime('now')),
  -- A supervisor's email, or a desk device's `desk:<name>`, as everywhere else.
  checked_in_by   TEXT NOT NULL
);

CREATE INDEX idx_arrivals_at ON arrivals (checked_in_at);

-- 2. Guest cards. Friends and family of the committee who never register are
--    handed a printed card at the gate, and a supervisor activates its sticker
--    for them by name. Such a sticker is active with no registration behind it,
--    which the original CHECK forbade, and SQLite cannot change a CHECK in
--    place: the table is rebuilt.
--
--    `defer_foreign_keys` is the D1-documented way to do this: `sticker_scans`
--    references `stickers`, and dropping the old table would otherwise trip
--    that reference for every scan already recorded. The new table takes the
--    old one's name before the transaction commits, so every reference is
--    whole again by then.
PRAGMA defer_foreign_keys = on;

CREATE TABLE stickers_new (
  code            TEXT PRIMARY KEY,
  serial          INTEGER NOT NULL UNIQUE,
  batch           TEXT NOT NULL,

  status          TEXT NOT NULL DEFAULT 'stock'
                    CHECK (status IN ('stock', 'active', 'void')),
  registration_id TEXT REFERENCES registrations (id),
  activated_at    TEXT,
  activated_by    TEXT,
  voided_at       TEXT,
  voided_by       TEXT,
  void_reason     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  -- Who a guest card was given to. Written by a supervisor, never by a desk
  -- device, and shown to the guard at the gate in place of a delegate's name.
  guest_name      TEXT,
  guest_phone     TEXT,
  -- Whose guest, or anything else worth knowing later ("Dean's family").
  guest_note      TEXT,

  -- An active sticker belongs to somebody: a registration or a named guest.
  CHECK (status <> 'active' OR registration_id IS NOT NULL OR guest_name IS NOT NULL),
  -- Never both.
  CHECK (registration_id IS NULL OR guest_name IS NULL)
);

INSERT INTO stickers_new
  (code, serial, batch, status, registration_id, activated_at, activated_by,
   voided_at, voided_by, void_reason, created_at)
SELECT code, serial, batch, status, registration_id, activated_at, activated_by,
       voided_at, voided_by, void_reason, created_at
  FROM stickers;

DROP TABLE stickers;
ALTER TABLE stickers_new RENAME TO stickers;

CREATE UNIQUE INDEX idx_sticker_holder ON stickers (registration_id) WHERE status = 'active';
CREATE INDEX idx_sticker_batch ON stickers (batch, serial);

PRAGMA defer_foreign_keys = off;

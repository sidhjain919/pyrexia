-- Star Night stickers.
--
-- A printed QR stuck on the physical Festival Pass at the desk, and scanned by
-- a guard at the concert gate. Separate from the online pass QR on purpose:
-- that one lives on a phone and can be screenshotted and passed along; this
-- one is on a card that is in somebody's hand.
--
-- The codes are printed in bulk before anyone is known, so a sticker starts as
-- `stock` and means nothing. Stuck on a pass and linked to a registration at
-- the desk, it becomes `active`. A stolen roll of stock is worthless, and a
-- sticker on a lost pass is `void` and stays that way.

CREATE TABLE stickers (
  -- The 10 random characters printed on the sticker, without the `PX-` prefix.
  -- Crockford base32, 50 bits: not guessable even knowing every other code.
  code            TEXT PRIMARY KEY,
  -- Printed under the code. Sequential and not secret: it only exists so a
  -- lost sheet can be voided by range and a box of stock can be counted.
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

  -- Only Festival Pass holders get a sticker, so an active one always has
  -- somebody behind it. There are no anonymous comps.
  CHECK (status <> 'active' OR registration_id IS NOT NULL)
);

-- One live sticker per person. Replacing a lost pass voids the old one first.
CREATE UNIQUE INDEX idx_sticker_holder ON stickers (registration_id) WHERE status = 'active';
CREATE INDEX idx_sticker_batch ON stickers (batch, serial);

-- Every scan at a Star Night gate, admitted or not. The refused ones are kept
-- because they are where a copied sticker shows up.
CREATE TABLE sticker_scans (
  id                TEXT PRIMARY KEY,
  -- Null when what was scanned is not one of our stickers at all.
  sticker_code      TEXT REFERENCES stickers (code),
  -- The fest night this scan belongs to: the IST date, with the day turning
  -- over at 06:00, so a 00:30 scan counts toward the concert it is part of.
  -- Decided by the server, never by the phone's clock.
  night             TEXT NOT NULL,
  result            TEXT NOT NULL
                      CHECK (result IN ('ok', 'duplicate', 'not_active', 'void',
                                        'no_festival_pass', 'unknown')),
  gate_id           TEXT REFERENCES gates (id),
  guard_id          TEXT REFERENCES guards (id),
  client_scanned_at TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- No re-entry: one admitted scan per sticker per night. This index *is* the
-- rule, so two gates scanning the same sticker at the same instant cannot
-- both win. A new night is a new key, which is all the "reset" there is.
CREATE UNIQUE INDEX idx_sticker_once ON sticker_scans (sticker_code, night) WHERE result = 'ok';
CREATE INDEX idx_sticker_scan_night ON sticker_scans (night, gate_id);

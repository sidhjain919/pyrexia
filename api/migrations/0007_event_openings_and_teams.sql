-- Opening event entry, and taking a team's details without an invite dance.
--
-- Three changes travel together because they are the same decision: the 2026
-- rulebooks are final, so entries can open — and once they open, three things
-- that used to be hypothetical become real.
--
--   1. Which verticals are taking entries stops being a constant in a file and
--      becomes a row the committee flips from the dashboard. Waiting on a
--      deploy to open a form at 9pm the night before is not a plan.
--   2. A team enters once, named by whoever registered it. There is no
--      invitation, no token, no half-built squad: the captain lists their crew
--      and pays, and the desk has the names. `team_members` stays for history;
--      new entries carry their squad as JSON on the entry itself.
--   3. Several events run more than one bracket — Badminton singles *and*
--      doubles, Chess rapid *and* blitz, Basketball 5v5 *and* 3v3. One entry
--      per person per event was right when every event had one price; it is
--      wrong now, so the uniqueness moves to (person, event, band).

-- ------------------------------------------------------------------ --
-- 1. Which verticals are open
-- ------------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS event_openings (
  territory_id TEXT PRIMARY KEY,
  open         INTEGER NOT NULL DEFAULT 0 CHECK (open IN (0, 1)),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by   TEXT
);

-- Every vertical whose 2026 rulebook is final, opened together. The two that
-- are not here (fahrenheit, auriga) are not competitions to enter.
INSERT OR IGNORE INTO event_openings (territory_id, open, updated_by) VALUES
  ('alfresco',    1, 'migration:0007'),
  ('chronos',     1, 'migration:0007'),
  ('kalakriti',   1, 'migration:0007'),
  ('littmania',   1, 'migration:0007'),
  ('sinfonia',    1, 'migration:0007'),
  ('chorea',      1, 'migration:0007'),
  ('thespians',   1, 'migration:0007'),
  ('velocity',    1, 'migration:0007'),
  ('thunderbolt', 1, 'migration:0007');

-- ------------------------------------------------------------------ --
-- 2. The squad, on the entry
-- ------------------------------------------------------------------ --

-- JSON array of { name, phone }. Empty for a solo entry. Held here rather than
-- in `team_members` because these people are not accounts: they are names the
-- captain gave for the desk to check against, which is what the rulebooks ask
-- for and all they ask for.
ALTER TABLE event_entries ADD COLUMN members TEXT NOT NULL DEFAULT '[]';

-- How many people this entry covers, captain included. Snapshotted because
-- three dance events price a group per head, and the receipt has to keep
-- meaning what it meant on the day.
ALTER TABLE event_entries ADD COLUMN head_count INTEGER NOT NULL DEFAULT 1;

-- ------------------------------------------------------------------ --
-- 3. One entry per band, not one per event
-- ------------------------------------------------------------------ --

DROP INDEX IF EXISTS idx_entry_once;

CREATE UNIQUE INDEX idx_entry_once
  ON event_entries (registration_id, event_name, COALESCE(fee_variant, 'standard'))
  WHERE status = 'confirmed';

-- One Google Sheet per event, kept in step with the database.
--
-- The sheets are made, and written, by an Apps Script running as the Google
-- account that owns them (see scripts/event-sheets.mjs). The Worker asks that
-- script which sheet is which event's and remembers the answer here.
--
-- The database stays the master copy. A sheet is rewritten from it whenever
-- that event's entries change, so a refund or a withdrawal takes the row away
-- again. `content_hash` is what was last written: a rewrite that would change
-- nothing is skipped.

CREATE TABLE IF NOT EXISTS event_sheets (
  event_name      TEXT PRIMARY KEY,
  spreadsheet_id  TEXT NOT NULL,
  -- Hash of the rows last written, or NULL when nothing has been written yet.
  content_hash    TEXT,
  synced_at       TEXT,
  last_error      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

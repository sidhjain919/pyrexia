-- Bounces and complaints.
--
-- Amazon asks every new sender how they handle these before letting them out
-- of the sandbox, and the question is a fair one: repeatedly emailing an
-- address that does not exist is the single fastest way to ruin a sending
-- reputation, and one ruined reputation affects every student waiting on a
-- pass.
--
-- Two tables rather than one. `email_events` is the raw history and never
-- deletes; `email_suppressions` is the short answer to "may we send to this
-- address", which is the only question the sending path needs to ask.

CREATE TABLE IF NOT EXISTS email_suppressions (
  -- Lowercased, because a bounce for Aarav@example.com must also stop mail to
  -- aarav@example.com. It is the same mailbox.
  email       TEXT PRIMARY KEY,
  reason      TEXT NOT NULL CHECK (reason IN ('bounce', 'complaint', 'manual')),
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_events (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  event       TEXT NOT NULL,
  -- 'Permanent' or 'Transient' for a bounce. A full mailbox is transient and
  -- clears on its own; a non-existent address never will, and only the second
  -- kind justifies refusing to send again.
  subtype     TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events (email);
CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events (created_at DESC);

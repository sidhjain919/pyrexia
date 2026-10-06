-- Mail the provider account refused to send.
--
-- On 2 Oct 2026 the ZeptoMail credits ran out. Every confirmation, pass and
-- event email for the next two days came back as a 4xx, was treated as a
-- permanent failure, and was dropped; 211 of them had to be found and resent
-- by hand. An account-level refusal (no credits, blocked, bad key) now parks
-- the job here, and the 15-minute cron re-queues it, so a top-up is the whole
-- fix next time.
--
-- `id` is a hash of the job, so the same email held twice is one row.

CREATE TABLE mail_held (
  id          TEXT PRIMARY KEY,
  job         TEXT NOT NULL,
  last_error  TEXT,
  attempts    INTEGER NOT NULL DEFAULT 1,
  held_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mail_held_at ON mail_held (held_at);

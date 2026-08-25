-- The confirmation email's link is told to be kept, so it cannot be a
-- 30-minute single-use token like a password reset. `pass_link` is long-lived
-- and reusable; SQLite can't alter a CHECK constraint in place, so the table
-- is rebuilt.

CREATE TABLE login_tokens_new (
  token_hash      TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  purpose         TEXT NOT NULL DEFAULT 'magic_link'
                    CHECK (purpose IN ('magic_link', 'otp', 'pass_link')),
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO login_tokens_new SELECT * FROM login_tokens;
DROP TABLE login_tokens;
ALTER TABLE login_tokens_new RENAME TO login_tokens;

CREATE INDEX idx_login_expiry ON login_tokens (expires_at);

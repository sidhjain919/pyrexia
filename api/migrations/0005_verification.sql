-- Proving an email address belongs to the person typing it.
--
-- Until now an account existed the moment someone typed an address, verified
-- or not. That is a problem beyond looking unserious: the entry pass is
-- delivered by email, so a typo means a student pays ₹450 and never receives
-- the thing they paid for — and we have no way to tell that from a person who
-- simply hasn't checked their inbox.
--
-- Two routes to a verified address. A six-digit code for people who sign up
-- with a password, and Google, which has already done the work for us.

-- Google accounts are keyed by `sub`, not by email. Google's own documentation
-- is explicit that an address can change hands between accounts, whereas `sub`
-- is permanent and unique. Matching on email alone would eventually hand one
-- person another person's registration.
ALTER TABLE registrations ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_google_sub ON registrations (google_sub)
  WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_otps (
  id             TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  -- Hashed, never stored in the clear. A code is a password with a short life,
  -- and a leaked database should not hand over live codes.
  code_hash      TEXT NOT NULL,
  purpose        TEXT NOT NULL DEFAULT 'verify_email',
  -- Counted so that guessing a six-digit code is not merely slow but bounded.
  attempts       INTEGER NOT NULL DEFAULT 0,
  expires_at     TEXT NOT NULL,
  consumed_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_registration
  ON email_otps (registration_id, purpose, consumed_at);
CREATE INDEX IF NOT EXISTS idx_otp_expiry ON email_otps (expires_at);

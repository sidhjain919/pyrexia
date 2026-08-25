-- PYREXIA 2026 — initial schema
--
-- Money is stored as integer paise, never a float. ₹450 is 45000.
-- Ids are lowercase uuid v4 strings unless noted.
--
-- The central design choice: a registration records a *person*, and what they
-- have bought lives in `entitlements` — one row per purchase. Tier is derived,
-- never stored on the person, so the Delegate upgrade is an INSERT and a refund
-- is a revoke rather than an unpick.

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------ --
-- People
-- ------------------------------------------------------------------ --

CREATE TABLE registrations (
  id                TEXT PRIMARY KEY,
  -- Display-only, printed on the pass and quoted on the phone. Never an
  -- authentication token: knowing it must not let anyone act as this person.
  public_code       TEXT NOT NULL UNIQUE,

  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,          -- 10 digits, no country code
  gender            TEXT,
  college           TEXT NOT NULL,
  city              TEXT NOT NULL,
  course            TEXT NOT NULL,
  year              TEXT NOT NULL,
  emergency_name    TEXT NOT NULL,
  emergency_phone   TEXT NOT NULL,

  -- 'pending'   — form submitted, no successful payment yet
  -- 'confirmed' — at least one entitlement is live
  -- 'cancelled' — refunded or withdrawn; all entitlements revoked
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  -- Document check, handled by the verifier role in admin.
  verification      TEXT NOT NULL DEFAULT 'unsubmitted'
                      CHECK (verification IN ('unsubmitted', 'pending', 'approved', 'rejected')),
  verification_note TEXT,
  verified_by       TEXT,
  verified_at       TEXT,

  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One confirmed registration per human. Partial indexes let an abandoned
-- pending attempt sit alongside a real one without blocking a retry.
CREATE UNIQUE INDEX idx_reg_email_confirmed ON registrations (lower(email))
  WHERE status = 'confirmed';
CREATE UNIQUE INDEX idx_reg_phone_confirmed ON registrations (phone)
  WHERE status = 'confirmed';

CREATE INDEX idx_reg_status       ON registrations (status);
CREATE INDEX idx_reg_verification ON registrations (verification) WHERE verification = 'pending';
CREATE INDEX idx_reg_created      ON registrations (created_at);

-- ------------------------------------------------------------------ --
-- Money
-- ------------------------------------------------------------------ --

-- The catalogue. Prices live in the database, not in client code — the server
-- must never be told an amount by a browser.
CREATE TABLE products (
  id            TEXT PRIMARY KEY,           -- 'basic' | 'delegate'
  name          TEXT NOT NULL,
  amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0),
  -- 'basic' must be held before this product can be bought.
  requires      TEXT REFERENCES products (id),
  active        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO products (id, name, amount_paise, requires, sort_order) VALUES
  ('basic',    'Basic Registration', 45000,  NULL,    1),
  ('delegate', 'Delegate Card',      225000, 'basic', 2);

-- One row per payment attempt. A first-time Delegate buys two products in a
-- single payment, so the line items live in `order_items` and this row carries
-- only the total actually charged.
CREATE TABLE orders (
  id                   TEXT PRIMARY KEY,
  registration_id      TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,

  amount_paise         INTEGER NOT NULL,    -- sum of order_items, computed server-side
  currency             TEXT NOT NULL DEFAULT 'INR',

  razorpay_order_id    TEXT UNIQUE,
  -- The constraint that makes webhook retries harmless: the same payment can
  -- never be recorded twice, so it can never be credited twice.
  razorpay_payment_id  TEXT UNIQUE,
  razorpay_signature   TEXT,
  method               TEXT,                -- upi | card | netbanking | wallet

  status               TEXT NOT NULL DEFAULT 'created'
                         CHECK (status IN ('created', 'paid', 'failed', 'refunded', 'expired')),

  -- What Razorpay actually kept. Populated from the webhook, not assumed —
  -- this is how we learn our real effective rate.
  fee_paise            INTEGER,
  tax_paise            INTEGER,

  webhook_payload      TEXT,                -- raw JSON, for disputes
  failure_reason       TEXT,

  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at              TEXT,
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products (id),
  -- Snapshotted from products at order time, so a later price change never
  -- rewrites what somebody was actually charged.
  amount_paise INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_item_once ON order_items (order_id, product_id);
CREATE INDEX idx_item_order       ON order_items (order_id);

CREATE INDEX idx_orders_reg     ON orders (registration_id);
CREATE INDEX idx_orders_status  ON orders (status);
-- Drives the reconciliation cron: anything created but unresolved.
CREATE INDEX idx_orders_pending ON orders (created_at) WHERE status = 'created';

-- What a person owns. An upgrade is an INSERT here, never an UPDATE elsewhere.
CREATE TABLE entitlements (
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products (id),
  order_id        TEXT NOT NULL REFERENCES orders (id),

  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,
  revoked_reason  TEXT,
  revoked_by      TEXT
);

-- Nobody buys the same product twice.
CREATE UNIQUE INDEX idx_ent_unique ON entitlements (registration_id, product_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_ent_reg ON entitlements (registration_id);

-- Tier, derived rather than stored. 1 = Delegate, 0 = Basic.
CREATE VIEW registration_tier AS
  SELECT r.id AS registration_id,
         CASE WHEN EXISTS (
           SELECT 1 FROM entitlements e
            WHERE e.registration_id = r.id
              AND e.product_id = 'delegate'
              AND e.revoked_at IS NULL
         ) THEN 1 ELSE 0 END AS tier
    FROM registrations r;

-- ------------------------------------------------------------------ --
-- Passes
-- ------------------------------------------------------------------ --

CREATE TABLE passes (
  -- 16 random bytes as 32 hex chars. Random, never sequential, never guessable.
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,

  -- The tier baked into the signed QR at issue. The gate takes the greater of
  -- this and the current tier from the synced manifest, so buying the Delegate
  -- Card later never invalidates an already-printed pass.
  tier_floor      INTEGER NOT NULL DEFAULT 0,
  key_id          INTEGER NOT NULL,         -- which signing key; supports rotation
  issued_at       TEXT NOT NULL DEFAULT (datetime('now')),

  revoked_at      TEXT,
  revoked_reason  TEXT,
  revoked_by      TEXT
);

CREATE UNIQUE INDEX idx_pass_reg ON passes (registration_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_pass_revoked    ON passes (revoked_at) WHERE revoked_at IS NOT NULL;

-- ------------------------------------------------------------------ --
-- Gates and scanning
-- ------------------------------------------------------------------ --

CREATE TABLE gates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  -- JSON array of tiers admitted here. Star Night gates carry [1] only, which
  -- is what turns a Basic scan into an upgrade prompt instead of a shrug.
  allowed_tiers TEXT NOT NULL DEFAULT '[0,1]',
  -- 0 = one entry per day; 1 = re-entry allowed all day.
  allow_reentry INTEGER NOT NULL DEFAULT 0,
  active_from   TEXT,
  active_to     TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE guards (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  phone              TEXT,
  -- Stored hashed, exactly like a password. A database leak must not hand
  -- anyone a working scanner.
  device_token_hash  TEXT NOT NULL,
  pin_hash           TEXT NOT NULL,
  gate_id            TEXT REFERENCES gates (id),
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at       TEXT
);

CREATE TABLE scans (
  id                TEXT PRIMARY KEY,
  pass_id           TEXT REFERENCES passes (id),
  gate_id           TEXT NOT NULL REFERENCES gates (id),
  guard_id          TEXT REFERENCES guards (id),
  device_id         TEXT,

  result            TEXT NOT NULL
                      CHECK (result IN ('ok', 'duplicate', 'wrong_tier',
                                        'revoked', 'invalid_signature', 'unknown_pass')),
  tier_at_scan      INTEGER,

  -- The device's own clock, kept separately from ours: scans queue offline and
  -- sync later, and we need to know when it actually happened at the gate.
  client_scanned_at TEXT NOT NULL,
  synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
  -- Local date at the gate, for the one-entry-per-day rule.
  scan_day          TEXT NOT NULL
);

-- The duplicate-entry catcher. Only successful entries occupy a slot, so a
-- rejected scan never locks someone out of a legitimate retry.
CREATE UNIQUE INDEX idx_scan_once ON scans (pass_id, gate_id, scan_day)
  WHERE result = 'ok';
CREATE INDEX idx_scan_pass ON scans (pass_id);
CREATE INDEX idx_scan_gate ON scans (gate_id, scan_day);
CREATE INDEX idx_scan_time ON scans (synced_at);

-- ------------------------------------------------------------------ --
-- Identity documents
-- ------------------------------------------------------------------ --

-- Only a reference is stored here; the bytes live in a private R2 bucket,
-- encrypted, reachable solely through short-lived signed URLs minted for the
-- verifier role. Every view writes an audit row, and `purge_after` drives the
-- cron that deletes the object once the fest is over.
CREATE TABLE documents (
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('aadhaar', 'student_id', 'photo')),

  r2_key          TEXT NOT NULL,
  filename        TEXT,
  mime            TEXT,
  size_bytes      INTEGER,
  sha256          TEXT,

  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  purge_after     TEXT NOT NULL,
  purged_at       TEXT
);

CREATE UNIQUE INDEX idx_doc_one_per_kind ON documents (registration_id, kind)
  WHERE purged_at IS NULL;
CREATE INDEX idx_doc_purge ON documents (purge_after) WHERE purged_at IS NULL;

-- ------------------------------------------------------------------ --
-- Events
-- ------------------------------------------------------------------ --

CREATE TABLE event_entries (
  id              TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  event_name      TEXT NOT NULL,
  territory_code  TEXT NOT NULL,

  participation   TEXT NOT NULL CHECK (participation IN ('solo', 'team')),
  team_name       TEXT,
  answers         TEXT NOT NULL DEFAULT '{}',   -- JSON, the per-event questions

  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'withdrawn')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_entry_once ON event_entries (registration_id, event_name)
  WHERE status = 'confirmed';
CREATE INDEX idx_entry_event ON event_entries (event_name);

-- Team-mates are registrations in their own right — everyone needs their own
-- Basic Registration, so a member is a link, not a copy of someone's details.
CREATE TABLE team_members (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL REFERENCES event_entries (id) ON DELETE CASCADE,
  registration_id TEXT REFERENCES registrations (id),

  -- Held until they accept, so a captain can build the team before everyone
  -- has finished registering.
  invited_email   TEXT,
  invited_phone   TEXT,
  invite_token    TEXT UNIQUE,
  state           TEXT NOT NULL DEFAULT 'invited'
                    CHECK (state IN ('invited', 'accepted', 'declined', 'removed')),

  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at    TEXT
);

CREATE UNIQUE INDEX idx_member_once ON team_members (entry_id, registration_id)
  WHERE state = 'accepted';
CREATE INDEX idx_member_entry ON team_members (entry_id);

-- ------------------------------------------------------------------ --
-- Noticeboard
-- ------------------------------------------------------------------ --

CREATE TABLE notices (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'announcement'
                CHECK (category IN ('announcement', 'schedule', 'result', 'urgent')),
  pinned      INTEGER NOT NULL DEFAULT 0,
  attachments TEXT NOT NULL DEFAULT '[]',    -- JSON array of R2 keys

  publish_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT,
  published   INTEGER NOT NULL DEFAULT 0,

  author_id   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notice_live ON notices (publish_at DESC) WHERE published = 1;

-- ------------------------------------------------------------------ --
-- Sessions, admins, audit
-- ------------------------------------------------------------------ --

-- Passwordless sign-in. Single-use, short-lived, and stored hashed so a
-- database leak cannot be replayed into someone's account.
CREATE TABLE login_tokens (
  token_hash      TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  purpose         TEXT NOT NULL DEFAULT 'magic_link'
                    CHECK (purpose IN ('magic_link', 'otp')),
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_login_expiry ON login_tokens (expires_at);

CREATE TABLE sessions (
  token_hash      TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT NOT NULL,
  last_seen_at    TEXT,
  user_agent      TEXT,
  revoked_at      TEXT
);

CREATE INDEX idx_session_reg ON sessions (registration_id);

CREATE TABLE admins (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,          -- Google sign-in, allowlisted
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('superadmin', 'core', 'finance',
                               'verifier', 'event_head', 'gate_supervisor', 'viewer')),
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

-- Append-only. Nothing in the application ever updates or deletes from here.
CREATE TABLE audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  actor_email TEXT,
  action      TEXT NOT NULL,                -- 'pass.revoke', 'document.view', …
  entity      TEXT,
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  ip          TEXT,
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_at     ON audit_log (at DESC);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);
CREATE INDEX idx_audit_actor  ON audit_log (actor_id);

-- Makes a double-tapped submit return the first result instead of charging
-- someone twice. The stored response is replayed verbatim.
CREATE TABLE idempotency_keys (
  key           TEXT PRIMARY KEY,
  endpoint      TEXT NOT NULL,
  request_hash  TEXT NOT NULL,
  response_json TEXT,
  status_code   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_idem_created ON idempotency_keys (created_at);

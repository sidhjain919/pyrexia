-- Accounts before purchase.
--
-- The architecture changed: an account now exists *before* anyone pays, so
-- someone can sign in, be told they haven't completed Basic Registration, and
-- be sent to do it. Previously a person who hadn't paid didn't exist at all,
-- which made "please sign in" impossible to act on.
--
-- Rather than split into accounts + registrations — a rebuild that every
-- foreign key in the schema points at — a registration row is now created at
-- sign-up with its detail columns empty, and filled in when the pass is
-- bought. `status` reads:
--
--   pending    account exists; no confirmed payment yet
--   confirmed  holds at least one live entitlement
--   cancelled  refunded or withdrawn

ALTER TABLE registrations ADD COLUMN password_hash TEXT;
ALTER TABLE registrations ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- Email is the login now, so it has to be unique across every row rather than
-- only among confirmed ones. An abandoned attempt must not let the same person
-- create a second account with the same address.
DROP INDEX IF EXISTS idx_reg_email_confirmed;
CREATE UNIQUE INDEX idx_reg_email ON registrations (lower(email));

-- Phone stays scoped to confirmed rows: it is empty until someone buys, and a
-- table full of empty strings would collide instantly on a global index.

-- Clear every registration and everything hanging off one.
--
-- Run before opening real registration, to drop the test data created while
-- Razorpay was on test keys. Confirmed safe on 1 Sep 2026: the four paid
-- orders in the database were all created 25-26 Aug, and live credentials did
-- not land until 29 Aug, so no real money is represented here.
--
-- Take an export first. This is not reversible:
--   wrangler d1 export pyrexia --remote --output backup.sql
--
-- The encrypted document objects in R2 are NOT removed by this file; delete
-- those separately or they are orphaned in the bucket forever.
--
-- What deliberately survives: products (the price list the checkout reads),
-- admins, gates and guards (the gate provisioning), and notices (the crew's
-- own board). Deleting those would take the site down rather than reset it.
--
-- Children before parents, so the foreign keys hold at every step.

DELETE FROM scans;
DELETE FROM team_members;
DELETE FROM event_entries;
DELETE FROM passes;
DELETE FROM entitlements;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM documents;
DELETE FROM login_tokens;
DELETE FROM email_otps;
DELETE FROM email_events;
DELETE FROM sessions;
DELETE FROM idempotency_keys;
DELETE FROM audit_log;
DELETE FROM email_suppressions;
DELETE FROM registrations;

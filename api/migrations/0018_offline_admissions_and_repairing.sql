-- Two things the first night's design got wrong or left out.
--
-- 1. A gate phone with no signal admits from its own list and sends the scan
--    later. If the same sticker was used elsewhere in the meantime (a copy),
--    the server books the late scan as a duplicate, which read as "refused"
--    on every screen although the person was let in. The phone's own verdict
--    is now kept beside the server's, so "let in twice" can be told apart
--    from "turned away".
ALTER TABLE sticker_scans ADD COLUMN admitted_offline INTEGER NOT NULL DEFAULT 0;

-- 2. A guard whose phone loses its pairing (cleared browser, another browser,
--    a new phone) is re-paired from the supervisor's screen with a fresh link
--    sent over WhatsApp, keeping the same guard, gate and tonight's count.
--    A re-pair code needs its own clock: `created_at` is when the guard was
--    first added, perhaps days ago. Null means a code issued before this
--    column existed, which keeps the old rule of 15 minutes from creation.
ALTER TABLE guards ADD COLUMN pair_expires_at TEXT;

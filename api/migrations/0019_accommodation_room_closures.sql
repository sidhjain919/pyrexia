-- Closing one kind of room without closing the rest.
--
-- The global switch in `accommodation_settings` answers "are we taking
-- bookings at all". During the fest the accommodation team runs out of rooms
-- one size at a time ("2 seaters are gone, 4 seater non-AC too") and needs to
-- stop selling exactly those while the others stay on sale.
--
-- A row here means that room type is closed. No row means open, so a room type
-- added to the rate card later goes on sale with the rest instead of arriving
-- shut and unnoticed. `room_type_id` is the id from `api/src/data/
-- accommodation.ts` (`boys-2-ac`), not constrained here because the rate card
-- lives in code.
CREATE TABLE accommodation_room_closures (
  room_type_id  TEXT PRIMARY KEY,
  closed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  closed_by     TEXT
);

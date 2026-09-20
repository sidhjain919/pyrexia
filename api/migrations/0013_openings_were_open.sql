-- Tell "not open yet" apart from "closed now".
--
-- `event_openings.open` is a single boolean, and it has been carrying two
-- quite different meanings depending on when you read it. Before a vertical
-- opens, closed means "we have not started taking entries": the card says
-- Coming Soon and that is true. After the committee shuts it, closed means
-- "entries are over", and Coming Soon is then a small lie that invites
-- somebody to keep checking back for a form that is never returning.
--
-- One column fixes it. `was_open` latches the first time a vertical is opened
-- and is never cleared, so the two states are distinguishable forever after.
--
-- Only verticals need this. An event has no switch row until somebody closes
-- it by hand, which means every event under an open vertical is open by
-- default; nothing under a vertical can therefore have been open before the
-- vertical itself was.

ALTER TABLE event_openings ADD COLUMN was_open INTEGER NOT NULL DEFAULT 0;

-- Anything open right now has plainly been open.
UPDATE event_openings SET was_open = 1 WHERE open = 1;

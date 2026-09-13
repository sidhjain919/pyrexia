-- Event sheets become tabs.
--
-- Every vertical but Velocity now keeps one spreadsheet with a tab per event,
-- so an event's place is a spreadsheet *and* a tab. `sheet_gid` is the tab's
-- id, the number after #gid= in its URL. 0 is a spreadsheet's first tab, which
-- is where every event lived until now.

ALTER TABLE event_sheets ADD COLUMN sheet_gid INTEGER NOT NULL DEFAULT 0;

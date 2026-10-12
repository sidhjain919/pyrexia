-- The Festival Pass add-on goes from ₹2400 to ₹2700.
--
-- Only the price of the product changes. Orders already placed snapshot what
-- they were charged in `order_items.amount_paise`, so nothing already sold is
-- repriced, and no entitlement is touched. Basic Registration is unchanged at
-- ₹500, which makes the full Festival Pass ₹3200 before gateway charges.
--
-- `DELEGATE_ADDON` in ../src/data/registration.ts is the display copy for this
-- and has to move with it.

UPDATE products SET amount_paise = 270000 WHERE id = 'delegate';

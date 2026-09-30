-- A blank mobile number is nobody's number.
--
-- The desk may now take a registration without a mobile: every detail field
-- there is optional, because a queue at a counter moves faster than a form.
-- The one-number-per-person index covered every confirmed row, so the second
-- phone-less desk registration would have collided with the first on ''.
--
-- Same rule for everybody who does give a number; blanks simply stop counting.

DROP INDEX IF EXISTS idx_reg_phone_confirmed;

CREATE UNIQUE INDEX idx_reg_phone_confirmed ON registrations (phone)
  WHERE status = 'confirmed' AND phone != '';

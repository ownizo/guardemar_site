-- Run against a disposable Netlify Database branch after migrations.
-- The transaction rolls back all fixtures. Any failed assertion aborts the test.
BEGIN;

SELECT set_config('app.user_id', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.user_email', 'info@guardemar.com', true);
INSERT INTO profiles (id, role) VALUES ('00000000-0000-4000-8000-000000000001', 'admin');
INSERT INTO profiles (id, role) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'customer'),
  ('00000000-0000-4000-8000-00000000000b', 'customer');

INSERT INTO clients (id, first_name, last_name, email, phone) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'Customer', 'A', 'a@example.invalid', '+351000000001'),
  ('10000000-0000-4000-8000-00000000000b', 'Customer', 'B', 'b@example.invalid', '+351000000002');
INSERT INTO properties (id, client_id, display_name, address_line_1, postal_code, locality, municipality) VALUES
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Property A', 'Address A', '0000-001', 'Lagos', 'Lagos'),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'Property B', 'Address B', '0000-002', 'Lagos', 'Lagos');
INSERT INTO client_users (client_id, user_id) VALUES
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b');
INSERT INTO property_users (property_id, user_id) VALUES
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a'),
  ('20000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b');

SELECT set_config('app.user_id', '00000000-0000-4000-8000-00000000000a', true);
SELECT set_config('app.user_email', 'a@example.invalid', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM properties) <> 1 THEN RAISE EXCEPTION 'Customer A property isolation failed'; END IF;
  IF EXISTS (SELECT 1 FROM properties WHERE id = '20000000-0000-4000-8000-00000000000b') THEN RAISE EXCEPTION 'Customer A retrieved Property B'; END IF;
  IF (SELECT count(*) FROM clients) <> 1 THEN RAISE EXCEPTION 'Customer A client isolation failed'; END IF;
  BEGIN
    UPDATE profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-00000000000a';
    RAISE EXCEPTION 'Customer A changed role';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Customer A changed role' THEN RAISE; END IF;
  END;
END $$;

ROLLBACK;

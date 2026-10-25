-- Keep existing credentials and actor IDs while exposing keys as independent access tokens.
ALTER TABLE service_account_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE service_account_keys ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE service_account_keys ADD COLUMN IF NOT EXISTS regenerated_at TIMESTAMPTZ;
ALTER TABLE service_account_keys ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

UPDATE service_account_keys AS key
   SET description = account.description
  FROM service_accounts AS account
 WHERE key.service_account_id = account.id AND key.description IS NULL;

ALTER TABLE service_account_keys ALTER COLUMN description SET DEFAULT '';
ALTER TABLE service_account_keys ALTER COLUMN description SET NOT NULL;

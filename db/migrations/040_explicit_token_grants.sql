-- Every access token states its own grants: no owner status, scope-only grant or null connection
-- list carries an older meaning any more. The application reads only the shape written here.

-- A disabled owner stopped all of its tokens; each of those tokens is now disabled itself.
UPDATE service_account_keys k
   SET disabled_at = now(), revision = k.revision + 1
  FROM service_accounts a
 WHERE a.id = k.service_account_id AND a.status = 'disabled'
   AND k.revoked_at IS NULL AND k.disabled_at IS NULL;
ALTER TABLE service_accounts DROP COLUMN status;

-- A token with only integration scopes gets the feature permissions those scopes stand for.
-- The scopes themselves stay: they are derived from the permissions from now on.
WITH scope_only AS (
  SELECT k.id FROM service_account_keys k
   WHERE NOT EXISTS (SELECT 1 FROM service_account_key_permissions p WHERE p.key_id = k.id)
), converted AS (
  INSERT INTO service_account_key_permissions (key_id, permission)
  SELECT s.key_id, CASE s.scope
           WHEN 'lineage:read' THEN 'lineage:read'
           WHEN 'lineage:write' THEN 'lineage:send'
           WHEN 'metrics:read' THEN 'capacity:read'
         END
    FROM service_account_key_scopes s JOIN scope_only o ON o.id = s.key_id
  RETURNING key_id
)
UPDATE service_account_keys SET revision = revision + 1 WHERE id IN (SELECT DISTINCT key_id FROM converted);

-- An unrestricted metrics token read every connection; that is now the explicit '*'. Any other
-- unrestricted token reached no connection, which an empty list already says.
WITH every_connection AS (
  INSERT INTO service_account_key_connections (key_id, connection_id)
  SELECT k.id, '*' FROM service_account_keys k
   WHERE NOT k.connections_restricted
     AND EXISTS (SELECT 1 FROM service_account_key_scopes s WHERE s.key_id = k.id AND s.scope = 'metrics:read')
  ON CONFLICT DO NOTHING
  RETURNING key_id
)
UPDATE service_account_keys SET revision = revision + 1 WHERE id IN (SELECT key_id FROM every_connection);
ALTER TABLE service_account_keys DROP COLUMN connections_restricted;

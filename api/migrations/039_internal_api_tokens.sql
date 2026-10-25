-- Existing tokens receive no internal permissions and retain their integration access.
ALTER TABLE service_account_keys ADD COLUMN IF NOT EXISTS connections_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS service_account_key_permissions (
  key_id UUID NOT NULL REFERENCES service_account_keys(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission ~ '^[a-z][a-z0-9_.:-]{0,127}$'),
  PRIMARY KEY (key_id, permission)
);

-- Keep deleted connection IDs as explicit grants; deletion must never broaden a token.
CREATE TABLE IF NOT EXISTS service_account_key_connections (
  key_id UUID NOT NULL REFERENCES service_account_keys(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL CHECK (length(connection_id) BETWEEN 1 AND 128),
  PRIMARY KEY (key_id, connection_id)
);

ALTER TABLE service_account_key_permissions OWNER TO dashboard_rw;
ALTER TABLE service_account_key_connections OWNER TO dashboard_rw;
GRANT SELECT ON service_account_key_permissions, service_account_key_connections TO dashboard_ro;
-- The public OpenLineage role does not need access to internal API grants.

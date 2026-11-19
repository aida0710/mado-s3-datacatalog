-- DataLineage をやめたので、そのためだけにあった権限・Namespace・表・ロールを片付ける。
-- 監査ログ (audit_events) の lineage.* の行は、過去の記録として残す。

-- トークンから DataLineage の権限と連携 scope を外す。Namespace は DataLineage だけが使っていた。
WITH removed_permissions AS (
  DELETE FROM service_account_key_permissions WHERE permission LIKE 'lineage:%' RETURNING key_id
), removed_scopes AS (
  DELETE FROM service_account_key_scopes WHERE scope LIKE 'lineage:%' RETURNING key_id
), affected AS (
  SELECT key_id FROM removed_permissions
  UNION SELECT key_id FROM removed_scopes
  UNION SELECT key_id FROM service_account_key_namespaces
)
UPDATE service_account_keys SET revision = revision + 1 WHERE id IN (SELECT key_id FROM affected);
DROP TABLE service_account_key_namespaces;

-- DataLineage の権限だけを持っていたトークンは、できる操作が無くなる。権限の無いトークンは作れない決まりなので無効にする。
UPDATE service_account_keys k
   SET disabled_at = now(), revision = k.revision + 1
 WHERE k.revoked_at IS NULL AND k.disabled_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM service_account_key_permissions p WHERE p.key_id = k.id);

-- ブラウザのロールから DataLineage の権限を外す。
DELETE FROM auth_role_permissions WHERE permission_id LIKE 'lineage:%';
DELETE FROM auth_permissions WHERE id LIKE 'lineage:%';

-- S3 の接続と Registry の storage system の対応表。022 を当てていない DB には無い。
DROP TABLE IF EXISTS lineage_storage_bindings;

-- OpenLineage を受けていたプロセスのロール。ロールはクラスタ全体のもので、ほかの DB に権限が残っていると消せない。
-- ここではこの DB の権限をすべて外してログインを止める。ロール自体は、運用者が DROP ROLE mado_lineage で消せる。
DROP OWNED BY mado_lineage;
ALTER ROLE mado_lineage NOLOGIN;

-- 移行は api-internal が起動時に DB の管理者 (postgres) の権限で当てる。
-- これまで db/init/00-init.sh が全移行の後に行っていた所有者と読み取り権限の設定を、ここで移行として行う。
-- 001 の表は管理者の持ち物として作られるので dashboard_rw へ移す (以降の表は各移行が自分で移している)。
ALTER TABLE    storage_connections                    OWNER TO dashboard_rw;
ALTER FUNCTION storage_connections_touch_updated_at() OWNER TO dashboard_rw;
ALTER TABLE    storage_readme_meta                    OWNER TO dashboard_rw;
ALTER TABLE    storage_favorite_buckets               OWNER TO dashboard_rw;
ALTER TABLE    notes                                  OWNER TO dashboard_rw;

-- dashboard_ro は dashboard_rw と同じパスワードで、読み取りの経路を分けるためのロール。
GRANT USAGE  ON SCHEMA public               TO dashboard_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE dashboard_rw IN SCHEMA public
  GRANT SELECT ON TABLES TO dashboard_ro;

-- 移行を当てる権限の無い api-lineage と media-worker は、起動時に移行が済んでいるかを読む。
GRANT SELECT ON schema_migrations TO mado_lineage, mado_worker;

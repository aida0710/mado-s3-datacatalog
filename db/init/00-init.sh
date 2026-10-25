#!/usr/bin/env bash
set -euo pipefail

# コンテナ初回作成時に一度だけ実行される。再実行するには名前付きボリューム `db_data` を削除する必要がある。
# ここではロールとテスト用 DB だけを作る。表は api-internal が起動時に当てる移行 (api/migrations) が作る。

PASSWORD="${DASHBOARD_PASSWORD:?DASHBOARD_PASSWORD must be set in compose.dev.yaml or compose.prod.yaml}"
LINEAGE_PASSWORD="${LINEAGE_DB_PASSWORD:?LINEAGE_DB_PASSWORD must be set in compose}"
WORKER_PASSWORD="${WORKER_DB_PASSWORD:?WORKER_DB_PASSWORD must be set in compose}"

# ロールとテスト DB を作成する。デフォルトの `dashboard` DB は POSTGRES_DB から作成済み。
psql -v ON_ERROR_STOP=1 --username "postgres" <<-EOSQL
  CREATE ROLE dashboard_rw LOGIN PASSWORD '${PASSWORD}';
  CREATE ROLE dashboard_ro LOGIN PASSWORD '${PASSWORD}';
  CREATE ROLE mado_lineage LOGIN PASSWORD '${LINEAGE_PASSWORD}';
  CREATE ROLE mado_worker LOGIN PASSWORD '${WORKER_PASSWORD}';

  CREATE DATABASE dashboard_test OWNER postgres;

  GRANT ALL ON DATABASE dashboard      TO dashboard_rw;
  GRANT ALL ON DATABASE dashboard_test TO dashboard_rw;
  GRANT CONNECT ON DATABASE dashboard      TO dashboard_ro;
  GRANT CONNECT ON DATABASE dashboard_test TO dashboard_ro;
EOSQL

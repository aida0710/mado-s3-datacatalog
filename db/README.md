# Database setup

The dashboard uses Postgres with four application roles:

- `dashboard_rw` — owns and writes to the schema. Used by `/api/internal/*` write paths (connections, notes, readme, favorites).
- `dashboard_ro` — read-only. Used by `/api/internal/*` read paths so a buggy front-end can never DROP TABLE.
- `mado_lineage` — least-privilege login used only by the Internet-facing OpenLineage process. It can authenticate access tokens, update their `last_used_at`, append audit events, and read `schema_migrations`, but cannot read browser or storage secrets.
- `mado_worker` — reads storage connection settings and `schema_migrations`, and writes media, job, pricing, and capacity tables. It cannot read or write browser sessions, credentials, roles, or access tokens.

The PostgreSQL administrator (`postgres`) applies the schema migrations. Only `api-internal` receives its URL, as `MDC_DATABASE_URL_MIGRATE`; the Compose files build it from `POSTGRES_PASSWORD`.

## Schema migrations

`api/migrations/*.sql` is the schema, as an ordered set: `001_init.sql` is the base and each later file is an incremental change. The files are part of the `mado-api` image.

`api-internal` applies them when it starts, before it serves requests:

1. It takes a PostgreSQL advisory lock, so processes that start at the same time apply each file once.
2. It creates `schema_migrations (name, sha256, applied_at)` on an empty database.
3. It applies every file that has no row, in name order. Each file and its row commit in one transaction; a failing file leaves neither, and `api-internal` exits.
4. It stops instead of starting when the SHA-256 of an applied file has changed, or when the database already has tables but no `schema_migrations` (see [Databases migrated by hand](#databases-migrated-by-hand)).

`api-lineage` and `media-worker` cannot apply migrations. They take the same lock (waiting while `api-internal` applies), check that every bundled file is recorded with the same SHA-256, and exit otherwise. The Compose files start both only after `api-internal` reports healthy.

### Writing a migration

- Add a new file with the next number. Never edit an applied file: the changed digest stops every service.
- Each file runs in a transaction as `postgres`. Do not use statements that cannot run in a transaction (`CREATE INDEX CONCURRENTLY`, `VACUUM`).
- New tables belong to `dashboard_rw`, and `dashboard_ro` can read them. Set this in the file, and grant the worker or lineage role only what it needs:

  ```sql
  ALTER TABLE    my_new_table        OWNER TO dashboard_rw;
  ALTER SEQUENCE my_new_table_id_seq OWNER TO dashboard_rw;  -- if it has a BIGSERIAL
  GRANT SELECT ON my_new_table TO dashboard_ro;
  ```

## Local development (Docker — recommended)

```sh
docker compose -f compose.dev.yaml up -d
```

This brings up Postgres 16 on `127.0.0.1:5432`. On first launch `db/init/00-init.sh` creates the four roles and the `dashboard_test` database. `api-internal` then applies the migrations to `dashboard`.

The tests use `dashboard_test`. Apply the migrations to it from `api/` before running them, and again after adding a migration:

```sh
MDC_DATABASE_URL_MIGRATE=postgres://postgres:postgres@localhost:5432/dashboard_test npm run db:migrate
```

To re-bootstrap from scratch:

```sh
docker compose -f compose.dev.yaml down -v   # WARNING: deletes db_data volume
docker compose -f compose.dev.yaml up -d
```

## Credentials (passwords)

DB passwords come from env vars, consumed **only when the `db_data` volume is first created**:

- `POSTGRES_PASSWORD` — the `postgres` superuser. `api-internal` also uses it in `MDC_DATABASE_URL_MIGRATE`, so use a URL-safe value (hex).
- `MDC_DASHBOARD_DB_PASSWORD` — the `dashboard_rw` / `dashboard_ro` roles. **Must match** the password embedded in `MDC_DATABASE_URL_RW` / `MDC_DATABASE_URL_RO`.
- `MDC_LINEAGE_DB_PASSWORD` — the dedicated `mado_lineage` role. **Must match** both OpenLineage `MDC_DATABASE_URL_RW` and `MDC_DATABASE_URL_RO`.
- `MDC_WORKER_DB_PASSWORD` — the dedicated `mado_worker` role. The worker Compose fragment uses it for both database URLs and does not inherit the API environment.

`compose.prod.yaml` requires all four (startup fails if unset) — set strong values in `.env` before the first `up` (`openssl rand -hex 24`). `compose.dev.yaml` has development-only defaults for zero-config local use.

Because they apply only at first init, **changing them later does not affect an existing volume**. To rotate on a running DB, use `ALTER ROLE`:

```sh
docker compose -f compose.prod.yaml exec postgres \
  psql -U postgres -c "ALTER ROLE dashboard_rw PASSWORD 'NEW'; ALTER ROLE dashboard_ro PASSWORD 'NEW';"
# Rotate mado_lineage separately, then update its two MDC_DATABASE_URL_* values.
docker compose -f compose.prod.yaml exec postgres \
  psql -U postgres -c "ALTER ROLE mado_lineage PASSWORD 'NEW_LINEAGE_PASSWORD';"
# finally update the matching values in .env and recreate the affected services.
```

Send passwords through protected stdin or a mode-600 file in production; do not leave them in shell history or logs.

## Databases migrated by hand

Up to v0.4.0 the init script applied the migrations to a new volume and operators applied later files by hand, so those databases have tables but no `schema_migrations`. `api-internal` refuses to start on them rather than running old files again.

Once, before the first start of a release that applies migrations, record the files the database already has. For a database on v0.4.0 (through `041`), with PostgreSQL running and the new image pulled:

```sh
docker compose -f compose.yaml run --rm --no-deps api-internal \
  node dist/scripts/record-applied-migrations.js --through 041
```

The command records `001` to `041` with their SHA-256 without running them, inside the same advisory lock. It refuses when `schema_migrations` already exists or when the database has no tables. Use `compose.mdx.yaml` for an MDX deployment. Then start the services; `api-internal` applies the files after `041`.

## Manual setup (non-Docker)

If you don't use Docker, create the roles and databases by hand against any local Postgres 14+, then let the migration command build the schema:

```sh
psql -U postgres <<'SQL'
CREATE DATABASE dashboard;
CREATE DATABASE dashboard_test;
CREATE ROLE dashboard_rw LOGIN PASSWORD 'CHANGEME';
CREATE ROLE dashboard_ro LOGIN PASSWORD 'CHANGEME';
CREATE ROLE mado_lineage LOGIN PASSWORD 'CHANGEME_LINEAGE';
CREATE ROLE mado_worker LOGIN PASSWORD 'CHANGEME_WORKER';
GRANT ALL ON DATABASE dashboard       TO dashboard_rw;
GRANT ALL ON DATABASE dashboard_test  TO dashboard_rw;
GRANT CONNECT ON DATABASE dashboard      TO dashboard_ro;
GRANT CONNECT ON DATABASE dashboard_test TO dashboard_ro;
SQL

cd api
for db in dashboard dashboard_test; do
  MDC_DATABASE_URL_MIGRATE="postgres://postgres:<password>@localhost:5432/$db" npm run db:migrate
done
```

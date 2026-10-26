# mado S3 Data Catalog release bundle

This archive installs a tagged mado S3 Data Catalog release from pre-built OCI images. It does
not build application source on the deployment host.

## New installation

1. Copy `.env.example` to `.env`.
2. Replace every placeholder or empty secret in `.env`. Keep
   `MDC_DATABASE_URL_RW`, `MDC_DATABASE_URL_RO`, and `MDC_DASHBOARD_DB_PASSWORD` consistent.
   Generate a separate hex `MDC_WORKER_DB_PASSWORD` for the restricted media worker.
3. Choose `MDC_AUTH_MODE=local`, `oidc`, or `hybrid`. Keep `MDC_ENV=production`;
   keep `MDC_AUTH_COOKIE_SECURE=true` whenever browser access uses TLS.
4. Provide a compatible Dataset Registry API and token. It is an external
   prerequisite and is not contained in this archive; Marquez is optional for
   the browser graph. No official Registry distribution is included in this
   release. Use `REGISTRY_API_CONTRACT.md` to validate an existing external
   service and obtain its Bearer token from that service's operator. Leave
   neither Registry value blank.
5. Run `docker compose -f compose.yaml config` and review the resolved config.
6. Start only `api-internal` (and PostgreSQL), which applies the database
   migrations, then create the first administrator while no Web listener
   exists:

   ```bash
   docker compose -f compose.yaml up -d api-internal
   docker compose -f compose.yaml exec api-internal \
     node dist/scripts/bootstrap-admin.js --username admin
   ```

7. Run `docker compose -f compose.yaml up -d`.
8. Put an intranet TLS proxy in front of `127.0.0.1:8080`. If Pipeline ingest
   is public, use a separate TLS hostname pointing only to `127.0.0.1:8081`.

The generated `compose.yaml` pins mado S3 Data Catalog images by digest. `images.txt` records
the same immutable references. Do not point a public proxy at port 8080.

## Existing database

`api-internal` applies the database migrations from its image when it starts,
using the PostgreSQL administrator URL that `compose.yaml` builds from
`POSTGRES_PASSWORD`. `api-lineage` and `media-worker` check that every
migration is recorded and start after `api-internal` is healthy. Back up the
database before every update.

A database migrated by hand up to v0.4.0 has tables but no
`schema_migrations`, and `api-internal` refuses to start on it. Once, before
the first start of this release, record the files it already has:

```bash
docker compose -f compose.yaml run --rm --no-deps api-internal \
  node dist/scripts/record-applied-migrations.js --through 041
```

See [the database procedure](db/README.md#databases-migrated-by-hand) and the
release notes of the version you install for changes that need operator
action.

Internal/private deployments are downstream operations. Publishing an OSS
release never connects to or changes a deployment environment.

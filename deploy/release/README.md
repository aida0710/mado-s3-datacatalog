# mado S3 Data Catalog release bundle

This archive installs a tagged mado S3 Data Catalog release from pre-built OCI images. It does
not build application source on the deployment host.

## New installation

1. Copy `.env.example` to `.env`.
2. Replace every placeholder or empty secret in `.env`. Keep
   `DATABASE_URL_RW`, `DATABASE_URL_RO`, and `DASHBOARD_PASSWORD` consistent.
   Generate a separate hex `WORKER_DB_PASSWORD` for the restricted media worker.
3. Choose `AUTH_MODE=local`, `oidc`, or `hybrid`. Keep `MADO_ENV=production`;
   keep `AUTH_COOKIE_SECURE=true` whenever browser access uses TLS.
4. Provide a compatible Dataset Registry API and token. It is an external
   prerequisite and is not contained in this archive; Marquez is optional for
   the browser graph. No official Registry distribution is included in this
   release. Use `REGISTRY_API_CONTRACT.md` to validate an existing external
   service and obtain its Bearer token from that service's operator. Leave
   neither Registry value blank.
5. Run `docker compose -f compose.yaml config` and review the resolved config.
6. Start only PostgreSQL, then create the first administrator while no Web
   listener exists:

   ```bash
   docker compose -f compose.yaml up -d postgres
   docker compose -f compose.yaml run --rm api-internal \
     node dist/scripts/bootstrap-admin.js --username admin
   ```

7. Run `docker compose -f compose.yaml up -d`.
8. Put an intranet TLS proxy in front of `127.0.0.1:8080`. If Pipeline ingest
   is public, use a separate TLS hostname pointing only to `127.0.0.1:8081`.

The generated `compose.yaml` pins mado S3 Data Catalog images by digest. `images.txt` records
the same immutable references. Do not point a public proxy at port 8080.

## Existing database

The PostgreSQL init directory runs only for a new volume. For an existing DB,
follow the single ordered procedure in `db/README.md`: backup, apply missing
files through 027, start only the new `api-internal`, apply 028 then 029, enable
the `mado_lineage` login with `LINEAGE_DB_PASSWORD`, and only then start
`api-lineage` and the remaining services. Do not bring up the entire new
Compose project before completing those steps.

For a deployment already on the previous schema, apply 035–037 before the new
services, then enable `mado_worker` with the generated `WORKER_DB_PASSWORD`.
The worker receives only its dedicated environment from `deploy/worker-service.yaml`.
Migration 037 requires existing SSO users to sign in once after the update.

Upgrading to v0.3.0 applies `db/migrations/039_internal_api_tokens.sql` and
`db/migrations/040_explicit_token_grants.sql`, in that order. 039 only adds
tables and can run while the previous release serves requests. 040 converts
existing tokens to feature permissions and explicit connections, then drops
`service_accounts.status` and `service_account_keys.connections_restricted`,
which the previous release still reads: stop `api-internal` and `api-lineage`,
apply 040, and start both on this release. Token values stay valid. There is no
way back to an earlier release after 040; see
[access tokens](../../docs/access-tokens.md) and
[the permission contract](../../docs/internal-api-permissions.md).

Upgrading to v0.4.0 applies
`db/migrations/041_explicit_connection_settings_media_cache.sql` after 040.
`AUTH_MODE` must be `local`, `oidc`, or `hybrid`; `disabled` no longer exists.
041 stores the effective value of every missing boolean connection setting and
removes media cache rows without metadata or a connection. The previous release
can create connections without those settings, so stop `api-internal` and
`api-lineage`, apply 041, and start both on this release; update `nginx` and
`media-worker` as well. The bundled edge configuration no longer redirects a
legacy hostname; keep your own edge configuration if you rely on that redirect.
See [the database procedure](../../db/README.md).

When upgrading from v0.1.0, apply `db/migrations/038_access_tokens.sql` before
starting the new APIs. Update both `api-internal` and `api-lineage` to this
release so token disabling is enforced on both listeners. Existing token
values and permissions remain valid; regenerating or deleting a token revokes
its previous value immediately.


Internal/private deployments are downstream operations. Publishing an OSS
release never connects to or changes a deployment environment.

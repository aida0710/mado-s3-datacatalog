# Dataset Registry API contract for mado S3 Data Catalog v1.0.0

mado S3 Data Catalog v1.0.0 does not distribute an official Dataset Registry implementation.
The OpenLineage endpoint and browser lineage features require an operator-
supplied service that implements this contract. The Registry operator is also
responsible for issuing and rotating the Bearer token; mado S3 Data Catalog does not create it.
This document defines mado S3 Data Catalog's integration surface, not a complete standalone
Registry implementation specification; v1.0.0 does not promise that a new
third-party Registry can be built from this document alone.

## Transport and authentication

- `DATASET_REGISTRY_URL` is the base URL. Production deployments must use a
  trusted private network or HTTPS.
- Every request sends `Authorization: Bearer <DATASET_REGISTRY_TOKEN>` and
  `Accept: application/json`. The token must be at least 16 characters and
  should be dedicated to mado S3 Data Catalog with only ingest, read, and manual-registration
  permissions.
- JSON requests send `Content-Type: application/json`. All successful API
  responses must be JSON and use a 2xx status. mado S3 Data Catalog treats other statuses,
  invalid JSON, and a five-second timeout as Registry failure.
- The operator must provide `GET /healthz` returning 2xx for installation
  preflight. mado S3 Data Catalog's runtime does not use this endpoint as authorization proof.

## Required endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/ingest/openlineage` | Store `{ event, principal }`; principal contains service-account/key IDs and allowed namespaces |
| `POST` | `/v1/resolve/datasets` | Resolve `{ datasets: [{ namespace, name }] }` |
| `GET` | `/v1/search/datasets?q=&limit=&namespace=&offset=` | Search datasets |
| `GET` | `/v1/resolve/storage-location?storage_system_key=&uri=&limit=` | Resolve a storage URI |
| `GET` | `/v1/datasets/{id}` | Dataset detail |
| `GET` | `/v1/dataset-versions/{id}` | Version detail and locations |
| `GET` | `/v1/runs/{id}` | Run detail and input/output versions |
| `GET` | `/v1/graph/dataset-versions/{id}?direction=&depth=` | Version lineage graph |
| `GET` | `/v1/projection-status` | Projection state (`synced`, `lagging`, or `unavailable`) |
| `POST` | `/v1/manual/datasets` | Register a manually curated dataset/version/location |
| `POST` | `/v1/manual/locations` | Register a location for an existing version |
| `POST` | `/v1/manual/lineage` | Register manually curated lineage |

Dataset summaries must contain non-empty `namespace` and `name`. Version
responses must contain `id`, `datasetId` (or `dataset_id`), and `version`.
Storage matches must additionally contain version/location IDs, version, and
location URI. Responses may use camelCase or the documented snake_case aliases.
Unknown additional fields are ignored.

## Dataset identities for `lineage:read`

To enable mado S3 Data Catalog's Service Account read API, dataset search results and dataset
details must also include a UUID `datasetId` (`dataset_id` or `id` is accepted).
ML Tracking uses the search result's UUID to fetch dataset details; summaries
without an ID cannot be imported. The detail's ID must match the requested
dataset ID. Each version in the detail must contain its own UUID `id` and a
`datasetId` matching that dataset.

`GET /v1/dataset-versions/{id}` must return the requested version UUID as `id`
and its parent dataset UUID as `datasetId`. mado S3 Data Catalog resolves that parent dataset
to check the read key's allowed namespaces before returning the version.
Missing or inconsistent identities are rejected with 502 by the read API;
mado S3 Data Catalog does not infer an upstream identity from the request URL.

For namespace-restricted internal graph reads, version and run nodes must include
their canonical UUID as `node.data.id`. mado S3 Data Catalog authorizes these IDs against Registry
details instead of parsing opaque node IDs. Nodes without this field or outside
the token's namespaces are omitted and the graph is marked truncated. Tokens with
all namespaces and browser sessions retain the original graph's nodes and edges.
mado S3 Data Catalog connection references in graph metadata follow the caller's connection visibility.

## OpenLineage retries

`POST /v1/ingest/openlineage` must accept retries of the same event, including
its original `eventTime`, `run.runId`, and dataset version references. Repeating
an accepted event must return `accepted: true`, `duplicate: true`, and the same
`eventId` and `runId`, without creating another Run or DatasetVersion. Deduplicate
the event payload independently of the service-account key ID so rotating a key
does not create another record. Check the current principal's namespace
permissions on every request, including retries.

`run.runId` identifies one Run. A dataset's namespace, name, and version identify
one DatasetVersion; a conflicting redefinition must return 409. mado S3 Data Catalog forwards
the validated event unchanged and preserves the Registry's duplicate result.
Verify these guarantees against the chosen Registry before enabling ML Tracking
delivery; mado S3 Data Catalog's adapter tests do not validate an operator-supplied Registry's
database behavior.

Before starting mado S3 Data Catalog, validate both health and token authentication against the
chosen implementation. A health-only stub is not compatible: all endpoints
used by the enabled mado S3 Data Catalog features must satisfy this contract.

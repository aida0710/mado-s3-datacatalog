---
description: Creating, regenerating, and disabling access tokens, scopes and namespaces, sending OpenLineage events, and Prometheus capacity metrics.
---

# Use the API with an access token

Reading datasets, sending OpenLineage events from pipelines, and fetching metrics from Prometheus use access tokens. You don't need to pass anyone's login credentials to scripts.

<Screenshot src="/screenshots/en/service-accounts.png" alt="Access token permissions and status in a single list" caption="Manage token permissions and status in Settings → Access → Access Tokens." />

## Create a token

An Admin opens **Create access token** in **Settings → Access → Access Tokens**, then enters a name and selects the allowed operations. There is no separate account to create.

You can select both **Read datasets** and **Send DataLineage**. A namespace groups datasets and jobs, for example `speech` or `podcast`, independently of S3 connections and buckets. Enter the allowed namespaces, separated by commas. `*` allows all namespaces. A token used only for capacity metrics does not need a namespace.

The value is shown only once, when issued. Save it in the integration’s secret manager. An expiration date is optional.

| Scope | Purpose | Endpoint |
| --- | --- | --- |
| `lineage:read` | Read datasets and versions | `GET /api/mado/lineage/catalog` and detail endpoints |
| `lineage:write` | Send OpenLineage events | `POST /api/openlineage/v1/lineage` |
| `metrics:read` | Get capacity metrics for all connections | `GET /api/mado/metrics/capacity` |

`/api/mado/`, which returns mado's own data, accepts GET only. One token can combine the scopes it needs. `metrics:read` can read bucket names and capacity for all connections, including connections whose users are limited by an allowlist. Capacity metrics are not limited by namespace, even when combined with lineage scopes.

For ML Tracking, you can use the same value in both its read-key and write-key fields when the token allows dataset reads and lineage writes.

## Send OpenLineage events

Pass the destination URL and the key from the pipeline's environment variables or secret manager. The following example assumes the event JSON is in `event.json`.

```bash
curl --fail-with-body \
  -X POST "$MADO_LINEAGE_URL/api/openlineage/v1/lineage" \
  -H "Authorization: Bearer $MADO_LINEAGE_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @event.json
```

`MADO_LINEAGE_URL` is the origin of the public API hostname, and `MADO_LINEAGE_KEY` is a `lineage:write` key. Send events for the allowed namespaces. The event format and how events are registered are described in the [Lineage specification](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/lineage.md).

## Collect capacity metrics with Prometheus

Metrics are served on the UI's intranet entry point. They are not available on the public API entry point.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MADO_METRICS_KEY" \
  "$MADO_URL/api/mado/metrics/capacity"
```

Here is an example Prometheus configuration. The Bearer token is read from a file.

```yaml
scrape_configs:
  - job_name: mado-capacity
    scheme: https
    metrics_path: /api/mado/metrics/capacity
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/secrets/mado-metrics-key
    static_configs:
      - targets: ['mado.example.com']
```

Replace `mado.example.com` with your actual UI hostname. For the list of metrics returned, see the [capacity metrics specification](https://github.com/aida0710/mado-s3-datacatalog/blob/main/deploy/mdx/README.md#prometheus-metrics).

## Edit, regenerate, or disable a token

Open the **…** menu beside a token.

- **Edit** changes the name, purpose note, permissions, namespaces, or expiration date. The value stays the same.
- **Regenerate** immediately invalidates the old value and shows a new value once. Permissions, expiration, and disabled status are preserved. Update the integration with the new value.
- **Disable / Enable** pauses or resumes use of the same value.
- **Delete** permanently ends access and removes the token from the list. Audit history is retained.

Existing Service Account keys appear in the same list, with their values and permissions preserved.

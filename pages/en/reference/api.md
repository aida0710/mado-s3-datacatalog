---
description: Service Account key scopes and namespaces, sending OpenLineage events, and Prometheus capacity metrics.
---

# Use the API with a Service Account

Sending OpenLineage events from pipelines and fetching metrics from Prometheus both use Service Account keys. You don't need to pass anyone's login credentials to scripts.

<Screenshot src="/screenshots/en/service-accounts.png" alt="Screen for managing the audio-pipeline Service Account" caption="Manage accounts and keys in Settings → Access → Service Accounts." />

## Issue a key for each purpose

An Admin creates a Service Account and issues a key with the required scopes and namespaces. The key value is shown only once, when the key is issued. Store it in the secret manager on the sending side.

| Scope | Purpose | Endpoint |
| --- | --- | --- |
| `lineage:write` | Send OpenLineage events | `POST /api/openlineage/v1/lineage` |
| `metrics:read` | Get capacity metrics for all connections | `GET /api/mado/metrics/capacity` |

`/api/mado/`, which returns mado's own data, accepts GET only. Use keys with separate scopes for sending OpenLineage events and for fetching metrics. `metrics:read` can read bucket names and capacity for all connections, including connections whose users are limited by an allowlist.

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

## Revoke keys you no longer use

Revoke the key in Service Accounts. To change scopes or namespaces, issue a new key and switch the sending side to it.

# Capacity metrics for Prometheus

Access tokens read mado S3 Data Catalog's own data under `/api/mado/`; every route
there is read-only and nginx passes only GET. Prometheus reads mado S3 Data Catalog metrics from
the UI host at `https://mado.example.com/api/mado/metrics/<area>`.
Each area has its own path so that it can be scraped at a rate that matches how
fast it changes; bucket capacity (the "容量メトリクス" screen) is served at
`/api/mado/metrics/capacity`. The route goes through the same TLS entry point
as the web UI, so keep it inside the same network restrictions. The public
OpenLineage listener (`:8081`) returns 404 for these paths.

Scraping requires an access token that allows reading capacity
(`capacity:read`, which carries the `metrics:read` scope). Issue it in
Settings → Access → Access Tokens, choose **Read** under **Capacity** and select
the connections to expose (or all connections). A token can combine operations;
a dedicated Prometheus token only needs that permission and its connections.
Connection names, bucket/prefix metrics and tracking settings all use that
selection.

```yaml
scrape_configs:
  - job_name: mado-capacity
    # Capacity changes at most every 6 hours, but stay within Prometheus'
    # 5-minute lookback so the series does not go stale between scrapes.
    scrape_interval: 2m
    scheme: https
    metrics_path: /api/mado/metrics/capacity
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/secrets/mado-metrics-key
    static_configs:
      - targets: ['mado.example.com']
```

`/api/mado/metrics/capacity` exports each bucket's latest saved scan result as
`mado_storage_bucket_bytes` and `mado_storage_bucket_objects`, along with
`mado_storage_capacity_collection_age_seconds` and
`mado_storage_capacity_collection_failures` (labels `connection_id` and
`bucket`). Buckets without a successful scan have no size, object count, or age
sample; failed scans leave the last successful values in place. Scraping does
not initiate a scan. Enable capacity tracking for a connection or run a manual
capacity scan in mado S3 Data Catalog to populate results.

The same scan also counts each top-level directory of the bucket, so the
largest 50 are exported as `mado_storage_prefix_bytes` and
`mado_storage_prefix_objects` (labels `connection_id`, `bucket`, and `prefix`,
for example `prefix="ja/"`). Files directly under the bucket root and
directories outside the largest 50 are not exported; they are the difference
from the bucket value:

```promql
mado_storage_bucket_bytes
  - on (connection_id, bucket)
    sum by (connection_id, bucket) (mado_storage_prefix_bytes)
```

Per connection, `mado_storage_connection_info{connection_id,connection_name}`
is always 1 and maps the opaque ID to its name, and
`mado_storage_capacity_tracking_enabled` and
`mado_storage_capacity_tracking_interval_seconds` describe scheduled tracking.
If the saved values cannot be read, the path returns 503 and Prometheus reports
`up{job="mado-capacity"} == 0`. To alert on stale scans only where tracking is
on:

```promql
mado_storage_capacity_collection_age_seconds
  > on (connection_id) group_left
    2 * mado_storage_capacity_tracking_interval_seconds
  and on (connection_id)
    mado_storage_capacity_tracking_enabled == 1
```

---
description: Creating, regenerating, and disabling access tokens, scopes and namespaces, sending OpenLineage events, and Prometheus capacity metrics.
---

# Use the API with an access token

Reading datasets, sending OpenLineage events from pipelines, and fetching metrics from Prometheus use access tokens. You don't need to pass anyone's login credentials to scripts.

<Screenshot src="/screenshots/en/service-accounts.png" alt="Access token permissions and status in a single list" caption="Manage token permissions and status in Settings → Access → Access Tokens." />

## Create a token

An Admin opens **Create access token** in **Settings → Access → Access Tokens**, then enters a name and selects the allowed operations. There is no separate account to create.

Select **Read** and **Send** in the DataLineage row of the feature permission list, or use the **ML Tracking integration** preset. A namespace groups datasets and jobs, for example `speech` or `podcast`, independently of S3 connections and buckets. Use **Search namespaces** to filter the list and check the names to allow. Your selection is retained across searches. For a name missing from the list, enter it in the search field and choose **Add**. Select **Allow all namespaces** only when you need access to every namespace. A token used only for capacity metrics does not need a namespace.

<Screenshot src="/screenshots/en/access-token-create.png" alt="Token creation with a searchable namespace checklist" caption="Filter the list and check the namespaces to allow. Selected names are retained across searches." />

The value is shown only once, when issued. Save it in the integration’s secret manager. **Expires at** defaults to 90 days. You can choose 7, 30, 90, or 365 days, no expiry, a **Custom duration** in minutes, hours, or days, or **Choose from calendar**.

| Feature / action | Purpose | Endpoint |
| --- | --- | --- |
| DataLineage: Read | Read datasets and versions | `GET /api/mado/lineage/catalog` and detail endpoints |
| DataLineage: Send | Send OpenLineage events | `POST /api/openlineage/v1/lineage` |
| Capacity: Read | Get capacity metrics for allowed connections | `GET /api/mado/metrics/capacity` |

The integration API `/api/mado/` accepts GET only. One token can combine operations. The integration scopes are derived from the selected operations. Capacity metrics use the selected connections, independently of namespaces.

`GET /api/mado/access-token` returns the calling token's own name, scopes, namespaces, and expiration, whatever its scopes (`["*"]` in `namespaces` means all namespaces). It never returns other tokens or token values. Integrations use it to learn the allowed namespaces without asking people to type them.

For ML Tracking, enter a token that allows **Read datasets** and **Send DataLineage** in the **Access token** field of its **Integrations**. You do not enter namespaces: ML Tracking reads them from this endpoint.

## Use internal APIs

Tokens can use the same internal APIs as the UI for Storage, READMEs, Notes, DataLineage, jobs, connections and settings. New tokens start with no permissions. Select read, edit, delete, run or manage actions for each feature, optionally using a preset, then search and check the allowed connections and namespaces.

<Screenshot src="/screenshots/en/token-permissions.png" alt="Choosing actions for each feature" caption="Choose each allowed action and select the connections the token may use." />

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MADO_API_TOKEN" \
  "$MADO_URL/api/internal/connections"
```

This example needs `permissions: ["connections:read"]` and selected connections. Reads and sending are configured in the same feature permission list. Token management can be granted, but callers cannot issue or regenerate stronger tokens. User administration requires the Administrator preset's full permissions and targets. Login, SSO and self-service password changes remain browser-only. See the [permission and target reference](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/internal-api-permissions.md).

## Send OpenLineage events

Pass the destination URL and the key from the pipeline's environment variables or secret manager. The following example assumes the event JSON is in `event.json`.

```bash
curl --fail-with-body \
  -X POST "$MADO_LINEAGE_URL/api/openlineage/v1/lineage" \
  -H "Authorization: Bearer $MADO_LINEAGE_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @event.json
```

`MADO_LINEAGE_URL` is the origin of the public API hostname, and `MADO_LINEAGE_KEY` is a token with DataLineage **Send** permission. Send events for the allowed namespaces. The event format and how events are registered are described in the [Lineage specification](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/lineage.md).

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

Existing Service Account keys appear in the same list, with their values and permissions preserved. Renaming or regenerating a token does not add internal API permissions. Changing and saving its selected operations moves it to the feature permission model.

Internal APIs require a browser session or an access token. Notes and README edits use the account signature or token name as the editor. An `editor` field in the PUT body produces a 400 validation error. Logical DataLineage graphs use `rootKind=dataset|job`; queries containing `kind` produce a 400 response.

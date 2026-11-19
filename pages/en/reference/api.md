---
description: Creating, regenerating, and disabling access tokens, choosing permissions and connections, and Prometheus capacity metrics.
---

# Use the API with an access token

Scripts that do what the UI does, and Prometheus fetching metrics, use access tokens. You don't need to pass anyone's login credentials to scripts.

<Screenshot src="/screenshots/en/service-accounts.png" alt="Access token permissions and status in a single list" caption="Manage token permissions and status in Settings → Access → Access Tokens." />

## Create a token

An Admin opens **Create access token** in **Settings → Access → Access Tokens**, then enters a name and selects the allowed operations. There is no separate account to create.

Check the actions to allow in the feature permission list, or start from a preset. When you select actions that use a connection, such as Storage or Capacity, also select the connections to allow. Search to filter the connection list and check the ones you need; your selection is retained across searches. Select all connections only when the token needs every connection.

<Screenshot src="/screenshots/en/access-token-create.png" alt="Token creation with a name, permissions, and an expiration" caption="Enter a name, the allowed actions, and an expiration to create a token." />

The value is shown only once, when issued. Save it in the integration’s secret manager. **Expires at** defaults to 90 days. You can choose 7, 30, 90, or 365 days, no expiry, a **Custom duration** in minutes, hours, or days, or **Choose from calendar**. Values start with `mado_dc_` (mado ML Tracking tokens start with `mado_mt_`).

| Feature / action | Purpose | Endpoint |
| --- | --- | --- |
| Capacity: Read | Get capacity metrics for allowed connections | `GET /api/mado/metrics/capacity` |

The integration API `/api/mado/` accepts GET only. The integration scopes are derived from the selected operations. Capacity metrics cover the selected connections.

`GET /api/mado/access-token` returns the calling token's own name, scopes, and expiration, whatever its scopes. It never returns other tokens or token values. Integrations use it to check what the token they were given can do.

Data lineage (datasets and the processing between them) is handled by mado ML Tracking. mado has no DataLineage API (removed in v0.6.0). To read capacity metrics from ML Tracking, enter a token that allows Capacity **Read** in the **Access token** field of its **Integrations**.

## Use internal APIs

Tokens can use the same internal APIs as the UI for Storage, READMEs, Notes, jobs, connections and settings. New tokens start with no permissions. Select read, edit, delete, run or manage actions for each feature, optionally using a preset, then search and check the allowed connections.

<Screenshot src="/screenshots/en/token-permissions.png" alt="Choosing actions for each feature" caption="Choose each allowed action and select the connections the token may use." />

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MDC_API_TOKEN" \
  "$MDC_URL/api/internal/connections"
```

This example needs `permissions: ["connections:read"]` and selected connections. Token management can be granted, but callers cannot issue or regenerate stronger tokens. User administration requires the Administrator preset's full permissions and targets. Login, SSO and self-service password changes remain browser-only. See the [permission and target reference](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/internal-api-permissions.md).

Lists that continue over several pages (audit log, directory listing) take `limit` and `cursor`. Pass the response's `nextCursor` unchanged as the next request's `cursor`; `null` means the last page. The cursor is opaque: do not build or parse it. A value the API cannot read returns 400 `invalid_cursor`.

## Collect capacity metrics with Prometheus

Metrics are served on the same intranet entry point as the UI.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MDC_METRICS_KEY" \
  "$MDC_URL/api/mado/metrics/capacity"
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

Replace `mado.example.com` with your actual UI hostname. For the list of metrics returned, see the [capacity metrics specification](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/capacity-metrics.md).

## Edit, regenerate, or disable a token

Open the **…** menu beside a token.

- **Edit** changes the name, purpose note, permissions, connections, or expiration date. The value stays the same.
- **Regenerate** immediately invalidates the old value and shows a new value once. Permissions, expiration, and disabled status are preserved. Update the integration with the new value.
- **Disable / Enable** pauses or resumes use of the same value.
- **Delete** permanently ends access and removes the token from the list. Audit history is retained.

Values issued up to v0.4.0 start with `mado_lin_` and stop working when you update to v0.5.0. The name, permissions, and expiration date remain, so **regenerate** each token and distribute the new value to its integration.

Internal APIs require a browser session or an access token. Notes and README edits use the account signature or token name as the editor. An `editor` field in the PUT body produces a 400 validation error.

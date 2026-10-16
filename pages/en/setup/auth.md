---
description: Local Users and OIDC SSO, built-in roles, connection allowlists, and disabling users.
---

# Set up authentication and access permissions

mado supports Local Users and OIDC SSO. You combine RBAC, which sets each user's role, with per-connection operation restrictions and allowlists.

## Choose between Local Users and SSO

| `AUTH_MODE` | Login method |
| --- | --- |
| `local` | Local Users created by an administrator |
| `oidc` | OIDC SSO |
| `hybrid` | Local Users and OIDC SSO |

Local Users cannot sign up by themselves. Create the initial Admin with the command in the [installation steps](./install.md#initial-admin).

For SSO, configure the issuer, client ID, client secret, and redirect URI. For the values to register in Authentik, the mapping between groups and roles, and the logout settings, see the [OIDC integration guide](https://github.com/aida0710/mado-s3-datacatalog/blob/main/docs/authentik.md).

## Keep users logged in for 7 days

The session idle timeout `AUTH_SESSION_IDLE_SECONDS` and the timeout from login `AUTH_SESSION_ABSOLUTE_SECONDS` both default to 604800 seconds (7 days). A login lasts 7 days, including periods of inactivity. If your existing `.env` sets shorter timeouts, set both to `604800` and restart the API.

For SSO, set `OIDC_SCOPES=openid email profile offline_access`. In Authentik, go to **Applications** → **Providers**, edit the mado provider, and add the standard `offline_access` mapping to **Scopes** under **Advanced protocol settings**. Set **Refresh Token Validity** to `days=7` or longer. If it is already `days=30`, no change is needed. **Access Token Validity** can stay at `minutes=5`, and tokens are still renewed. After the changes take effect, log in again once to get a refresh token.

## Assign roles

Manage users in **Settings → Access → Users**.

<Screenshot src="/screenshots/en/access-users.png" alt="User management screen with an Admin and a Viewer registered" caption="Add users, change roles, and disable users from Access." />

| Role | Main permissions |
| --- | --- |
| Viewer | Viewing Storage and Lineage |
| Curator | Viewing, editing READMEs and notes, and registering and correcting Lineage |
| Operator | Viewing and operating jobs |
| Admin | All permissions, including managing connections, settings, users, and access tokens, and viewing the audit log |

If a user has multiple roles, they get the combined permissions of those roles. Operations disabled on a connection and access to connections hidden from the user are restricted separately.

## When you revoke SSO access, also check the user in mado

Removing a user from an SSO group does not necessarily end their existing mado sessions right away. To stop access immediately, disable the User in mado.

In production, use HTTPS and set `AUTH_COOKIE_SECURE=true`. Every environment, including development and tests, must set `AUTH_MODE` to `local`, `oidc`, or `hybrid`. Missing or unsupported values prevent startup.

## Use access tokens for pipelines

Keep authentication for pipelines and Prometheus separate from people's browser sessions. Create tokens with the required permissions in **Settings → Access → Access Tokens**. One token can allow both reads and writes. See the [API guide](../reference/api.md).

New tokens start with no permissions. Select read, edit, delete, run or manage actions by feature, then choose allowed connections and namespaces. The same token can use internal APIs.

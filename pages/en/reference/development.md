---
description: The roles of Front, the API, and the media worker, and how to start mado, verify changes, and update the docs during development.
---

# Architecture and development

mado consists of a React web UI, a Hono API, a media worker that uses ffmpeg, and PostgreSQL.

## What each service does

| Service | Role |
| --- | --- |
| front / nginx | Vite during development, or serving and proxying the web UI in production |
| api-internal | Browser authentication, Storage, settings, and read APIs |
| media-worker | Analyzing audio info, waveforms, and spectrograms |
| postgres | Connection settings, authentication, notes, jobs, and cache |

In production, nginx listens on 8080 and exposes it only on the host's loopback interface. Give users the URL served through the TLS proxy.

## Start the development environment

```bash
docker compose -f compose.dev.yaml up -d --build
docker compose -f compose.dev.yaml logs -f api-internal front
```

Development also requires login. Before startup, copy `.env.example` to `.env` and configure the encryption key and database connections. Start with `MDC_AUTH_MODE=local`, then create the initial Admin with this interactive command.

```bash
docker compose -f compose.dev.yaml exec api-internal npm run auth:bootstrap-admin:dev
```

`front/` and `api/` are bind-mounted, so your changes are picked up. Front reloads with HMR, and the API reloads with `tsx watch`. If you set up Node.js 22 on the host, install the dependencies in each directory.

```bash
npm ci --prefix front
npm ci --prefix api
```

## Verify your changes

```bash
docker compose -f compose.dev.yaml up -d postgres
npm test --prefix api
npm run lint --prefix api
npm run build --prefix api
npm test --prefix front
npm run lint --prefix front
npm run build --prefix front
```

The API's DB tests use the `MDC_TEST_DATABASE_URL` setting. If the DB password does not match, check the connection settings and the existing role's values before you recreate the volume.

## Update the GitHub Pages content

The source of this site is in `pages/`. When you update the Markdown and images and push to `main`, GitHub Actions builds and publishes the site.

```bash
npm ci --prefix pages
npm run dev --prefix pages
npm run build --prefix pages
```

To check the site before publishing, use `npm run preview --prefix pages`. How to capture and update the screenshots is described in the [documentation maintenance guide](https://github.com/aida0710/mado-s3-datacatalog/blob/main/pages/README.md).

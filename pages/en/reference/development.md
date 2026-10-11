---
description: The roles of Front, the API, the media worker, and the Registry, and how to start mado, verify changes, and update the docs during development.
---

# Architecture and development

mado consists of a React web UI, a Hono API, a media worker that uses ffmpeg, and PostgreSQL. Dataset Registry is the source of truth for Lineage metadata, and Marquez is a projection that can be rebuilt.

## Separate entry points for browsers and pipelines

| Service | Role |
| --- | --- |
| front / nginx | Vite during development, or serving and proxying the web UI in production |
| api-internal | Browser authentication, Storage, settings, and read APIs |
| api-lineage | Ingesting OpenLineage events from pipelines |
| media-worker | Analyzing audio info, waveforms, and spectrograms |
| postgres | Connection settings, authentication, notes, jobs, and cache |
| Dataset Registry | Metadata for Datasets, Versions, Runs, and storage locations |
| Marquez | Graph projection based on OpenLineage |

In production, nginx listens on 8080 for the UI and on 8081 for OpenLineage only, and exposes them only on the host's loopback interface. Give users the URL served through the TLS proxy.

## Start the development environment

```bash
docker compose -f compose.dev.yaml up -d --build
docker compose -f compose.dev.yaml logs -f api-internal front
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

The API's DB tests use the `DATABASE_URL_RW_TEST` setting. If the DB password does not match, check the connection settings and the existing role's values before you recreate the volume.

## Update the GitHub Pages content

The source of this site is in `pages/`. When you update the Markdown and images and push to `main`, GitHub Actions builds and publishes the site.

```bash
npm ci --prefix pages
npm run dev --prefix pages
npm run build --prefix pages
```

To check the site before publishing, use `npm run preview --prefix pages`. How to capture and update the screenshots is described in the [documentation maintenance guide](https://github.com/aida0710/mado-s3-datacatalog/blob/main/pages/README.md).

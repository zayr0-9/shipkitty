# PetShip MVP

A tiny no-OAuth service for adding pet/mascot approval images to GitHub release notes.

## Stack

- Frontend: Vite + React + TypeScript, deployable to Cloudflare Pages
- API: Cloudflare Worker TypeScript
- Storage: Cloudflare R2 bucket (`petship-images`)
- Metadata: Cloudflare D1 database (`petship-db`)

## MVP flow

1. User enters GitHub owner/repo/tag and pet metadata.
2. Browser resizes/compresses the image to WebP under 100 KB.
3. Frontend calls `POST /api/images/prepare`.
4. Frontend uploads the compressed image to `PUT /api/images/:imageId/upload`.
5. Worker validates MIME, size, and magic bytes, then stores image in R2 and metadata in D1.
6. User copies Markdown into GitHub release notes.

## Local setup

```bash
pnpm install
pnpm db:migrate:local
pnpm dev          # frontend on :5173
pnpm dev:api      # Worker API on Wrangler's local port
```

For local frontend-to-Worker calls, run the Worker separately and use a Vite proxy if needed, or deploy the Worker and set Pages rewrites/routes in Cloudflare.

## Cloudflare setup

D1 database was created through the Cloudflare MCP/API:

```txt
name: petship-db
id: 1775b58a-52b3-4ab0-9c27-b3040ac85991
```

R2 bucket was created through the Cloudflare MCP/API:

```txt
name: petship-images
location: WNAM
storage class: Standard
```

The D1 schema has also been applied remotely through the Cloudflare MCP/API. If you want Wrangler to manage remote migrations from this machine, set `CLOUDFLARE_API_TOKEN` first, then you can run:

```bash
pnpm db:migrate:remote
```

Deploy API:

```bash
pnpm deploy:api
```

Deploy frontend:

```bash
pnpm deploy:web
```

Update `worker/wrangler.toml` if you change bucket/database names or `PUBLIC_CDN_BASE`.

## API endpoints

- `POST /api/images/prepare`
- `PUT /api/images/:imageId/upload`
- `GET /api/markdown?owner=&repo=&tag=`
- `GET /r/:owner/:repo/:tag/:imageId.webp`
- `GET /api/health`

## Limits in stage 1

- No OAuth / GitHub write integration
- Anonymous usage only
- 100 KB final upload limit
- PNG/JPEG/WebP accepted by the browser, API only accepts compressed WebP
- 10 uploads/hour/IP and 50 uploads/day/IP based on hashed IP audit events
- One active image per repo+release tag; replacements delete the previous R2 object after the new one is stored

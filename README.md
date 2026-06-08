# ShipKitty

A tiny GitHub-authenticated service for adding pet/mascot approval images to GitHub release notes.

## Stack

- Frontend: Vite + React + TypeScript, deployable to Cloudflare Pages
- API: Cloudflare Worker TypeScript
- Auth: GitHub OAuth web flow, Worker-managed HttpOnly session cookie
- Storage: Cloudflare R2 bucket (`petship-images`)
- Metadata: Cloudflare D1 database (`petship-db`)

## Flow

1. User signs in with GitHub OAuth.
2. User loads GitHub repos/releases or manually enters owner/repo/tag.
3. Worker verifies repo access using the user's GitHub token.
4. Browser resizes/compresses the image to WebP under 100 KB.
5. Frontend calls `POST /api/images/prepare`.
6. Frontend uploads the compressed image to `PUT /api/images/:imageId/upload`.
7. Worker validates MIME, size, and magic bytes, then stores image in R2 and metadata in D1 linked to the user.
8. User copies Markdown into GitHub release notes.

No automatic GitHub release mutation is implemented yet.

## Local setup

```bash
pnpm install
pnpm db:migrate:local
pnpm dev          # frontend on :5173
pnpm dev:api      # Worker API on :8787
```

Vite proxies `/api` and `/r` to the local Worker.

## GitHub OAuth setup

Create a GitHub OAuth App. For local development use:

```txt
Homepage URL: http://localhost:5173
Authorization callback URL: http://localhost:8787/api/auth/github/callback
```

For production use your Worker/API host callback:

```txt
https://<api-host>/api/auth/github/callback
```

GitHub OAuth apps have one callback URL, so use separate OAuth apps for local and production.

Set non-secret vars in `worker/wrangler.toml` or Cloudflare dashboard:

```txt
GITHUB_CLIENT_ID
APP_BASE_URL
FRONTEND_BASE_URL
PUBLIC_CDN_BASE
```

Set secrets with Wrangler/dashboard, never commit them:

```bash
wrangler secret put GITHUB_CLIENT_SECRET --config worker/wrangler.toml
wrangler secret put SESSION_SECRET --config worker/wrangler.toml
```

Current OAuth scope is `repo` so private repositories can be listed and verified. Tokens stay server-side in D1 and are never exposed to React. Token-at-rest encryption is a recommended hardening follow-up.

## Cloudflare setup

D1 database:

```txt
name: petship-db
id: 1775b58a-52b3-4ab0-9c27-b3040ac85991
```

R2 bucket:

```txt
name: petship-images
location: WNAM
storage class: Standard
```

Apply migrations:

```bash
pnpm db:migrate:local
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

## API endpoints

Auth:

- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

GitHub helper routes:

- `GET /api/github/repos`
- `GET /api/github/repos/:owner/:repo/verify`
- `GET /api/github/repos/:owner/:repo/releases`

Images:

- `POST /api/images/prepare`
- `PUT /api/images/:imageId/upload`
- `GET /api/markdown?owner=&repo=&tag=`
- `GET /r/:owner/:repo/:tag/:imageId.webp`
- `GET /api/health`

## Limits

- GitHub sign-in required for new uploads
- Public/private repo support via OAuth `repo` scope
- Copy-paste Markdown output only; no GitHub release writes yet
- 100 KB final upload limit
- PNG/JPEG/WebP accepted by the browser, API only accepts compressed WebP
- 10 uploads/hour/IP and 50 uploads/day/IP based on hashed IP audit events
- One active image per repo+release tag; replacements delete the previous R2 object after the new one is stored

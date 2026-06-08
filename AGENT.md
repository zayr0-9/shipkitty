# AGENT.md

## Project

ShipKitty: a GitHub OAuth-authenticated pet/mascot image generator for GitHub release notes.

## Stack

- Vite + React + TypeScript frontend in `src/`
- Cloudflare Pages for static frontend deployment
- Cloudflare Worker API in `worker/src/`
- GitHub OAuth web flow handled by the Worker
- Cloudflare R2 for uploaded image objects via `PET_IMAGES` binding
- Cloudflare D1 for metadata/auth/session storage via `DB` binding

## Important files

- `src/App.tsx`: main UI, auth bar, repo/release picker, upload flow
- `src/api.ts`: frontend API client including auth/GitHub helper calls
- `src/image.ts`: browser canvas compression to WebP under 100 KB
- `worker/src/index.ts`: Worker routing and endpoint handlers
- `worker/src/auth.ts`: session cookie/hash helpers and auth guard
- `worker/src/github.ts`: GitHub OAuth/API helper functions
- `worker/src/db.ts`: D1 queries for auth, repos, pets, prepared/final images, audit
- `worker/src/validation.ts`: upload size/type/magic-byte checks
- `worker/src/markdown.ts`: GitHub Markdown + HTML snippet generation
- `worker/migrations/0001_initial.sql`: initial D1 schema
- `worker/migrations/0002_github_oauth.sql`: OAuth/session/token/user-repo migration
- `worker/wrangler.toml`: Worker config and Cloudflare bindings

## Current Cloudflare resources

- D1 database: `petship-db`
- D1 database id: `1775b58a-52b3-4ab0-9c27-b3040ac85991`
- R2 bucket: `petship-images`
- R2 location: `WNAM`
- R2 storage class: `Standard`

## Commands

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm db:migrate:local
pnpm db:migrate:remote
pnpm dev
pnpm dev:api
pnpm deploy:web
pnpm deploy:api
```

## GitHub OAuth setup

Local OAuth app values:

```txt
Homepage URL: http://localhost:5173
Authorization callback URL: http://localhost:8787/api/auth/github/callback
```

Production callback should point at the deployed Worker/API host:

```txt
https://<api-host>/api/auth/github/callback
```

Use separate GitHub OAuth apps for local and production because OAuth apps have one callback URL.

## Environment variables / secrets

Non-secret vars in `worker/wrangler.toml` or Cloudflare dashboard:

```txt
PUBLIC_CDN_BASE
APP_BASE_URL
FRONTEND_BASE_URL
GITHUB_CLIENT_ID
```

Secrets set with Wrangler/dashboard, not committed:

```bash
wrangler secret put GITHUB_CLIENT_SECRET --config worker/wrangler.toml
wrangler secret put SESSION_SECRET --config worker/wrangler.toml
```

## Current constraints

- GitHub sign-in is required for new uploads in the OAuth-enabled flow.
- OAuth currently requests `repo` scope to support public and private repo verification/pickers.
- No automatic GitHub release body mutation yet; output remains copy-paste Markdown/HTML.
- Keep image uploads rate-limited by hashed IP as a baseline guardrail.
- API must validate browser-compressed images; never trust frontend compression alone.
- Reject SVG and GIF.
- Final upload size limit is `100_000` bytes.
- One active image per `repo_id + release_tag`; replacement should only delete old R2 object after new upload succeeds.
- GitHub access tokens are server-only in D1; token-at-rest encryption is a recommended hardening follow-up.

## Deployment notes

- `PUBLIC_CDN_BASE` defaults to `https://cdn.shipkitty.dev`; for Worker-served images, route that hostname/path to the Worker or update the var.
- Frontend expects API endpoints at same origin under `/api/*`; Vite proxies locally and Pages/Worker routing must be configured in production.
- Apply `worker/migrations/0002_github_oauth.sql` before deploying OAuth-enabled API code to production.

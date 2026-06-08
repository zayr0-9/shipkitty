# AGENT.md

## Project

PetShip / Release Pets MVP stage 1: a no-OAuth pet/mascot image generator for GitHub release notes.

## Stack

- Vite + React + TypeScript frontend in `src/`
- Cloudflare Pages for static frontend deployment
- Cloudflare Worker API in `worker/src/`
- Cloudflare R2 for uploaded image objects via `PET_IMAGES` binding
- Cloudflare D1 for metadata via `DB` binding

## Important files

- `src/App.tsx`: main UI and upload flow
- `src/image.ts`: browser canvas compression to WebP under 100 KB
- `src/api.ts`: frontend API client
- `worker/src/index.ts`: Worker routing and endpoint handlers
- `worker/src/db.ts`: D1 queries
- `worker/src/validation.ts`: upload size/type/magic-byte checks
- `worker/src/markdown.ts`: GitHub Markdown + HTML snippet generation
- `worker/migrations/0001_initial.sql`: D1 schema
- `worker/wrangler.toml`: Worker config and Cloudflare bindings

## Current Cloudflare resources

- D1 database: `petship-db`
- D1 database id: `1775b58a-52b3-4ab0-9c27-b3040ac85991`
- R2 bucket: `petship-images`
- R2 location: `WNAM`
- R2 storage class: `Standard`
- Remote D1 schema was applied via Cloudflare MCP/API because local Wrangler has no `CLOUDFLARE_API_TOKEN`

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

## MVP constraints

- Do not add GitHub OAuth/App/PAT integration in stage 1.
- Keep frontend copy-paste Markdown flow.
- Keep image uploads anonymous but rate-limited by hashed IP.
- API must validate browser-compressed images; never trust frontend compression alone.
- Reject SVG and GIF.
- Final upload size limit is `100_000` bytes.
- One active image per `repo_id + release_tag`; replacement should only delete old R2 object after new upload succeeds.

## Deployment notes

- `PUBLIC_CDN_BASE` defaults to `https://cdn.petship.dev`; for Worker-served images, route that hostname/path to the Worker or update the var.
- Frontend expects API endpoints at same origin under `/api/*`; configure Pages/Worker routing accordingly or add a Vite/local proxy during development.

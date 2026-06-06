# 17 — Deployment

This document covers building and deploying VendorBridge. For local development, see [16-SETUP.md](16-SETUP.md).

## 17.1 Environment strategy

| Env | Purpose | Branch | DB | URLs |
|-----|---------|--------|----|----|
| `development` | Local dev | `main` | local docker | `localhost:3000`, `localhost:4000` |
| `staging` | Pre-prod validation | `develop` | managed Postgres (staging) | staging URL |
| `production` | Live | `main` (tagged) | managed Postgres (prod) | production URL |

Every PR can spin up a preview environment (Vercel + Neon branching for the DB).

## 17.2 Build

### Backend

```bash
pnpm --filter @vb/api build
# Produces apps/api/dist/
```

The Dockerfile (multi-stage):

```dockerfile
# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm --filter @vb/api build && pnpm --filter @vb/shared build

# Stage 3: prune
FROM node:20-alpine AS prune
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
RUN corepack enable && pnpm --filter @vb/api --prod deploy /app/api-prod && pnpm --filter @vb/shared --prod deploy /app/shared-prod

# Stage 4: runtime
FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S vb && adduser -S vb -G vb
COPY --from=prune /app/api-prod ./api
COPY --from=prune /app/shared-prod ./shared
COPY apps/api/prisma ./prisma
USER vb
EXPOSE 4000
CMD ["node", "api/dist/main.js"]
```

The `prisma generate` step is required at build time. For the runtime, we ship the generated client and the migration files; we run `prisma migrate deploy` as a release step.

### Frontend

```bash
pnpm --filter @vb/web build
# Produces .next/ + standalone output
```

The Dockerfile for web is simpler; the image is small.

## 17.3 Hosting

### Frontend → Vercel

- Connect the repo.
- Set the root to `apps/web`.
- Build command: `pnpm --filter @vb/web build`.
- Output: `.next` (Next.js).
- Env vars: `NEXT_PUBLIC_*` per env.
- Auto-deploys on push to `main` (production) and on PRs (preview).

### Backend → Render / Railway / Fly.io

- Dockerfile-based deploy.
- Health check: `GET /api/v1/health`.
- Env vars: full set per [16-SETUP.md](16-SETUP.md).
- Release command: `pnpm --filter @vb/api prisma migrate deploy && pnpm --filter @vb/api db:check-triggers` (custom script that confirms audit immutability triggers are in place).
- Auto-deploy on `main`.

### Database → Neon / Supabase / RDS

- Postgres 16.
- Connection pooling enabled (pgbouncer or provider-native).
- Daily backups retained 7 days.
- Read replica optional (production scale).

### Files → Cloudinary

- Production tier.
- Folder structure: `vendorbridge/<ownerType>/<ownerId>/<fileId>`.
- Signed upload preset for direct browser uploads (future v2; v1 uses backend proxy).

## 17.4 Release process

1. **Cut a release branch** from `develop`: `release/v0.x.y`.
2. **Bump versions** in `package.json`.
3. **Update CHANGELOG.md** with merged PRs.
4. **Open a PR** to `main`.
5. **CI runs**: lint, typecheck, test, build, docker build, security audit.
6. **Manual smoke test** on the preview environment.
7. **Merge to `main`** → production deploy.
8. **Tag** the commit: `git tag v0.x.y && git push --tags`.

## 17.5 Rollback

- **Frontend**: Vercel instant rollback via dashboard (no rebuild).
- **Backend**: re-deploy the previous Docker image. (Render/Railway keep the last 5 images.)
- **Database**: forward-only migrations mean rollback requires a "down" migration. For v1, we accept this — we keep the prior image deployable, and a new migration is written to undo (rare).
- **Migrations are never auto-reverted in production.** A failed migration blocks the release.

## 17.6 Observability

- **Logs**: structured JSON to stdout. Aggregated by the platform (Render's log stream, Vercel's log drains, or Datadog if available).
- **Errors**: Sentry SDK in both API and web.
- **Metrics**: Prometheus endpoint on the API (`GET /metrics`) — optional in v1.
- **Uptime**: UptimeRobot or BetterStack pinging `/api/v1/health`.

The `/api/v1/health` endpoint returns:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "db": "up",
  "checks": { "audit_triggers": "ok" }
}
```

## 17.7 Security hardening (production)

- TLS enforced (HSTS, see [13-SECURITY.md](13-SECURITY.md)).
- DB connection over TLS.
- Secrets in the platform's secret manager (no `.env` files on disk).
- Rate limiting enabled with conservative defaults.
- CORS restricted to the frontend origin.
- Cloudinary: signed uploads, folder-level access control.
- Dependencies: `pnpm audit` and Snyk in CI; high-severity findings block the release.

## 17.8 Scaling

For 1k+ concurrent users:

- Multiple API instances behind a load balancer.
- DB read replicas for read-heavy endpoints (dashboard, reports).
- Cloudinary CDN handles file bandwidth.
- Frontend on Vercel Edge (auto-scales).

For 10k+ concurrent users (future):

- Move notifications and audit writes to a queue (BullMQ + Redis).
- Add a read-cache for dashboards (Redis).
- Partition `audit_logs` by month.
- Migrate to a horizontally scaled Postgres (Citus, or move to managed Spanner/AlloyDB).

## 17.9 Backup and disaster recovery

- **DB**: daily automated backups; weekly manual snapshot exported to S3.
- **Files**: Cloudinary is the source of truth; no DB-side backup needed.
- **Source**: GitHub is the source of truth for code.
- **Recovery target**: RPO 24h, RTO 4h (production).

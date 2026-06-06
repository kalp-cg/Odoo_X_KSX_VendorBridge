# 16 — Local Setup

This document explains how to set up the project locally for development. For deployment, see [17-DEPLOYMENT.md](17-DEPLOYMENT.md).

## 16.1 Prerequisites

- **Node.js**: 20.x LTS (recommended via `nvm` or `volta`).
- **pnpm**: 9.x (`npm install -g pnpm`).
- **PostgreSQL**: 16 (local install or Docker).
- **Docker + Docker Compose** (optional but recommended for local DB and dependencies).
- **Git**.
- A code editor with TypeScript and ESLint support (VS Code recommended).

## 16.2 Repository layout (post-setup)

```
vendorbridge/
├── apps/
│   ├── api/                # NestJS backend
│   └── web/                # Next.js frontend
├── packages/
│   └── shared/             # Shared Zod schemas, types
├── doc/                    # This documentation
├── scripts/                # Dev scripts
├── .github/                # CI workflows
├── docker-compose.yml      # Local Postgres
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 16.3 First-time setup

```bash
# Clone
git clone <repo-url> vendorbridge
cd vendorbridge

# Install dependencies
pnpm install

# Copy env templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/shared/.env.example packages/shared/.env 2>/dev/null || true

# Start local Postgres
docker compose up -d postgres

# Apply migrations + seed (if available)
pnpm --filter @vb/api prisma migrate deploy
pnpm --filter @vb/api db:seed  # optional

# Start dev servers (parallel)
pnpm dev
```

`pnpm dev` runs both API and web via `turbo` or `concurrently`.

## 16.4 Environment variables

### `apps/api/.env`

| Var | Required | Description | Example |
|-----|----------|-------------|---------|
| `NODE_ENV` | yes | `development`, `production`, `test` | `development` |
| `PORT` | yes | API port | `4000` |
| `DATABASE_URL` | yes | Postgres connection | `postgresql://vb:vb@localhost:5432/vendorbridge` |
| `JWT_ACCESS_SECRET` | yes | RS256 private key (PEM) | (generated) |
| `JWT_ACCESS_PUBLIC_KEY` | yes | RS256 public key (PEM) | (generated) |
| `JWT_ACCESS_TTL` | yes | Access token TTL (seconds) | `900` |
| `JWT_REFRESH_SECRET` | yes | Refresh token secret (symmetric) | (random) |
| `JWT_REFRESH_TTL` | yes | Refresh token TTL (seconds) | `604800` |
| `CORS_ORIGINS` | yes | Comma-separated allowed origins | `http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary cloud name | (from cloudinary) |
| `CLOUDINARY_API_KEY` | yes | Cloudinary API key | |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary API secret | |
| `EMAIL_PROVIDER` | yes | `console` (v1), `sendgrid`, `ses` (v1.1) | `console` |
| `EMAIL_FROM` | yes | Default From address | `noreply@vendorbridge.com` |
| `SENDGRID_API_KEY` | no | Required if EMAIL_PROVIDER=sendgrid | |
| `LOG_LEVEL` | no | `info`, `debug`, `warn`, `error` | `info` |
| `RATE_LIMIT_TTL` | no | Throttler window (seconds) | `60` |
| `RATE_LIMIT_MAX` | no | Throttler max requests | `120` |

The `.env` file is validated by a Zod schema on app boot. If a required var is missing or malformed, the app refuses to start.

### `apps/web/.env`

| Var | Required | Description | Example |
|-----|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | yes | API URL used by the browser | `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | no | Display name | `VendorBridge` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | yes | For `next/image` | |
| `NEXTAUTH_URL` | no | (future) | `http://localhost:3000` |

**Anything starting with `NEXT_PUBLIC_` is exposed to the browser. Never put secrets there.**

## 16.5 Generating JWT keys

For local dev:

```bash
mkdir -p apps/api/keys
openssl genpkey -algorithm RSA -out apps/api/keys/jwt-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in apps/api/keys/jwt-private.pem -pubout -out apps/api/keys/jwt-public.pem
```

For production, generate via the hosting platform's secret manager.

## 16.6 Database operations

```bash
# Apply migrations
pnpm --filter @vb/api prisma migrate deploy

# Create a new migration after schema change
pnpm --filter @vb/api prisma migrate dev --name <name>

# Reset the database (dev only)
pnpm --filter @vb/api prisma migrate reset

# Open Prisma Studio
pnpm --filter @vb/api prisma studio
```

**Never run `migrate reset` in production.**

## 16.7 Seed data

A seed script (`apps/api/prisma/seed.ts`) creates:

- 1 admin user (`admin@vendorbridge.local` / `Admin@123`).
- 1 procurement officer.
- 1 manager.
- 2 sample vendors (one ACTIVE, one PENDING).
- 1 sample RFQ (DRAFT) for testing.

Seeds are **only** for development. They are not idempotent across environments.

## 16.8 Common commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Run all apps in dev mode |
| `pnpm --filter @vb/api start:dev` | Run API only |
| `pnpm --filter @vb/web dev` | Run web only |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all apps |
| `pnpm typecheck` | Type-check all apps |
| `pnpm test` | Run all unit tests |
| `pnpm test:e2e` | Run e2e tests |
| `pnpm format` | Format with Prettier |

## 16.9 VS Code settings (recommended)

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [["cN\\(([^)]*)\\)"]]
}
```

Recommended extensions:

- ESLint
- Prettier
- Prisma
- Tailwind IntelliSense
- Error Lens

## 16.10 Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED 5432` | Postgres is not running. `docker compose up -d postgres` |
| `prisma migrate deploy` fails with P3009 | DB has drift. Run `prisma migrate resolve` or `prisma migrate reset` (dev only) |
| `JWT_PUBLIC_KEY malformed` | Ensure PEM has newlines; many secret managers strip them — base64-decode and reformat |
| Cloudinary upload 401 | Check `CLOUDINARY_*` envs; verify the API secret is correct |
| Next.js 401 on every request | Check `NEXT_PUBLIC_API_BASE_URL` matches the API port |
| Migration triggers missing | See [11-AUDIT-LOGS.md](11-AUDIT-LOGS.md) — triggers are in a separate migration `audit_immutability` |

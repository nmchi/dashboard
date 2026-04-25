# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production (standalone output)
npm run start        # Run production build
npm run lint         # Run ESLint

# Database
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma migrate dev       # Apply migrations in development
npx prisma db seed           # Seed database (uses prisma/seed.ts via ts-node)

# Docker (full stack with PostgreSQL)
docker-compose up -d         # Start PostgreSQL (port 5433) + app (port 3000)
```

## Architecture

This is a **Next.js (App Router) + TypeScript** lottery management dashboard for Vietnamese lottery betting, with PostgreSQL via Prisma ORM.

### Role-Based Access

Three user roles with strict hierarchy:
- **ADMIN** → `/admin/*`: manage agents, provinces, bet types
- **AGENT** → `/agent/*`: manage players, view player tickets, configure bet settings
- **PLAYER**: no dashboard; tickets submitted through agent interface

Role enforcement happens in three layers:
1. `src/middleware.ts` — validates session cookie on every request
2. `src/app/admin/layout.tsx` / `src/app/agent/layout.tsx` — role-based redirects
3. API routes — check `session.user.role` and verify user hierarchy (parentId IDOR prevention)

### Key Directories

- `src/app/api/` — API routes (tickets, lottery crawl, auth, cron, users)
- `src/app/admin/` and `src/app/agent/` — role-specific page trees
- `src/components/` — UI split by role (`admin/`, `agent/`) plus shared `ui/` (Radix/shadcn wrappers)
- `src/lib/` — auth config (`auth.ts`), Prisma client (`prisma.ts`), session helpers
- `src/server/` — Next.js Server Actions for data mutations (admin and agent)
- `src/utils/` — core business logic (see below)
- `prisma/schema.prisma` — database schema; `prisma/migrations/` for history

### Core Business Logic (`src/utils/`)

| File | Purpose |
|------|---------|
| `parser.ts` | NLP-like parser for freeform Vietnamese lottery bet messages |
| `ticket-processor.ts` | Ticket processing pipeline (parse → validate → store) |
| `result.ts` | Win calculation and digit extraction per bet type |
| `lottery-crawler.ts` | Web scraper that fetches official lottery draw results |
| `normalizer.ts` | Vietnamese text normalization for input parsing |
| `bet-type.ts` / `province.ts` | Lookup helpers for bet types and provinces |
| `permutation.ts` | Combinatorial logic for multi-number bet types |

### Data Models (Prisma)

Key relationships:
- `User` has a `parentId` self-relation (AGENT → PLAYER hierarchy)
- `Ticket` → many `Bet` records (one ticket, multiple individual bets)
- `Bet` references `LotteryProvince` and `BetType`
- `LotteryResult` stores prizes as JSON per draw date/province
- `User.betSettings` stores per-region pricing/win-rate config as JSON

### Authentication

Uses **Better Auth** with username plugin and bcryptjs. Session is stored as a secure cookie. The server-side session is read via `getSession()` from `src/lib/auth-session.ts`. Client-side helpers are in `src/lib/auth-client.ts`.

### Multi-Region Lottery

Supports three Vietnamese lottery regions: **MB** (North/Miền Bắc), **MT** (Central/Miền Trung), **MN** (South/Miền Nam). Region affects draw schedules, province availability, and prize structures. Lottery results are fetched automatically via a cron endpoint (`/api/cron/lottery`) secured with `CRON_SECRET`.

### Environment Variables

```
DATABASE_URL         # PostgreSQL connection string
BETTER_AUTH_SECRET   # Auth session signing key
CRON_SECRET          # Bearer token for cron endpoint protection
```

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

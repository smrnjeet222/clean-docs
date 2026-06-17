# Ajaia Docs — Collaborative Document Editor

A lightweight collaborative document editor: rich-text editing, file attachments,
per-user sharing with an owned-vs-shared distinction, and durable persistence.

Built for the Ajaia Full Stack Product Engineer assignment.

- **Live demo:** `<DEPLOY_URL>` *(fill in after deploy)*
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · Tiptap · TanStack Query · Zustand · Prisma 7 · Postgres (Neon) · iron-session

## Test credentials (seeded)

| User  | Email               | Password      | Role on demo doc |
|-------|---------------------|---------------|------------------|
| Alice | alice@example.com   | password123   | Owner            |
| Bob   | bob@example.com     | password123   | Shared (edit)    |

Sign in as Alice to see an **owned** document; sign in as Bob to see the same
document under **Shared with you**.

## Features

- **Documents** — create, rename, edit, autosave, reopen. Rich text: bold, italic,
  underline, strikethrough, H1–H3, bullet & numbered lists (Tiptap).
- **File upload** — attach a file to any document. Supported: PNG, JPG, GIF, WebP,
  PDF, TXT, Markdown, CSV. Max 5 MB. Stored in Postgres, served back via a
  permission-checked route.
- **Import / export** — create a new document by importing a `.txt` or `.md` file
  (Markdown is parsed to rich text); export any document back out as `.md` or
  `.txt`. Import lives on the dashboard ("Import .txt / .md"); export is in the
  editor header.
- **Sharing** — owner grants another registered user `view` or `edit` access by
  email. Owned vs shared documents are visually distinguished on the dashboard;
  read-only users get a disabled editor.
- **Live freshness on shared docs** — a shared document is polled; a co-editor's
  changes appear without a manual refresh. Concurrent edits are guarded by
  optimistic concurrency (document `version` + `409`), so no one silently
  overwrites anyone — a conflict surfaces a "Reload latest" banner.
- **Persistence** — documents, formatting (as sanitized HTML), shares, and files
  all survive refresh, stored in Postgres via Prisma.
- **Auth** — email/password (bcrypt) with encrypted `iron-session` cookies.

## Local setup

Prereqs: Node 20.9+ and a Postgres database (a free [Neon](https://neon.tech)
project works; any Postgres URL is fine).

```bash
npm install                      # also runs `prisma generate`

cp .env.example .env             # then edit:
#   DATABASE_URL=...             # Neon pooled connection string
#   SESSION_SECRET=...           # openssl rand -base64 32

npm run db:push                  # create tables
npm run db:seed                  # create Alice + Bob + demo shared doc

npm run dev                      # http://localhost:3000
```

## Commands

| Command            | Purpose                                  |
|--------------------|------------------------------------------|
| `npm run dev`      | Dev server                               |
| `npm run build`    | Production build (runs `prisma generate`)|
| `npm test`         | Run the automated test suite (Vitest)    |
| `npm run db:push`  | Sync schema to the database              |
| `npm run db:seed`  | Seed demo users + document               |

## Deploy (Vercel)

1. Push to GitHub, import the repo in Vercel.
2. Set env vars `DATABASE_URL` and `SESSION_SECRET` in the Vercel project.
3. Deploy. Then run `npm run db:push && npm run db:seed` once against the prod
   `DATABASE_URL` (locally with the prod URL, or via the Neon SQL console + seed).

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design, priorities, tradeoffs.
- [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) — how AI was used, modified, and verified.
- [`SUBMISSION.md`](./SUBMISSION.md) — deliverable index.

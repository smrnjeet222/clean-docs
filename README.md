# Folio — Collaborative Document Editor

A lightweight collaborative document editor: rich-text editing, file attachments,
per-user sharing with an owned-vs-shared distinction, live freshness on shared
documents, and durable persistence.

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
- **Import / export** — import a `.txt`/`.md` file as a **new document** (dashboard)
  or **append it into the open draft** (editor); Markdown is parsed to rich text.
  Export any document to `.md` or `.txt` from the editor header.
- **Sharing & access** — owner grants/unshares `view` or `edit` access by email.
  Owned vs shared documents are visually distinguished on the dashboard; read-only
  users get a disabled editor. Any reader can **duplicate** a document into their own
  copy; a shared user can **leave**; the owner can **delete**.
- **Live freshness on shared docs** — a shared document is polled (and refetched on
  tab focus); a co-editor's changes appear without a manual refresh. Concurrent edits
  are guarded by optimistic concurrency (document `version` + `409`), so no one
  silently overwrites anyone — a conflict surfaces a "Reload latest" banner.
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

## Status

**Working** — auth; create/rename/rich-text edit with autosave; file upload;
import/export (`.txt`/`.md`); sharing with view/edit roles + owned-vs-shared
distinction; duplicate / leave / delete; live freshness on shared docs with
optimistic-concurrency conflict handling. Zod validation, server-side access
control, 16 automated tests, green build, ESLint clean.

**Intentionally cut** — real-time character-level co-editing (CRDT); share-by-link
/ invites for non-registered users; soft-delete / trash.

**Next** — presence indicators over the existing poll; per-paragraph version history
on the `version` field; tokenized share-by-link.

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design, priorities, tradeoffs, scope cuts.
- [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) — AI tools used, outputs modified/rejected, and how it was verified.

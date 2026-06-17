# Submission — Ajaia Docs

Full Stack Product Engineer assignment. Lightweight collaborative document editor.

## Links

- **Live deployment:** `<DEPLOY_URL>`
- **Repository:** `<REPO_URL>`
- **Walkthrough video (3–5 min):** `<LOOM_OR_YOUTUBE_URL>`

## Test credentials

| Email             | Password    | Role on demo doc |
|-------------------|-------------|------------------|
| alice@example.com | password123 | Owner            |
| bob@example.com   | password123 | Shared (edit)    |

## Contents

| Path               | What it is |
|--------------------|------------|
| `README.md`        | Setup, run, deploy, features, credentials |
| `ARCHITECTURE.md`  | Design, priorities, tradeoffs, scope cuts |
| `AI_WORKFLOW.md`   | AI tools used, outputs modified/rejected, verification |
| `prisma/schema.prisma` | Data model: User, Document, Share, FileAsset |
| `prisma/seed.ts`   | Seeds demo users + a shared document |
| `src/lib/`         | DB client, session, access control, HTML sanitizer |
| `src/app/api/`     | Auth, documents, sharing, file upload/download routes |
| `src/components/`  | Auth form, dashboard, Tiptap editor + share/files panels |
| `src/lib/__tests__/` | Vitest suite (HTML sanitization / XSS) |

## Requirements coverage

- [x] Create / rename / edit / save / reopen documents
- [x] Rich text: bold, italic, underline, strikethrough, headings, lists
- [x] File upload (PNG/JPG/GIF/WebP/PDF/TXT/MD/CSV, ≤5 MB) — documented in README + UI
- [x] Sharing: owner designation, grant access by email, owned-vs-shared distinction
- [x] Persistence across refresh (Postgres) with formatting preserved
- [x] Setup/run instructions + deployable build
- [x] Input validation (Zod) + error handling + server-side access checks
- [x] Automated test (Vitest)
- [x] Architecture note + AI workflow note

## Run locally

```bash
npm install
cp .env.example .env   # set DATABASE_URL + SESSION_SECRET
npm run db:push && npm run db:seed
npm run dev            # localhost:3000
npm test               # test suite
```

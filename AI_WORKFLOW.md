# AI Workflow Note

## Tools used

- **Claude (agentic coding)** — primary driver: scaffolding, schema, API routes,
  React components, tests, and docs.
- **Local framework docs** — Next.js 16 and Prisma 7 ship breaking changes vs. the
  models' training data, so I had the agent read the *installed* version's docs
  (`node_modules/next/dist/docs/`, Prisma config types) before writing code rather
  than trusting recall.

## Where AI materially accelerated the work

- **Boilerplate at speed** — the full CRUD surface (auth, documents, share, files),
  Zod schemas, and the Tiptap editor + toolbar were generated far faster than by
  hand, freeing the time budget for the parts that needed judgment (access model,
  tradeoffs, scope cuts).
- **Surfacing breaking changes** — instead of debugging cryptic runtime errors, the
  agent read the version-16 upgrade guide and Prisma 7 config types up front.

## AI output I modified or rejected

1. **Prisma 6-style schema (rejected).** The first pass put
   `url = env("DATABASE_URL")` in `schema.prisma` and `new PrismaClient()` with no
   adapter — valid pre-v7. Prisma 7 **removed** that: the URL moves to
   `prisma.config.ts` and the runtime needs a driver adapter. Fixed by adding
   `@prisma/adapter-pg` and `PrismaPg` in `src/lib/db.ts`.
2. **Duplicate Underline extension (modified).** Plan was to add
   `@tiptap/extension-underline` alongside StarterKit. Inspecting the installed
   StarterKit showed it already bundles Underline (and Link) in Tiptap 3 — adding
   it again would double-register and throw. Dropped the separate import.
3. **Default dark-mode CSS (modified).** The scaffold's `prefers-color-scheme`
   block fought the explicit light UI. Replaced with a deterministic theme so the
   demo renders consistently for reviewers.
4. **Default `prose` styling (caught gap).** Tailwind v4 doesn't ship typography;
   `prose` classes were inert until `@tailwindcss/typography` was added via the v4
   `@plugin` directive.

## Architecture deepening pass (post-MVP)

After the MVP worked, I ran an AI-assisted architecture review and implemented the
top recommendation as a deliberate refactor:

- **Save lifecycle → explicit finite state machine** (zustand). The pure
  `nextStatus` transition is now the test surface (8 tests).
- **Server-state → one TanStack Query seam**, replacing scattered `fetch` +
  loading/error booleans. Auth was deliberately left as direct calls — judgment
  over dogma; a one-shot login gains nothing from a cache.
- **Safe polling for shared Documents** — reconciled against the machine, with
  server-side optimistic concurrency (`version` + 409) so collaborators can't
  silently overwrite each other. The naive `refetchInterval` was explicitly
  rejected as a data-loss hazard.

Two AI outputs were corrected during this pass:

- **React Compiler lint (rejected).** The first hook draft read `storeRef.current`
  and `store.getState()` during render — flagged by Next 16's
  `react-hooks/refs` + compiler rules. Reworked to create the store via a
  `useState` initializer and read setters through `useStore` selectors.
- **Implicit declaration cycle (fixed).** The debounce had `flush` and
  `scheduleFlush` referencing each other; the compiler flagged use-before-declare.
  Broke the cycle with a `flushRef`.

## How I verified correctness & reliability

- **Type safety** — `next build` runs the TypeScript compiler over all 13 routes;
  build is green, ESLint clean.
- **Automated tests** — `npm test` (Vitest, 12 tests): `sanitizeDocumentHtml`
  (stored-XSS — strips `<script>`, `onclick`, `javascript:` URLs) and the save
  machine's `nextStatus` (every meaningful transition, including
  `dirty + remoteChanged → conflict` and "conflict only escapes via reload").
- **Recovered a corrupted toolchain, didn't paper over it.** A stray
  `node_modules/.pnpm` store (knip) left the npm tree inconsistent
  (`isDescendantOf` null / phantom peer conflict). I diagnosed it to the hybrid
  npm/pnpm state rather than blindly forcing `--legacy-peer-deps`, then did a clean
  reinstall.
- **Access model reasoned, not assumed** — every mutating route re-checks
  `getAccessLevel` server-side; the UI is never trusted for permissions.
  Non-readable docs return 404 to avoid ID enumeration.
- **Manual walkthrough** — seeded Alice/Bob to exercise the owned-vs-shared paths,
  edit→refresh persistence, upload, and read-only enforcement.

## Honest assessment

AI did the typing; the engineering decisions — relational model, centralized
access function, files-in-DB tradeoff, sanitize-on-write, and what to cut
(real-time CRDT, invite flow) — were directed and reviewed deliberately. The two
framework breaking changes are exactly where blind trust in AI output would have
failed, and where reading the installed docs paid off.

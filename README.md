# NEVORA — SSC AI Tutor

PURE IN PURPOSE. TRUE IN VALUE.

A working Next.js application: chat UI, Google sign-in, per-subject
resource namespaces, a PDF ingest → chunk → embed → index pipeline,
retrieval-augmented answers with textbook-priority logic, source
citations, optional web search, and an owner-only resource manager.

## Architecture at a glance

```
Upload PDF ──▶ Parse text (+ OCR fallback) ──▶ Chunk (page-tagged)
           ──▶ Embed chunks ──▶ Store in DB (Chunk table = the index)
           ──▶ Resource marked READY

Question ──▶ Embed question ──▶ Cosine-similarity search over that
          subject's stored chunks ONLY ──▶ top matches + chat history
          ──▶ sent to the AI model with a textbook-priority system
          prompt ──▶ answer + source citations
```

The raw PDF (`data/uploads/`) and the searchable index (`Chunk` rows
in the database) are deliberately separate. Chat-time retrieval never
re-opens the PDF — see `src/lib/retrieval.ts`.

## Centralized configuration

Everything that might change later lives in ONE place:

- **API keys / model / provider** → `.env` (copy from `.env.example`),
  read only through `src/lib/config.ts`. Change the model or swap
  providers by editing this file/`.env` — no other file references
  a key directly. Keys are never sent to the browser (Next.js only
  exposes `NEXT_PUBLIC_*` vars client-side, and none are used here).
- **Subject list** → `src/lib/subjects.ts`. Add/rename/remove a
  subject, then run `npx prisma db seed` (or restart — the admin
  panel reads live from the DB, so existing resources are unaffected
  by reordering).
- **Branding text** → `src/lib/branding.ts` (client-safe) and
  `src/lib/config.ts` (`branding` key, server-side).

## Setup

```bash
npm install
cp .env.example .env        # fill in the values below
npx prisma db push          # create the SQLite database
npx prisma db seed          # load the default subject list
npm run dev
```

### Required for basic chat to work
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `OPENAI_API_KEY` — used only for embeddings (resource indexing/search)
- `NEXTAUTH_SECRET` — any long random string (`openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud Console →
  OAuth consent screen → Web application → redirect URI
  `http://localhost:3000/api/auth/callback/google` (add your deployed
  domain's equivalent URL too)
- `OWNER_EMAIL` — the Google account that should get Resource Manager
  access. The first time you sign in with this email, `isOwner` is
  set automatically (see `src/lib/auth.ts`).

### Optional
- `WEB_SEARCH_PROVIDER=tavily` + `WEB_SEARCH_API_KEY` — enables real
  web search for "Others" mode / questions outside your uploaded
  resources. Leave as `none` and the app still works — it just won't
  add web results.

## Adding a resource (no code changes needed)

1. Sign in with the owner Google account → **Resource manager**.
2. Pick a subject, name the document, mark it Textbook / Guide /
   Reference, upload the PDF.
3. Status shows **PROCESSING** while it's parsed/chunked/embedded,
   then flips to **READY**. Only READY resources are searched.
4. Remove or re-index anytime from the same screen.

Textbook-tagged resources are given a small ranking boost over
Guide/Reference at query time (see `src/lib/retrieval.ts`), and the
AI's system prompt (`src/lib/ai.ts`) explicitly instructs it to treat
textbook content as the authority for exam-standard facts, using
guide content only to learn answer structure/style — matching the
"exam correctness over general internet correctness" requirement.

## OCR for scanned PDFs

`src/lib/ingest.ts` detects pages with near-zero extracted text and
routes them to an OCR fallback (`tesseract.js`, English+Bangla).
Rendering a specific PDF page to an image for OCR needs a rasterizer
(e.g. `pdftoppm`, or `pdf-lib`/`pdf.js` canvas rendering) — that one
integration point is marked clearly in the file rather than silently
skipped, since the right choice depends on your hosting environment
(serverless vs. a container with poppler-utils installed).

## Get a live URL in ~5 minutes (Vercel)

This is how you turn the code into something you and your friend can
actually open on a phone — no server management.

1. Create a free account at vercel.com (sign in with GitHub is easiest).
2. Push this project to a new GitHub repo (or use Vercel's "Upload"
   option to drag-and-drop the folder — no git required).
3. In Vercel: **New Project** → select the repo/folder → it auto-detects
   Next.js.
4. Before deploying, add **Environment Variables** (same names as
   `.env.example`): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (set to the Vercel URL Vercel
   shows you, e.g. `https://nevora-yourname.vercel.app`),
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`,
   `DATABASE_URL` (see database note below).
5. For the database, SQLite's local file won't persist on Vercel —
   create a free Postgres database in 1 click via Vercel's Storage
   tab (or neon.tech / supabase.com), copy its connection string into
   `DATABASE_URL`, and change `provider = "sqlite"` to
   `provider = "postgresql"` in `prisma/schema.prisma` before pushing.
6. In Google Cloud Console, add
   `https://your-vercel-url.vercel.app/api/auth/callback/google` as
   an authorized redirect URI on your OAuth client.
7. Deploy. Visit the URL — that's your live NEVORA.

## Installing it like an app on Android

The app ships as a PWA (`public/manifest.json`, `public/sw.js`).
Once it's live at a real URL:
1. Open the URL in Chrome on Android.
2. Tap the menu (⋮) → **Add to Home screen** / **Install app**.
3. It installs with the NEVORA icon, opens full-screen without browser
   chrome, and behaves like a native app — without needing a signed
   `.apk` or Play Store listing. If you later want an actual `.apk`
   (e.g. for Play Store distribution), wrap this same code with
   Capacitor (`npx cap add android`) — no rewrite needed, it reuses
   this whole app as-is.

## Production notes

- **Database**: SQLite is fine for one or two users. For real
  multi-user use, change `provider` in `prisma/schema.prisma` from
  `sqlite` to `postgresql` and point `DATABASE_URL` at a real Postgres
  instance (e.g. Supabase, Neon, Railway) — no application code
  changes needed, Prisma abstracts the difference.
- **File storage**: raw PDFs are saved to `data/uploads/` on local
  disk. On serverless hosting (Vercel) this is ephemeral — swap the
  two lines in `src/app/api/upload/route.ts` for an S3/GCS upload.
- **Ingestion queue**: large PDF ingestion currently runs as a
  fire-and-forget async call after upload. This works on a
  long-running server (Render, Fly.io, a VPS) but can be killed
  early by serverless function timeouts. For heavy use, move the
  `ingestResource()` call into a real queue (BullMQ + Redis, or a
  cron-polled "PROCESSING" table) — the function itself doesn't need
  to change.
- **Multi-user isolation**: chats and resources are already scoped by
  `userId` at the query level (see the API routes) — a second user
  signing in gets their own chat history automatically. Resources
  uploaded by the owner are visible to all users of a subject (that's
  the intended "shared knowledge base"); flag if you wanted per-user
  private resources instead.

## What's a placeholder vs. production-ready

Production-ready as written: subject namespacing, chunk-and-embed
indexing, retrieval, textbook-priority prompting, source citations,
chat CRUD, TTS, owner-gated admin panel, centralized config.

Needs a decision from you before going live: which OCR rasterizer to
wire in, which file storage backend, and which queue for ingestion at
scale (all called out above, each is a small, isolated change).

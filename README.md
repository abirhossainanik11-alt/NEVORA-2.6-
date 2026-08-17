# NEVORA AI

NEVORA AI is a server-backed SSC educational assistant designed around uploaded textbook/guide resources as the primary academic source. The application keeps accounts, conversations, source citations, PDF resources, extracted documents, chunks and pgvector embeddings in persistent server-side infrastructure.

## What is included

- Next.js 14 + React + TypeScript + Tailwind
- Email/password authentication with bcrypt-hashed passwords
- Signed HTTP-only session cookies and server-side role enforcement
- One protected Admin account seeded with the required initial password `261209`
- Admin password change; the previous password stops working immediately
- Ten configurable SSC subject slots, each with up to 5 PDF resources
- Real device PDF upload; no browser/localStorage file persistence and no URL entry
- Persistent PDF storage through S3-compatible object storage, with a local filesystem fallback for persistent Node servers
- Automatic PDF processing: store → extract → optional OCR fallback → page metadata → chunk → embed → pgvector index → READY
- Resource states: UPLOADING, PROCESSING, INDEXING, READY, FAILED
- Retry, re-index and delete cleanup
- Per-subject RAG filtering and textbook-first retrieval ordering
- Page/chapter/section metadata and structured source citations
- Printed-page and physical PDF-page metadata are kept separately when detectable
- Chat history persistence, conversation deletion and reopening
- Chat image attachment with preview; no voice feature
- Explain action that stores a separate explanation on the assistant message
- KaTeX mathematical rendering
- Admin AI provider/model/temperature/retrieval/embedding configuration
- Encrypted server-side provider API-key storage; keys are never sent to frontend JavaScript
- Configurable NEVORA developer identity
- Responsive Android-friendly UI with light/dark themes
- PWA manifest, service worker and installable app shell
- Privacy and About pages
- Security headers, input validation and basic login/register rate limiting

## Architecture

```text
Admin browser
  │ multipart PDF
  ▼
Next.js Admin API
  │
  ├── persistent object storage (S3/R2/B2/etc.)
  └── PostgreSQL + Prisma
        │
        ├── Resource metadata
        ├── Document / page-aware Chunks
        ├── pgvector embeddings
        └── source metadata

Chat
  │ selected subject + question
  ▼
subject-scoped vector retrieval
  │
  ▼
textbook → guide → reference → notes priority
  │
  ▼
configured AI provider
  │
  ▼
answer + structured source citations
```

## Production services

Required:

1. PostgreSQL with the `vector`/pgvector extension
2. A configured chat AI provider API key
3. An OpenAI `text-embedding-3-small` key for the current 1536-dimensional pgvector schema
4. Persistent object storage for PDFs in production (S3-compatible storage is recommended)

The application does not require a manual backend command after each PDF upload. The Admin upload request stores the file and automatically runs the processing pipeline. Processing is server-side and the resource remains persisted if the browser closes or the user logs out.

For large files or high-volume deployments, use a deployment environment that supports long-running Node requests or move the same `processResource()` function behind a persistent worker/queue. The application includes stale-processing recovery: resources left in PROCESSING/INDEXING for more than 15 minutes are marked FAILED and can be retried.

### Persistent storage

Configure all S3-compatible variables:

- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`
- `S3_ENDPOINT`

If all are absent, PDFs are written under `NEVORA_STORAGE_DIR` (default `./storage`). This fallback is suitable for local development or a persistent Node server. It is **not** durable on typical ephemeral/serverless filesystems, so production serverless deployments should use object storage.

## Environment variables

Copy `.env.example` to `.env` and supply real secrets. Never commit `.env`.

- `DATABASE_URL`
- `NEVORA_SESSION_SECRET` — long random secret for sessions
- `NEVORA_SECRET_KEY` — 32+ character secret used to encrypt provider keys
- `NEVORA_ADMIN_EMAIL` — initial admin email used by the seed script
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT`
- `NEVORA_STORAGE_DIR` — optional local persistent storage path

Provider API keys are entered from Admin → AI Configuration and encrypted in the database. Do not put provider API keys in `.env`.

## Database setup

1. Provision PostgreSQL with pgvector support.
2. Ensure the vector extension is available:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. Install dependencies:

```bash
npm install
```

4. Apply Prisma migrations:

```bash
npx prisma migrate deploy
```

5. Seed the initial subjects, system configuration and Admin account:

```bash
npm run prisma:seed
```

The initial Admin password is `261209`. Change it immediately from Admin → Security. The seed also deactivates legacy subject records that are no longer part of the ten default SSC subjects.

## PDF/OCR processing

Normal text PDFs use native per-page PDF text extraction. Pages with little/no native text attempt a server-side OCR fallback using Tesseract.js with English/Bangla language data and PDF page rendering. OCR is best-effort; NEVORA never invents text or page metadata when extraction is unavailable.

Each resource stores:

- resource ID
- original filename
- Admin-provided source title
- resource type
- subject
- file size
- upload/update timestamps
- page count
- processing status/progress
- OCR usage/quality indicator
- processing error when failed

Re-indexing first removes the old Document/Chunk/vector data, then rebuilds the resource, so a normal re-index does not create duplicate indexed records.

## Source citations

Retrieved chunks carry:

- source title
- chapter
- section
- physical PDF page
- printed page when detectable
- chunk ID

The UI displays the exact page when known and explicitly shows when the exact page is unavailable. It never substitutes a guessed page number.

## Authentication and security

- Passwords are hashed with bcrypt.
- Sessions are signed JWTs in HTTP-only, SameSite cookies.
- Admin authorization is enforced on the server for every Admin API.
- Provider keys are encrypted at rest with AES-256-GCM using `NEVORA_SECRET_KEY`.
- Frontend responses only contain masked key previews.
- PDF uploads are limited to 25 MB, validated as PDFs, and stored using generated safe object keys.
- Image chat input is limited to JPG/PNG/WebP and 6 MB.
- Login and registration have basic per-process rate limiting.
- Security headers are configured in `next.config.js`.
- No Google OAuth or provider callback configuration is required.

The rate limiter is intentionally lightweight and process-local. For a large multi-instance deployment, place authentication rate limiting at the platform/WAF layer as well.

## PWA / Android

The project includes a web manifest, SVG app icons, service worker and responsive viewport configuration. Android Chrome can install it using its normal Add to Home screen/install flow when the deployment is served over HTTPS.

This is a web PWA, not a native APK build.

## Verification performed in this build environment

The repository was inspected after implementation and all TypeScript/TSX files were syntax-transpiled with the available TypeScript compiler. Obvious TODO/not-implemented runtime placeholders were scanned for and removed where applicable.

A full `npm install` / Next production build and Prisma validation could not be completed in this environment because external package installation/network access timed out and no installed `node_modules`/Prisma CLI was available. Consequently, the final project still requires the normal dependency installation plus real PostgreSQL/pgvector, AI API and object-storage integration test in the deployment environment.

These are infrastructure/testing limitations, not browser-only mock implementations.

# AI Interview Prep Kit

A full-stack application that turns a pasted job description, company website, and available preparation time into a structured interview-preparation kit. Each kit includes:

- Evidence-bound company research
- Extracted requirements
- Complex scenario questions
- Rapid-recall flashcards
- A deterministic study plan
- Practice tracking
- A weak-spots report

## Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js App Router, React, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express 5, native MongoDB driver |
| **AI** | Google Gemini via `@google/genai` (default model `gemini-3.5-flash-lite`, override with `GEMINI_MODEL`) |
| **Retrieval** | Native `fetch` and Cheerio |

Retrieval uses native `fetch` and Cheerio to keep deployment small, avoid external crawler-service dependencies, and let local evaluation URLs work without a browser runtime.

The frontend is intentionally a quiet black, white, and zinc interface. The backend is a separately deployed HTTP service so a Vercel frontend can connect directly to SSE without relying on a serverless rewrite to hold an event stream open.

## Setup

**Requirements:** Node.js 20+ and MongoDB (local or Atlas). Obtain a Gemini API key with free-tier access.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

### Backend environment (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/interview_prep_kit
COOKIE_SECRET=a-long-random-secret
GEMINI_API_KEY=your-key
```

### Frontend environment (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Production

- Deploy the frontend to Vercel.
- Deploy the backend to any Node host with long-lived HTTP response support.
- Set `FRONTEND_URL` to the exact Vercel origin and `NEXT_PUBLIC_API_URL` to the backend's public HTTPS origin.
- Configure MongoDB network access for the backend host.
- Use a strong `COOKIE_SECRET`.
- Set `NODE_ENV=production` (cookies then become `Secure`).

## Batch Evaluation

The evaluator executes the exact same orchestration path as HTTP kit creation, running sequentially to respect free-tier rate limits.

```bash
cd backend
npm run evaluate -- --input cases.json --output kits.json
```

- **Input:** an array of `{ "id", "jd", "company_url", "days" }`.
- **Output:** an assessment-compliant object containing `version`, `generated_at`, and the array of evaluated kits.
- One failed case is recorded and does not stop later cases.
- Local company URLs are allowed outside production so the evaluator can crawl local fixtures.

## High-Level Architecture

```text
Next.js / Vercel ── credentialed fetch + direct SSE ──> Express API
                                                        ├─ MongoDB: users, sessions, kits
                                                        ├─ Retrieval: AI-steered crawler + public discussion lookup
                                                        ├─ Gemini: Extraction, brief, questions, flashcards
                                                        └─ Deterministic: Coverage, scheduling, validation
```

### Authentication

A minimal stateful session design:

- bcrypt password hashes
- Random 32-byte session IDs stored in MongoDB
- Seven-day TTL index
- `HttpOnly`, `SameSite=Lax` cookie

Every database query strictly combines `kitId` with the authenticated `userId`, ensuring strong multi-tenant isolation.

### Concurrency & Resources

- MongoDB uses one process-wide connection pool.
- Active generation jobs retain an `AbortController`.
- SSE listeners and heartbeat timers are removed immediately upon client disconnect.
- The event emitter is shared process-wide.

This supports ~50 simultaneous generations without the overhead of Redis or BullMQ. For multi-instance scaling, a message broker would be introduced.

## Retrieval and Generation Sequence

The orchestration logic intentionally decouples research, extraction, and generation to maximize prompt focus and minimize hallucination.

1. **AI-Steered Crawler** – Validates the URL, fetches the homepage, and extracts all links. Instead of a fragile hardcoded list of candidate words (e.g., "careers", "about"), a lightweight Gemini prompt analyzes anchor text and URLs to select the best targets. `robots.txt` is respected at every step.
2. **Public Search** – A best-effort lookup for public interview discussion (e.g., on Reddit). If absent, the gap is recorded honestly.
3. **Skill Extraction** – Gemini extracts all distinct, testable skills (technical, behavioral, leadership, system design) from the JD. It decomposes compound requirements and ignores non-testable fluff (e.g., "5 years experience"). Requirements receive stable IDs, dynamic categories (`kind`), and `must`/`nice` priorities.
4. **Briefing & Flashcards** – Gemini synthesizes the company brief from the scraped context. Concurrently, it generates a high volume of rapid-recall flashcards that test the subject matter of the skills, not the meta-text of the job description.
5. **Multi-Requirement Questions** – Gemini generates interview questions. To avoid bloat and trivial 1:1 mapping, the prompt forces broad categorization (e.g., "System Design", "Frontend Architecture") and demands complex scenarios that synthesize and evaluate multiple requirements simultaneously.
6. **Coverage Loop** – Node code (not the model) calculates coverage. A second targeted AI pass runs for any requirement (must or nice) missing a question. A kit is rejected if gaps persist after two passes, as an incomplete kit fails its primary job.
7. **Deterministic Scheduling** – Node code assigns durations based on question difficulty, sorts must-have skills earlier in the timeline, and distributes the load mathematically across exactly the requested number of days (1 to 60).
8. **Validation** – The complete schema is strictly validated before persistence.

## State Management: Generated, Edited, and Pinned Data

A core challenge was allowing AI regeneration without destroying user effort. State is represented by an `is_edited` boolean flag on array subdocuments (questions, flashcards).

- **Generated:** New components lack the flag (`is_edited: false`).
- **Edited/Pinned:** Any user modification (via `PATCH`) or manual creation (via `POST`) automatically sets `is_edited: true`.
- **Safe Regeneration:** When a user regenerates a category, the controller retains any question in that category where `is_edited === true`, deletes only the untouched generated questions, fetches fresh AI output, merges the two sets, and recalculates coverage. Hand-authored work is immune to AI regeneration.

Users have full CRUD capabilities. They can shift questions across schedule days, create custom categories on the fly, and reorder elements — none of which is blocked by hardcoded enums.

## Resiliency and Edge Cases

Postings from the open web fail predictably. The architecture handles these gracefully:

| Scenario | Behavior |
| --- | --- |
| **Invalid URL / 404 / Timeout** | Treated as a partial-research outcome, not a kit failure. The brief explicitly states what could not be verified. |
| **Missing hiring page** | The AI-steered crawler falls back to the best available pages, or skips if none are viable. |
| **Stub job description** | Extraction returns only explicit data. A thin JD yields a thin kit. |
| **No public discussion** | The gap is recorded in the `research.errors` array; brief generation proceeds with only crawled text. |
| **LLM JSON failure** | The structured `generateJson` utility retries rate-limits or transient failures with bounded exponential backoff and jitter (2s, 5s, 10s, 20s). Persistent failures abort generation and mark the kit as failed. |
| **Duplicate submission** | Handled harmlessly; duplicates intentionally spawn independent jobs and independent kits. |
| **1-day vs 60-day schedules** | The deterministic scheduler leaves days empty for thin kits at 60 days, and packs everything into a single session at 1 day. |

## Key Design Decisions

- **Dynamic everything:** No hardcoded category enums or scraper keywords. AI-assigned dynamic categories and flexible string schemas let the system adapt to roles ranging from Deep Learning Engineer to Corporate Legal Counsel.
- **AI crawler selection:** Passing links to a lightweight AI prompt costs minimal tokens but greatly improves scrape accuracy over regex heuristics, surfacing culture and hiring pages even when named uniquely (e.g., "Life at [Company]").
- **No heavy queues:** Node's native `AbortController` and `EventEmitter` provide sufficient async control and real-time SSE progress updates at this scale, avoiding Redis/BullMQ.

## Limitations

- Without headless browsing (Puppeteer/Playwright), SPA-heavy websites (React/Vue sites without SSR) may return empty bodies to the crawler.
- The public discussion search is a rudimentary mock. Production would require integration with a licensed API (e.g., Reddit Data API or a specialized aggregator).
- Production hardening would require DNS rebinding protection on the crawler and stricter per-host rate limits.
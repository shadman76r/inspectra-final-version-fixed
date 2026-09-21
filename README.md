# Inspectra AI — Final Standalone Enhancement Build

This build is intentionally split into **two independent main tabs** so website auditing and Figma comparison do not interfere with each other.

## 1. Website Audit tab
Enter one website URL and click **Start website audit**.

The run produces:
- SEO score and checks
- GEO (Generative Engine Optimization readiness) score and checks
- Performance score with visual metric cards
- Responsive testing at Desktop 1440×900, Tablet 768×1024, Mobile 375×812
- Actual viewport screenshots for all three device sizes
- Website QA checks for links, images, ALT coverage and buttons
- Unified PASS / FAIL / WARNING summary
- Downloadable PDF

> GEO is an Inspectra heuristic readiness score, not an official Google/OpenAI/AI-search ranking metric.

## 2. Figma Match tab
The Figma workflow is deliberately element-driven rather than automatically comparing the full design.

1. Enter the **Figma frame URL** (prefer a URL containing `node-id`).
2. Enter a **Figma personal access token**.
3. Enter the **live website URL**.
4. Click **Load Figma elements**.
5. Browse/search the detected comparable elements.
6. Click any single element.
7. Inspectra finds the best live DOM match and produces a focused report for that element only.

The selected-element report includes:
- Figma node name/type/text/dimensions
- Figma rendered preview (when the Figma Images API returns one)
- Matched live DOM selector
- Live website element screenshot
- Mapping confidence and matching reasons
- Text comparison
- Font-size and font-weight comparison
- Width/height comparison
- Padding comparison
- Border radius comparison
- Text/background color comparison
- Text alignment comparison
- PASS / FAIL / WARNING evidence
- Downloadable selected-element PDF report

Previously compared elements keep their score in the left element list, so a user can click through the Figma design one element at a time.

## Run backend

```bash
cd backend
npm install
npx playwright install chromium
npm run dev
```

Backend: `http://localhost:5000`

Health check: `http://localhost:5000/api/health`

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Important environment settings
Copy `backend/.env.example` if you want to change defaults.

- `PORT=5000`
- `FRONTEND_URL=http://localhost:5173`
- `SCAN_TIMEOUT_MS=30000`
- `LINK_CHECK_LIMIT=25`

## Main API routes

- `POST /api/audit/run` — Website Audit only
- `POST /api/figma/extract` — Read selected Figma frame and return clickable elements
- `POST /api/figma/compare-selected` — Compare one selected Figma element against the live website
- `POST /api/report/pdf` — Generate Website Audit or Figma-element PDF
- `GET /api/demo-audit` — Frontend demo data

## QA validation included
Run:

```bash
cd backend
npm test
```

The smoke test validates the normalized website audit, GEO category, category separation and semantic Figma element matching.


## Blank page hotfix
The frontend no longer imports Lucide's deprecated Figma brand icon. It uses generic Frame/Globe/Link/Layers icons instead. The bootstrap also renders a visible diagnostic panel when App.jsx or a child module fails to import, instead of leaving a blank white page.

After replacing an older frontend, delete `frontend/node_modules/.vite` (or run Vite with `--force`) and restart the dev server.

## Slow-site navigation handling
This build uses a resilient Playwright navigation helper. It starts from the main-document `commit` event, treats `DOMContentLoaded` and `networkidle` as best-effort waits, and continues when usable HTML is already present. This prevents slow third-party scripts from causing the entire audit to fail with `page.goto: Timeout 30000ms exceeded`.

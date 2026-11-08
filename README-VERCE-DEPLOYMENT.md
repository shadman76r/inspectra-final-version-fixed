# Inspectra — Vercel single-project deployment

This deployment keeps the existing repository layout and deploys the React/Vite frontend and Express/Playwright backend as two Vercel Services under one Vercel project and one domain.

## Architecture

- `/` and all non-API routes -> `frontend/` (Vite)
- `/api/*` -> `backend/` (Express)
- Playwright runs with `@sparticuz/chromium` inside the Vercel backend Function.
- Production API requests use the same origin. No production `VITE_API_BASE` value is required.

Vercel Services are currently a Beta feature. The Vercel project Framework Preset must be set to **Services**.

## Files in this bundle

- `vercel.json` — two service definitions, public rewrites, 300-second backend timeout, and explicit Chromium binary asset inclusion.
- `.gitignore` — ignores dependencies, environment files, and build output.
- `backend/package.json` — pins a Node version and serverless Chromium/Playwright dependencies.
- `backend/utils/browser.js` — launches Playwright's local browser for development and serverless Chromium on Vercel.
- `backend/server.js` — exports the Express app for Vercel and keeps the local `npm run dev` listener.
- `backend/services/responsiveTester.js` — uses compressed JPEG screenshot evidence.
- `frontend/src/services/api.js` — uses same-origin API URLs in production and strips screenshots from PDF POST requests.

## 1. Apply the files

Extract this bundle into the root of the repository and allow it to overwrite the matching files.

Do not set the Vercel Root Directory to `frontend/` or `backend/`. The root must remain the repository root so Vercel can see `vercel.json` and both services.

## 2. Remove the already-committed node_modules

The current GitHub repository contains `backend/node_modules` and `frontend/node_modules`. Adding `.gitignore` does not untrack files that are already committed.

From the repository root, run:

```bash
git rm -r --cached backend/node_modules frontend/node_modules
```

If Git reports that one of those paths does not exist in your local clone, run the command for the path that exists.

## 3. Regenerate the backend lockfile

The backend dependencies changed. Regenerate and commit the lockfile:

```bash
cd backend
npm install
npx playwright install chromium
npm test
cd ..
```

The local Playwright install is needed for local development only. Vercel uses the `@sparticuz/chromium` binary at runtime.

Build the frontend:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

Run the backend and frontend in two separate terminals:

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

Or test the Vercel Services routing locally (after installing the Vercel CLI):

```bash
npx vercel dev -L
```

## 4. Push the deployment changes

```bash
git add .gitignore vercel.json backend/package.json backend/package-lock.json backend/server.js backend/utils/browser.js backend/services/responsiveTester.js frontend/src/services/api.js README-VERCEL-DEPLOYMENT.md
git commit -m "Prepare Inspectra for Vercel Services deployment"
git push origin main
```

The commit also removes the previously tracked `node_modules` files from Git.

## 5. Configure Vercel

1. Import `shadman76r/inspectra-final-version-fixed` into Vercel.
2. Keep **Root Directory** set to `.` (repository root).
3. Set **Framework Preset** to **Services**.
4. Set the project Node.js version to **22.x**.
5. Deploy a Preview first.
6. In the backend service's Functions/compute settings, choose at least 1.6 GB memory if the plan allows it. Chromium's serverless package recommends 1.6 GB or more.
7. Once Preview tests pass, promote/deploy `main` to Production.

Vercel Services builds the frontend and backend separately but routes both through the same deployment domain.

## 6. Environment variables

The production deployment does not need `VITE_API_BASE`; the frontend automatically calls `/api/...` on its own domain.

Suggested backend variables:

```env
SCAN_TIMEOUT_MS=60000
LINK_CHECK_LIMIT=25
```

`PORT` is only used by local development. `FRONTEND_URL=http://localhost:5173` is the local Vite origin used by the current CORS configuration. Same-origin production requests do not need CORS.

If Vercel reports that a Function exceeds the standard 250 MB package limit, opt the project into Large Functions by adding this environment variable in the applicable Vercel environments:

```env
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
```

Large Functions are a Vercel public beta. Only enable this if the deployment needs it.

## 7. Post-deployment smoke checks

Replace `YOUR-VERCEL-DOMAIN` with the Preview URL:

```text
GET  https://YOUR-VERCEL-DOMAIN/api/health
GET  https://YOUR-VERCEL-DOMAIN/api/demo-audit
POST https://YOUR-VERCEL-DOMAIN/api/audit/run
POST https://YOUR-VERCEL-DOMAIN/api/figma/extract
POST https://YOUR-VERCEL-DOMAIN/api/figma/compare-selected
POST https://YOUR-VERCEL-DOMAIN/api/report/pdf
```

Expected health response:

```json
{
  "ok": true,
  "service": "inspectra-final"
}
```

Test in this order:

1. Health endpoint.
2. Demo audit and frontend page load.
3. One small public website audit.
4. Desktop/tablet/mobile screenshots.
5. Figma element extraction and selected-element comparison.
6. PDF download.

Check Vercel Function logs for Chromium launch errors, memory errors, timeouts, and `FUNCTION_PAYLOAD_TOO_LARGE`.

## Important production considerations

- Vercel Function request and response bodies are limited to 4.5 MB. The PDF request now omits screenshot previews because the PDF generator does not use them. Responsive screenshots are JPEG-compressed to reduce API response size.
- The backend currently accepts public audit URLs and has no authentication or rate limiting. Before making this a public multi-user service, add abuse protection, rate limiting, and SSRF protections so users cannot use the scanner to access private/internal network addresses.
- Vercel Functions are request-driven and not a persistent worker. Long scans must finish within the configured Function duration. The backend service is configured for 300 seconds; plan limits still apply. The Vercel function configuration explicitly includes `node_modules/@sparticuz/chromium/bin/**` so the compressed Chromium binary and support assets are packaged with the backend.
- Vercel Services and Large Functions are Beta features. Confirm both are enabled for the project before production rollout.

# Tomorrow's Merge Guide — Inspectra AI

The safest merge is to preserve the two-workspace structure introduced in this standalone build.

## Main navigation
Add two top-level tabs/routes in the existing frontend:

- Website Audit
- Figma Match

Do not put Figma inside the Website Audit result categories.

## Website Audit integration
Reuse the existing Inspectra scanners wherever they are already stronger than this standalone implementation.

Recommended mapping:

- Existing SEO output -> `categories.seo`
- New GEO scanner -> `categories.geo`
- Existing Lighthouse output -> `normalizeLighthouseResult()` -> `categories.performance`
- Responsive tester/screenshots -> `categories.responsive`
- Existing website QA crawler -> `categories.websiteQA`

The final website audit category set should be:

```js
{
  seo,
  geo,
  performance,
  responsive,
  websiteQA
}
```

## Figma integration
Keep the current extraction route from the main project if it already has authentication/error handling, but return normalized Figma elements using the fields expected by `figmaComparator.js`.

The new UX should remain:

1. Load selected frame.
2. Show element browser.
3. User clicks one element.
4. Extract live DOM for the website.
5. `compareDesign([selectedFigmaElement], websiteElements, options)`.
6. Show only that selected-element report.

For deterministic matching on difficult/repeated components, keep or add `data-qa-audit-id` in the DOM extractor.

## Files to merge

### Backend
- `services/geoScanner.js` (new)
- `services/basicPerformanceScanner.js`
- `services/responsiveTester.js`
- `services/auditSummary.js`
- `services/figmaComparator.js`
- `services/figmaService.js`
- `services/domExtractor.js`
- `services/pdfReport.js`
- selected routes from `server.js`

### Frontend
- `pages/WebsiteAuditPage.jsx`
- `pages/FigmaMatchPage.jsx`
- `components/WebsiteAuditResults.jsx`
- `components/SeoGeoSection.jsx`
- `components/PerformanceVisual.jsx`
- `components/ResponsiveVisual.jsx`
- `components/FigmaElementBrowser.jsx`
- `components/FigmaElementReport.jsx`
- `components/ScoreCard.jsx`
- `components/CheckTable.jsx`
- `services/api.js`
- the relevant classes from `styles.css`

## Use existing Lighthouse tomorrow
The standalone performance scanner collects browser timing signals so this project works by itself. In the main Inspectra project, prefer the existing Lighthouse result because it provides stronger performance scoring and diagnostics. Feed it through `normalizeLighthouseResult()` so the new visual UI does not need to change.

## Final regression checklist
- Website audit runs without requiring Figma credentials.
- Website audit contains SEO + GEO + Performance + Responsive + Website QA.
- Figma tab does not affect website audit score.
- Figma credentials are not persisted by frontend/backend code.
- Figma frame elements load and are searchable/clickable.
- Clicking one element compares only that element.
- Figma and live DOM previews render where available.
- Desktop/tablet/mobile screenshots render.
- PDF works for website audit.
- PDF works for selected Figma element.
- Existing crawler/SEO/Lighthouse behavior still works after merge.

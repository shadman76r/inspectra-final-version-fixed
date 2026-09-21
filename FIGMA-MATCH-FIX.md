# Inspectra AI — Figma Match Fix

## What was wrong in the first build

The first comparator depended too heavily on the Figma element key matching a website element key. Real Figma node IDs, DOM IDs, selectors and labels usually do not match, so valid elements could be reported as missing or the wrong element could be compared.

## What is fixed

1. Figma URL parsing supports `design`, `file` and `proto` links plus `node-id`.
2. Live Figma extraction reads the selected frame through the Figma REST API.
3. Live DOM extraction reads visible, relevant elements through Playwright.
4. Element matching now uses multiple signals:
   - explicit `data-qa-audit-id` / mapping
   - selector
   - exact/fuzzy text
   - Figma layer name vs DOM identity/accessibility name
   - compatible semantic role
   - approximate element size
5. Matching is confidence-based. Low-confidence mappings are shown as warnings.
6. Element mapping stats are separate from property PASS/FAIL stats.
7. The selected Figma frame width is used as the browser viewport width when reasonable.
8. Comparisons support text, font size, font weight, dimensions, padding, radius, colors and text alignment.
9. Figma URL + token + website URL can now be compared directly from the frontend.
10. A mapping diagnostics section shows the exact Figma-to-DOM pairing and confidence.

## Recommended Figma URL

Use a URL for the exact frame you want to compare. The URL should contain `node-id`, for example a desktop page frame rather than the whole Figma file.

## Stable mapping for difficult elements

For elements such as icons, duplicate CTA buttons, repeated cards or elements without useful text, add a stable website attribute:

```html
<button data-qa-audit-id="hero-primary-cta">Run Audit</button>
```

Then pass an explicit mapping when needed:

```js
{
  elementMappings: {
    "123:456": "hero-primary-cta"
  }
}
```

The key is the Figma node ID. The value can be a website `data-qa-audit-id`, DOM id, test id or selector identity.

## Live endpoint

`POST /api/figma/compare-live`

```json
{
  "figmaUrl": "https://www.figma.com/design/FILE_KEY/Name?node-id=1-2",
  "accessToken": "YOUR_TOKEN",
  "websiteUrl": "https://example.com",
  "options": {
    "minimumMatchConfidence": 0.62,
    "fontSizeTolerancePx": 1,
    "layoutTolerancePx": 12,
    "layoutTolerancePercent": 4,
    "spacingTolerancePx": 8,
    "colorDistanceTolerance": 18
  }
}
```

Do not commit the Figma token into source control or `.env` unless your deployment has an appropriate secret-management process.

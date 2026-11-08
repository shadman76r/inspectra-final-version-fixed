import express from "express";
import cors from "cors";
import { launchBrowser } from "./utils/browser.js";
import { compareDesign } from "./services/figmaComparator.js";
import { extractDomElements } from "./services/domExtractor.js";
import { fetchFigmaElements, fetchFigmaNodeImage } from "./services/figmaService.js";
import { scanSeo } from "./services/seoScanner.js";
import { scanGeo } from "./services/geoScanner.js";
import { installPerformanceObservers, scanBasicPerformance } from "./services/basicPerformanceScanner.js";
import { runResponsiveAudit } from "./services/responsiveTester.js";
import { scanWebsiteQa } from "./services/websiteQaScanner.js";
import { buildAudit } from "./services/auditSummary.js";
import { createAuditPdf } from "./services/pdfReport.js";
import { createDemoAudit } from "./sample/sampleAudit.js";
import { safeGoto } from "./utils/navigation.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 60000);
const LINK_CHECK_LIMIT = Number(process.env.LINK_CHECK_LIMIT || 25);

app.disable("x-powered-by");
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    service: "inspectra-final",
    time: new Date().toISOString(),
  })
);

app.get("/api/demo-audit", (_req, res) => res.json(createDemoAudit()));

app.post("/api/figma/extract", async (req, res) => {
  const { figmaUrl, accessToken, options = {} } = req.body || {};
  if (!figmaUrl) return res.status(400).json({ error: "Figma URL is required." });
  if (!accessToken) return res.status(400).json({ error: "Figma access token is required." });

  try {
    const result = await fetchFigmaElements(figmaUrl, accessToken, {
      maxElements: Number(options.maxElements || 700),
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/figma/compare-selected", async (req, res) => {
  const { figmaElement, figmaFileKey, accessToken, websiteUrl, options = {} } = req.body || {};
  if (!figmaElement?.id) {
    return res.status(400).json({ error: "Select a Figma element first." });
  }
  if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) {
    return res.status(400).json({ error: "A valid website URL is required." });
  }

  let browser;
  try {
    const width = Math.max(320, Math.min(2560, Number(options.viewportWidth || 1440)));
    const height = Math.max(500, Math.min(2200, Number(options.viewportHeight || 900)));

    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const navigation = await safeGoto(page, websiteUrl, {
      timeout: SCAN_TIMEOUT_MS,
      renderWaitMs: Number(options.renderWaitMs || 1200),
    });
    await page.evaluate(() => document.fonts?.ready || Promise.resolve()).catch(() => {});

    const websiteElements = await extractDomElements(page, {
      maxElements: Number(options.maxWebsiteElements || 900),
    });

    const figma = compareDesign([figmaElement], websiteElements, {
      minimumMatchConfidence: 0.58,
      lowConfidenceThreshold: 0.72,
      fontSizeTolerancePx: 1,
      layoutTolerancePx: 12,
      layoutTolerancePercent: 4,
      spacingTolerancePx: 8,
      colorDistanceTolerance: 18,
      ...options,
    });

    let websitePreview = null;
    const match = figma.matches?.[0];
    if (match?.website?.selector) {
      try {
        const locator = page.locator(match.website.selector).first();
        await locator.scrollIntoViewIfNeeded();
        const buffer = await locator.screenshot({
          type: "jpeg",
          quality: 55,
        });
        websitePreview = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      } catch {
        // A missing preview must not fail the comparison itself.
      }
    }

    let figmaPreview = null;
    if (accessToken && figmaFileKey) {
      try {
        figmaPreview = await fetchFigmaNodeImage(figmaFileKey, figmaElement.id, accessToken);
      } catch {
        // Figma preview is optional evidence.
      }
    }

    figma.source = {
      selectedFigmaElement: figmaElement,
      websiteElements: websiteElements.length,
      viewport: { width, height },
      previews: { figma: figmaPreview, website: websitePreview },
    };

    const audit = buildAudit({
      url: websiteUrl,
      figma,
      metadata: {
        mode: "figma-element",
        selectedFigmaElement: {
          id: figmaElement.id,
          name: figmaElement.name,
          type: figmaElement.type,
          text: figmaElement.text,
        },
        viewport: { width, height },
        navigation,
      },
    });

    res.json(audit);
    await context.close();
  } catch (error) {
    res.status(500).json({
      error: error.message,
      hint: "Check the website URL and Playwright Chromium installation.",
    });
  } finally {
    if (browser) await browser.close();
  }
});

// Backward-compatible all-element comparator. The final UI intentionally uses selected-element comparison.
app.post("/api/figma/compare", (req, res) => {
  const { figmaElements = [], websiteElements = [], options = {} } = req.body || {};
  if (!Array.isArray(figmaElements) || !Array.isArray(websiteElements)) {
    return res.status(400).json({
      error: "figmaElements and websiteElements must both be arrays.",
    });
  }
  res.json(compareDesign(figmaElements, websiteElements, options));
});

app.post("/api/audit/run", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "A valid http/https URL is required." });
  }

  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await installPerformanceObservers(page);
    const navigation = await safeGoto(page, url, {
      timeout: SCAN_TIMEOUT_MS,
      renderWaitMs: 1200,
    });

    const [seo, geo, performance, websiteQA] = await Promise.all([
      scanSeo(page, url),
      scanGeo(page, url),
      scanBasicPerformance(page, url),
      scanWebsiteQa(page, url, LINK_CHECK_LIMIT),
    ]);

    await context.close();

    const responsive = await runResponsiveAudit(browser, url, SCAN_TIMEOUT_MS);
    const audit = buildAudit({
      url,
      seo,
      geo,
      performance,
      responsive,
      websiteQA,
      metadata: { mode: "standalone-final", navigation },
    });

    res.json(audit);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      hint: "Ensure the serverless Chromium package is installed and the target website is reachable.",
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.post("/api/report/pdf", (req, res) => {
  const audit = req.body;
  if (!audit || !audit.summary) {
    return res.status(400).json({ error: "Normalized audit payload is required." });
  }

  const safeHost = (() => {
    try {
      return new URL(audit.url).hostname.replace(/[^a-z0-9.-]/gi, "-");
    } catch {
      return "website";
    }
  })();

  const prefix = audit.reportType === "figma-element" ? "inspectra-figma" : "inspectra-audit";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${prefix}-${safeHost}-report.pdf`
  );
  createAuditPdf(audit, res);
});

// Vercel detects the default Express export and serves it as a Function.
// Keep a local listener for the existing npm run dev workflow.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Inspectra final backend running on http://localhost:${PORT}`);
  });
}

export default app;

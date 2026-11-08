import { createCheck, scoreFromChecks, summarizeChecks } from "../utils/auditCheck.js";
import { safeGoto } from "../utils/navigation.js";

export const VIEWPORTS = [
  { name: "Desktop", width: 1440, height: 900 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Mobile", width: 375, height: 812 },
];

async function testViewport(browser, url, viewport, timeout) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const navigation = await safeGoto(page, url, { timeout, renderWaitMs: 700 });

  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflow = Math.max(doc.scrollWidth, body?.scrollWidth || 0) - window.innerWidth;
    const viewportMeta = document.querySelector('meta[name="viewport"]')?.content || "";

    const badElements = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2);
      })
      .slice(0, 5)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString?.().slice(0, 80) || "",
        text: el.textContent?.trim().slice(0, 60) || "",
      }));

    const tinyTargets = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          (r.width < 40 || r.height < 40)
        );
      }).length;

    return {
      overflow,
      viewportMeta,
      badElements,
      tinyTargets,
      pageHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
    };
  });

  // JPEG screenshots retain visual evidence with a smaller response payload than PNG.
  const screenshotBuffer = await page.screenshot({
    type: "jpeg",
    quality: 50,
    fullPage: false,
  });

  await context.close();

  return {
    ...result,
    navigation,
    screenshot: `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`,
  };
}

export async function runResponsiveAudit(browser, url, timeout = 60000) {
  const checks = [];
  const devices = [];

  for (const viewport of VIEWPORTS) {
    try {
      const result = await testViewport(browser, url, viewport, timeout);
      devices.push({ ...viewport, ...result });

      checks.push(
        createCheck({
          id: `responsive-${viewport.name.toLowerCase()}-overflow`,
          category: "responsive",
          label: `${viewport.name} — Horizontal overflow`,
          status: result.overflow <= 2 ? "pass" : "fail",
          url,
          expected: "No horizontal page overflow",
          actual:
            result.overflow <= 2
              ? "No overflow detected"
              : `${Math.round(result.overflow)}px overflow`,
          evidence: result.badElements.length ? JSON.stringify(result.badElements) : "",
          recommendation:
            result.overflow <= 2
              ? ""
              : "Fix fixed-width or off-screen elements for this viewport.",
          severity: "high",
        })
      );

      checks.push(
        createCheck({
          id: `responsive-${viewport.name.toLowerCase()}-viewport-meta`,
          category: "responsive",
          label: `${viewport.name} — Viewport meta`,
          status: result.viewportMeta ? "pass" : "fail",
          url,
          expected: "Viewport meta tag present",
          actual: result.viewportMeta || "Missing",
          recommendation: result.viewportMeta ? "" : "Add a responsive viewport meta tag.",
          severity: "medium",
        })
      );

      if (viewport.name !== "Desktop") {
        checks.push(
          createCheck({
            id: `responsive-${viewport.name.toLowerCase()}-targets`,
            category: "responsive",
            label: `${viewport.name} — Touch target review`,
            status: result.tinyTargets <= 5 ? "pass" : "warning",
            url,
            expected: "Most interactive targets are comfortably tappable",
            actual: `${result.tinyTargets} potentially small target(s)`,
            recommendation:
              result.tinyTargets <= 5
                ? ""
                : "Review small links/buttons and increase the tappable area where appropriate.",
            severity: "low",
          })
        );
      }
    } catch (error) {
      checks.push(
        createCheck({
          id: `responsive-${viewport.name.toLowerCase()}-load`,
          category: "responsive",
          label: `${viewport.name} — Page load`,
          status: "fail",
          url,
          expected: "Page loads",
          actual: error.message,
          recommendation: "Check page availability and browser errors.",
          severity: "high",
        })
      );
    }
  }

  return {
    name: "Responsive",
    score: scoreFromChecks(checks),
    summary: summarizeChecks(checks),
    checks,
    devices,
  };
}

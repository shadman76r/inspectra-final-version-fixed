import { summarizeChecks } from "../utils/auditCheck.js";

const WEBSITE_WEIGHTS = { seo: 0.22, geo: 0.18, performance: 0.25, responsive: 0.2, websiteQA: 0.15 };

export function buildAudit({ url, seo, geo, performance, responsive, figma, websiteQA, metadata = {} }) {
  const all = { seo, geo, performance, responsive, websiteQA, figma };
  const categories = Object.fromEntries(Object.entries(all).filter(([, value]) => value));
  const checks = Object.values(categories).flatMap((c) => c?.checks || []);
  const summary = summarizeChecks(checks);
  const isFigmaOnly = metadata.mode === "figma-element" || (figma && !seo && !geo && !performance && !responsive && !websiteQA);
  const weights = isFigmaOnly ? { figma: 1 } : WEBSITE_WEIGHTS;

  let weighted = 0;
  let usedWeight = 0;
  for (const [key, category] of Object.entries(categories)) {
    if (category?.score !== null && category?.score !== undefined && weights[key] != null) {
      const w = weights[key];
      weighted += Number(category.score) * w;
      usedWeight += w;
    }
  }
  const overallScore = usedWeight ? Math.round(weighted / usedWeight) : 0;

  return {
    schemaVersion: "2.0",
    reportType: isFigmaOnly ? "figma-element" : "website-audit",
    url,
    scannedAt: new Date().toISOString(),
    overallScore,
    summary,
    categories,
    checks,
    passedChecks: checks.filter((c) => c.status === "pass"),
    failedChecks: checks.filter((c) => c.status === "fail"),
    warnings: checks.filter((c) => c.status === "warning"),
    metadata,
  };
}

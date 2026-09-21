import assert from "node:assert/strict";
import { createDemoAudit } from "../sample/sampleAudit.js";
import { compareDesign } from "../services/figmaComparator.js";

const audit = createDemoAudit();
assert.equal(audit.reportType, "website-audit");
assert.equal(audit.summary.total, audit.summary.passed + audit.summary.failed + audit.summary.warnings + audit.summary.informational);
assert.ok(audit.overallScore >= 0 && audit.overallScore <= 100);
assert.ok(audit.categories.seo.checks.length > 0);
assert.ok(audit.categories.geo.checks.length > 0);
assert.ok(audit.categories.performance.checks.length > 0);
assert.ok(audit.categories.responsive.checks.length > 0);
assert.ok(audit.categories.websiteQA.checks.length > 0);
assert.equal(audit.categories.figma, undefined);

const cmp = compareDesign(
  [{ id: "figma-1", name: "CTA", roleHint: "button", fontSize: 16, color: "#ffffff", text: "Run Audit", width: 140, height: 44 }],
  [{ id: "dom-other-id", role: "button", selector: "#run-audit", fontSize: 17, color: "rgb(255,255,255)", text: "Run Audit", width: 142, height: 44 }]
);
assert.equal(cmp.elementSummary.matched, 1, "Different IDs should still map using semantic signals");
assert.equal(cmp.mismatched.filter((c) => c.label.includes("Font size")).length, 0, "1px font-size tolerance should pass");
console.log("Smoke tests passed", { overallScore: audit.overallScore, summary: audit.summary });

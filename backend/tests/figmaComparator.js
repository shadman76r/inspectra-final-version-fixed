import assert from "node:assert/strict";
import { compareDesign } from "../services/figmaComparator.js";

const figma = [
  { id: "1:1", name: "Hero title", type: "TEXT", roleHint: "heading", text: "Inspect smarter", fontSize: 48, fontWeight: 700, color: "#111827", width: 560, height: 58 },
  { id: "1:2", name: "Primary CTA", type: "INSTANCE", roleHint: "button", text: "Run Audit", backgroundColor: "#4f46e5", width: 140, height: 44, borderRadius: 8 },
  { id: "1:3", name: "Missing badge", type: "TEXT", roleHint: "text", text: "Beta badge", fontSize: 12 },
];

const website = [
  { id: "headline", selector: "#headline", tag: "h1", role: "heading", text: "Inspect smarter", fontSize: "48px", fontWeight: "700", color: "rgb(17, 24, 39)", width: 566, height: 60, visible: true },
  { id: "start-audit", selector: "button.start", tag: "button", role: "button", text: "Run Audit", backgroundColor: "rgb(79, 70, 229)", width: 142, height: 44, borderRadius: "8px", visible: true },
];

const result = compareDesign(figma, website);
assert.equal(result.elementSummary.total, 3);
assert.equal(result.elementSummary.matched, 2);
assert.equal(result.elementSummary.unmatched, 1);
assert.ok(result.matches[0].confidence >= 0.8, "Exact text heading should match strongly");
assert.ok(result.matches[1].confidence >= 0.8, "CTA should match strongly");
assert.equal(result.matches[2].website, null);
assert.ok(result.checks.some((c) => c.label.includes("Missing badge") && c.status === "fail"));

const mapped = compareDesign(
  [{ id: "99:1", name: "Icon without text", type: "INSTANCE", roleHint: "button", width: 44, height: 44 }],
  [{ auditId: "mobile-menu", selector: "[data-qa-audit-id=mobile-menu]", role: "button", width: 44, height: 44, visible: true }],
  { elementMappings: { "99:1": "mobile-menu" } },
);
assert.equal(mapped.elementSummary.matched, 1);
assert.equal(mapped.matches[0].confidence, 1);

console.log("Figma comparator tests passed");

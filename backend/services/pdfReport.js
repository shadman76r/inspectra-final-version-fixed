import PDFDocument from "pdfkit";

function statusMark(status) {
  return status === "pass" ? "PASS" : status === "fail" ? "FAIL" : status === "warning" ? "WARN" : String(status || "INFO").toUpperCase();
}

function writeCheck(doc, check) {
  if (doc.y > 730) doc.addPage();
  doc.font("Helvetica-Bold").fontSize(10).text(`[${statusMark(check.status)}] ${check.label}`);
  doc.font("Helvetica").fontSize(9);
  if (check.url) doc.text(`URL: ${check.url}`);
  if (check.expected) doc.text(`Expected: ${String(check.expected).slice(0, 500)}`);
  if (check.actual) doc.text(`Actual: ${String(check.actual).slice(0, 500)}`);
  if (check.evidence) doc.text(`Evidence: ${String(check.evidence).slice(0, 700)}`);
  if (check.recommendation) doc.text(`Recommendation: ${String(check.recommendation).slice(0, 700)}`);
  doc.moveDown(0.6);
}

export function createAuditPdf(audit, stream) {
  const doc = new PDFDocument({ margin: 44, size: "A4" });
  doc.pipe(stream);
  const figmaMode = audit.reportType === "figma-element";
  doc.font("Helvetica-Bold").fontSize(24).text("Inspectra AI", { align: "center" });
  doc.fontSize(15).text(figmaMode ? "Figma Element Comparison Report" : "Website SEO + GEO + Performance + Responsive Audit", { align: "center" });
  doc.moveDown();
  doc.font("Helvetica").fontSize(10).text(`Website: ${audit.url || "N/A"}`);
  doc.text(`Scanned: ${audit.scannedAt ? new Date(audit.scannedAt).toLocaleString() : "N/A"}`);
  if (figmaMode && audit.metadata?.selectedFigmaElement) {
    const el = audit.metadata.selectedFigmaElement;
    doc.text(`Figma element: ${el.name || el.text || el.id} (${el.type || "element"})`);
  }
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(16).text(`${figmaMode ? "Match" : "Overall"} Score: ${audit.overallScore ?? 0}/100`);
  const s = audit.summary || {};
  doc.font("Helvetica").fontSize(10).text(`Total: ${s.total ?? 0}   Passed: ${s.passed ?? 0}   Failed: ${s.failed ?? 0}   Warnings: ${s.warnings ?? 0}   Pass rate: ${s.passPercentage ?? 0}%`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(14).text("Category Summary");
  for (const [key, category] of Object.entries(audit.categories || {})) {
    if (!category) continue;
    doc.font("Helvetica").fontSize(10).text(`${category.name || key}: ${category.score ?? "N/A"}/100 — ${category.summary?.passed ?? 0} passed, ${category.summary?.failed ?? 0} failed, ${category.summary?.warnings ?? 0} warnings`);
    if (category.note) doc.fontSize(8).text(category.note);
  }
  doc.moveDown();

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(15).text("Failed / Bug Results");
  doc.moveDown(0.5);
  const failed = audit.failedChecks || (audit.checks || []).filter((c) => c.status === "fail");
  if (!failed.length) doc.font("Helvetica").fontSize(10).text("No failed checks.");
  failed.forEach((c) => writeCheck(doc, c));

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(15).text("Passed Results");
  doc.moveDown(0.5);
  const passed = audit.passedChecks || (audit.checks || []).filter((c) => c.status === "pass");
  if (!passed.length) doc.font("Helvetica").fontSize(10).text("No passed checks.");
  passed.forEach((c) => writeCheck(doc, c));

  const warnings = audit.warnings || (audit.checks || []).filter((c) => c.status === "warning");
  if (warnings.length) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(15).text("Warnings / Review Items");
    doc.moveDown(0.5);
    warnings.forEach((c) => writeCheck(doc, c));
  }
  doc.end();
}

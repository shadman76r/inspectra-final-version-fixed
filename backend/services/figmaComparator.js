import { createCheck, scoreFromChecks, summarizeChecks } from "../utils/auditCheck.js";
import {
  colorDistance,
  normalizeColor,
  normalizeFontWeight,
  normalizeText,
  relativeDifference,
  textSimilarity,
  toPx,
} from "../utils/comparison.js";

const DEFAULTS = {
  fontSizeTolerancePx: 1,
  fontWeightTolerance: 100,
  layoutTolerancePx: 12,
  layoutTolerancePercent: 4,
  spacingTolerancePx: 8,
  radiusTolerancePx: 4,
  colorDistanceTolerance: 18,
  textSimilarityThreshold: 0.9,
  minimumMatchConfidence: 0.62,
  lowConfidenceThreshold: 0.74,
  compareTextBoxSize: true,
};

function safeId(value = "element") {
  return String(value || "element").replace(/[^a-z0-9-_]/gi, "-").slice(0, 120);
}

function baseFor(figma, index) {
  const identity = figma.auditId || figma.figmaNodeId || figma.id || figma.name || figma.text || `element-${index + 1}`;
  return {
    id: `figma-${safeId(identity)}`,
    category: "figma",
    label: figma.name || figma.text || figma.selector || identity || "Figma element",
    url: figma.url || "",
  };
}

function valuesForWebIdentity(web) {
  return [web.auditId, web.testId, web.id, web.name, web.accessibleName, web.selector, web.text]
    .map(normalizeText)
    .filter(Boolean);
}

function compatibleRole(figma, web) {
  const f = normalizeText(figma.roleHint || figma.type);
  const w = normalizeText(web.role || web.tag);
  if (!f || !w) return 0;
  const groups = {
    button: ["button"],
    heading: ["heading", "h1", "h2", "h3", "h4", "h5", "h6"],
    text: ["text", "p", "span", "div", "label", "heading", "h1", "h2", "h3", "h4", "h5", "h6"],
    link: ["link", "a"],
    img: ["img", "image"],
    navigation: ["navigation", "nav"],
    "form-control": ["form-control", "input", "textarea", "select"],
    container: ["container", "div", "section", "article", "header", "footer", "main"],
  };
  const allowed = groups[f] || [f];
  return allowed.includes(w) ? 1 : 0;
}

function sizeSimilarity(figma, web) {
  const vals = [];
  if (toPx(figma.width) !== null && toPx(web.width) !== null) vals.push(1 - Math.min(1, relativeDifference(figma.width, web.width)));
  if (toPx(figma.height) !== null && toPx(web.height) !== null) vals.push(1 - Math.min(1, relativeDifference(figma.height, web.height)));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function explicitMappingTarget(figma, options) {
  const mappings = options.elementMappings || {};
  return mappings[figma.figmaNodeId] || mappings[figma.id] || mappings[figma.name] || null;
}

function mappingMatches(target, web) {
  if (!target) return false;
  const needle = normalizeText(typeof target === "string" ? target : target.selector || target.auditId || target.id || target.testId || "");
  if (!needle) return false;
  return valuesForWebIdentity(web).includes(needle);
}

function scoreCandidate(figma, web, options) {
  const reasons = [];
  const mappingTarget = explicitMappingTarget(figma, options);
  if (mappingTarget && mappingMatches(mappingTarget, web)) return { score: 1, reasons: ["explicit mapping"] };

  const fAudit = normalizeText(figma.auditId);
  const wAudit = normalizeText(web.auditId);
  if (fAudit && wAudit && fAudit === wAudit) return { score: 1, reasons: ["data-qa-audit-id"] };

  const fSelector = normalizeText(figma.webSelector || figma.selector);
  const wSelector = normalizeText(web.selector);
  if (fSelector && wSelector && fSelector === wSelector) return { score: 0.99, reasons: ["selector"] };

  let score = 0;
  const fText = normalizeText(figma.text);
  const wText = normalizeText(web.text || web.accessibleName);
  if (fText && wText) {
    const sim = textSimilarity(fText, wText);
    if (fText === wText) {
      score = Math.max(score, 0.82);
      reasons.push("exact text");
    } else if (sim >= options.textSimilarityThreshold) {
      score = Math.max(score, 0.58 + sim * 0.2);
      reasons.push(`text ${(sim * 100).toFixed(0)}%`);
    } else if (fText.length >= 5 && (wText.includes(fText) || fText.includes(wText))) {
      score = Math.max(score, 0.68);
      reasons.push("contained text");
    }
  }

  const fName = normalizeText(figma.name);
  if (fName) {
    const identities = valuesForWebIdentity(web);
    if (identities.includes(fName)) {
      score = Math.max(score, 0.72);
      reasons.push("exact name/identity");
    } else {
      const bestNameSimilarity = identities.reduce((best, value) => Math.max(best, textSimilarity(fName, value)), 0);
      if (bestNameSimilarity >= 0.9) {
        score = Math.max(score, 0.58 + bestNameSimilarity * 0.12);
        reasons.push(`name ${(bestNameSimilarity * 100).toFixed(0)}%`);
      }
    }
  }

  const role = compatibleRole(figma, web);
  if (role) {
    score += 0.08;
    reasons.push("compatible role");
  }

  const size = sizeSimilarity(figma, web);
  if (size >= 0.8) {
    score += 0.1 * size;
    reasons.push("similar size");
  } else if (size >= 0.6) {
    score += 0.05 * size;
  }

  return { score: Math.min(1, Number(score.toFixed(4))), reasons };
}

function matchElements(figmaElements, websiteElements, options) {
  const edges = [];
  for (let fi = 0; fi < figmaElements.length; fi += 1) {
    const figma = figmaElements[fi];
    for (let wi = 0; wi < websiteElements.length; wi += 1) {
      const web = websiteElements[wi];
      const candidate = scoreCandidate(figma, web, options);
      if (candidate.score >= options.minimumMatchConfidence) {
        edges.push({ fi, wi, ...candidate });
      }
    }
  }

  edges.sort((a, b) => b.score - a.score);
  const usedFigma = new Set();
  const usedWeb = new Set();
  const matches = new Map();
  for (const edge of edges) {
    if (usedFigma.has(edge.fi) || usedWeb.has(edge.wi)) continue;
    usedFigma.add(edge.fi);
    usedWeb.add(edge.wi);
    matches.set(edge.fi, edge);
  }
  return matches;
}

function numberTolerance(expected, fixedPx, percent = 0) {
  const n = Math.abs(toPx(expected) || 0);
  return Math.max(fixedPx, n * (percent / 100));
}

function compareNumber(checks, base, property, figmaValue, webValue, tolerance, severity = "medium", meta = {}) {
  const expected = toPx(figmaValue);
  const actual = toPx(webValue);
  if (expected === null) return;
  const ok = actual !== null && Math.abs(expected - actual) <= tolerance;
  checks.push(createCheck({
    ...base,
    id: `${base.id}-${safeId(property)}`,
    label: `${base.label} — ${property}`,
    status: ok ? "pass" : "fail",
    expected: `${expected}px`,
    actual: actual === null ? "Missing" : `${actual}px`,
    evidence: actual === null
      ? `Website value was not available. Match confidence: ${Math.round((meta.matchConfidence || 0) * 100)}%.`
      : `Difference: ${Math.abs(expected - actual).toFixed(1)}px. Allowed: ${tolerance.toFixed(1)}px. Match confidence: ${Math.round((meta.matchConfidence || 0) * 100)}%.`,
    recommendation: ok ? "" : `Align ${property.toLowerCase()} with the Figma value or adjust the approved tolerance if the difference is intentional.`,
    severity,
    meta,
  }));
}

function compareColor(checks, base, property, expected, actual, tolerance, meta = {}) {
  const normalizedExpected = normalizeColor(expected);
  if (!normalizedExpected || normalizedExpected === "transparent") return;
  const normalizedActual = normalizeColor(actual);
  const distance = colorDistance(normalizedExpected, normalizedActual);
  const ok = Boolean(normalizedActual) && distance <= tolerance;
  checks.push(createCheck({
    ...base,
    id: `${base.id}-${safeId(property)}`,
    label: `${base.label} — ${property}`,
    status: ok ? "pass" : "fail",
    expected: normalizedExpected,
    actual: normalizedActual || "Missing",
    evidence: `Color distance: ${Number.isFinite(distance) ? distance.toFixed(1) : distance}. Allowed: ${tolerance}. Match confidence: ${Math.round((meta.matchConfidence || 0) * 100)}%.`,
    recommendation: ok ? "" : `Update ${property.toLowerCase()} to match the approved Figma color.`,
    severity: "medium",
    meta,
  }));
}

function compareFontWeight(checks, base, expectedValue, actualValue, tolerance, meta) {
  const expected = normalizeFontWeight(expectedValue);
  if (expected === null) return;
  const actual = normalizeFontWeight(actualValue);
  const ok = actual !== null && Math.abs(expected - actual) <= tolerance;
  checks.push(createCheck({
    ...base,
    id: `${base.id}-font-weight`,
    label: `${base.label} — Font weight`,
    status: ok ? "pass" : "fail",
    expected: String(expected),
    actual: actual === null ? "Missing" : String(actual),
    evidence: actual === null ? "Website font weight was unavailable." : `Difference: ${Math.abs(expected - actual)}. Allowed: ${tolerance}.`,
    recommendation: ok ? "" : "Align the website font weight with Figma.",
    severity: "low",
    meta,
  }));
}

function compareTextAlign(checks, base, expectedValue, actualValue, meta) {
  if (!expectedValue) return;
  const expected = normalizeText(expectedValue);
  const actual = normalizeText(actualValue);
  const aliases = { left: "left", center: "center", right: "right", justified: "justify", justify: "justify" };
  const ok = (aliases[expected] || expected) === (aliases[actual] || actual);
  checks.push(createCheck({
    ...base,
    id: `${base.id}-text-align`,
    label: `${base.label} — Text alignment`,
    status: ok ? "pass" : "fail",
    expected,
    actual: actual || "Missing",
    recommendation: ok ? "" : "Align text alignment with Figma.",
    severity: "low",
    meta,
  }));
}

export function compareDesign(figmaElements = [], websiteElements = [], options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const cleanFigma = figmaElements.filter((item) => item && item.visible !== false);
  const cleanWeb = websiteElements.filter((item) => item && item.visible !== false);
  const assignment = matchElements(cleanFigma, cleanWeb, cfg);
  const checks = [];
  const elementMatches = [];

  for (let index = 0; index < cleanFigma.length; index += 1) {
    const figma = cleanFigma[index];
    const edge = assignment.get(index);
    const web = edge ? cleanWeb[edge.wi] : null;
    const base = baseFor(figma, index);
    const matchMeta = web ? {
      matchConfidence: edge.score,
      matchedBy: edge.reasons,
      websiteSelector: web.selector || "",
      websiteElementId: web.auditId || web.testId || web.id || "",
      figmaNodeId: figma.figmaNodeId || figma.id || "",
    } : {
      matchConfidence: 0,
      matchedBy: [],
      figmaNodeId: figma.figmaNodeId || figma.id || "",
    };

    checks.push(createCheck({
      ...base,
      id: `${base.id}-existence`,
      label: `${base.label} — Element match`,
      status: web ? "pass" : "fail",
      expected: "Matching website element",
      actual: web ? (web.selector || web.name || web.text || "Matched element") : "No confident match",
      evidence: web
        ? `Matched with ${Math.round(edge.score * 100)}% confidence using ${edge.reasons.join(", ") || "available signals"}.`
        : `No website candidate reached the ${Math.round(cfg.minimumMatchConfidence * 100)}% confidence threshold. This usually means the element is missing or needs an explicit data-qa-audit-id / mapping.`,
      recommendation: web ? "" : "Add a stable data-qa-audit-id to the website element or provide an explicit Figma-to-DOM mapping before treating this as a visual defect.",
      severity: "high",
      meta: matchMeta,
    }));

    elementMatches.push({
      figma: { id: figma.id || figma.figmaNodeId, name: figma.name, text: figma.text, type: figma.type },
      website: web ? { selector: web.selector, id: web.id, auditId: web.auditId, text: web.text, role: web.role } : null,
      confidence: web ? edge.score : 0,
      reasons: web ? edge.reasons : [],
    });

    if (!web) continue;

    if (figma.text !== undefined && normalizeText(figma.text)) {
      const similarity = textSimilarity(figma.text, web.text || web.accessibleName || "");
      const ok = similarity >= cfg.textSimilarityThreshold;
      checks.push(createCheck({
        ...base,
        id: `${base.id}-text`,
        label: `${base.label} — Text`,
        status: ok ? "pass" : "fail",
        expected: figma.text,
        actual: web.text || web.accessibleName || "",
        evidence: `Text similarity: ${(similarity * 100).toFixed(1)}%. Required: ${(cfg.textSimilarityThreshold * 100).toFixed(0)}%. Match confidence: ${Math.round(edge.score * 100)}%.`,
        recommendation: ok ? "" : "Update the website copy or verify the selected Figma layer is mapped to the correct DOM element.",
        severity: "medium",
        meta: matchMeta,
      }));
    }

    compareNumber(checks, base, "Font size", figma.fontSize, web.fontSize, cfg.fontSizeTolerancePx, "medium", matchMeta);
    compareFontWeight(checks, base, figma.fontWeight, web.fontWeight, cfg.fontWeightTolerance, matchMeta);

    const shouldCompareSize = cfg.compareTextBoxSize || normalizeText(figma.type) !== "text";
    if (shouldCompareSize) {
      compareNumber(checks, base, "Width", figma.width, web.width, numberTolerance(figma.width, cfg.layoutTolerancePx, cfg.layoutTolerancePercent), "medium", matchMeta);
      compareNumber(checks, base, "Height", figma.height, web.height, numberTolerance(figma.height, cfg.layoutTolerancePx, cfg.layoutTolerancePercent), "medium", matchMeta);
    }

    compareNumber(checks, base, "Padding top", figma.paddingTop, web.paddingTop, cfg.spacingTolerancePx, "low", matchMeta);
    compareNumber(checks, base, "Padding right", figma.paddingRight, web.paddingRight, cfg.spacingTolerancePx, "low", matchMeta);
    compareNumber(checks, base, "Padding bottom", figma.paddingBottom, web.paddingBottom, cfg.spacingTolerancePx, "low", matchMeta);
    compareNumber(checks, base, "Padding left", figma.paddingLeft, web.paddingLeft, cfg.spacingTolerancePx, "low", matchMeta);
    compareNumber(checks, base, "Border radius", figma.borderRadius, web.borderRadius, cfg.radiusTolerancePx, "low", matchMeta);

    compareColor(checks, base, "Text color", figma.color, web.color, cfg.colorDistanceTolerance, matchMeta);
    compareColor(checks, base, "Background color", figma.backgroundColor, web.backgroundColor, cfg.colorDistanceTolerance, matchMeta);
    compareTextAlign(checks, base, figma.textAlign, web.textAlign, matchMeta);

    if (edge.score < cfg.lowConfidenceThreshold) {
      checks.push(createCheck({
        ...base,
        id: `${base.id}-match-confidence`,
        label: `${base.label} — Match confidence`,
        status: "warning",
        expected: `≥ ${Math.round(cfg.lowConfidenceThreshold * 100)}% preferred`,
        actual: `${Math.round(edge.score * 100)}%`,
        evidence: `Matched using ${edge.reasons.join(", ") || "weak signals"}.`,
        recommendation: "Add data-qa-audit-id or an explicit mapping to make this comparison deterministic.",
        severity: "low",
        meta: matchMeta,
      }));
    }
  }

  const matched = checks.filter((c) => c.status === "pass");
  const mismatched = checks.filter((c) => c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warning");
  const matchedElements = elementMatches.filter((m) => m.website).length;
  const unmatchedElements = elementMatches.length - matchedElements;

  return {
    name: "Figma Match",
    score: scoreFromChecks(checks),
    summary: summarizeChecks(checks),
    elementSummary: {
      total: elementMatches.length,
      matched: matchedElements,
      unmatched: unmatchedElements,
      matchPercentage: elementMatches.length ? Number(((matchedElements / elementMatches.length) * 100).toFixed(1)) : 0,
    },
    checks,
    matched,
    mismatched,
    warnings,
    matches: elementMatches,
    tolerances: cfg,
  };
}

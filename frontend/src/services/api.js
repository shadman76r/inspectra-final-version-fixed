// In production, the frontend and backend share the same Vercel domain.
// Locally, Vite runs on :5173 and the Express API runs on :5000.
const configuredApiBase = import.meta.env.VITE_API_BASE;
const API_BASE = (
  configuredApiBase ?? (import.meta.env.DEV ? "http://localhost:5000" : "")
).replace(/\/$/, "");

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.hint || `Request failed with ${response.status}`);
  }

  return response.json();
}

export const getDemoAudit = () => jsonRequest("/api/demo-audit");

export const runAudit = (url) =>
  jsonRequest("/api/audit/run", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

export const extractFigma = (payload) =>
  jsonRequest("/api/figma/extract", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const compareFigmaElement = (payload) =>
  jsonRequest("/api/figma/compare-selected", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// PDFKit does not use browser screenshot previews. Strip those large fields
// before posting the report so the request stays below Vercel's 4.5 MB limit.
function stripPreviewPayload(value) {
  if (Array.isArray(value)) return value.map(stripPreviewPayload);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "screenshot" && key !== "previews")
        .map(([key, child]) => [key, stripPreviewPayload(child)])
    );
  }

  return value;
}

export async function downloadPdf(audit, filename = "inspectra-audit-report.pdf") {
  const pdfPayload = stripPreviewPayload(audit);

  const response = await fetch(`${API_BASE}/api/report/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pdfPayload),
  });

  if (!response.ok) throw new Error("PDF generation failed");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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
export const runAudit = (url) => jsonRequest("/api/audit/run", { method: "POST", body: JSON.stringify({ url }) });
export const extractFigma = (payload) => jsonRequest("/api/figma/extract", { method: "POST", body: JSON.stringify(payload) });
export const compareFigmaElement = (payload) => jsonRequest("/api/figma/compare-selected", { method: "POST", body: JSON.stringify(payload) });

export async function downloadPdf(audit, filename = "inspectra-audit-report.pdf") {
  const response = await fetch(`${API_BASE}/api/report/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(audit),
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

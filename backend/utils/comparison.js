export function toPx(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).trim().match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number.parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function normalizeText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeFontWeight(value) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  const named = {
    thin: 100,
    extralight: 200,
    "extra light": 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    "semi bold": 600,
    bold: 700,
    extrabold: 800,
    "extra bold": 800,
    black: 900,
  };
  if (named[raw] !== undefined) return named[raw];
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizeColor(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === "transparent") return "transparent";

  if (raw.startsWith("#")) {
    const h = raw.slice(1);
    if (h.length === 3) return `#${h.split("").map((c) => c + c).join("")}`;
    if (h.length === 4) {
      const rgb = h.slice(0, 3).split("").map((c) => c + c).join("");
      const alpha = Number.parseInt(h[3] + h[3], 16) / 255;
      return alpha <= 0.01 ? "transparent" : `#${rgb}`;
    }
    if (h.length >= 8) {
      const alpha = Number.parseInt(h.slice(6, 8), 16) / 255;
      return alpha <= 0.01 ? "transparent" : `#${h.slice(0, 6)}`;
    }
    if (h.length >= 6) return `#${h.slice(0, 6)}`;
  }

  const rgb = raw.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+))?/);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (Number.isFinite(alpha) && alpha <= 0.01) return "transparent";
    return `#${[rgb[1], rgb[2], rgb[3]].map((v) => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, "0")).join("")}`;
  }

  return raw;
}

function rgbFromHex(hex) {
  const c = normalizeColor(hex);
  if (!c || c === "transparent" || !/^#[0-9a-f]{6}$/.test(c)) return null;
  return [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
}

export function colorDistance(a, b) {
  const na = normalizeColor(a);
  const nb = normalizeColor(b);
  if (na === nb) return 0;
  if (na === "transparent" || nb === "transparent") return 999;
  const x = rgbFromHex(na);
  const y = rgbFromHex(nb);
  if (!x || !y) return 999;
  return Math.sqrt(x.reduce((sum, v, i) => sum + (v - y[i]) ** 2, 0));
}

function levenshtein(a = "", b = "") {
  const s = String(a);
  const t = String(b);
  const dp = Array.from({ length: t.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= s.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= t.length; i += 1) {
    for (let j = 1; j <= s.length; j += 1) {
      dp[i][j] = t[i - 1] === s[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[t.length][s.length];
}

export function textSimilarity(a = "", b = "") {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s && !t) return 1;
  const max = Math.max(s.length, t.length);
  if (!max) return 1;
  return Number((1 - levenshtein(s, t) / max).toFixed(3));
}

export function relativeDifference(a, b) {
  const x = toPx(a);
  const y = toPx(b);
  if (x === null || y === null) return 1;
  const denom = Math.max(Math.abs(x), Math.abs(y), 1);
  return Math.abs(x - y) / denom;
}

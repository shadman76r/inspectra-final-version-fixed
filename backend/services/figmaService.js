const FIGMA_API = "https://api.figma.com/v1";

export function parseFigmaUrl(figmaUrl) {
  let url;
  try { url = new URL(figmaUrl); } catch { throw new Error("Invalid Figma URL."); }
  const parts = url.pathname.split("/").filter(Boolean);
  const kindIndex = parts.findIndex((p) => ["design", "file", "proto"].includes(p));
  const fileKey = kindIndex >= 0 ? parts[kindIndex + 1] : null;
  if (!fileKey) throw new Error("Could not find the Figma file key in the URL.");
  let nodeId = url.searchParams.get("node-id") || null;
  if (nodeId && !nodeId.includes(":")) nodeId = nodeId.replace(/-/g, ":");
  return { fileKey, nodeId };
}

function channel(v) { return Math.max(0, Math.min(255, Math.round(Number(v || 0) * 255))); }
function paintToHex(paints) {
  const paint = (paints || []).find((p) => p && p.visible !== false && p.type === "SOLID" && p.color);
  if (!paint) return null;
  if ((paint.opacity ?? 1) <= 0.01) return "transparent";
  return `#${[channel(paint.color.r), channel(paint.color.g), channel(paint.color.b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function roleHint(node) {
  const name = String(node.name || "").toLowerCase();
  if (node.type === "TEXT") {
    if (/heading|title|headline|h1|h2|h3/.test(name)) return "heading";
    return "text";
  }
  if (/button|cta|btn/.test(name)) return "button";
  if (/nav|menu/.test(name)) return "navigation";
  if (/image|photo|logo|icon/.test(name)) return "img";
  if (/input|field|select|textarea/.test(name)) return "form-control";
  return "container";
}

function isComparable(node) {
  if (!node || node.visible === false || !node.absoluteBoundingBox) return false;
  if (node.absoluteBoundingBox.width < 1 || node.absoluteBoundingBox.height < 1) return false;
  if (node.type === "TEXT") return true;
  if (["INSTANCE", "COMPONENT", "RECTANGLE", "ELLIPSE"].includes(node.type)) return true;
  if (node.type === "FRAME") {
    const n = String(node.name || "").toLowerCase();
    return Boolean(paintToHex(node.fills)) || /button|cta|card|header|nav|menu|footer|input|field|hero/.test(n);
  }
  return false;
}

function descendantText(node) {
  const values = [];
  const stack = [...(node.children || [])];
  while (stack.length && values.length < 3) {
    const child = stack.shift();
    if (child?.visible === false) continue;
    if (child?.type === "TEXT" && child.characters) values.push(String(child.characters).trim());
    if (Array.isArray(child?.children)) stack.push(...child.children);
  }
  return values.filter(Boolean).join(" ").slice(0, 220);
}

function firstTextNode(node) {
  const stack = [...(node.children || [])];
  while (stack.length) {
    const child = stack.shift();
    if (child?.visible === false) continue;
    if (child?.type === "TEXT") return child;
    if (Array.isArray(child?.children)) stack.push(...child.children);
  }
  return null;
}

function toElement(node, rootBox) {
  const box = node.absoluteBoundingBox || {};
  const textNode = node.type === "TEXT" ? node : firstTextNode(node);
  const style = textNode?.style || node.style || {};
  const radius = typeof node.cornerRadius === "number"
    ? node.cornerRadius
    : Array.isArray(node.rectangleCornerRadii) ? node.rectangleCornerRadii[0] : null;
  return {
    id: node.id,
    figmaNodeId: node.id,
    name: node.name || "",
    type: node.type,
    roleHint: roleHint(node),
    text: node.type === "TEXT" ? (node.characters || "") : descendantText(node),
    width: box.width ?? null,
    height: box.height ?? null,
    x: box.x != null && rootBox?.x != null ? box.x - rootBox.x : box.x ?? null,
    y: box.y != null && rootBox?.y != null ? box.y - rootBox.y : box.y ?? null,
    fontSize: style.fontSize ?? null,
    fontWeight: style.fontWeight ?? null,
    color: textNode ? paintToHex(textNode.fills) : null,
    backgroundColor: node.type !== "TEXT" ? paintToHex(node.fills) : null,
    textAlign: style.textAlignHorizontal ? String(style.textAlignHorizontal).toLowerCase() : null,
    borderRadius: radius,
    paddingTop: node.paddingTop ?? null,
    paddingRight: node.paddingRight ?? null,
    paddingBottom: node.paddingBottom ?? null,
    paddingLeft: node.paddingLeft ?? null,
    itemSpacing: node.itemSpacing ?? null,
    visible: node.visible !== false,
  };
}

export function flattenFigmaDocument(documentNode, { maxElements = 500 } = {}) {
  if (!documentNode) return [];
  const rootBox = documentNode.absoluteBoundingBox || null;
  const result = [];
  const stack = [{ node: documentNode, isRoot: true }];
  while (stack.length && result.length < maxElements) {
    const { node, isRoot = false } = stack.shift();
    const skipRootContainer = isRoot && ["DOCUMENT", "CANVAS", "FRAME"].includes(node?.type);
    if (!skipRootContainer && isComparable(node)) result.push(toElement(node, rootBox));
    if (Array.isArray(node.children)) stack.unshift(...node.children.map((child) => ({ node: child, isRoot: false })));
  }
  return result;
}

async function figmaFetch(url, accessToken) {
  const attempts = [
    { "X-Figma-Token": accessToken },
    { Authorization: `Bearer ${accessToken}` },
  ];
  let lastStatus = 0;
  let lastBody = "";
  for (const headers of attempts) {
    const response = await fetch(url, { headers });
    if (response.ok) return response.json();
    lastStatus = response.status;
    lastBody = await response.text().catch(() => "");
    if (![401, 403].includes(response.status)) break;
  }
  throw new Error(`Figma API request failed (${lastStatus}). ${lastBody.slice(0, 250)}`.trim());
}

export async function fetchFigmaElements(figmaUrl, accessToken, options = {}) {
  if (!accessToken) throw new Error("Figma access token is required for live Figma extraction.");
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);
  const endpoint = nodeId
    ? `${FIGMA_API}/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}`
    : `${FIGMA_API}/files/${encodeURIComponent(fileKey)}`;
  const payload = await figmaFetch(endpoint, accessToken);
  const documentNode = nodeId ? payload.nodes?.[nodeId]?.document : payload.document;
  if (!documentNode) throw new Error("The selected Figma node/file could not be read. Check the URL and token permissions.");
  return {
    fileKey,
    nodeId,
    fileName: payload.name || payload.nodes?.[nodeId]?.name || "Figma design",
    frame: documentNode.absoluteBoundingBox ? {
      width: documentNode.absoluteBoundingBox.width,
      height: documentNode.absoluteBoundingBox.height,
    } : null,
    elements: flattenFigmaDocument(documentNode, options),
  };
}

export async function fetchFigmaNodeImage(fileKey, nodeId, accessToken) {
  if (!fileKey || !nodeId || !accessToken) return null;
  const endpoint = `${FIGMA_API}/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1`;
  const payload = await figmaFetch(endpoint, accessToken);
  return payload?.images?.[nodeId] || null;
}

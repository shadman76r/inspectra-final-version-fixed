function compact(value, max = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function extractDomElements(page, { maxElements = 700 } = {}) {
  const elements = await page.evaluate(({ maxElements }) => {
    function compactText(value, max = 220) {
      return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
    }

    function stableSelector(el) {
      const qa = el.getAttribute("data-qa-audit-id");
      if (qa) return `[data-qa-audit-id="${CSS.escape(qa)}"]`;
      const testId = el.getAttribute("data-testid");
      if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
      if (el.id) return `#${CSS.escape(el.id)}`;

      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && node !== document.body && parts.length < 5) {
        let part = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.tagName === node.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        node = parent;
      }
      return parts.join(" > ");
    }

    function inferRole(el) {
      const explicit = el.getAttribute("role");
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      if (tag === "button") return "button";
      if (tag === "a") return "link";
      if (/^h[1-6]$/.test(tag)) return "heading";
      if (tag === "img") return "img";
      if (["input", "textarea", "select"].includes(tag)) return "form-control";
      if (tag === "nav") return "navigation";
      return tag;
    }

    const candidates = [];
    const all = [...document.querySelectorAll("body *")];
    for (const el of all) {
      if (candidates.length >= maxElements) break;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01;
      if (!visible) continue;

      const tag = el.tagName.toLowerCase();
      const text = compactText(el.innerText || el.textContent || "");
      const ariaLabel = compactText(el.getAttribute("aria-label") || "");
      const title = compactText(el.getAttribute("title") || "");
      const qaId = el.getAttribute("data-qa-audit-id") || "";
      const testId = el.getAttribute("data-testid") || "";
      const isInteractive = ["a", "button", "input", "textarea", "select", "summary"].includes(tag) || Boolean(el.getAttribute("role")) || el.tabIndex >= 0;
      const hasVisual = style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopWidth !== "0px" || tag === "img";
      const hasUsefulIdentity = Boolean(text || ariaLabel || title || qaId || testId || el.id);
      const childCount = el.children.length;

      if (!isInteractive && !hasVisual && !hasUsefulIdentity) continue;
      if (!isInteractive && childCount > 12 && text.length > 180) continue;

      candidates.push({
        auditId: qaId || null,
        testId: testId || null,
        id: el.id || null,
        selector: stableSelector(el),
        tag,
        role: inferRole(el),
        name: ariaLabel || title || testId || el.id || "",
        accessibleName: ariaLabel || title || text,
        text,
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        textAlign: style.textAlign,
        borderRadius: style.borderTopLeftRadius,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        marginTop: style.marginTop,
        marginRight: style.marginRight,
        marginBottom: style.marginBottom,
        marginLeft: style.marginLeft,
        visible: true,
        href: tag === "a" ? el.href : null,
      });
    }
    return candidates;
  }, { maxElements });

  return elements.map((item) => ({ ...item, text: compact(item.text), name: compact(item.name) }));
}

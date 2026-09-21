import { createCheck, scoreFromChecks, summarizeChecks } from "../utils/auditCheck.js";

const AI_BOTS = ["gptbot", "chatgpt-user", "claudebot", "anthropic-ai", "perplexitybot", "google-extended"];

function robotsBlocksAiBots(text = "") {
  const lower = String(text).toLowerCase();
  const blocked = [];
  for (const bot of AI_BOTS) {
    const sections = lower.split(/user-agent\s*:/i).slice(1);
    for (const section of sections) {
      const lines = section.split(/\r?\n/).map((line) => line.trim());
      const agent = lines[0]?.split(/\s+/)[0] || "";
      if (agent.includes(bot) && lines.some((line) => /^disallow\s*:\s*\/$/i.test(line))) {
        blocked.push(bot);
        break;
      }
    }
  }
  return [...new Set(blocked)];
}

export async function scanGeo(page, url) {
  const data = await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
    const bodyText = clean(document.body?.innerText || "");
    const words = bodyText ? bodyText.split(/\s+/).filter(Boolean) : [];
    const headingNodes = [...document.querySelectorAll("h1,h2,h3")];
    const headings = headingNodes.map((el) => clean(el.textContent)).filter(Boolean);
    const questionHeadings = headings.filter((text) => /\?$|^(what|why|how|when|where|who|which|can|does|do|is|are)\b/i.test(text));

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((el) => {
        try { return JSON.parse(el.textContent || "{}"); } catch { return null; }
      })
      .filter(Boolean);

    const schemaTypes = [];
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach(visit);
      const type = value["@type"];
      if (Array.isArray(type)) schemaTypes.push(...type.map(String));
      else if (type) schemaTypes.push(String(type));
      if (value["@graph"]) visit(value["@graph"]);
    };
    jsonLd.forEach(visit);

    const author = clean(
      document.querySelector('meta[name="author"]')?.content ||
      document.querySelector('[rel="author"]')?.textContent ||
      document.querySelector('[class*="author" i]')?.textContent || ""
    );
    const published = clean(
      document.querySelector('meta[property="article:published_time"]')?.content ||
      document.querySelector('meta[name="date"]')?.content ||
      document.querySelector("time[datetime]")?.getAttribute("datetime") || ""
    );
    const modified = clean(
      document.querySelector('meta[property="article:modified_time"]')?.content ||
      document.querySelector('meta[name="last-modified"]')?.content || ""
    );
    const siteName = clean(
      document.querySelector('meta[property="og:site_name"]')?.content ||
      document.querySelector('[itemprop="name"]')?.textContent || ""
    );
    const externalLinks = [...document.querySelectorAll("a[href]")].filter((a) => {
      try { return new URL(a.href, location.href).origin !== location.origin; } catch { return false; }
    }).length;
    const firstParagraph = clean(document.querySelector("main p, article p, p")?.textContent || "");
    const lists = document.querySelectorAll("main ul, main ol, article ul, article ol").length;
    const tables = document.querySelectorAll("main table, article table").length;
    const faqSignals = schemaTypes.some((t) => /faqpage/i.test(t)) || questionHeadings.length >= 2;
    const entitySchema = schemaTypes.some((t) => /organization|localbusiness|person|product|service|article|newsarticle/i.test(t));

    return {
      wordCount: words.length,
      headings,
      questionHeadings,
      schemaTypes: [...new Set(schemaTypes)],
      author,
      published,
      modified,
      siteName,
      externalLinks,
      firstParagraphLength: firstParagraph.length,
      lists,
      tables,
      faqSignals,
      entitySchema,
    };
  });

  let robotsText = "";
  try {
    const robotsUrl = `${new URL(url).origin}/robots.txt`;
    const response = await fetch(robotsUrl, { redirect: "follow" });
    if (response.ok) robotsText = await response.text();
  } catch {}
  const blockedAiBots = robotsBlocksAiBots(robotsText);

  const checks = [
    createCheck({
      id: "geo-answer-ready",
      category: "geo",
      label: "Answer-ready content",
      status: data.wordCount >= 300 && data.firstParagraphLength >= 80 ? "pass" : data.wordCount >= 150 ? "warning" : "fail",
      url,
      expected: "Substantial page content with a clear introductory answer",
      actual: `${data.wordCount} words · intro ${data.firstParagraphLength} chars`,
      evidence: "GEO heuristic: useful, self-contained page content is easier for answer engines to understand and summarize.",
      recommendation: data.wordCount >= 300 && data.firstParagraphLength >= 80 ? "" : "Add a concise introductory answer followed by sufficiently detailed supporting content.",
      severity: "medium",
    }),
    createCheck({
      id: "geo-structured-data",
      category: "geo",
      label: "Structured data signals",
      status: data.schemaTypes.length ? "pass" : "warning",
      url,
      expected: "Relevant JSON-LD schema where appropriate",
      actual: data.schemaTypes.length ? data.schemaTypes.join(", ") : "No JSON-LD types detected",
      recommendation: data.schemaTypes.length ? "" : "Add accurate schema markup such as Organization, LocalBusiness, Product, Article or FAQPage where it reflects visible content.",
      severity: "medium",
    }),
    createCheck({
      id: "geo-entity-clarity",
      category: "geo",
      label: "Entity clarity",
      status: data.entitySchema || data.siteName ? "pass" : "warning",
      url,
      expected: "Clear organization/person/product identity",
      actual: data.entitySchema ? "Relevant entity schema detected" : data.siteName ? `Site name: ${data.siteName}` : "Weak entity signals",
      recommendation: data.entitySchema || data.siteName ? "" : "Make the primary entity explicit with consistent naming, About/contact information and accurate structured data.",
      severity: "medium",
    }),
    createCheck({
      id: "geo-question-coverage",
      category: "geo",
      label: "Question / FAQ coverage",
      status: data.faqSignals ? "pass" : "warning",
      url,
      expected: "Useful question-led sections when relevant",
      actual: `${data.questionHeadings.length} question-style heading(s)`,
      evidence: data.questionHeadings.slice(0, 4).join(" | "),
      recommendation: data.faqSignals ? "" : "Where useful, add natural question-led sections that directly answer common user questions. Do not add FAQ markup for content that is not visible.",
      severity: "low",
    }),
    createCheck({
      id: "geo-authorship",
      category: "geo",
      label: "Authorship / trust signal",
      status: data.author ? "pass" : "warning",
      url,
      expected: "Author or responsible organization is identifiable",
      actual: data.author || data.siteName || "No explicit author detected",
      recommendation: data.author || data.siteName ? "" : "For editorial or expert content, expose the author/responsible organization and supporting trust information.",
      severity: "low",
    }),
    createCheck({
      id: "geo-freshness",
      category: "geo",
      label: "Freshness metadata",
      status: data.published || data.modified ? "pass" : "warning",
      url,
      expected: "Published/updated date where freshness matters",
      actual: data.modified || data.published || "No publication/update date detected",
      recommendation: data.published || data.modified ? "" : "For time-sensitive content, expose accurate published/updated dates in visible content and structured metadata.",
      severity: "low",
    }),
    createCheck({
      id: "geo-semantic-structure",
      category: "geo",
      label: "Semantic content structure",
      status: data.headings.length >= 3 || data.lists + data.tables > 0 ? "pass" : "warning",
      url,
      expected: "Clear headings and scannable supporting structure",
      actual: `${data.headings.length} H1-H3 headings · ${data.lists} lists · ${data.tables} tables`,
      recommendation: data.headings.length >= 3 || data.lists + data.tables > 0 ? "" : "Break complex information into descriptive headings, lists or tables where appropriate.",
      severity: "low",
    }),
    createCheck({
      id: "geo-source-signals",
      category: "geo",
      label: "Supporting source signals",
      status: data.externalLinks >= 2 ? "pass" : data.externalLinks === 1 ? "warning" : "warning",
      url,
      expected: "Helpful external references when claims require support",
      actual: `${data.externalLinks} external link(s) detected`,
      recommendation: data.externalLinks >= 2 ? "" : "For factual or research-heavy content, cite useful primary or authoritative sources where they genuinely support claims.",
      severity: "low",
    }),
    createCheck({
      id: "geo-ai-crawler-access",
      category: "geo",
      label: "AI crawler directives",
      status: blockedAiBots.length ? "warning" : "pass",
      url,
      expected: "No accidental blanket block for major AI crawlers unless intentional",
      actual: blockedAiBots.length ? `Explicitly blocked: ${blockedAiBots.join(", ")}` : "No explicit blanket AI-bot block detected",
      evidence: "This is an Inspectra discoverability signal, not a ranking guarantee. Blocking may be intentional depending on site policy.",
      recommendation: blockedAiBots.length ? "Confirm these robots.txt directives are intentional and aligned with the site's AI-content policy." : "",
      severity: "low",
    }),
  ];

  return {
    name: "GEO",
    score: scoreFromChecks(checks),
    summary: summarizeChecks(checks),
    checks,
    raw: { ...data, blockedAiBots },
    note: "Inspectra GEO is a heuristic Generative Engine Optimization readiness score, not an official search-engine metric.",
  };
}

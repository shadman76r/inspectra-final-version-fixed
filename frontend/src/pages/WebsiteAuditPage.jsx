import { useEffect, useState } from "react";
import { Globe, Play, Sparkles } from "lucide-react";
import { getDemoAudit, runAudit } from "../services/api.js";
import WebsiteAuditResults from "../components/WebsiteAuditResults.jsx";

const stages = ["Opening website", "Checking SEO & GEO", "Measuring performance", "Capturing device previews", "Building QA report"];

export default function WebsiteAuditPage() {
  const [url, setUrl] = useState("https://example.com");
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setStage((s) => Math.min(stages.length - 1, s + 1)), 1800);
    return () => clearInterval(timer);
  }, [loading]);

  async function handleRun(e) {
    e.preventDefault();
    setError(""); setLoading(true); setStage(0); setAudit(null);
    try { setAudit(await runAudit(url)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadDemo() {
    setError(""); setLoading(true); setStage(1);
    try { setAudit(await getDemoAudit()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return <div className="page-stack">
    <section className="hero-panel audit-hero">
      <div className="hero-copy"><p className="eyebrow">WEBSITE QUALITY INTELLIGENCE</p><h1>Audit SEO, GEO, performance and responsive behavior in one run.</h1><p>Enter a website URL once. Inspectra returns a combined quality report with visual performance indicators and real desktop, tablet and mobile previews.</p><div className="feature-pills"><span>SEO + GEO</span><span>Performance visuals</span><span>Responsive screenshots</span><span>PASS / FAIL report</span></div></div>
      <form className="primary-form" onSubmit={handleRun}>
        <label><Globe size={16}/> Website URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" required />
        <button disabled={loading}><Play size={17}/>{loading ? "Auditing website…" : "Start website audit"}</button>
        <button type="button" className="secondary" onClick={loadDemo} disabled={loading}><Sparkles size={16}/> Load demo result</button>
        <small>Figma comparison is intentionally separated into its own tab.</small>
      </form>
      {loading && <div className="progress-panel"><div className="progress-track"><i style={{width:`${((stage+1)/stages.length)*100}%`}} /></div><strong>{stages[stage]}…</strong><span>{stage+1} / {stages.length}</span></div>}
      {error && <div className="error-box">{error}</div>}
    </section>
    {audit && <WebsiteAuditResults audit={audit} />}
  </div>;
}

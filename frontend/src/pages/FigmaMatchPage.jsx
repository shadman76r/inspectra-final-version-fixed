import { useState } from "react";
import { Frame, KeyRound, Link, Layers } from "lucide-react";
import { compareFigmaElement, extractFigma } from "../services/api.js";
import FigmaElementBrowser from "../components/FigmaElementBrowser.jsx";
import FigmaElementReport from "../components/FigmaElementReport.jsx";

export default function FigmaMatchPage() {
  const [websiteUrl, setWebsiteUrl] = useState("https://example.com");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [token, setToken] = useState("");
  const [figmaData, setFigmaData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState({});
  const [loadingElements, setLoadingElements] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");

  async function loadElements(e) {
    e.preventDefault();
    setError(""); setLoadingElements(true); setFigmaData(null); setSelected(null); setReport(null); setReports({});
    try { setFigmaData(await extractFigma({ figmaUrl, accessToken: token, options: { maxElements: 700 } })); }
    catch (e) { setError(e.message); }
    finally { setLoadingElements(false); }
  }

  async function selectElement(element) {
    setSelected(element); setReport(reports[element.id] || null); setError("");
    if (reports[element.id]) return;
    setComparing(true);
    try {
      const result = await compareFigmaElement({
        figmaElement: element,
        figmaFileKey: figmaData.fileKey,
        accessToken: token,
        websiteUrl,
        options: { viewportWidth: figmaData.frame?.width || 1440, viewportHeight: Math.min(1200, Math.max(700, figmaData.frame?.height || 900)) },
      });
      setReport(result);
      setReports((prev) => ({ ...prev, [element.id]: result }));
    } catch (e) { setError(e.message); }
    finally { setComparing(false); }
  }

  return <div className="page-stack">
    <section className="hero-panel figma-hero">
      <div className="hero-copy"><p className="eyebrow">FIGMA MATCH WORKSPACE</p><h1>Browse your Figma elements, then compare only what you choose.</h1><p>Load the selected Figma frame first. Inspectra lists every comparable element. Click an element to match it against the live website and get a focused visual report.</p><div className="workflow-row"><span>1 · Load Figma</span><span>2 · Choose element</span><span>3 · Compare live</span><span>4 · Review report</span></div></div>
      <form className="figma-setup-form" onSubmit={loadElements}>
        <label><Frame size={16}/> Figma frame URL</label><input value={figmaUrl} onChange={(e)=>setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/design/...?...node-id=..." required />
        <label><KeyRound size={16}/> Figma access token</label><input type="password" value={token} onChange={(e)=>setToken(e.target.value)} placeholder="Figma personal access token" autoComplete="off" required />
        <label><Link size={16}/> Website to compare</label><input value={websiteUrl} onChange={(e)=>setWebsiteUrl(e.target.value)} placeholder="https://example.com" required />
        <button disabled={loadingElements}><Layers size={17}/>{loadingElements ? "Reading Figma elements…" : "Load Figma elements"}</button>
        <small>Your token is used only by the local backend request and is not stored by this project.</small>
      </form>
      {error && <div className="error-box">{error}</div>}
    </section>
    {figmaData && <section className="figma-workspace"><FigmaElementBrowser data={figmaData} selectedId={selected?.id} onSelect={selectElement} reports={reports}/><FigmaElementReport report={report} selected={selected} loading={comparing}/></section>}
  </div>;
}

import { Download, MousePointerClick } from "lucide-react";
import { downloadPdf } from "../services/api.js";
import CheckTable from "./CheckTable.jsx";
import ScoreCard from "./ScoreCard.jsx";

export default function FigmaElementReport({ report, selected, loading }) {
  if (loading) return <div className="figma-report-empty"><div className="compare-spinner"/><h3>Comparing selected element…</h3><p>Inspectra is finding the most likely live DOM element and checking its visual properties.</p></div>;
  if (!selected) return <div className="figma-report-empty"><MousePointerClick size={42}/><h3>Select a Figma element</h3><p>Click any element from the left panel. Only that element will be compared with the website.</p></div>;
  if (!report) return <div className="figma-report-empty"><h3>{selected.name || selected.text || selected.id}</h3><p>Comparison result will appear here.</p></div>;

  const figma = report.categories?.figma;
  const match = figma?.matches?.[0];
  const previews = figma?.source?.previews || {};
  return <div className="figma-element-report">
    <div className="figma-report-head"><div><span className="section-kicker">SELECTED ELEMENT REPORT</span><h2>{selected.name || selected.text || selected.id}</h2><p>{selected.type} · Figma node {selected.id}</p></div><button className="download-btn" onClick={()=>downloadPdf(report,"inspectra-figma-element-report.pdf")}><Download size={16}/> Download report</button></div>
    <div className="figma-report-overview"><ScoreCard label="Match score" score={report.overallScore} hint="Selected element only" /><div className="match-facts"><div><span>DOM match</span><strong>{match?.website?.selector || "Not matched"}</strong></div><div><span>Confidence</span><strong>{match?.website ? `${Math.round((match.confidence||0)*100)}%` : "0%"}</strong></div><div><span>Matched by</span><strong>{(match?.reasons || []).join(", ") || "No confident signals"}</strong></div></div></div>
    <div className="visual-compare-grid">
      <div className="visual-panel"><div className="visual-panel-head"><strong>Figma element</strong><span>{Math.round(selected.width||0)} × {Math.round(selected.height||0)}</span></div><div className="visual-canvas">{previews.figma ? <img src={previews.figma} alt="Selected Figma element"/> : <div className="element-placeholder"><b>{selected.name || selected.type}</b><span>{selected.text || "Figma preview unavailable"}</span></div>}</div></div>
      <div className="visual-panel"><div className="visual-panel-head"><strong>Live website match</strong><span>{match?.website?.selector || "No match"}</span></div><div className="visual-canvas">{previews.website ? <img src={previews.website} alt="Matched live website element"/> : <div className="element-placeholder"><b>No website preview</b><span>{match?.website ? "The DOM element was matched but could not be captured." : "No confident live element match was found."}</span></div>}</div></div>
    </div>
    <div className="selected-properties"><div><span>Text</span><strong>{selected.text || "—"}</strong></div><div><span>Font</span><strong>{selected.fontSize ? `${selected.fontSize}px` : "—"} / {selected.fontWeight || "—"}</strong></div><div><span>Text color</span><strong>{selected.color || "—"}</strong></div><div><span>Background</span><strong>{selected.backgroundColor || "—"}</strong></div></div>
    <div className="subsection"><h3>Property-by-property comparison</h3><CheckTable checks={figma?.checks || []} /></div>
  </div>;
}

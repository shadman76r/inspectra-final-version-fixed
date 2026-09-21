import React from "react";
import { Search } from "lucide-react";

function swatchStyle(el) {
  const color = el.backgroundColor || el.color;
  return color && color !== "transparent" ? { background: color } : {};
}

export default function FigmaElementBrowser({ data, selectedId, onSelect, reports = {} }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const elements = data?.elements || [];
  const filtered = elements.filter((el) => {
    const hay = `${el.name || ""} ${el.text || ""} ${el.type || ""} ${el.roleHint || ""}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (filter === "text" && el.type !== "TEXT") return false;
    if (filter === "interactive" && !["button","navigation","form-control"].includes(el.roleHint)) return false;
    if (filter === "visual" && !["RECTANGLE","ELLIPSE","INSTANCE","COMPONENT"].includes(el.type)) return false;
    return true;
  });
  return <div className="figma-browser">
    <div className="figma-browser-head"><div><strong>{data.fileName}</strong><span>{elements.length} comparable elements</span></div>{data.frame && <span className="frame-chip">{Math.round(data.frame.width)} × {Math.round(data.frame.height)}</span>}</div>
    <div className="element-search"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search Figma elements…" /></div>
    <div className="filter-row">{[["all","All"],["text","Text"],["interactive","UI"],["visual","Visual"]].map(([value,label]) => <button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <div className="element-list">{filtered.map((el) => {
      const result = reports[el.id];
      return <button className={`element-card ${selectedId===el.id?"selected":""}`} key={el.id} onClick={()=>onSelect(el)}>
        <span className="element-swatch" style={swatchStyle(el)}>{!el.backgroundColor && !el.color ? String(el.type || "E").slice(0,1) : ""}</span>
        <span className="element-copy"><strong>{el.name || el.text || "Unnamed element"}</strong><small>{el.type} · {Math.round(el.width || 0)}×{Math.round(el.height || 0)}</small>{el.text && <em>{el.text.slice(0,72)}</em>}</span>
        {result && <span className={`element-result ${result.overallScore>=80?"pass":result.overallScore>=55?"warn":"fail"}`}>{result.overallScore}</span>}
      </button>;
    })}{!filtered.length && <div className="empty-state">No elements match this filter.</div>}</div>
  </div>;
}

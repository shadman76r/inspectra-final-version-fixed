import { useState } from "react";
import { Frame, Gauge, ShieldCheck } from "lucide-react";
import WebsiteAuditPage from "./pages/WebsiteAuditPage.jsx";
import FigmaMatchPage from "./pages/FigmaMatchPage.jsx";

export default function App() {
  const [tab, setTab] = useState("audit");
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><ShieldCheck size={21}/></span><div><strong>Inspectra AI</strong><small>Website QA Intelligence</small></div></div>
      <nav className="main-tabs"><button className={tab==="audit"?"active":""} onClick={()=>setTab("audit")}><Gauge size={17}/> Website Audit</button><button className={tab==="figma"?"active":""} onClick={()=>setTab("figma")}><Frame size={17}/> Figma Match</button></nav>
      <span className="build-badge">Final standalone build</span>
    </header>
    <main>{tab === "audit" ? <WebsiteAuditPage/> : <FigmaMatchPage/>}</main>
  </div>;
}

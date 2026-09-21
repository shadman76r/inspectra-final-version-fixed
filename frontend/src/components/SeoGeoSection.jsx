import ScoreCard from "./ScoreCard.jsx";
import CheckTable from "./CheckTable.jsx";

export default function SeoGeoSection({ seo, geo }) {
  return <section className="audit-section" id="seo-geo-section">
    <div className="section-heading"><div><span className="section-kicker">DISCOVERABILITY</span><h3>SEO + GEO audit</h3><p>Classic search visibility plus Inspectra Generative Engine Optimization readiness.</p></div></div>
    <div className="dual-category-grid">
      <div className="category-block"><ScoreCard label="SEO" score={seo?.score} hint="Search visibility" compact /><CheckTable checks={seo?.checks || []} /></div>
      <div className="category-block"><ScoreCard label="GEO" score={geo?.score} hint="Generative answer readiness" compact />{geo?.note && <div className="geo-note">{geo.note}</div>}<CheckTable checks={geo?.checks || []} /></div>
    </div>
  </section>;
}

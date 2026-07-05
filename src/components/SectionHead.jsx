export default function SectionHead({ kicker, title, sub, className = "" }) {
  return (
    <header className={`home-sectionHead section-head ${className}`.trim()}>
      {kicker ? <span className="home-kicker section-head-kicker">{kicker}</span> : null}
      <h2 className="h2 home-sectionTitle section-head-title">{title}</h2>
      {sub ? <p className="home-sectionSub section-head-sub">{sub}</p> : null}
    </header>
  );
}
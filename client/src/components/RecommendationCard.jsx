import { useState } from "react";

const applyUrlFor = (scheme) =>
  scheme.applicationLink?.trim()
    ? scheme.applicationLink
    : "https://www.myscheme.gov.in";

const formatIncome = (value) => {
  if (!value) return null;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
};

const EligibilityPill = ({ icon, label }) => (
  <span className="epill">
    <i aria-hidden="true">{icon}</i>
    {label}
  </span>
);

const RecommendationCard = ({ scheme, action }) => {
  const [expanded, setExpanded] = useState(false);
  if (!scheme?.name) return null;

  const applyUrl = applyUrlFor(scheme);

  const ageLabel =
    scheme.minAge != null && scheme.maxAge != null
      ? `${scheme.minAge}–${scheme.maxAge} yrs`
      : scheme.minAge != null
      ? `${scheme.minAge}+ yrs`
      : scheme.maxAge != null
      ? `≤${scheme.maxAge} yrs`
      : null;

  const incomeLabel = scheme.maxIncome
    ? `Income ≤ ${formatIncome(scheme.maxIncome)}`
    : null;

  return (
    <article
      className={`rcard${expanded ? " is-expanded" : ""}`}
      onClick={() => setExpanded((value) => !value)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((value) => !value);
        }
      }}
    >
      <div className="rcard__top">
        <div className="rcard__badges">
          {scheme.category && <span className="tag-cat">{scheme.category}</span>}
          {scheme.isFemaleOnly && <span className="tag-female">Women only</span>}
          {scheme.isScholarship && <span className="tag-scholar">Scholarship</span>}
        </div>

        <div className="rcard__meta-right">
          {typeof scheme.relevanceScore === "number" && scheme.relevanceScore > 0 && (
            <span className="rcard__score" title="Relevance score">
              {scheme.relevanceScore}%
            </span>
          )}
          <span className="rcard__state">
            {scheme.state && scheme.state !== "all"
              ? scheme.state.replace(/^./, (c) => c.toUpperCase())
              : "All India"}
          </span>
        </div>
      </div>

      <h3 className="rcard__name">{scheme.name}</h3>
      {scheme.description && (
        <p className="rcard__desc">{scheme.description}</p>
      )}

      <div
        className={`rcard__expand${expanded ? " is-open" : ""}`}
        aria-hidden={!expanded}
        inert={!expanded}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rcard__details">
          {scheme.eligibility && <section><h4>Eligibility</h4><p>{scheme.eligibility}</p></section>}
          {scheme.benefits && <section><h4>Benefits</h4><p>{scheme.benefits}</p></section>}
          {scheme.documentsRequired && <section><h4>Documents required</h4><p>{scheme.documentsRequired}</p></section>}
          {(scheme.minAge != null || scheme.maxAge != null || scheme.minIncome != null || scheme.maxIncome != null || scheme.allowedStates?.length > 0 || scheme.allowedOccupations?.length > 0) && (
            <section>
              <h4>At a glance</h4>
              <ul>
                {(scheme.minAge != null || scheme.maxAge != null) && <li>Age: {ageLabel}</li>}
                {(scheme.minIncome != null || scheme.maxIncome != null) && <li>Income: {scheme.minIncome ? `from ${formatIncome(scheme.minIncome)}` : ""}{scheme.minIncome && scheme.maxIncome ? " · " : ""}{scheme.maxIncome ? `up to ${formatIncome(scheme.maxIncome)}` : ""}</li>}
                {scheme.allowedStates?.length > 0 && <li>States: {scheme.allowedStates.join(", ")}</li>}
                {scheme.allowedOccupations?.length > 0 && <li>Occupations: {scheme.allowedOccupations.join(", ")}</li>}
              </ul>
            </section>
          )}
          {!scheme.eligibility && !scheme.benefits && !scheme.documentsRequired && !scheme.description && <p>More details are available on the official scheme page.</p>}
          <button type="button" className="rcard__collapse" onClick={() => setExpanded(false)}>Collapse details ↑</button>
        </div>
      </div>

      {(ageLabel || incomeLabel || scheme.allowedGenders?.length > 0) && (
        <div className="rcard__elig">
          {ageLabel && <EligibilityPill icon="◷" label={ageLabel} />}
          {incomeLabel && <EligibilityPill icon="₹" label={incomeLabel} />}
          {scheme.gender && scheme.gender !== "all" && (
            <EligibilityPill icon="⚤" label={scheme.gender} />
          )}
        </div>
      )}

      {scheme.tags?.length > 0 && (
        <div className="rcard__tags">
          {scheme.tags.slice(0, 3).map((tag, i) => (
            <span key={`${tag}-${i}`} className="rcard__tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="rcard__foot">
        <div className="rcard__ministry">
          <span className="lbl">Ministry</span>
          <span className="val" title={scheme.ministry || "Central Government"}>
            {scheme.ministry || "Central Government"}
          </span>
        </div>

        <div className="rcard__side">
          <a
            href={applyUrl}
            target="_blank"
            rel="noreferrer"
            className="rcard__apply"
            onClick={(e) => e.stopPropagation()}
          >
            Apply <span className="arw">↗</span>
          </a>
          {action}
        </div>
      </div>
    </article>
  );
};

export default RecommendationCard;

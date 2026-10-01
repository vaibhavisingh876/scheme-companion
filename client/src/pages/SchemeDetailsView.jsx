const decodeEntities = (str) =>
  str
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const cleanRichText = (raw) => {
  if (!raw) return [];
  let text = String(raw);
  text = text.replace(/<\s*br\s*\/?>/gi, "\n");
  text = text.replace(/<\/\s*(p|div|li|ul|ol|h[1-6]|tr)\s*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  text = text.replace(/[*_`>#]/g, "");
  text = text.replace(/\s*\d+\.\s+/g, "\n");
  text = text.replace(/[ \t]+/g, " ");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const RichText = ({ text }) => {
  const lines = cleanRichText(text);
  if (lines.length === 0) return null;
  if (lines.length === 1) return <p>{lines[0]}</p>;
  return (
    <ul className="block__list">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
};

const formatIncome = (value) => {
  if (!value) return null;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Crore`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)} Lakh`;
  return `₹${value.toLocaleString("en-IN")}`;
};

const MetaRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="meta-row">
      <span className="meta-row__label">{label}</span>
      <span className="meta-row__value">{value}</span>
    </div>
  );
};

const SchemeDetailsView = ({ scheme, onBackNavigate }) => {
  if (!scheme) {
    return (
      <div className="view section">
        <div className="container container--narrow empty">
          <div className="empty__mark">◦</div>
          <h3 className="display">No scheme selected</h3>
          <p>Head back and choose a scheme to read its full details.</p>
          <button type="button" className="btn btn--outline" onClick={onBackNavigate}>
            <span className="arw">←</span> Go back
          </button>
        </div>
      </div>
    );
  }

  const applyUrl =
    scheme.applicationLink?.trim() ||
    scheme.sourceUrl?.trim() ||
    `https://www.myscheme.gov.in/search?q=${encodeURIComponent(scheme.name)}`;

  const ageRange =
    scheme.minAge != null && scheme.maxAge != null
      ? `${scheme.minAge} – ${scheme.maxAge} years`
      : scheme.minAge != null
      ? `${scheme.minAge} years and above`
      : scheme.maxAge != null
      ? `Up to ${scheme.maxAge} years`
      : null;

  const incomeRange = scheme.maxIncome
    ? `Up to ${formatIncome(scheme.maxIncome)} per year`
    : scheme.minIncome
    ? `Above ${formatIncome(scheme.minIncome)} per year`
    : null;

  const genderLabel =
    scheme.isFemaleOnly
      ? "Female only"
      : scheme.allowedGenders?.length > 0 && !scheme.allowedGenders.includes("all")
      ? scheme.allowedGenders.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(", ")
      : null;

  const categoryLabel =
    scheme.allowedCategories?.length > 0 && !scheme.allowedCategories.includes("all")
      ? scheme.allowedCategories.map((c) => c.toUpperCase()).join(", ")
      : null;

  const educationLabel =
    scheme.allowedEducationLevels?.length > 0 && !scheme.allowedEducationLevels.includes("all")
      ? scheme.allowedEducationLevels.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(", ")
      : null;

  const occupationLabel =
    scheme.allowedOccupations?.length > 0 && !scheme.allowedOccupations.includes("all")
      ? scheme.allowedOccupations.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(", ")
      : null;

  const stateLabel =
    scheme.allowedStates?.length > 0 && !scheme.allowedStates.includes("all")
      ? scheme.allowedStates.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")
      : "All India";

  const hasStructuredMeta = ageRange || incomeRange || genderLabel || categoryLabel || educationLabel || occupationLabel;

  return (
    <div className="view article">
      <div className="container container--wide">
        <button className="back-link" onClick={onBackNavigate}>
          <span className="arw">←</span> Back
        </button>

        <div className="article__layout">
          <div className="article__main">
            <div className="article__meta">
              {scheme.category && (
                <span className="meta-pill meta-pill--accent">{scheme.category}</span>
              )}
              <span className="meta-pill">{stateLabel}</span>
              {scheme.isScholarship && (
                <span className="meta-pill meta-pill--scholar">Scholarship</span>
              )}
              {scheme.isFemaleOnly && (
                <span className="meta-pill meta-pill--female">Women only</span>
              )}
            </div>

            <h1 className="article__title display">{scheme.name}</h1>
            <p className="article__ministry">{scheme.ministry || "Central Government"}</p>

            <div className="article__body">
              {scheme.description && (
                <div className="block block--lede">
                  <h3>About this scheme</h3>
                  <RichText text={scheme.description} />
                </div>
              )}

              {hasStructuredMeta && (
                <div className="block">
                  <h3>Eligibility at a glance</h3>
                  <div className="meta-grid">
                    <MetaRow label="Age" value={ageRange} />
                    <MetaRow label="Income" value={incomeRange} />
                    <MetaRow label="Gender" value={genderLabel} />
                    <MetaRow label="Category" value={categoryLabel} />
                    <MetaRow label="Education" value={educationLabel} />
                    <MetaRow label="Occupation" value={occupationLabel} />
                    <MetaRow label="State" value={stateLabel} />
                  </div>
                </div>
              )}

              {scheme.eligibility && (
                <div className="block">
                  <h3>Eligibility details</h3>
                  <RichText text={scheme.eligibility} />
                </div>
              )}

              {scheme.benefits && (
                <div className="block">
                  <h3>Benefits</h3>
                  <RichText text={scheme.benefits} />
                </div>
              )}

              {scheme.documentsRequired && (
                <div className="block">
                  <h3>Documents required</h3>
                  <RichText text={scheme.documentsRequired} />
                </div>
              )}

              {scheme.tags?.length > 0 && (
                <div className="block">
                  <h3>Tagged</h3>
                  <div className="tag-row">
                    {scheme.tags.map((tag, i) => (
                      <span key={`${tag}-${i}`} className="rcard__tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="rail">
            <h4>Ready to apply?</h4>
            <p>
              Applications are handled on the official portal. Verify the details there
              before you submit.
            </p>
            <a
              href={applyUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn--primary btn--block"
            >
              Open on MyScheme <span className="arw">↗</span>
            </a>

            {scheme.sourceUrl && (
              <a
                href={scheme.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rail__link"
              >
                View source listing ↗
              </a>
            )}

            <p className="rail__note">
              Scheme Companion only surfaces and links to government schemes — we don't
              process applications or collect application data.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SchemeDetailsView;

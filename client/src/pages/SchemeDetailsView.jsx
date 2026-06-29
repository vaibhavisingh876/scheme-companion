import React from "react";

const SchemeDetailsView = ({ scheme, onBackNavigate }) => {
  if (!scheme) {
    return (
      <div
        className="text-center py-20 rounded-2xl max-w-2xl mx-auto"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No scheme selected.
        </p>
        <button
          onClick={onBackNavigate}
          className="mt-4 text-sm font-semibold underline underline-offset-2"
          style={{ color: "var(--saffron)" }}
        >
          Go back
        </button>
      </div>
    );
  }

  const finalVerificationUrl = `https://www.myscheme.gov.in/search?q=${encodeURIComponent(scheme.name)}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16 animate-fade-up">

      {/* Back */}
      <button
        onClick={onBackNavigate}
        className="flex items-center gap-1.5 text-sm font-medium transition-colors"
        style={{ color: "var(--muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--saffron)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
      >
        ← Back
      </button>

      {/* Main card */}
      <div
        className="rounded-2xl p-7 space-y-6"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--saffron)",
        }}
      >
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {scheme.category && (
            <span
              className="text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide"
              style={{ background: "var(--saffron-lt)", color: "var(--saffron-dk)" }}
            >
              {scheme.category}
            </span>
          )}
          <span
            className="text-[10px] font-medium px-3 py-1 rounded-full"
            style={{
              background: "var(--surface)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            📍 {scheme.state || "All India"}
          </span>
        </div>

        {/* Title */}
        <div>
          <h1
            className="text-2xl font-black tracking-tight leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
          >
            {scheme.name}
          </h1>
          <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--muted)" }}>
            {scheme.ministry || "Central Government"}
          </p>
        </div>

        {/* Description */}
        <div
          className="pt-5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <h3
            className="text-[11px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            About this scheme
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
            {scheme.description}
          </p>
        </div>

        {/* Eligibility */}
        {scheme.eligibility && (
          <div
            className="pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <h3
              className="text-[11px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Eligibility
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
              {scheme.eligibility}
            </p>
          </div>
        )}

        {/* Benefits */}
        {scheme.benefits && (
          <div
            className="pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <h3
              className="text-[11px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Benefits
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
              {scheme.benefits}
            </p>
          </div>
        )}

        {/* Tags */}
        {scheme.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            {scheme.tags.map((tag, i) => (
              <span
                key={i}
                className="text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wide font-medium"
                style={{
                  background: "var(--surface)",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Apply CTA */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <div>
          <h4
            className="text-sm font-bold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
          >
            Ready to apply?
          </h4>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Verify details on the official MyScheme portal before applying.
          </p>
        </div>
        <a
          href={finalVerificationUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm font-bold px-7 py-3 rounded-xl transition-all"
          style={{
            background: "var(--saffron)",
            color: "#fff",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
          onMouseEnter={(e) => (e.target.style.background = "var(--saffron-dk)")}
          onMouseLeave={(e) => (e.target.style.background = "var(--saffron)")}
        >
          Open on MyScheme ↗
        </a>
      </div>
    </div>
  );
};

export default SchemeDetailsView;
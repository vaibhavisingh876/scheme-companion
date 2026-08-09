import React from "react";

const CATEGORY_COLORS = {
  "Education & Learning":                     { bg: "#EBF5EE", text: "#2E7D52" },
  "Health & Wellness":                        { bg: "#FEF3F2", text: "#B42318" },
  "Agriculture, Rural & Environment":         { bg: "#F0FDF4", text: "#166534" },
  "Banking,Financial Services and Insurance": { bg: "#EFF6FF", text: "#1D4ED8" },
  "Skills & Employment":                      { bg: "#F5F3FF", text: "#6D28D9" },
  "Social welfare & Empowerment":             { bg: "#FFF7ED", text: "#C2410C" },
  "Business & Entrepreneurship":              { bg: "#ECFDF5", text: "#065F46" },
};

const getCategoryStyle = (cat) =>
  CATEGORY_COLORS[cat] || { bg: "var(--saffron-lt)", text: "var(--saffron-dk)" };

const RecommendationCard = ({ scheme, onViewDetails }) => {
  if (!scheme?.name || !scheme?.description) return null;

  const { bg, text } = getCategoryStyle(scheme.category);
  const applyUrl =
    scheme.applicationLink?.trim().length > 0
      ? scheme.applicationLink
      : "https://www.myscheme.gov.in";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--saffron)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(224,123,57,0.12)";
        e.currentTarget.style.borderColor = "var(--saffron)";
        e.currentTarget.style.borderLeftColor = "var(--saffron)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.borderLeftColor = "var(--saffron)";
      }}
      onClick={() => onViewDetails && onViewDetails(scheme)}
    >
      {/* Top row: category + state */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 flex-wrap">
        {scheme.category && (
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ background: bg, color: text }}
          >
            {scheme.category}
          </span>
        )}
        {scheme.state && (
          <span
            className="text-[10px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--surface)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            📍 {scheme.state}
          </span>
        )}
        {scheme.relevanceScore && (
          <span
            className="text-[10px] font-bold shrink-0 px-2 py-1 rounded-lg"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: "var(--saffron-lt)",
              color: "var(--saffron-dk)",
            }}
          >
            {scheme.relevanceScore}
          </span>
        )}
      </div>

      <div className="px-5 pb-3">
        {/* Name */}
        <h3
          className="text-base font-bold leading-snug mb-2"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: "var(--ink)",
          }}
        >
          {scheme.name}
        </h3>

        {/* Description */}
        <div className="mb-4">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {scheme.description}
          </p>
        </div>

        {/* Tags */}
        {scheme.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {scheme.tags.slice(0, 5).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wide font-medium"
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

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {scheme.ministry || "Central Government"}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={applyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold px-5 py-2 rounded-lg transition-all"
              style={{
                background: "var(--saffron)",
                color: "#fff",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Apply ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendationCard;
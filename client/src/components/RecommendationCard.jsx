
import React from "react";

const CATEGORY_COLORS = {
  "Education & Learning": {
    bg: "#EBF5EE",
    text: "#2E7D52",
  },
  "Health & Wellness": {
    bg: "#FEF3F2",
    text: "#B42318",
  },
  "Agriculture, Rural & Environment": {
    bg: "#F0FDF4",
    text: "#166534",
  },
  "Banking,Financial Services and Insurance": {
    bg: "#EFF6FF",
    text: "#1D4ED8",
  },
  "Skills & Employment": {
    bg: "#F5F3FF",
    text: "#6D28D9",
  },
  "Social welfare & Empowerment": {
    bg: "#FFF7ED",
    text: "#C2410C",
  },
  "Business & Entrepreneurship": {
    bg: "#ECFDF5",
    text: "#065F46",
  },
};

const getCategoryStyle = (cat) =>
  CATEGORY_COLORS[cat] || {
    bg: "var(--saffron-lt)",
    text: "var(--saffron-dk)",
  };

const RecommendationCard = ({
  scheme,
  onViewDetails,
}) => {
  if (!scheme?.name || !scheme?.description) {
    return null;
  }

  const { bg, text } = getCategoryStyle(
    scheme.category
  );

  const applyUrl =
    scheme.applicationLink?.trim().length > 0
      ? scheme.applicationLink
      : "https://www.myscheme.gov.in";

  return (
    <div
      className="premium-card group rounded-3xl overflow-hidden cursor-pointer animate-fade-up"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--saffron)",
      }}
      onClick={() =>
        onViewDetails?.(scheme)
      }
    >
      {/* TOP */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {scheme.category && (
            <span
              className="text-[9px] font-bold px-2.5 py-1.5 rounded-full uppercase tracking-[0.08em]"
              style={{
                background: bg,
                color: text,
              }}
            >
              {scheme.category}
            </span>
          )}

          {scheme.state && (
            <span
              className="text-[9px] font-semibold px-2.5 py-1.5 rounded-full"
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
              className="ml-auto text-[9px] font-bold px-2.5 py-1.5 rounded-lg"
              style={{
                fontFamily:
                  "'JetBrains Mono', monospace",
                background:
                  "var(--saffron-lt)",
                color:
                  "var(--saffron-dk)",
              }}
            >
              {scheme.relevanceScore}
            </span>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-5 pb-5">
        <h3
          className="text-[17px] font-black leading-snug mb-2.5 tracking-tight"
          style={{
            fontFamily:
              "'Plus Jakarta Sans', sans-serif",
            color: "var(--ink)",
          }}
        >
          {scheme.name}
        </h3>

        <p
          className="text-sm leading-6"
          style={{
            color: "var(--muted)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {scheme.description}
        </p>

        {scheme.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {scheme.tags
              .slice(0, 4)
              .map((tag, i) => (
                <span
                  key={i}
                  className="text-[9px] px-2 py-1 rounded-md uppercase tracking-wide font-semibold"
                  style={{
                    background:
                      "var(--surface)",
                    color: "var(--muted)",
                    border:
                      "1px solid var(--border)",
                  }}
                >
                  {tag}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        className="px-5 py-4 flex items-center justify-between gap-3"
        style={{
          borderTop:
            "1px solid var(--border)",
          background:
            "color-mix(in srgb, var(--surface) 35%, transparent)",
        }}
      >
        <div className="min-w-0">
          <p
            className="text-[9px] uppercase tracking-[0.12em] font-bold mb-1"
            style={{
              color: "var(--muted)",
            }}
          >
            Ministry
          </p>

          <span
            className="block text-[10px] font-semibold truncate"
            style={{
              color: "var(--ink)",
              maxWidth: "180px",
            }}
            title={
              scheme.ministry ||
              "Central Government"
            }
          >
            {scheme.ministry ||
              "Central Government"}
          </span>
        </div>

        <a
          href={applyUrl}
          target="_blank"
          rel="noreferrer"
          className="group/apply shrink-0 inline-flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: "var(--saffron)",
            fontFamily:
              "'Plus Jakarta Sans', sans-serif",
            boxShadow:
              "0 7px 20px rgba(224,123,57,0.15)",
          }}
          onClick={(e) =>
            e.stopPropagation()
          }
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "var(--saffron-dk)";
            e.currentTarget.style.boxShadow =
              "0 10px 28px rgba(224,123,57,0.22)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "var(--saffron)";
            e.currentTarget.style.boxShadow =
              "0 7px 20px rgba(224,123,57,0.15)";
          }}
        >
          Apply
          <span className="transition-transform duration-300 group-hover/apply:translate-x-0.5">
            ↗
          </span>
        </a>
      </div>
    </div>
  );
};

export default RecommendationCard;


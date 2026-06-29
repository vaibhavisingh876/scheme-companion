import { useEffect, useState } from "react";
import { getPaginatedSchemes } from "../services/api";

const StatPill = ({ value, label }) => (
  <div className="text-center">
    <p
      className="text-2xl font-black"
      style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--saffron)" }}
    >
      {value}
    </p>
    <p
      className="text-[10px] uppercase tracking-wider mt-0.5"
      style={{ color: "var(--muted)", fontFamily: "'Inter', sans-serif" }}
    >
      {label}
    </p>
  </div>
);

const SchemeCard = ({ scheme, onViewDetails }) => (
  <div
    className="flex flex-col justify-between p-5 rounded-2xl transition-all duration-200 group cursor-pointer"
    style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--saffron)",
    }}
    onClick={() => onViewDetails(scheme)}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = "0 4px 20px rgba(224,123,57,0.10)";
      e.currentTarget.style.borderColor = "var(--saffron)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = "var(--border)";
      e.currentTarget.style.borderLeft = "3px solid var(--saffron)";
    }}
  >
    <div className="space-y-2 mb-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{ background: "var(--saffron-lt)", color: "var(--saffron-dk)" }}
        >
          {scheme.category || "General"}
        </span>
        <span
          className="text-[9px] px-2 py-0.5 rounded-full"
          style={{
            background: "var(--surface)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          📍 {scheme.state || "All India"}
        </span>
      </div>
      <h3
        className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-[var(--saffron)] transition-colors"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
      >
        {scheme.name}
      </h3>
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--muted)" }}>
        {scheme.description}
      </p>
    </div>

    <div
      className="flex items-center justify-between pt-3"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <span className="text-[10px] font-medium" style={{ color: "var(--muted)" }}>
        View details →
      </span>
      <a
        href={scheme.applicationLink || "https://www.myscheme.gov.in"}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "var(--saffron)", color: "#fff" }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => (e.target.style.background = "var(--saffron-dk)")}
        onMouseLeave={(e) => (e.target.style.background = "var(--saffron)")}
      >
        Apply ↗
      </a>
    </div>
  </div>
);

// FIX: Added onTabChange prop so hero CTA buttons don't cause a full page reload
const LandingHome = ({ onViewDetails, onTabChange }) => {
  const [popularSchemes, setPopularSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaginatedSchemes(1, 6)
      .then((data) => {
        if (data?.schemes) setPopularSchemes(data.schemes);
      })
      .catch((err) => console.error("Backend connection failure:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-16 pb-16 animate-fade-in">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        className="relative rounded-3xl overflow-hidden p-8 md:p-14"
        style={{ background: "#1A0F00" }}
      >
        <svg
          className="absolute -right-16 -top-16 opacity-10 animate-spin-slow"
          width="320" height="320" viewBox="0 0 320 320"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 360) / 16;
            const rad = (angle * Math.PI) / 180;
            const x2 = 160 + 150 * Math.cos(rad);
            const y2 = 160 + 150 * Math.sin(rad);
            return <line key={i} x1="160" y1="160" x2={x2} y2={y2} stroke="#E07B39" strokeWidth="0.8" />;
          })}
          <circle cx="160" cy="160" r="40" fill="none" stroke="#E07B39" strokeWidth="1" />
        </svg>

        <div className="relative z-10 max-w-2xl space-y-6">
          <div
            className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(224,123,57,0.15)",
              color: "var(--saffron)",
              border: "1px solid rgba(224,123,57,0.3)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--saffron)" }} />
            Live · Connected to MyScheme Portal
          </div>

          <h1
            className="text-4xl md:text-5xl font-black tracking-tight leading-none text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Government benefits,<br />
            <span style={{ color: "var(--saffron)" }}>found in seconds.</span>
          </h1>

          <p className="text-sm leading-relaxed max-w-lg" style={{ color: "#A89080" }}>
            Thousands of scholarships, subsidies, loans, and pensions — matched to your profile
            using AI. No forms, no jargon.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {/* FIX: was <a href="?page=search"> which caused full page reload */}
            <button
              onClick={() => onTabChange("search")}
              className="text-sm font-bold px-7 py-3.5 rounded-xl transition-all"
              style={{
                background: "var(--saffron)",
                color: "#fff",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={(e) => (e.target.style.background = "var(--saffron-dk)")}
              onMouseLeave={(e) => (e.target.style.background = "var(--saffron)")}
            >
              Find my schemes →
            </button>
          </div>

          <div
            className="flex items-center gap-8 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <StatPill value="3,700+" label="Active schemes" />
            <StatPill value="28"    label="States covered" />
            <StatPill value="AI"    label="Powered match" />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "01", title: "Describe yourself",   desc: "Tell the AI your occupation, state, income, and what you're looking for." },
            { step: "02", title: "AI extracts profile", desc: "The model identifies your eligibility criteria and maps them to scheme parameters." },
            { step: "03", title: "Get matched schemes", desc: "See ranked results — scholarship, loan, pension, subsidy — with direct apply links." },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="p-5 rounded-2xl"
              style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
            >
              <p
                className="text-xs font-black mb-3"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--saffron)" }}
              >
                {step}
              </p>
              <h3
                className="text-sm font-bold mb-1"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
              >
                {title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Popular schemes ──────────────────────────────────────── */}
      <section className="space-y-5">
        <div
          className="flex items-end justify-between pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2
              className="text-base font-black tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
            >
              Popular schemes
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              From the live database
            </p>
          </div>
          {/* FIX: was <a href="?page=search"> */}
          <button
            onClick={() => onTabChange("search")}
            className="text-xs font-semibold underline underline-offset-4 transition-colors"
            style={{ color: "var(--saffron)" }}
          >
            See all →
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-52 rounded-2xl skeleton" />
            ))}
          </div>
        ) : popularSchemes.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl"
            style={{ border: "1px dashed var(--border)", background: "var(--panel)" }}
          >
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              No schemes loaded. Check your server connection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {popularSchemes.map((scheme, i) => (
              <div
                key={scheme.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <SchemeCard scheme={scheme} onViewDetails={onViewDetails} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LandingHome;
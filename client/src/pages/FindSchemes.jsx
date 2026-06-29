import { useState, useCallback } from "react";
import axios from "axios";
import ProfileCard from "../components/ProfileCard.jsx";
import RecommendationCard from "../components/RecommendationCard.jsx";

// How many results to show at once before "Load more"
const PAGE_SIZE = 8;

const FindSchemes = ({ onSaveScheme, savedIds = [] }) => {
  const [aiMessage, setAiMessage] = useState("");
  const [profile, setProfile] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const focusInput = (e) => (e.target.style.borderColor = "var(--saffron)");
  const blurInput  = (e) => (e.target.style.borderColor = "var(--border)");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!aiMessage.trim()) return;

    try {
      setLoading(true);
      setHasSearched(true);
      setProfile(null);
      setSchemes([]);
      setVisibleCount(PAGE_SIZE); // reset pagination on new search

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const response = await axios.post(`${API_URL}/api/ai/extract-profile`, {
        message: aiMessage,
      });

      setProfile(response.data.profile || null);
      setSchemes(response.data.schemes || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, schemes.length));
  }, [schemes.length]);

  const visibleSchemes = schemes.slice(0, visibleCount);
  const remaining = schemes.length - visibleCount;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-2xl font-black tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
        >
          Find Schemes
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Describe your situation and our AI will match you with relevant government schemes.
        </p>
      </div>

      {/* ── Search panel ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <form onSubmit={handleSearch} className="space-y-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Mention your state, occupation, age, income, caste category, and what kind of help you need.
            The more detail, the better the match.
          </p>
          <textarea
            value={aiMessage}
            onChange={(e) => setAiMessage(e.target.value)}
            placeholder="e.g. I am a 22-year-old engineering student from Punjab, general category, family income around 3 lakh. I want to pursue higher studies but don't have money."
            rows={4}
            className="w-full resize-none text-sm rounded-xl px-4 py-3 transition-all outline-none"
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              color: "var(--ink)",
              fontFamily: "'Inter', sans-serif",
              lineHeight: "1.6",
            }}
            onFocus={focusInput}
            onBlur={blurInput}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !aiMessage.trim()}
              className="text-sm font-bold px-8 py-3 rounded-xl transition-all"
              style={{
                background: loading || !aiMessage.trim() ? "#C5A88A" : "var(--saffron)",
                color: "#fff",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: loading || !aiMessage.trim() ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading && aiMessage.trim()) e.target.style.background = "var(--saffron-dk)";
              }}
              onMouseLeave={(e) => {
                if (!loading && aiMessage.trim()) e.target.style.background = "var(--saffron)";
              }}
            >
              {loading ? "Searching…" : "Find matching schemes →"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Loading state ────────────────────────────────────────────── */}
      {loading && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-8 h-8 rounded-full mb-4"
            style={{
              border: "2.5px solid var(--border)",
              borderTopColor: "var(--saffron)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Extracting your profile…
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--border)" }}>
            This may take a few seconds
          </p>
        </div>
      )}

      {/* ── Profile card ─────────────────────────────────────────────── */}
      {!loading && hasSearched && profile && <ProfileCard profile={profile} />}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {!loading && hasSearched && schemes.length > 0 && (
        <div className="space-y-4">
          {/* Result count header */}
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Matching schemes
            </p>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: "var(--saffron-lt)",
                color: "var(--saffron-dk)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {schemes.length} found
            </span>
          </div>

          {/* Scheme cards — only render visibleSchemes, not all at once */}
          <div className="space-y-3">
            {visibleSchemes.map((scheme, i) => (
              <div
                key={`${scheme.id}-${i}`}
                className="relative animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 7) * 0.04}s` }}
              >
                <RecommendationCard scheme={scheme} />
                <button
                  onClick={() => onSaveScheme(scheme)}
                  disabled={savedIds.includes(scheme.id)}
                  className="absolute top-5 right-5 text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-all"
                  style={{
                    background: savedIds.includes(scheme.id) ? "var(--surface)" : "var(--panel)",
                    border: "1px solid var(--border)",
                    color: savedIds.includes(scheme.id) ? "var(--muted)" : "var(--ink)",
                    cursor: savedIds.includes(scheme.id) ? "default" : "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {savedIds.includes(scheme.id) ? "✓ Saved" : "+ Save"}
                </button>
              </div>
            ))}
          </div>

          {/* Load more button — only shown when there are hidden results */}
          {remaining > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                onClick={loadMore}
                className="text-sm font-bold px-8 py-3 rounded-xl transition-all"
                style={{
                  background: "var(--panel)",
                  border: "1.5px solid var(--border)",
                  color: "var(--ink)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--saffron)";
                  e.currentTarget.style.color = "var(--saffron)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--ink)";
                }}
              >
                Load {Math.min(remaining, PAGE_SIZE)} more
              </button>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {visibleCount} of {schemes.length} shown
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!loading && hasSearched && schemes.length === 0 && (
        <div
          className="py-16 text-center rounded-2xl"
          style={{ background: "var(--panel)", border: "1px dashed var(--border)" }}
        >
          <p className="text-2xl mb-3">🔍</p>
          <h4
            className="text-sm font-bold mb-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
          >
            No schemes found
          </h4>
          <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--muted)" }}>
            Try being more specific about your state, occupation, or what you're looking for.
          </p>
        </div>
      )}
    </div>
  );
};

export default FindSchemes;
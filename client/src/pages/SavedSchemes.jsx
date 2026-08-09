import RecommendationCard from "../components/RecommendationCard.jsx";

const SavedSchemes = ({ savedList = [], onRemoveScheme, onViewDetails }) => {
  const activeList = Array.isArray(savedList) ? savedList : [];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
          >
            Bookmarks
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Schemes you've shortlisted for later.
          </p>
        </div>
        {activeList.length > 0 && (
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{
              background: "var(--saffron-lt)",
              color: "var(--saffron-dk)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {activeList.length} saved
          </span>
        )}
      </div>

      {activeList.length === 0 ? (
        <div
          className="py-20 text-center rounded-2xl"
          style={{ border: "1px dashed var(--border)", background: "var(--panel)" }}
        >
          <div className="text-4xl mb-4">🔖</div>
          <h3
            className="text-sm font-bold mb-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--ink)" }}
          >
            No bookmarks yet
          </h3>
          <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--muted)" }}>
            Use "Find Schemes" and hit Save on any result to shortlist it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeList.map((scheme, idx) => (
            <div
              key={`${scheme.id}-${idx}`}
              className="relative animate-fade-up"
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <RecommendationCard scheme={scheme} onViewDetails={onViewDetails} />
              <button
                onClick={() => onRemoveScheme(scheme.id)}
                className="absolute top-5 right-5 text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-all"
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "var(--red)";
                  e.target.style.borderColor = "var(--red)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "var(--muted)";
                  e.target.style.borderColor = "var(--border)";
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedSchemes;
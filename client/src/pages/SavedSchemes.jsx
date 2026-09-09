import RecommendationCard from "../components/RecommendationCard.jsx";

const SavedSchemes = ({
  savedList = [],
  onRemoveScheme,
  onViewDetails,
}) => {
  const activeList = Array.isArray(savedList)
    ? savedList
    : [];

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 md:py-14">

      {/* HEADER */}

      <div className="mb-9 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
              style={{
                color: "var(--saffron)",
              }}
            >
              Your collection
            </p>

            <h1
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={{
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
                color: "var(--ink)",
              }}
            >
              Bookmarks
            </h1>

            <p
              className="text-sm mt-2"
              style={{
                color: "var(--muted)",
              }}
            >
              Schemes you've shortlisted for later.
            </p>
          </div>

          {activeList.length > 0 && (
            <span
              className="self-start sm:self-auto text-[10px] font-bold px-3.5 py-2 rounded-full"
              style={{
                background:
                  "var(--saffron-lt)",
                color:
                  "var(--saffron-dk)",
                fontFamily:
                  "'JetBrains Mono', monospace",
              }}
            >
              {activeList.length} saved
            </span>
          )}
        </div>
      </div>

      {/* EMPTY */}

      {activeList.length === 0 ? (
        <div
          className="rounded-3xl py-20 px-6 text-center animate-fade-up"
          style={{
            background: "var(--panel)",
            border:
              "1px dashed var(--border)",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl"
            style={{
              background:
                "var(--saffron-lt)",
              border:
                "1px solid var(--border)",
            }}
          >
            🔖
          </div>

          <h3
            className="text-lg font-black mb-2"
            style={{
              fontFamily:
                "'Plus Jakarta Sans', sans-serif",
              color: "var(--ink)",
            }}
          >
            No bookmarks yet
          </h3>

          <p
            className="text-sm max-w-sm mx-auto leading-6"
            style={{
              color: "var(--muted)",
            }}
          >
            Use "Find Schemes" and save any
            result you want to shortlist here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {activeList.map((scheme, idx) => (
            <div
              key={`${scheme.id}-${idx}`}
              className="animate-fade-up"
              style={{
                animationDelay:
                  `${idx * 0.05}s`,
              }}
            >
              <RecommendationCard
                scheme={scheme}
                onViewDetails={
                  onViewDetails
                }
              />

              {/* Remove stays OUTSIDE card */}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() =>
                    onRemoveScheme(
                      scheme.id
                    )
                  }
                  className="text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-all"
                  style={{
                    background:
                      "transparent",
                    border:
                      "1px solid var(--border)",
                    color: "var(--muted)",
                    fontFamily:
                      "'Plus Jakarta Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color =
                      "var(--red)";
                    e.currentTarget.style.borderColor =
                      "var(--red)";
                    e.currentTarget.style.background =
                      "var(--red-lt)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color =
                      "var(--muted)";
                    e.currentTarget.style.borderColor =
                      "var(--border)";
                    e.currentTarget.style.background =
                      "transparent";
                  }}
                >
                  Remove bookmark
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedSchemes;


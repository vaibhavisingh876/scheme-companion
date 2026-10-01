import RecommendationCard from "../components/RecommendationCard.jsx";
import Chakra from "../components/Chakra.jsx";

const SavedSchemes = ({ savedList = [], onRemoveScheme, onViewDetails, onTabChange }) => {
  const items = Array.isArray(savedList) ? savedList : [];

  return (
    <div className="view section" style={{ paddingTop: "clamp(36px,5vw,60px)" }}>
      <div className="page__chakra" aria-hidden="true"><Chakra /></div>
      <div className="container">
        <header className="page-head">
          <div className="page-head__row">
            <div>
              <span className="kicker">Your collection</span>
              <h1 className="display">
                Schemes worth <em>remembering.</em>
              </h1>
              <p className="lede">
                Everything you've saved, in one quiet place. Come back whenever you're
                ready to read them properly or apply.
              </p>
            </div>

            <div className="count-badge">
              <span className="num">{String(items.length).padStart(2, "0")}</span>
              <span className="lbl">saved</span>
            </div>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="empty">
            <div className="empty__mark">◦</div>
            <h3 className="display">Nothing saved yet</h3>
            <p>
              Find schemes that match your profile and save the ones you want to come
              back to later.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onTabChange?.("search")}
            >
              Go to Find Schemes <span className="arw">→</span>
            </button>
          </div>
        ) : (
          <div className="saved-grid">
            {items.map((scheme, idx) => (
              <div
                key={`${scheme.id}-${idx}`}
                className="saved-item anim-fade-up"
                style={{ animationDelay: `${Math.min(idx, 8) * 0.05}s` }}
              >
                <RecommendationCard
                  scheme={scheme}
                  onViewDetails={onViewDetails}
                  action={
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveScheme(scheme.id);
                      }}
                    >
                      <span aria-hidden="true">✕</span> Remove
                    </button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedSchemes;

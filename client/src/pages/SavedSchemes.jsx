import RecommendationCard from "../components/RecommendationCard.jsx"; 

const SavedSchemes = ({ savedList = [], onRemoveScheme }) => {
  const activeList = Array.isArray(savedList) ? savedList : [];

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      {/* Header Info Panel */}
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-black tracking-tight text-[#3e2723]">
          Bookmarked Schemes
        </h1>
        <p className="text-[#8d6e63] text-sm mt-1.5">
          Organize and track shortlisted benefits locked into your persistent storage.
        </p>
      </div>

      {activeList.length === 0 ? (
        <div className="bg-[#fdfbf7] border border-dashed border-[#d7ccc8] rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="text-4xl mb-4 opacity-80">🔖</div>
          <h3 className="text-sm font-bold text-[#5d4037] uppercase tracking-wide">No Bookmarks Yet</h3>
          <p className="text-xs text-[#8d6e63] max-w-xs mx-auto mt-2 leading-relaxed font-medium">
            Shortlist active records inside the Discovery Engine to see your curated schemes here.
          </p>
        </div>
      ) : (
        <main className="space-y-6">
          <div className="flex items-center justify-between text-xs font-bold text-[#8d6e63] tracking-wider uppercase px-2">
            <span>Your Bookmarked Subsidies</span>
            <span className="text-[#5d4037] bg-[#efebe9] px-3 py-1 rounded-lg border border-[#d7ccc8]">
              {activeList.length} items
            </span>
          </div>

          <div className="grid gap-6">
            {activeList.map((scheme, idx) => (
              <div key={`${scheme.id}-${idx}`} className="relative group/saved">
                <RecommendationCard scheme={scheme} />
                
                <button
                  onClick={() => onRemoveScheme(scheme.id)}
                  className="absolute top-6 right-6 md:right-36 bg-white hover:bg-[#efebe9] border border-[#d7ccc8] text-[#5d4037] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm"
                >
                  🗑️ Remove Bookmark
                </button>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
};

export default SavedSchemes;
import React from "react";

const RecommendationCard = ({ scheme }) => {
  if (!scheme?.name || !scheme?.description) return null;

  return (
    <div className="group relative overflow-hidden bg-[#faf6f0] border border-[#d7ccc8] hover:border-[#a1887f] rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 mb-6">
      
      {/* Header: Name Only */}
      <header className="mb-4">
        <h3 className="text-xl font-bold text-[#3e2723] tracking-tight group-hover:text-[#5d4037] transition-colors">
          {scheme.name}
        </h3>
      </header>

      {/* Description */}
      <p className="text-sm text-[#795548] leading-relaxed font-medium mb-6">
        {scheme.description}
      </p>

      {/* Tags + State */}
      <div className="flex flex-wrap gap-2 mb-6">
        {scheme.tags && scheme.tags.slice(0, 4).map((tag, i) => (
          <span key={i} className="bg-[#fdfbf7] text-[#8d6e63] border border-[#d7ccc8] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide">
            #{tag}
          </span>
        ))}
        {scheme.state && (
          <span className="bg-[#fbe9e7] text-[#d84315] border border-[#ffccbc] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide">
            📍 {scheme.state}
          </span>
        )}
        {scheme.category && (
          <span className="bg-[#efebe9] text-[#5d4037] border border-[#d7ccc8] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide">
            {scheme.category}
          </span>
        )}
      </div>

      {/* Apply Button */}
      <footer className="pt-5 border-t border-[#d7ccc8]">
        <a
          href={scheme.applicationLink && scheme.applicationLink.trim().length > 0 ? scheme.applicationLink : "https://www.myscheme.gov.in"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex justify-center items-center gap-2 bg-[#5d4037] hover:bg-[#4e342e] active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-[#5d4037]/20 whitespace-nowrap"
        >
          Apply Now ↗
        </a>
      </footer>
    </div>
  );
};

export default RecommendationCard;
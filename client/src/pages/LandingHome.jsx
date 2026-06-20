import { useEffect, useState } from "react";
import { getPaginatedSchemes } from "../services/api";

const LandingHome = ({ onViewDetails }) => {
  const [popularSchemes, setPopularSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaginatedSchemes(1, 6)
      .then((data) => {
        if (data && data.schemes) {
          setPopularSchemes(data.schemes);
        }
      })
      .catch((err) => console.error("Backend connection failure:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-16 pb-16 animate-fadeIn text-[#5d4037]">
      
      {/* 🚀 PASTEL HERO SECTION */}
      <section className="relative bg-[#fdfbf7] border border-[#d7ccc8] rounded-3xl p-8 md:p-12 text-center md:text-left overflow-hidden shadow-xl shadow-[#d7ccc8]/40">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#efebe9] blur-3xl rounded-full pointer-events-none" />
        <div className="max-w-3xl space-y-6 relative z-10">
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#efebe9] text-[#5d4037] text-[10px] font-bold uppercase tracking-wider border border-[#d7ccc8]">
            ✨ Core Portal Gateway Live
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-[#3e2723]">
            Find Government Benefits. <br />
            <span className="text-[#8d6e63]">Zero Bureaucracy Context.</span>
          </h1>
          <p className="text-[#795548] text-sm max-w-xl leading-relaxed font-medium">
            Sift through thousands of legal and localized public welfare registries instantly. Ask our conversational parsing model or run surgical filters directly.
          </p>
          <div className="flex flex-wrap gap-3 pt-2 justify-center md:justify-start">
            {/* ✅ FIXED: Removed target="_blank" and changed page to "search" */}
            <a href="?page=search" className="bg-[#5d4037] text-white font-bold text-xs px-6 py-3.5 rounded-xl hover:bg-[#4e342e] shadow-lg shadow-[#5d4037]/20 transition-all uppercase tracking-wider">
              🤖 Use AI Assistant
            </a>
          </div>
        </div>
      </section>

      {/* 📁 POPULAR LIVE DATA STREAMS */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#d7ccc8] pb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#4e342e]">Popular Welfare Schemes</h2>
            <p className="text-[#8d6e63] text-xs font-medium">Real-time repository streams connected directly to your server layer database.</p>
          </div>
          <a href="?page=search" target="_blank" rel="noreferrer" className="text-xs font-bold text-[#5d4037] hover:text-[#3e2723] underline underline-offset-4 whitespace-nowrap">
            Explore Full Repositories ↗
          </a>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-56 bg-[#efebe9] rounded-3xl border border-[#d7ccc8]" />
            ))}
          </div>
        ) : popularSchemes.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#d7ccc8] rounded-3xl bg-[#fdfbf7]">
            <p className="text-xs text-[#8d6e63] font-medium">No live schemes accessible from server. Check database connection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {popularSchemes.map((scheme) => (
              <div key={scheme.id} className="bg-white border border-[#d7ccc8] p-6 rounded-3xl flex flex-col justify-between hover:border-[#a1887f] transition-all group shadow-sm hover:shadow-xl hover:shadow-[#d7ccc8]/50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#795548] bg-[#efebe9] px-2.5 py-1 rounded-lg border border-[#d7ccc8] truncate max-w-[70%]">
                      {scheme.category || "General Subsidies"}
                    </span>
                    <span className="text-[9px] font-black text-[#5d4037] bg-[#efebe9] px-2.5 py-1 rounded-lg border border-[#d7ccc8] uppercase tracking-wider whitespace-nowrap">
                      📍 {scheme.state || "All India"}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-[#3e2723] group-hover:text-[#5d4037] transition-colors line-clamp-2">
                    {scheme.name}
                  </h3>
                  <p className="text-xs text-[#795548] leading-relaxed line-clamp-3">
                    {scheme.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#efebe9] mt-5 flex items-center justify-between text-[11px] font-bold">
                  <button onClick={() => onViewDetails(scheme)} className="text-[#8d6e63] hover:text-[#5d4037] uppercase tracking-wide cursor-pointer text-[10px]">
                    View Details
                  </button>
                  <a href={scheme.applicationLink || "https://www.myscheme.gov.in"} target="_blank" rel="noreferrer" className="bg-[#3e2723] text-white font-black uppercase tracking-wider text-xs px-4 py-2.5 rounded-xl hover:bg-[#271816] transition-all shadow-md text-[10px]">
                    Apply Now ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LandingHome;
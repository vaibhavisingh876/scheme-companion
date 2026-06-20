import React from "react";

const SchemeDetailsView = ({ scheme, onBackNavigate }) => {
  if (!scheme) {
    return (
      <div className="text-center py-16 bg-[#faf6f0] border border-[#d7ccc8] rounded-3xl max-w-2xl mx-auto">
        <p className="text-sm font-medium text-[#8d6e63]">No active scheme context selected.</p>
        <button onClick={onBackNavigate} className="mt-4 text-xs font-bold text-[#5d4037] underline underline-offset-4">Go Back to Dashboard</button>
      </div>
    );
  }

  const finalVerificationUrl = `https://www.myscheme.gov.in/search?q=${encodeURIComponent(scheme.name)}`;

  return (
    <div className="space-y-8 animate-fadeIn max-w-3xl mx-auto pb-12 text-[#5d4037]">
      <button onClick={onBackNavigate} className="text-[11px] font-black uppercase tracking-wider text-[#8d6e63] hover:text-[#3e2723] transition-colors">
        ← Return to Dashboard
      </button>

      <div className="bg-[#faf6f0] border border-[#d7ccc8] rounded-3xl p-8 shadow-xl shadow-[#d7ccc8]/40 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-[#efebe9] text-[#5d4037] px-3 py-1 rounded-lg border border-[#d7ccc8]">
            {scheme.category || "General Subsidies"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5d4037] bg-[#efebe9] px-3 py-1 rounded-lg border border-[#d7ccc8]">
            📍 {scheme.state || "All India"}
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-[#3e2723] leading-snug">{scheme.name}</h1>
          <div className="text-xs font-bold text-[#8d6e63] uppercase tracking-wide">
            Managed Node: <span className="text-[#5d4037]">{scheme.ministry || "Central Government"}</span>
          </div>
        </div>

        <div className="border-t border-[#efebe9] pt-5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-[#5d4037] mb-2">Official Summary Overview</h3>
          <p className="text-sm text-[#795548] leading-relaxed font-medium">{scheme.description}</p>
        </div>
      </div>

      <div className="bg-[#fdfbf7] border border-[#d7ccc8] rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 text-center sm:text-left max-w-md">
          <h4 className="text-sm font-black uppercase tracking-wide text-[#3e2723]">Official Portal Verification</h4>
          <p className="text-xs text-[#795548] leading-relaxed font-medium">
            Please copy the scheme name and search for it on the official MyScheme portal to view complete and up-to-date details.
          </p>
        </div>
        <a href={finalVerificationUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto bg-[#3e2723] text-white font-black uppercase tracking-wider text-xs px-8 py-4 rounded-2xl hover:bg-[#271816] transition-all text-center shadow-lg shadow-[#3e2723]/20">
          Official Portal ↗
        </a>
      </div>
    </div>
  );
};

export default SchemeDetailsView;
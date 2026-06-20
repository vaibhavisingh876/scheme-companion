import { useState } from "react";
import axios from "axios";
import ProfileCard from "../components/ProfileCard.jsx";
import RecommendationCard from "../components/RecommendationCard.jsx";

const FindSchemes = ({ onSaveScheme, savedIds = [] }) => {
  const [activeTab, setActiveTab] = useState("ai");
  const [aiMessage, setAiMessage] = useState("");
  const [filters, setFilters] = useState({
    gender: "", state: "", occupation: "", educationLevel: "", income: "", casteCategory: "",
  });

  const [profile, setProfile] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const indianStatesList = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
  ];

  const updateField = (field, val) => setFilters((prev) => ({ ...prev, [field]: val }));

  const handleSearchExecute = async (e) => {
    e.preventDefault();
    if (activeTab === "ai" && !aiMessage.trim()) return;

    try {
      setLoading(true);
      setHasSearched(true);
      setProfile(null);
      setSchemes([]);

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

      let response;

      if (activeTab === "ai") {
        response = await axios.post(`${API_URL}/api/ai/extract-profile`, {
          message: aiMessage,
        });
      } else {
        response = await axios.post(`${API_URL}/api/schemes/search`, filters);
      }

      if (activeTab === "ai") {
        setProfile(response.data.profile);
      } else {
        setProfile(null);
      }

      setSchemes(response.data.schemes || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-[#3e2723]">Discovery Engine</h1>
        <p className="text-[#795548] text-sm mt-1">
          Describe your context to our AI or use manual parameters to find exact subsidies.
        </p>
      </div>

      <div className="flex border border-[#d7ccc8] p-1.5 gap-2 bg-[#fdfbf7] rounded-2xl shadow-sm max-w-sm mx-auto">
        <button
          onClick={() => { setActiveTab("ai"); setHasSearched(false); setSchemes([]); setProfile(null); }}
          className={`flex-1 text-center py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
            activeTab === "ai"
              ? "bg-[#5d4037] text-white shadow-md shadow-[#5d4037]/20"
              : "text-[#795548] hover:bg-[#efebe9]"
          }`}
        >
          🤖 AI Assistant
        </button>
        <button
          onClick={() => { setActiveTab("strict"); setHasSearched(false); setSchemes([]); setProfile(null); }}
          className={`flex-1 text-center py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
            activeTab === "strict"
              ? "bg-[#5d4037] text-white shadow-md shadow-[#5d4037]/20"
              : "text-[#795548] hover:bg-[#efebe9]"
          }`}
        >
          🔍 Manual Filters
        </button>
      </div>

      <div className="bg-[#fdfbf7] border border-[#d7ccc8] rounded-3xl p-8 shadow-xl shadow-[#d7ccc8]/40">
        <form onSubmit={handleSearchExecute}>
          {activeTab === "ai" && (
            <div className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-wider text-[#5d4037] mb-1">
                Tell us about yourself
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  placeholder="e.g., I am a 21 year old college student from Delhi, income is 40k..."
                  className="flex-1 bg-white border border-[#d7ccc8] focus:border-[#5d4037] focus:ring-4 focus:ring-[#d7ccc8] rounded-2xl px-5 py-4 text-sm text-[#3e2723] outline-none placeholder:text-[#a1887f] transition-all shadow-sm"
                />
                <button
                  type="submit"
                  className="bg-[#5d4037] hover:bg-[#4e342e] active:scale-[0.98] text-white text-sm font-bold px-8 py-4 rounded-2xl shadow-lg shadow-[#5d4037]/20 tracking-wide transition-all whitespace-nowrap"
                >
                  ✨ Ask AI
                </button>
              </div>
            </div>
          )}

          {activeTab === "strict" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5d4037]">Gender Identity</label>
                  <select
                    value={filters.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="bg-white border border-[#d7ccc8] rounded-xl px-4 py-3.5 text-sm text-[#3e2723] outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#d7ccc8] transition-all shadow-sm"
                  >
                    <option value="">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5d4037]">State / Territory</label>
                  <select
                    value={filters.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className="bg-white border border-[#d7ccc8] rounded-xl px-4 py-3.5 text-sm text-[#3e2723] outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#d7ccc8] transition-all shadow-sm"
                  >
                    <option value="">All India</option>
                    {indianStatesList.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5d4037]">Social Category</label>
                  <select
                    value={filters.casteCategory}
                    onChange={(e) => updateField("casteCategory", e.target.value)}
                    className="bg-white border border-[#d7ccc8] rounded-xl px-4 py-3.5 text-sm text-[#3e2723] outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#d7ccc8] transition-all shadow-sm"
                  >
                    <option value="">General / Unreserved</option>
                    <option value="obc">OBC</option>
                    <option value="sc">SC</option>
                    <option value="st">ST</option>
                    <option value="minority">Minority</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5d4037]">Occupation</label>
                  <select
                    value={filters.occupation}
                    onChange={(e) => updateField("occupation", e.target.value)}
                    className="bg-white border border-[#d7ccc8] rounded-xl px-4 py-3.5 text-sm text-[#3e2723] outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#d7ccc8] transition-all shadow-sm"
                  >
                    <option value="">All Careers</option>
                    <option value="student">Student / Academic</option>
                    <option value="farmer">Farmer / Agrarian</option>
                    <option value="housewife">Homemaker</option>
                    <option value="worker">Worker / Artisan</option>
                    <option value="startup">Startup / Business</option>
                    <option value="unemployed">Unemployed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5d4037]">Education Level</label>
                  <input
                    type="text"
                    value={filters.educationLevel}
                    onChange={(e) => updateField("educationLevel", e.target.value)}
                    placeholder="e.g., Graduate, 12th Pass"
                    className="bg-white border border-[#d7ccc8] rounded-xl px-4 py-3.5 text-sm text-[#3e2723] outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#d7ccc8] transition-all shadow-sm placeholder:text-[#a1887f]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-[#5d4037]">Annual Income (₹)</label>
                  <input
                    type="number"
                    value={filters.income}
                    onChange={(e) => updateField("income", e.target.value)}
                    placeholder="e.g., 250000"
                    className="bg-white border border-[#d7ccc8] rounded-xl px-4 py-3.5 text-sm text-[#3e2723] outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#d7ccc8] transition-all shadow-sm placeholder:text-[#a1887f]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-[#d7ccc8]">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-[#5d4037] hover:bg-[#4e342e] active:scale-[0.98] text-white text-sm font-bold px-10 py-4 rounded-2xl shadow-lg shadow-[#5d4037]/20 tracking-wide transition-all"
                >
                  🔍 Match Schemes
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#fdfbf7] border border-[#d7ccc8] rounded-3xl shadow-sm">
          <div className="w-8 h-8 border-4 border-t-[#5d4037] border-[#d7ccc8] rounded-full animate-spin mb-4" />
          <p className="text-[#795548] font-bold text-xs uppercase tracking-wider animate-pulse">
            {activeTab === "ai" ? "Extracting profile with AI..." : "Running matrix filters..."}
          </p>
        </div>
      )}

      {!loading && hasSearched && profile && <ProfileCard profile={profile} />}

      {!loading && hasSearched && schemes.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between px-2 text-xs font-bold uppercase tracking-wider text-[#795548]">
            <span>Verified Results Feed</span>
            <span className="text-[#5d4037] bg-[#fdfbf7] px-3 py-1 rounded-lg border border-[#d7ccc8]">
              {schemes.length} matches
            </span>
          </div>

          <div className="grid gap-6">
            {schemes.map((scheme, i) => (
              <div key={`${scheme.id}-${i}`} className="relative">
                <RecommendationCard scheme={scheme} />
                <button
                  onClick={() => onSaveScheme(scheme)}
                  disabled={savedIds.includes(scheme.id)}
                  className={`absolute top-6 right-6 md:right-36 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                    savedIds.includes(scheme.id)
                      ? "bg-[#efebe9] border border-[#d7ccc8] text-[#8d6e63] cursor-not-allowed"
                      : "bg-[#fdfbf7] hover:bg-[#efebe9] text-[#5d4037] border border-[#d7ccc8] shadow-sm"
                  }`}
                >
                  {savedIds.includes(scheme.id) ? "🔖 Bookmarked" : "📌 Bookmark"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && hasSearched && schemes.length === 0 && (
        <div className="bg-[#fdfbf7] border border-dashed border-[#d7ccc8] rounded-3xl p-10 text-center shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-wider text-[#3e2723]">Zero Exact Matches</h4>
          <p className="text-xs text-[#795548] mt-2 max-w-sm mx-auto font-medium">
            We couldn't find a scheme mapping exactly to these parameters. Try removing the income limit or changing the state.
          </p>
        </div>
      )}
    </div>
  );
};

export default FindSchemes;
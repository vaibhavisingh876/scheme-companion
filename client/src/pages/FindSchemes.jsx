import { useState, useCallback, useEffect } from "react";
import { getAIRecommendations, searchSchemes } from "../services/api";
import ProfileCard from "../components/ProfileCard.jsx";
import RecommendationCard from "../components/RecommendationCard.jsx";
import Chakra from "../components/Chakra.jsx";

const PAGE_SIZE = 8;

const STATES = [
  { value: "", label: "Any state" },
  { value: "andhrapradesh", label: "Andhra Pradesh" },
  { value: "arunachalpradesh", label: "Arunachal Pradesh" },
  { value: "assam", label: "Assam" },
  { value: "bihar", label: "Bihar" },
  { value: "chhattisgarh", label: "Chhattisgarh" },
  { value: "goa", label: "Goa" },
  { value: "gujarat", label: "Gujarat" },
  { value: "haryana", label: "Haryana" },
  { value: "himachalpradesh", label: "Himachal Pradesh" },
  { value: "jammuandkashmir", label: "Jammu & Kashmir" },
  { value: "jharkhand", label: "Jharkhand" },
  { value: "karnataka", label: "Karnataka" },
  { value: "kerala", label: "Kerala" },
  { value: "ladakh", label: "Ladakh" },
  { value: "madhyapradesh", label: "Madhya Pradesh" },
  { value: "maharashtra", label: "Maharashtra" },
  { value: "manipur", label: "Manipur" },
  { value: "meghalaya", label: "Meghalaya" },
  { value: "mizoram", label: "Mizoram" },
  { value: "nagaland", label: "Nagaland" },
  { value: "odisha", label: "Odisha" },
  { value: "puducherry", label: "Puducherry" },
  { value: "punjab", label: "Punjab" },
  { value: "rajasthan", label: "Rajasthan" },
  { value: "sikkim", label: "Sikkim" },
  { value: "tamilnadu", label: "Tamil Nadu" },
  { value: "telangana", label: "Telangana" },
  { value: "tripura", label: "Tripura" },
  { value: "uttarpradesh", label: "Uttar Pradesh" },
  { value: "uttarakhand", label: "Uttarakhand" },
  { value: "westbengal", label: "West Bengal" },
  { value: "delhi", label: "Delhi" },
  { value: "chandigarh", label: "Chandigarh" },
  { value: "dadranagarhavelianddamananddiu", label: "Dadra & Nagar Haveli, Daman & Diu" },
  { value: "lakshadweep", label: "Lakshadweep" },
  { value: "andamanandnicobarislands", label: "Andaman & Nicobar Islands" },
];

const OCCUPATIONS = [
  { value: "", label: "Any occupation" },
  { value: "student", label: "Student" },
  { value: "farmer", label: "Farmer" },
  { value: "worker", label: "Worker" },
  { value: "startup", label: "Startup / Entrepreneur" },
  { value: "housewife", label: "Homemaker" },
  { value: "unemployed", label: "Unemployed" },
  { value: "widow", label: "Widow" },
];

const GENDERS = [
  { value: "", label: "Any gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const EDUCATION = [
  { value: "", label: "Any education" },
  { value: "higher_education", label: "Higher education" },
  { value: "school", label: "School" },
];

const CATEGORIES = [
  { value: "", label: "Any category" },
  { value: "general", label: "General" },
  { value: "sc", label: "SC" },
  { value: "st", label: "ST" },
  { value: "obc", label: "OBC" },
  { value: "minority", label: "Minority" },
];

const EXAMPLES = [
  "I'm a 22-year-old female student from Delhi looking for scholarships",
  "Farmer from Maharashtra needing crop insurance support",
  "Unemployed youth from Bihar seeking skill training and stipend",
];

const SelectField = ({ label, value, onChange, options, hint }) => (
  <div className="field">
    <div className="field__label">
      <label>{label}</label>
      {hint && <span className="opt">{hint}</span>}
    </div>
    <div className="control">
      <select value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="control__caret">▾</span>
    </div>
  </div>
);

const FindSchemes = ({
  onSaveScheme,
  savedIds = [],
  onViewDetails,
  initialResults,
  initialProfile,
  onResultsUpdate,
}) => {
  const [aiMessage, setAiMessage] = useState("");
  const [profile, setProfile] = useState(initialProfile || null);
  const [schemes, setSchemes] = useState(initialResults || []);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialResults?.length);
  const [searchMode, setSearchMode] = useState("ai");
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    gender: "",
    state: "",
    occupation: "",
    educationLevel: "",
    income: "",
    casteCategory: "",
  });

  useEffect(() => {
    if (initialResults?.length) {
      setSchemes(initialResults);
      setProfile(initialProfile || null);
      setHasSearched(true);
      setVisibleCount(PAGE_SIZE);
    }
  }, [initialResults, initialProfile]);

  useEffect(() => {
    if (onResultsUpdate) onResultsUpdate(schemes, profile);
  }, [schemes, profile, onResultsUpdate]);

  const updateFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleAISearch = async (e) => {
    e.preventDefault();
    if (!aiMessage.trim()) return;

    setLoading(true);
    setError("");
    setHasSearched(true);
    setProfile(null);
    setSchemes([]);
    setVisibleCount(PAGE_SIZE);

    try {
      const response = await getAIRecommendations(aiMessage);
      const newProfile = response?.profile || null;
      const newSchemes = response?.schemes || [];

      setProfile(newProfile);
      setSchemes(newSchemes);
      if (onResultsUpdate) onResultsUpdate(newSchemes, newProfile);
    } catch (err) {
      console.error("AI search failed:", err);
      setError(
        err.response?.data?.error ||
        "Something went wrong while matching. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setHasSearched(true);
    setProfile(null);
    setSchemes([]);
    setVisibleCount(PAGE_SIZE);

    try {
      const reqFilters = {};
      if (filters.gender) reqFilters.gender = filters.gender;
      if (filters.state) reqFilters.state = filters.state;
      if (filters.occupation) reqFilters.occupation = filters.occupation;
      if (filters.educationLevel) reqFilters.educationLevel = filters.educationLevel;
      if (filters.casteCategory) reqFilters.casteCategory = filters.casteCategory;
      if (filters.income) reqFilters.income = Number(filters.income);

      const response = await searchSchemes(reqFilters);
      const newSchemes = response?.schemes || [];

      setSchemes(newSchemes);
      if (onResultsUpdate) onResultsUpdate(newSchemes, null);
    } catch (err) {
      console.error("Manual search failed:", err);
      setError("Search failed. Please try again.");
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
    <div className="view find">
      <div className="page__chakra" aria-hidden="true"><Chakra /></div>
      <div className="container container--narrow" style={{ maxWidth: 900 }}>
        <header className="find__head">
          <span className="kicker">Discovery</span>
          <h1 className="display">
            Find schemes that <em>fit your life.</em>
          </h1>
          <p className="lede">
            Describe your situation in your own words, or narrow things down with
            filters. Either way, we match you against every eligible scheme we index.
          </p>

          <div className="segmented" role="tablist" aria-label="Search mode">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === "ai"}
              onClick={() => setSearchMode("ai")}
            >
              Describe it
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === "manual"}
              onClick={() => setSearchMode("manual")}
            >
              Use filters
            </button>
          </div>
        </header>

        {searchMode === "ai" && (
          <form className="composer" onSubmit={handleAISearch}>
            <div className="composer__label">
              <span>Your situation</span>
            </div>

            <textarea
              value={aiMessage}
              maxLength={1000}
              onChange={(e) => setAiMessage(e.target.value)}
              placeholder="I'm a 22-year-old engineering student from Delhi, family income around ₹3 lakh, looking for scholarships…"
              rows={4}
              aria-label="Describe your situation"
            />

            <div className="composer__foot">
              <div className="chips">
                <span>Try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    className="chip"
                    onClick={() => setAiMessage(ex)}
                  >
                    {ex.length > 48 ? ex.slice(0, 48) + "…" : ex}
                  </button>
                ))}
              </div>
              <span className="composer__count">{aiMessage.length}/1000</span>
            </div>

            <div className="composer__submit">
              <span className="hint">
                The more specific you are, the better the matches.
              </span>
              <button
                className="btn btn--primary"
                type="submit"
                disabled={loading || !aiMessage.trim()}
              >
                {loading ? "Matching…" : "Find my schemes"} <span className="arw">→</span>
              </button>
            </div>
          </form>
        )}

        {searchMode === "manual" && (
          <form className="filters" onSubmit={handleManualSearch}>
            <div className="filters__grid">
              <SelectField
                label="Gender"
                value={filters.gender}
                onChange={(e) => updateFilter("gender", e.target.value)}
                options={GENDERS}
              />
              <SelectField
                label="State"
                value={filters.state}
                onChange={(e) => updateFilter("state", e.target.value)}
                options={STATES}
              />
              <SelectField
                label="Occupation"
                value={filters.occupation}
                onChange={(e) => updateFilter("occupation", e.target.value)}
                options={OCCUPATIONS}
              />
              <SelectField
                label="Education"
                value={filters.educationLevel}
                onChange={(e) => updateFilter("educationLevel", e.target.value)}
                options={EDUCATION}
              />
              <SelectField
                label="Category"
                value={filters.casteCategory}
                onChange={(e) => updateFilter("casteCategory", e.target.value)}
                options={CATEGORIES}
              />

              <div className="field">
                <div className="field__label">
                  <label>Annual income</label>
                  <span className="opt">Optional</span>
                </div>
                <div className="control">
                  <span className="control__prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="3,00,000"
                    value={filters.income}
                    onChange={(e) => updateFilter("income", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="filters__foot">
              <p className="filters__note">
                You don't need to fill every field — we'll search with whatever you provide.
              </p>
              <button className="btn btn--primary" type="submit" disabled={loading}>
                {loading ? "Searching…" : "Search eligible schemes"} <span className="arw">→</span>
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="matching" role="status" aria-live="polite">
            <div className="matching__dial" aria-hidden="true">
              <span /><span /><span />
            </div>
            <div>
              <h3>Finding your best matches</h3>
              <p>Comparing your profile against every scheme we index…</p>
            </div>
            <div className="matching__bars" aria-hidden="true">
              <i /><i /><i /><i />
            </div>
          </div>
        )}

        {!loading && hasSearched && profile && <ProfileCard profile={profile} />}

        {!loading && hasSearched && schemes.length > 0 && (
          <section className="results">
            <div className="results__head">
              <div>
                <h2 className="display">Recommended for you</h2>
                <p>Ranked by how closely each scheme matches your situation.</p>
              </div>
              <span className="results__count">
                <b>{schemes.length}</b> {schemes.length === 1 ? "match" : "matches"}
              </span>
            </div>

            <div className="results__list">
              {visibleSchemes.map((scheme, index) => {
                const isSaved = savedIds.includes(scheme.id);
                return (
                  <div
                    key={`${scheme.id}-${index}`}
                    className="result"
                  >
                    <RecommendationCard
                      scheme={scheme}
                      onViewDetails={onViewDetails}
                      action={
                        <button
                          type="button"
                          className={`save-btn ${isSaved ? "is-saved" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSaved) onSaveScheme(scheme);
                          }}
                          disabled={isSaved}
                        >
                          <i>{isSaved ? "✓" : "+"}</i>
                          {isSaved ? "Saved" : "Save"}
                        </button>
                      }
                    />
                  </div>
                );
              })}
            </div>

            {remaining > 0 && (
              <div className="loadmore">
                <button type="button" className="btn btn--outline" onClick={loadMore}>
                  Load {Math.min(remaining, PAGE_SIZE)} more
                </button>
                <small>
                  Showing {Math.min(visibleCount, schemes.length)} of {schemes.length}
                </small>
              </div>
            )}
          </section>
        )}

        {!loading && hasSearched && schemes.length === 0 && !error && (
          <div className="empty">
            <div className="empty__mark">?</div>
            <h3 className="display">No matching schemes yet</h3>
            <p>
              Try adding more context — your state, occupation, income, or the kind of
              support you're looking for.
            </p>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                setSearchMode("ai");
                setHasSearched(false);
              }}
            >
              Try describing it instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindSchemes;

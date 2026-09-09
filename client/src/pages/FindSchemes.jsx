
import { useState, useCallback, useEffect } from "react";
import { getAIRecommendations, searchSchemes } from "../services/api";
import ProfileCard from "../components/ProfileCard.jsx";
import RecommendationCard from "../components/RecommendationCard.jsx";

const PAGE_SIZE = 8;

const FieldLabel = ({ children, hint }) => (
  <div className="sc-field-head">
    <label>{children}</label>
    {hint && <span>{hint}</span>}
  </div>
);

const FilterSelect = ({ label, value, onChange, options, placeholder }) => (
  <div className="sc-filter-field">
    <FieldLabel>{label}</FieldLabel>

    <div className="sc-select-wrap">
      <select value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option || placeholder}
          </option>
        ))}
      </select>
      <span>⌄</span>
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
  const [hasSearched, setHasSearched] = useState(
    !!initialResults?.length
  );

  const [searchMode, setSearchMode] = useState("ai");
  const [focused, setFocused] = useState(false);

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
    }
  }, [initialResults, initialProfile]);

  useEffect(() => {
    if (onResultsUpdate) {
      onResultsUpdate(schemes, profile);
    }
  }, [schemes, profile, onResultsUpdate]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAISearch = async (e) => {
    e.preventDefault();

    if (!aiMessage.trim()) return;

    setLoading(true);
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

      if (onResultsUpdate) {
        onResultsUpdate(newSchemes, newProfile);
      }
    } catch (error) {
      console.error("AI search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();

    setLoading(true);
    setHasSearched(true);
    setProfile(null);
    setSchemes([]);
    setVisibleCount(PAGE_SIZE);

    try {
      const reqFilters = {};

      if (filters.gender) reqFilters.gender = filters.gender;
      if (filters.state) reqFilters.state = filters.state;
      if (filters.occupation) {
        reqFilters.occupation = filters.occupation;
      }

      if (filters.educationLevel) {
        reqFilters.educationLevel = filters.educationLevel;
      }

      if (filters.casteCategory) {
        reqFilters.casteCategory = filters.casteCategory;
      }

      if (filters.income) {
        reqFilters.income = Number(filters.income);
      }

      const response = await searchSchemes(reqFilters);

      const newSchemes = response?.schemes || [];

      setSchemes(newSchemes);

      if (onResultsUpdate) {
        onResultsUpdate(newSchemes, null);
      }
    } catch (error) {
      console.error("Manual search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + PAGE_SIZE, schemes.length)
    );
  }, [schemes.length]);

  const visibleSchemes = schemes.slice(0, visibleCount);
  const remaining = schemes.length - visibleCount;

  const states = [
    "",
    "uttarpradesh",
    "maharashtra",
    "gujarat",
    "rajasthan",
    "karnataka",
    "delhi",
    "bihar",
    "westbengal",
    "tamilnadu",
  ];

  const occupations = [
    "",
    "student",
    "farmer",
    "worker",
    "startup",
    "housewife",
    "unemployed",
    "widow",
  ];

  const genders = [
    "",
    "male",
    "female",
    "other",
  ];

  const educationLevels = [
    "",
    "higher_education",
    "school",
  ];

  const casteCategories = [
    "",
    "general",
    "sc",
    "st",
    "obc",
    "minority",
  ];

  return (
    <div className="sc-page sc-search-page">

      {/* ───────────────────────── HERO ───────────────────────── */}

      <section className="sc-discovery-hero">

        <div className="sc-hero-grid" />

        <div className="sc-hero-glow sc-hero-glow-one" />
        <div className="sc-hero-glow sc-hero-glow-two" />

        <div className="sc-discovery-copy">

          <div className="sc-eyebrow sc-light-eyebrow">
            <span className="sc-live-dot" />
            AI-POWERED BENEFIT DISCOVERY
          </div>

          <h1>
            Find benefits
            <br />
            <span>made for you.</span>
          </h1>

          <p>
            Tell us what your life looks like. We'll connect
            you with government schemes that actually fit
            your situation.
          </p>

          <div className="sc-hero-trust">

            <div className="sc-trust-item">
              <strong>4,700+</strong>
              <span>schemes</span>
            </div>

            <div className="sc-trust-divider" />

            <div className="sc-trust-item">
              <strong>AI</strong>
              <span>matching</span>
            </div>

            <div className="sc-trust-divider" />

            <div className="sc-trust-item">
              <strong>28+</strong>
              <span>states</span>
            </div>

          </div>
        </div>

        <div className="sc-discovery-orbit">

          <div className="sc-orbit-ring ring-one" />
          <div className="sc-orbit-ring ring-two" />
          <div className="sc-orbit-ring ring-three" />

          <div className="sc-orbit-core">
            <div className="sc-orbit-core-inner">
              <span>✦</span>
              <small>AI</small>
            </div>
          </div>

          <div className="sc-orbit-chip chip-one">
            🎓 Education
          </div>

          <div className="sc-orbit-chip chip-two">
            🌾 Agriculture
          </div>

          <div className="sc-orbit-chip chip-three">
            💼 Employment
          </div>

          <div className="sc-orbit-chip chip-four">
            🏥 Healthcare
          </div>

        </div>

      </section>

      {/* ───────────────────── SEARCH MODE ───────────────────── */}

      <div className="sc-search-shell">

        <div className="sc-mode-switch">

          <button
            type="button"
            className={searchMode === "ai" ? "active" : ""}
            onClick={() => setSearchMode("ai")}
          >
            <span className="sc-mode-icon">✦</span>

            <span>
              <b>AI Assistant</b>
              <small>Describe your situation</small>
            </span>

            {searchMode === "ai" && (
              <span className="sc-active-check">✓</span>
            )}
          </button>

          <button
            type="button"
            className={searchMode === "manual" ? "active" : ""}
            onClick={() => setSearchMode("manual")}
          >
            <span className="sc-mode-icon">⌘</span>

            <span>
              <b>Advanced Filters</b>
              <small>Fine-tune your eligibility</small>
            </span>

            {searchMode === "manual" && (
              <span className="sc-active-check">✓</span>
            )}
          </button>

        </div>

        {/* ───────────────────── AI SEARCH ───────────────────── */}

        {searchMode === "ai" && (
          <section
            className={`sc-search-card sc-ai-card ${
              focused ? "is-focused" : ""
            }`}
          >

            <div className="sc-search-card-top">

              <div className="sc-card-icon sc-ai-icon">
                ✦
              </div>

              <div>
                <div className="sc-card-kicker">
                  NATURAL LANGUAGE SEARCH
                </div>

                <h2>
                  What are you looking for?
                </h2>

                <p>
                  Just explain your situation naturally.
                  Our AI will identify the details that matter.
                </p>
              </div>

            </div>

            <form onSubmit={handleAISearch}>

              <div className="sc-prompt-box">

                <div className="sc-prompt-glow" />

                <textarea
                  value={aiMessage}
                  maxLength={1000}
                  onChange={(e) =>
                    setAiMessage(e.target.value)
                  }
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="I'm a 22-year-old engineering student from Delhi, family income around ₹3 lakh, and I'm looking for scholarships..."
                  rows={5}
                />

                <div className="sc-prompt-footer">
                  <span>
                    ✦ AI understands natural language
                  </span>

                  <span>
                    {aiMessage.length}/1000
                  </span>
                </div>

              </div>

              <div className="sc-example-row">

                <span>Try asking:</span>

                {[
                  "Student scholarships",
                  "Farmer support",
                  "Women entrepreneurs",
                ].map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => setAiMessage(example)}
                  >
                    {example}
                  </button>
                ))}

              </div>

              <button
                className="sc-primary-btn sc-search-btn"
                type="submit"
                disabled={loading || !aiMessage.trim()}
              >
                <span>
                  {loading
                    ? "Finding your matches..."
                    : "Find my matching schemes"}
                </span>

                <b>→</b>
              </button>

            </form>

          </section>
        )}

        {/* ─────────────────── MANUAL SEARCH ─────────────────── */}

        {searchMode === "manual" && (
          <section className="sc-search-card sc-filter-card">

            <div className="sc-search-card-top">

              <div className="sc-card-icon sc-filter-icon">
                ⌘
              </div>

              <div>
                <div className="sc-card-kicker">
                  ELIGIBILITY FILTERS
                </div>

                <h2>
                  Build your profile
                </h2>

                <p>
                  Choose whatever you know. Everything else
                  can stay open.
                </p>
              </div>

            </div>

            <form onSubmit={handleManualSearch}>

              <div className="sc-filter-grid">

                <FilterSelect
                  label="Gender"
                  value={filters.gender}
                  onChange={(e) =>
                    updateFilter("gender", e.target.value)
                  }
                  options={genders}
                  placeholder="Any gender"
                />

                <FilterSelect
                  label="State"
                  value={filters.state}
                  onChange={(e) =>
                    updateFilter("state", e.target.value)
                  }
                  options={states}
                  placeholder="Any state"
                />

                <FilterSelect
                  label="Occupation"
                  value={filters.occupation}
                  onChange={(e) =>
                    updateFilter(
                      "occupation",
                      e.target.value
                    )
                  }
                  options={occupations}
                  placeholder="Any occupation"
                />

                <FilterSelect
                  label="Education"
                  value={filters.educationLevel}
                  onChange={(e) =>
                    updateFilter(
                      "educationLevel",
                      e.target.value
                    )
                  }
                  options={educationLevels}
                  placeholder="Any education"
                />

                <FilterSelect
                  label="Category"
                  value={filters.casteCategory}
                  onChange={(e) =>
                    updateFilter(
                      "casteCategory",
                      e.target.value
                    )
                  }
                  options={casteCategories}
                  placeholder="Any category"
                />

                <div className="sc-filter-field">

                  <FieldLabel hint="Optional">
                    Annual income
                  </FieldLabel>

                  <div className="sc-income-input">
                    <span>₹</span>

                    <input
                      type="number"
                      placeholder="5,00,000"
                      value={filters.income}
                      onChange={(e) =>
                        updateFilter(
                          "income",
                          e.target.value
                        )
                      }
                    />
                  </div>

                </div>

              </div>

              <div className="sc-filter-note">
                <span>✦</span>
                You don't need to fill every field.
                We'll search with whatever information you provide.
              </div>

              <button
                className="sc-primary-btn sc-search-btn"
                type="submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? "Searching..."
                    : "Search eligible schemes"}
                </span>

                <b>→</b>
              </button>

            </form>

          </section>
        )}

      </div>

      {/* ───────────────────── LOADING ───────────────────── */}

      {loading && (
        <div className="sc-loading-panel">

          <div className="sc-loading-visual">

            <div className="sc-loading-ring ring-a" />
            <div className="sc-loading-ring ring-b" />

            <div className="sc-loading-core">
              ✦
            </div>

          </div>

          <div>
            <h3>
              Finding your best matches
            </h3>

            <p>
              Comparing your profile with thousands of
              government schemes...
            </p>
          </div>

          <div className="sc-loading-bars">
            <span />
            <span />
            <span />
          </div>

        </div>
      )}

      {/* ───────────────────── PROFILE ───────────────────── */}

      {!loading && hasSearched && profile && (
        <section className="sc-profile-section">

          <div className="sc-section-marker">
            <span />
            YOUR PROFILE
          </div>

          <ProfileCard profile={profile} />

        </section>
      )}

      {/* ───────────────────── RESULTS ───────────────────── */}

      {!loading &&
        hasSearched &&
        schemes.length > 0 && (

          <section className="sc-results-section">

            <div className="sc-results-head">

              <div>

                <div className="sc-section-marker">
                  <span />
                  MATCH RESULTS
                </div>

                <h2>
                  Recommended schemes
                </h2>

                <p>
                  Ranked by relevance to your situation.
                </p>

              </div>

              <div className="sc-count-pill">
                <strong>{schemes.length}</strong>
                matches found
              </div>

            </div>

            <div className="sc-results-list">

              {visibleSchemes.map((scheme, index) => (

                <div
                  key={`${scheme.id}-${index}`}
                  className="sc-result-item"
                  style={{
                    animationDelay: `${
                      Math.min(index, 7) * 0.06
                    }s`,
                  }}
                >

                  <RecommendationCard
                    scheme={scheme}
                    onViewDetails={onViewDetails}
                  />

                  <button
                    className={`sc-save-float ${
                      savedIds.includes(scheme.id)
                        ? "saved"
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveScheme(scheme);
                    }}
                    disabled={savedIds.includes(scheme.id)}
                  >
                    {savedIds.includes(scheme.id)
                      ? "✓ Saved"
                      : "＋ Save"}
                  </button>

                </div>

              ))}

            </div>

            {remaining > 0 && (

              <div className="sc-load-more">

                <button onClick={loadMore}>
                  Load{" "}
                  {Math.min(remaining, PAGE_SIZE)}
                  {" "}more
                  <span>↓</span>
                </button>

                <small>
                  Showing {visibleCount} of {schemes.length}
                </small>

              </div>

            )}

          </section>
        )}

      {/* ───────────────────── EMPTY ───────────────────── */}

      {!loading &&
        hasSearched &&
        schemes.length === 0 && (

          <div className="sc-empty-state">

            <div className="sc-empty-visual">

              <div className="sc-empty-circle">
                ?
              </div>

            </div>

            <div className="sc-section-marker">
              SEARCH COMPLETE
            </div>

            <h3>
              No matching schemes yet
            </h3>

            <p>
              Try adding more context about your state,
              occupation, income, or the kind of support
              you're looking for.
            </p>

            <button
              className="sc-secondary-btn"
              onClick={() => setSearchMode("ai")}
            >
              Try AI search →
            </button>

          </div>
        )}

      {/* ───────────────────── INITIAL STATE ───────────────────── */}

      {!hasSearched && !loading && (
        <section className="sc-discovery-tips">

          <div className="sc-section-marker">
            <span />
            START HERE
          </div>

          <h2>
            One search. Thousands of possibilities.
          </h2>

          <div className="sc-tip-grid">

            <div className="sc-tip-card">
              <span>01</span>
              <div>
                <strong>Describe your situation</strong>
                <p>
                  Tell the AI about your goals,
                  background and what you need.
                </p>
              </div>
            </div>

            <div className="sc-tip-card">
              <span>02</span>
              <div>
                <strong>Get personalized matches</strong>
                <p>
                  Your profile is matched against
                  thousands of government schemes.
                </p>
              </div>
            </div>

            <div className="sc-tip-card">
              <span>03</span>
              <div>
                <strong>Explore & apply</strong>
                <p>
                  Open the scheme details and
                  follow the official application link.
                </p>
              </div>
            </div>

          </div>

        </section>
      )}

    </div>
  );
};

export default FindSchemes;


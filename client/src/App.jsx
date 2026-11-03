import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import Navbar from "./components/navigation/Navbar";
import LandingHome from "./pages/LandingHome";
import FindSchemes from "./pages/FindSchemes";
import SavedSchemes from "./pages/SavedSchemes";
import SchemeDetailsView from "./pages/SchemeDetailsView";
import AuthPage from "./pages/AuthPage";

import { AuthContext } from "./context/AuthContext";
import { addBookmark, removeBookmark } from "./services/api";

const PROTECTED_TABS = ["search", "saved"];

const TAB_PATHS = { landing: "/", search: "/search", saved: "/saved", auth: "/auth" };

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(() => {
    if (location.pathname.startsWith("/schemes/")) return "details";
    return Object.keys(TAB_PATHS).find((tab) => TAB_PATHS[tab] === location.pathname) || "landing";
  }, [location.pathname]);
  const selectedScheme = location.state?.scheme || null;
  const [searchResults, setSearchResults] = useState([]);
  const [searchProfile, setSearchProfile] = useState(null);

  const { token, savedSchemesList, fetchUserBookmarks } = useContext(AuthContext);

  const savedIds = Array.isArray(savedSchemesList)
    ? savedSchemesList.map((scheme) => scheme.id)
    : [];

  useEffect(() => {
    const legacyPage = new URLSearchParams(location.search).get("page");
    if (legacyPage && TAB_PATHS[legacyPage]) {
      navigate(TAB_PATHS[legacyPage], { replace: true });
      return;
    }
    if (activeTab === "auth" && token) navigate("/", { replace: true });
    else if (PROTECTED_TABS.includes(activeTab) && !token) navigate("/auth", { replace: true });
  }, [activeTab, location.search, navigate, token]);

  const handleTabChange = useCallback(
    (tab, { replace = false } = {}) => {
      if (PROTECTED_TABS.includes(tab) && !token) {
        navigate("/auth", { replace });
        return;
      }
      navigate(TAB_PATHS[tab] || "/", { replace });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate, token]
  );

  const handleAuthSuccess = () => {
    handleTabChange("landing", { replace: true });
  };

  const handleViewDetails = (scheme) => {
    navigate(`/schemes/${encodeURIComponent(scheme.id)}`, {
      state: { scheme, from: location.pathname },
    });
  };

  const handleSaveScheme = async (scheme) => {
    if (!token) {
      handleTabChange("auth");
      return;
    }

    try {
      await addBookmark(scheme.id);
      await fetchUserBookmarks();
    } catch (error) {
      console.error("Bookmark add failed:", error);
    }
  };

  const handleRemoveScheme = async (schemeId) => {
    try {
      await removeBookmark(schemeId);
      await fetchUserBookmarks();
    } catch (error) {
      console.error("Bookmark removal failed:", error);
    }
  };

  const handleBackFromDetails = () => {
    navigate(location.state?.from || "/");
  };

  const handleResultsUpdate = useCallback((results, profile) => {
    setSearchResults(results);
    setSearchProfile(profile);
  }, []);

  const isAuthPage = activeTab === "auth" && !token;

  return (
    <div className="min-h-screen flex flex-col app-shell">
      {!isAuthPage && <Navbar activeTab={activeTab} onTabChange={handleTabChange} />}

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingHome onViewDetails={handleViewDetails} onTabChange={handleTabChange} />} />
          <Route path="/search" element={<FindSchemes onSaveScheme={handleSaveScheme} savedIds={savedIds} onViewDetails={handleViewDetails} initialResults={searchResults} initialProfile={searchProfile} onResultsUpdate={handleResultsUpdate} />} />
          <Route path="/saved" element={<SavedSchemes savedList={savedSchemesList} onRemoveScheme={handleRemoveScheme} onViewDetails={handleViewDetails} onTabChange={handleTabChange} />} />
          <Route path="/auth" element={<AuthPage onAuthSuccess={handleAuthSuccess} />} />
          <Route path="/schemes/:schemeId" element={<SchemeDetailsView scheme={selectedScheme} onBackNavigate={handleBackFromDetails} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {!isAuthPage && (
          <footer className="foot">
            <div className="container container--wide foot__inner">
              <div>
                <div className="foot__brand">
                  <span className="brand__mark">
                    <img src="/logo.png" alt="" />
                  </span>
                  <span className="brand__word">
                    Scheme<b>Companion</b>
                  </span>
                </div>
                <p className="foot__tag">Discover government benefits that are meant for you.</p>
              </div>

              <p className="foot__src">
                Data sourced from{" "}
                <a href="https://www.myscheme.gov.in" target="_blank" rel="noreferrer">
                  MyScheme.gov.in
                </a>
              </p>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;

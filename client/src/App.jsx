import { useCallback, useContext, useEffect, useState } from "react";

import Navbar from "./components/navigation/Navbar";
import LandingHome from "./pages/LandingHome";
import FindSchemes from "./pages/FindSchemes";
import SavedSchemes from "./pages/SavedSchemes";
import SchemeDetailsView from "./pages/SchemeDetailsView";
import AuthPage from "./pages/AuthPage";

import { AuthContext } from "./context/AuthContext";
import { addBookmark, removeBookmark } from "./services/api";

const PROTECTED_TABS = ["search", "saved"];

const getPageFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("page") || "landing";
};

function App() {
  const [activeTab, setActiveTab] = useState(getPageFromUrl);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchProfile, setSearchProfile] = useState(null);
  const [previousTab, setPreviousTab] = useState(null);

  const { token, savedSchemesList, fetchUserBookmarks } = useContext(AuthContext);

  const savedIds = Array.isArray(savedSchemesList)
    ? savedSchemesList.map((scheme) => scheme.id)
    : [];

  const syncRoute = useCallback(() => {
    const page = getPageFromUrl();

    if (page === "auth" && token) {
      window.history.replaceState({}, "", "?page=landing");
      setActiveTab("landing");
      return;
    }

    if (PROTECTED_TABS.includes(page) && !token) {
      window.history.replaceState({}, "", "?page=auth");
      setActiveTab("auth");
      return;
    }

    setActiveTab(page);
  }, [token]);

  useEffect(() => {
    syncRoute();
    window.addEventListener("popstate", syncRoute);

    return () => window.removeEventListener("popstate", syncRoute);
  }, [syncRoute]);

  const handleTabChange = useCallback(
    (tab, { replace = false } = {}) => {
      if (PROTECTED_TABS.includes(tab) && !token) {
        const authUrl = "?page=auth";

        if (replace) {
          window.history.replaceState({}, "", authUrl);
        } else {
          window.history.pushState({}, "", authUrl);
        }

        setActiveTab("auth");
        return;
      }

      const url = `?page=${encodeURIComponent(tab)}`;

      if (replace) {
        window.history.replaceState({}, "", url);
      } else {
        window.history.pushState({}, "", url);
      }

      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [token]
  );

  const handleAuthSuccess = () => {
    handleTabChange("landing", { replace: true });
  };

  const handleViewDetails = (scheme) => {
    setSelectedScheme(scheme);
    setPreviousTab(activeTab);
    handleTabChange("details");
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
    const tab = previousTab || "landing";
    setPreviousTab(null);
    handleTabChange(tab);
  };

  const handleResultsUpdate = useCallback((results, profile) => {
    setSearchResults(results);
    setSearchProfile(profile);
  }, []);

  const renderViewport = () => {
    if (activeTab === "auth" && !token) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }

    if (activeTab === "auth" && token) {
      return <LandingHome onViewDetails={handleViewDetails} onTabChange={handleTabChange} />;
    }

    if (PROTECTED_TABS.includes(activeTab) && !token) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }

    switch (activeTab) {
      case "landing":
        return <LandingHome onViewDetails={handleViewDetails} onTabChange={handleTabChange} />;

      case "search":
        return (
          <FindSchemes
            onSaveScheme={handleSaveScheme}
            savedIds={savedIds}
            onViewDetails={handleViewDetails}
            initialResults={searchResults}
            initialProfile={searchProfile}
            onResultsUpdate={handleResultsUpdate}
          />
        );

      case "saved":
        return (
          <SavedSchemes
            savedList={savedSchemesList}
            onRemoveScheme={handleRemoveScheme}
            onViewDetails={handleViewDetails}
            onTabChange={handleTabChange}
          />
        );

      case "details":
        return <SchemeDetailsView scheme={selectedScheme} onBackNavigate={handleBackFromDetails} />;

      default:
        return <LandingHome onViewDetails={handleViewDetails} onTabChange={handleTabChange} />;
    }
  };

  const isAuthPage = activeTab === "auth" && !token;

  return (
    <div className="min-h-screen flex flex-col app-shell">
      {!isAuthPage && <Navbar activeTab={activeTab} onTabChange={handleTabChange} />}

      <main className="flex-1">
        {renderViewport()}

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

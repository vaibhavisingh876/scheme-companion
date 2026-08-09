import { useEffect, useState, useContext } from "react";
import Navbar from "./components/navigation/Navbar";
import LandingHome from "./pages/LandingHome";
import FindSchemes from "./pages/FindSchemes";
import SavedSchemes from "./pages/SavedSchemes";
import SchemeDetailsView from "./pages/SchemeDetailsView";
import AuthPage from "./pages/AuthPage";
import { AuthContext } from "./context/AuthContext";
import { addBookmark, removeBookmark } from "./services/api";

const PROTECTED_TABS = ["search", "saved"];

function App() {
  const [activeTab, setActiveTab] = useState("landing");
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchProfile, setSearchProfile] = useState(null);
  const [previousTab, setPreviousTab] = useState(null);

  const { token, savedSchemesList, fetchUserBookmarks } = useContext(AuthContext);

  const savedIds = Array.isArray(savedSchemesList)
    ? savedSchemesList.map((s) => s.id)
    : [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get("page");
    if (!page) return;

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

  const handleTabChange = (tab) => {
    if (PROTECTED_TABS.includes(tab) && !token) {
      window.history.pushState({}, "", "?page=auth");
      setActiveTab("auth");
      return;
    }
    window.history.pushState({}, "", `?page=${tab}`);
    setActiveTab(tab);
  };

  const handleViewDetailsTrigger = (schemeObject) => {
    setSelectedScheme(schemeObject);
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
    } catch (err) {
      console.error("Bookmark add failed:", err);
    }
  };

  const handleRemoveScheme = async (id) => {
    try {
      await removeBookmark(id);
      await fetchUserBookmarks();
    } catch (err) {
      console.error("Bookmark removal failed:", err);
    }
  };

  const handleBackFromDetails = () => {
    const backTab = previousTab || "landing";
    setPreviousTab(null);
    handleTabChange(backTab);
  };

  const renderViewport = () => {
    if (activeTab === "auth" && token) {
      return (
        <LandingHome
          onViewDetails={handleViewDetailsTrigger}
          onTabChange={handleTabChange}
        />
      );
    }

    if (PROTECTED_TABS.includes(activeTab) && !token) {
      return <AuthPage onAuthSuccess={() => handleTabChange("landing")} />;
    }

    switch (activeTab) {
      case "landing":
        return (
          <LandingHome
            onViewDetails={handleViewDetailsTrigger}
            onTabChange={handleTabChange}
          />
        );
      case "search":
        return (
          <FindSchemes
            onSaveScheme={handleSaveScheme}
            savedIds={savedIds}
            onViewDetails={handleViewDetailsTrigger}
            initialResults={searchResults}
            initialProfile={searchProfile}
            onResultsUpdate={(results, profile) => {
              setSearchResults(results);
              setSearchProfile(profile);
            }}
          />
        );
      case "saved":
        return (
          <SavedSchemes
            savedList={savedSchemesList}
            onRemoveScheme={handleRemoveScheme}
            onViewDetails={handleViewDetailsTrigger}
          />
        );
      case "details":
        return (
          <SchemeDetailsView
            scheme={selectedScheme}
            onBackNavigate={handleBackFromDetails}
          />
        );
      case "auth":
        return <AuthPage onAuthSuccess={() => handleTabChange("landing")} />;
      default:
        return (
          <LandingHome
            onViewDetails={handleViewDetailsTrigger}
            onTabChange={handleTabChange}
          />
        );
    }
  };

  const isAuthPage = activeTab === "auth" && !token;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--surface)",
        color: "var(--ink)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {!isAuthPage && <Navbar activeTab={activeTab} onTabChange={handleTabChange} />}
      <main
        className={
          isAuthPage
            ? "flex-1"
            : "flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-10"
        }
      >
        {renderViewport()}
        {!isAuthPage && (
          <footer
            className="py-6 text-center"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              SchemeCompanion · Data sourced from{" "}
              <a
                href="https://www.myscheme.gov.in"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: "var(--saffron)" }}
              >
                MyScheme.gov.in
              </a>
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;
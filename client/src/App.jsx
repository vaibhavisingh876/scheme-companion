import { useEffect, useState } from "react";
import Navbar from "./components/navigation/Navbar";
import LandingHome from "./pages/LandingHome";
import FindSchemes from "./pages/FindSchemes";
import SavedSchemes from "./pages/SavedSchemes";
import SchemeDetailsView from "./pages/SchemeDetailsView";
import AuthPage from "./pages/AuthPage";
import { AuthContext } from "./context/AuthContext";
import { addBookmark, removeBookmark } from "./services/api";
import { useContext } from "react";

const PROTECTED_TABS = ["search", "saved"];

function App() {
  const [activeTab, setActiveTab] = useState("landing");
  const [selectedScheme, setSelectedScheme] = useState(null);

  const { token, savedSchemesList, fetchUserBookmarks } = useContext(AuthContext);

  const savedIds = Array.isArray(savedSchemesList)
    ? savedSchemesList.map((s) => s.id)
    : [];

  // Sync URL param to tab on load and on token change
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

  const renderViewport = () => {
    // Hard guard: logged-in user should never see auth page
    if (activeTab === "auth" && token) {
      return <LandingHome onViewDetails={handleViewDetailsTrigger} onTabChange={handleTabChange} />;
    }

    // Hard guard: unauthenticated user trying protected tab
    if (PROTECTED_TABS.includes(activeTab) && !token) {
      return <AuthPage onAuthSuccess={() => handleTabChange("landing")} />;
    }

    switch (activeTab) {
      case "landing":
        // FIX: LandingHome now receives onTabChange so its CTA buttons work without page reload
        return <LandingHome onViewDetails={handleViewDetailsTrigger} onTabChange={handleTabChange} />;
      case "search":
        return <FindSchemes onSaveScheme={handleSaveScheme} savedIds={savedIds} />;
      case "saved":
        return <SavedSchemes savedList={savedSchemesList} onRemoveScheme={handleRemoveScheme} />;
      case "details":
        return (
          <SchemeDetailsView
            scheme={selectedScheme}
            onBackNavigate={() => handleTabChange("landing")}
          />
        );
      case "auth":
        return <AuthPage onAuthSuccess={() => handleTabChange("landing")} />;
      default:
        return <LandingHome onViewDetails={handleViewDetailsTrigger} onTabChange={handleTabChange} />;
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
      {!isAuthPage && (
        <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      <main
        className={
          isAuthPage
            ? "flex-1"
            : "flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-10"
        }
      >
        {renderViewport()}
      </main>

      {!isAuthPage && (
        <footer className="py-6 text-center" style={{ borderTop: "1px solid var(--border)" }}>
          <p
            className="text-[11px]"
            style={{ color: "var(--muted)", fontFamily: "'Inter', sans-serif" }}
          >
            SchemeCompanion · Data sourced from{" "}
            <a
              href="https://www.myscheme.gov.in"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
              style={{ color: "var(--saffron)" }}
            >
              MyScheme.gov.in
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
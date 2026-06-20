import { useEffect, useState, useContext } from "react";
import Navbar from "./components/navigation/Navbar";
import LandingHome from "./pages/LandingHome";
import FindSchemes from "./pages/FindSchemes";
import SavedSchemes from "./pages/SavedSchemes";
import SchemeDetailsView from "./pages/SchemeDetailsView";
import AuthPage from "./pages/AuthPage";
import { AuthContext } from "./context/AuthContext";
import { addBookmark, removeBookmark } from "./services/api";

function App() {
  const [activeTab, setActiveTab] = useState("landing");
  const [selectedScheme, setSelectedScheme] = useState(null);

  const {
    token,
    savedSchemesList,
    fetchUserBookmarks,
  } = useContext(AuthContext);

  const savedIds = Array.isArray(savedSchemesList)
    ? savedSchemesList.map((scheme) => scheme.id)
    : [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get("page");

    if (page) {
      setActiveTab(page);
    }
  }, []);

  const handleTabChange = (tab) => {
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
      console.error("Error updating configuration tracking bookmarks:", err);
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
    switch (activeTab) {
      case "landing":
        return (
          <LandingHome
            onViewDetails={handleViewDetailsTrigger}
          />
        );

      case "search":
        return (
          <FindSchemes
            onSaveScheme={handleSaveScheme}
            savedIds={savedIds}
          />
        );

      case "saved":
        return (
          <SavedSchemes
            savedList={savedSchemesList}
            onRemoveScheme={handleRemoveScheme}
          />
        );

      case "details":
        return (
          <SchemeDetailsView
            scheme={selectedScheme}
            onBackNavigate={() => handleTabChange("landing")}
          />
        );

      case "auth":
        return (
          <AuthPage
            onAuthSuccess={() => handleTabChange("landing")}
          />
        );

      default:
        return (
          <LandingHome
            onViewDetails={handleViewDetailsTrigger}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#e6ddcf] text-[#4e342e] flex flex-col font-sans antialiased">
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 relative z-10">
        {renderViewport()}
      </main>
    </div>
  );
}

export default App;
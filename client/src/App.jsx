import { useEffect, useState, useContext, useCallback } from "react";

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

  const {
    token,
    savedSchemesList,
    fetchUserBookmarks,
  } = useContext(AuthContext);

  const savedIds = Array.isArray(savedSchemesList)
    ? savedSchemesList.map((scheme) => scheme.id)
    : [];

  /*
   * ---------------------------------------------------------
   * BROWSER BACK / FORWARD
   * ---------------------------------------------------------
   */

  const syncRoute = useCallback(() => {
    const page = getPageFromUrl();

    if (page === "auth" && token) {
      window.history.replaceState(
        {},
        "",
        "?page=landing"
      );

      setActiveTab("landing");
      return;
    }

    if (
      PROTECTED_TABS.includes(page) &&
      !token
    ) {
      window.history.replaceState(
        {},
        "",
        "?page=auth"
      );

      setActiveTab("auth");
      return;
    }

    setActiveTab(page);
  }, [token]);

  useEffect(() => {
    syncRoute();

    window.addEventListener(
      "popstate",
      syncRoute
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncRoute
      );
    };
  }, [syncRoute]);

  /*
   * ---------------------------------------------------------
   * ROUTING
   * ---------------------------------------------------------
   */

  const handleTabChange = useCallback(
    (tab, options = {}) => {
      const {
        replace = false,
        fromAuth = false,
      } = options;

      /*
       * Protected page without authentication
       */
      if (
        PROTECTED_TABS.includes(tab) &&
        !token
      ) {
        setPreviousTab(
          activeTab === "auth"
            ? "landing"
            : activeTab
        );

        const authUrl =
          `?page=auth&from=${encodeURIComponent(tab)}`;

        if (replace) {
          window.history.replaceState(
            {},
            "",
            authUrl
          );
        } else {
          window.history.pushState(
            {},
            "",
            authUrl
          );
        }

        setActiveTab("auth");
        return;
      }

      /*
       * Normal navigation
       */
      const url =
        `?page=${encodeURIComponent(tab)}`;

      if (replace) {
        window.history.replaceState(
          {},
          "",
          url
        );
      } else {
        window.history.pushState(
          {},
          "",
          url
        );
      }

      setActiveTab(tab);

      if (!fromAuth) {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    },
    [activeTab, token]
  );

  /*
   * ---------------------------------------------------------
   * AUTH
   * ---------------------------------------------------------
   */

  const handleAuthSuccess = () => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const from =
      params.get("from");

    /*
     * After login, go where user originally
     * intended to go.
     */

    if (
      from &&
      PROTECTED_TABS.includes(from)
    ) {
      handleTabChange(
        from,
        {
          replace: true,
          fromAuth: true,
        }
      );
      return;
    }

    handleTabChange(
      "landing",
      {
        replace: true,
        fromAuth: true,
      }
    );
  };

  const handleAuthBack = () => {
    /*
     * If browser has a previous route,
     * use it naturally.
     */

    if (
      previousTab &&
      previousTab !== "auth"
    ) {
      handleTabChange(
        previousTab,
        {
          replace: true,
        }
      );

      setPreviousTab(null);
      return;
    }

    handleTabChange(
      "landing",
      {
        replace: true,
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * SCHEME DETAILS
   * ---------------------------------------------------------
   */

  const handleViewDetailsTrigger = (
    schemeObject
  ) => {
    setSelectedScheme(
      schemeObject
    );

    setPreviousTab(
      activeTab
    );

    handleTabChange(
      "details"
    );
  };

  /*
   * ---------------------------------------------------------
   * BOOKMARKS
   * ---------------------------------------------------------
   */

  const handleSaveScheme = async (
    scheme
  ) => {
    if (!token) {
      setPreviousTab(
        activeTab
      );

      handleTabChange(
        "auth"
      );

      return;
    }

    try {
      await addBookmark(
        scheme.id
      );

      await fetchUserBookmarks();
    } catch (error) {
      console.error(
        "Bookmark add failed:",
        error
      );
    }
  };

  const handleRemoveScheme = async (
    id
  ) => {
    try {
      await removeBookmark(id);

      await fetchUserBookmarks();
    } catch (error) {
      console.error(
        "Bookmark removal failed:",
        error
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * DETAILS BACK
   * ---------------------------------------------------------
   */

  const handleBackFromDetails = () => {
    const backTab =
      previousTab || "landing";

    setPreviousTab(null);

    handleTabChange(
      backTab
    );
  };

  /*
   * ---------------------------------------------------------
   * VIEWPORT
   * ---------------------------------------------------------
   */

  const renderViewport = () => {
    /*
     * Auth
     */
    if (
      activeTab === "auth" &&
      !token
    ) {
      return (
        <AuthPage
          onAuthSuccess={
            handleAuthSuccess
          }
          onBack={
            handleAuthBack
          }
        />
      );
    }

    /*
     * Auth page while already logged in
     */
    if (
      activeTab === "auth" &&
      token
    ) {
      return (
        <LandingHome
          onViewDetails={
            handleViewDetailsTrigger
          }
          onTabChange={
            handleTabChange
          }
        />
      );
    }

    /*
     * Protected route
     */
    if (
      PROTECTED_TABS.includes(
        activeTab
      ) &&
      !token
    ) {
      return (
        <AuthPage
          onAuthSuccess={
            handleAuthSuccess
          }
          onBack={
            handleAuthBack
          }
        />
      );
    }

    switch (activeTab) {
      case "landing":
        return (
          <LandingHome
            onViewDetails={
              handleViewDetailsTrigger
            }
            onTabChange={
              handleTabChange
            }
          />
        );

      case "search":
        return (
          <FindSchemes
            onSaveScheme={
              handleSaveScheme
            }
            savedIds={
              savedIds
            }
            onViewDetails={
              handleViewDetailsTrigger
            }
            initialResults={
              searchResults
            }
            initialProfile={
              searchProfile
            }
            onResultsUpdate={(
              results,
              profile
            ) => {
              setSearchResults(
                results
              );

              setSearchProfile(
                profile
              );
            }}
          />
        );

      case "saved":
        return (
          <SavedSchemes
            savedList={
              savedSchemesList
            }
            onRemoveScheme={
              handleRemoveScheme
            }
            onViewDetails={
              handleViewDetailsTrigger
            }
          />
        );

      case "details":
        return (
          <SchemeDetailsView
            scheme={
              selectedScheme
            }
            onBackNavigate={
              handleBackFromDetails
            }
          />
        );

      default:
        return (
          <LandingHome
            onViewDetails={
              handleViewDetailsTrigger
            }
            onTabChange={
              handleTabChange
            }
          />
        );
    }
  };

  const isAuthPage =
    activeTab === "auth" &&
    !token;

  return (
    <div
      className="min-h-screen flex flex-col app-shell"
      style={{
        background:
          "var(--surface)",
        color:
          "var(--ink)",
        fontFamily:
          "'Inter', sans-serif",
      }}
    >

      {!isAuthPage && (
        <Navbar
          activeTab={
            activeTab
          }
          onTabChange={
            handleTabChange
          }
        />
      )}

      <main
        className={
          isAuthPage
            ? "flex-1"
            : "flex-1"
        }
      >
        {renderViewport()}

        {!isAuthPage && (
          <footer
            className="max-w-7xl mx-auto px-5 sm:px-8 py-10 mt-12"
          >
            <div
              className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
              style={{
                borderTop:
                  "1px solid var(--border)",
              }}
            >
              <div>
                <p
                  className="text-sm font-black"
                  style={{
                    fontFamily:
                      "'Plus Jakarta Sans', sans-serif",
                    color:
                      "var(--ink)",
                  }}
                >
                  Scheme
                  <span
                    style={{
                      color:
                        "var(--saffron)",
                    }}
                  >
                    Companion
                  </span>
                </p>

                <p
                  className="text-[11px] mt-1"
                  style={{
                    color:
                      "var(--muted)",
                  }}
                >
                  Discover government benefits
                  that are meant for you.
                </p>
              </div>

              <p
                className="text-[11px]"
                style={{
                  color:
                    "var(--muted)",
                }}
              >
                Data sourced from{" "}
                <a
                  href="https://www.myscheme.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                  style={{
                    color:
                      "var(--saffron)",
                  }}
                >
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
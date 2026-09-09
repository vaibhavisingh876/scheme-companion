
import React, {
  useContext,
  useState,
} from "react";

import {
  AuthContext,
} from "../../context/AuthContext";

import ThemeToggle from "../ThemeToggle";

const Navbar = ({
  activeTab,
  onTabChange,
}) => {
  const {
    user,
    logout,
  } = useContext(AuthContext);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const handleNavigation = (
    tab
  ) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const handleAuthAction = () => {
    if (user?.loggedIn) {
      logout();
    } else {
      onTabChange("auth");
    }

    setMobileOpen(false);
  };

  const navItems = [
    {
      id: "landing",
      label: "Home",
    },
    {
      id: "search",
      label: "Find Schemes",
    },
    {
      id: "saved",
      label: "Bookmarks",
    },
  ];

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-xl navbar-glass"
      style={{
        borderBottom:
          "1px solid var(--border)",
        background:
          "var(--nav-bg)",
      }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[68px] flex items-center justify-between">

        {/* BRAND */}

        <button
          onClick={() =>
            handleNavigation(
              "landing"
            )
          }
          className="group flex items-center gap-3"
        >
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden brand-mark">
            <div className="absolute inset-0 brand-shine" />

            <img
              src="/logo.png"
              alt="Scheme Companion"
              className="relative w-full h-full object-contain"
            />
          </div>

          <div className="text-left leading-none">
            <div
              className="text-[15px] font-black tracking-tight"
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
            </div>

            <div
              className="text-[8px] uppercase tracking-[0.18em] mt-1"
              style={{
                color:
                  "var(--muted)",
              }}
            >
              AI welfare discovery
            </div>
          </div>
        </button>

        {/* DESKTOP NAV */}

        <div className="hidden md:flex items-center gap-1 p-1 rounded-2xl navbar-nav">
          {navItems.map(
            (item) => {
              const isActive =
                activeTab ===
                item.id;

              return (
                <button
                  key={item.id}
                  onClick={() =>
                    handleNavigation(
                      item.id
                    )
                  }
                  className="relative px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300"
                  style={{
                    color: isActive
                      ? "var(--ink)"
                      : "var(--muted)",
                    background:
                      isActive
                        ? "var(--panel)"
                        : "transparent",
                    boxShadow:
                      isActive
                        ? "0 3px 12px rgba(0,0,0,0.06)"
                        : "none",
                  }}
                >
                  {item.label}

                  {isActive && (
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{
                        background:
                          "var(--saffron)",
                      }}
                    />
                  )}
                </button>
              );
            }
          )}
        </div>

        {/* RIGHT */}

        <div className="hidden md:flex items-center gap-3">

          <ThemeToggle />

          {user?.loggedIn ? (
            <>
              <div
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full"
                style={{
                  border:
                    "1px solid var(--border)",
                  background:
                    "var(--panel)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                  style={{
                    background:
                      "linear-gradient(135deg,var(--saffron),var(--saffron-dk))",
                  }}
                >
                  {user.name
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    "U"}
                </div>

                <span
                  className="text-xs font-bold"
                  style={{
                    color:
                      "var(--ink)",
                  }}
                >
                  {user.name}
                </span>
              </div>

              <button
                onClick={
                  handleAuthAction
                }
                className="text-xs font-semibold px-2 py-2 transition-colors"
                style={{
                  color:
                    "var(--muted)",
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={
                handleAuthAction
              }
              className="group relative overflow-hidden text-xs font-black px-5 py-2.5 rounded-xl text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              style={{
                background:
                  "var(--saffron)",
              }}
            >
              <span className="relative z-10">
                Sign in
              </span>

              <span className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-[var(--saffron-dk)]" />
            </button>
          )}
        </div>

        {/* MOBILE */}

        <button
          onClick={() =>
            setMobileOpen(
              !mobileOpen
            )
          }
          className="md:hidden w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-1.5"
          style={{
            background:
              "var(--panel)",
            border:
              "1px solid var(--border)",
          }}
          aria-label="Toggle menu"
        >
          <span
            className="w-5 h-0.5 rounded-full transition-all duration-300"
            style={{
              background:
                "var(--ink)",
              transform:
                mobileOpen
                  ? "rotate(45deg) translate(3px,3px)"
                  : "none",
            }}
          />

          <span
            className="w-5 h-0.5 rounded-full transition-all duration-300"
            style={{
              background:
                "var(--ink)",
              opacity:
                mobileOpen
                  ? 0
                  : 1,
            }}
          />

          <span
            className="w-5 h-0.5 rounded-full transition-all duration-300"
            style={{
              background:
                "var(--ink)",
              transform:
                mobileOpen
                  ? "rotate(-45deg) translate(3px,-3px)"
                  : "none",
            }}
          />
        </button>
      </div>

      {/* MOBILE MENU */}

      {mobileOpen && (
        <div
          className="md:hidden animate-slide-down"
          style={{
            borderTop:
              "1px solid var(--border)",
            background:
              "var(--panel)",
          }}
        >
          <div className="px-5 py-5 space-y-2">

            {navItems.map(
              (item) => {
                const active =
                  activeTab ===
                  item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleNavigation(
                        item.id
                      )
                    }
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{
                      color: active
                        ? "var(--saffron)"
                        : "var(--ink)",
                      background:
                        active
                          ? "var(--saffron-lt)"
                          : "transparent",
                    }}
                  >
                    {item.label}
                  </button>
                );
              }
            )}

            <div
              className="pt-4 mt-3"
              style={{
                borderTop:
                  "1px solid var(--border)",
              }}
            >
              {user?.loggedIn ? (
                <button
                  onClick={
                    handleAuthAction
                  }
                  className="w-full py-3 rounded-xl text-sm font-bold"
                  style={{
                    background:
                      "var(--red-lt)",
                    color:
                      "var(--red)",
                  }}
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={
                    handleAuthAction
                  }
                  className="w-full py-3 rounded-xl text-sm font-black text-white"
                  style={{
                    background:
                      "var(--saffron)",
                  }}
                >
                  Sign in
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-4 pt-3">
              <span
                className="text-xs font-semibold"
                style={{
                  color:
                    "var(--muted)",
                }}
              >
                Appearance
              </span>

              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;


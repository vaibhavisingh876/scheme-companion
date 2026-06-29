import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import ThemeToggle from "../ThemeToggle";

const Navbar = ({ activeTab, onTabChange }) => {
  const { user, logout } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleAuthAction = () => {
    if (user?.loggedIn) {
      logout();
    } else {
      onTabChange("auth");
    }
    setMobileOpen(false);
  };

  const navItems = [
    { id: "landing", label: "Home" },
    { id: "search", label: "Find Schemes" },
    { id: "saved", label: "Bookmarks" },
  ];

  return (
    <nav
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--nav-bg)",
      }}
      className="sticky top-0 z-50 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => onTabChange("landing")}
          className="flex items-center gap-2 shrink-0"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
            style={{ background: "var(--saffron)" }}
          >
            SC
          </div>
          <span className="text-sm font-black tracking-tight" style={{ color: "var(--ink)" }}>
            Scheme<span style={{ color: "var(--saffron)" }}>Companion</span>
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="relative px-4 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  color: isActive ? "var(--saffron)" : "var(--muted)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ background: "var(--saffron)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {user?.loggedIn ? (
            <>
              <div
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full"
                style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                  style={{ background: "var(--saffron)" }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span
                  className="text-xs font-semibold pr-1"
                  style={{ color: "var(--ink)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {user.name}
                </span>
              </div>
              <button
                onClick={handleAuthAction}
                className="text-xs font-semibold transition-colors"
                style={{ color: "var(--muted)" }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={handleAuthAction}
              className="text-xs font-bold px-5 py-2 rounded-lg transition-all"
              style={{
                background: "var(--saffron)",
                color: "#fff",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Sign in
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
          aria-label="Toggle menu"
        >
          <span
            className="w-5 h-0.5 rounded-full transition-all"
            style={{
              background: "var(--ink)",
              transform: mobileOpen ? "rotate(45deg) translate(3px,3px)" : "none",
            }}
          />
          <span
            className="w-5 h-0.5 rounded-full transition-all"
            style={{
              background: "var(--ink)",
              opacity: mobileOpen ? 0 : 1,
            }}
          />
          <span
            className="w-5 h-0.5 rounded-full transition-all"
            style={{
              background: "var(--ink)",
              transform: mobileOpen ? "rotate(-45deg) translate(3px,-3px)" : "none",
            }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t animate-fade-in"
          style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        >
          <div className="px-5 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Theme
              </span>
              <ThemeToggle />
            </div>

            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  color: activeTab === item.id ? "var(--saffron)" : "var(--ink)",
                  background: activeTab === item.id ? "var(--saffron-lt)" : "transparent",
                }}
              >
                {item.label}
              </button>
            ))}

            <div className="pt-2 border-t mt-2" style={{ borderColor: "var(--border)" }}>
              {user?.loggedIn ? (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {user.name}
                  </span>
                  <button
                    onClick={handleAuthAction}
                    className="text-xs font-semibold"
                    style={{ color: "var(--red)" }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAuthAction}
                  className="w-full text-center py-2.5 rounded-lg text-sm font-bold"
                  style={{ background: "var(--saffron)", color: "#fff" }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
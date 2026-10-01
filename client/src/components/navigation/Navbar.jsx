import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";

const NAV_ITEMS = [
  { id: "landing", label: "Home" },
  { id: "search", label: "Find Schemes" },
  { id: "saved", label: "Saved" },
];

const Wordmark = () => (
  <span className="brand__word">
    Scheme<b>Companion</b>
  </span>
);

const Navbar = ({ activeTab, onTabChange }) => {
  const { user, logout } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (tab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const handleAuthAction = () => {
    if (user?.loggedIn) logout();
    else onTabChange("auth");
    setMobileOpen(false);
  };

  return (
    <nav className="nav">
      <div className="container container--wide nav__inner">
        <button className="brand" onClick={() => go("landing")} aria-label="Scheme Companion — home">
          <span className="brand__mark">
            <img src="/logo.png" alt="" />
          </span>
          <Wordmark />
        </button>

        <div className="nav__links">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className="nav__link"
              aria-current={activeTab === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="nav__right">
          {user?.loggedIn ? (
            <>
              <span className="user-chip">
                <span className="user-chip__avatar">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="8" r="3.25" />
                    <path d="M5.5 19c.45-3.1 2.75-4.8 6.5-4.8s6.05 1.7 6.5 4.8" />
                  </svg>
                </span>
                <span className="user-chip__name">{user.name}</span>
              </span>
              <button className="btn btn--ghost desktop-only" onClick={handleAuthAction}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn btn--primary desktop-only" onClick={handleAuthAction}>
              Sign in
            </button>
          )}

          <button
            className="nav__burger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className={`nav__mobile ${mobileOpen ? "is-open" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={activeTab === item.id ? "is-active" : ""}
            onClick={() => go(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button onClick={handleAuthAction}>
          {user?.loggedIn ? "Sign out" : "Sign in"}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

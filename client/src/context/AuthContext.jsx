import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import { getBookmarks } from "../services/api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(
    () => localStorage.getItem("token") || null
  );

  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem("token");
    const savedEmail = localStorage.getItem("userEmail");

    if (savedToken && savedEmail) {
      return {
        loggedIn: true,
        name: savedEmail.split("@")[0],
      };
    }

    return null;
  });

  const [savedSchemesList, setSavedSchemesList] = useState([]);

  // ─────────────────────────────────────
  // FETCH BOOKMARKS
  // ─────────────────────────────────────

  const fetchUserBookmarks = useCallback(async () => {
    if (!token) {
      setSavedSchemesList([]);
      return;
    }

    try {
      const data = await getBookmarks();

      setSavedSchemesList(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      console.error("Failed to sync bookmarks:", err);

      // If token is invalid/expired
      if (err.response?.status === 401) {
        console.warn("Invalid token. Logging out.");

        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");

        setTokenState(null);
        setUser(null);
        setSavedSchemesList([]);

        return;
      }

      setSavedSchemesList([]);
    }
  }, [token]);

  // ─────────────────────────────────────
  // SET TOKEN AFTER LOGIN
  // ─────────────────────────────────────

  const setToken = useCallback((newToken, email = null) => {
    if (!newToken) {
      localStorage.removeItem("token");
      localStorage.removeItem("userEmail");

      setTokenState(null);
      setUser(null);
      setSavedSchemesList([]);

      return;
    }

    localStorage.setItem("token", newToken);

    if (email) {
      localStorage.setItem("userEmail", email);
    }

    setTokenState(newToken);

    const savedEmail =
      email ||
      localStorage.getItem("userEmail") ||
      "User";

    setUser({
      loggedIn: true,
      name: savedEmail.split("@")[0],
    });
  }, []);

  // ─────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");

    setTokenState(null);
    setUser(null);
    setSavedSchemesList([]);
  }, []);

  // ─────────────────────────────────────
  // LOAD BOOKMARKS AFTER LOGIN
  // ─────────────────────────────────────

  useEffect(() => {
    if (token) {
      fetchUserBookmarks();
    } else {
      setSavedSchemesList([]);
    }
  }, [token, fetchUserBookmarks]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        setToken,
        logout,
        savedSchemesList,
        fetchUserBookmarks,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
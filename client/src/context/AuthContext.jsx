import React, { createContext, useState, useEffect, useCallback } from "react";
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
      return { loggedIn: true, name: savedEmail.split("@")[0] };
    }
    return null;
  });

  const [savedSchemesList, setSavedSchemesList] = useState([]);

  const fetchUserBookmarks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getBookmarks();
      setSavedSchemesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to sync bookmarks", err);
      setSavedSchemesList([]);
    }
  }, [token]);

  const setToken = useCallback((newToken) => {
    if (newToken) {
      setTokenState(newToken);
      localStorage.setItem("token", newToken);
      const savedEmail = localStorage.getItem("userEmail") || "User";
      setUser({ loggedIn: true, name: savedEmail.split("@")[0] });
    } else {
      setTokenState(null);
      localStorage.removeItem("token");
      setUser(null);
      setSavedSchemesList([]);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setTokenState(null);
    setUser(null);
    setSavedSchemesList([]);
  }, []);

  useEffect(() => {
    if (token) fetchUserBookmarks();
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
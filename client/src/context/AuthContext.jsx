import React, { createContext, useState, useEffect, useCallback } from "react";
import { getBookmarks, logoutUser } from "../services/api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem("token");
    const savedEmail = localStorage.getItem("userEmail");
    if (savedToken && savedEmail) {
      return { loggedIn: true, name: savedEmail.split("@")[0] };
    }
    return null;
  });

  const [savedSchemesList, setSavedSchemesList] = useState([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  const fetchUserBookmarks = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingBookmarks(true);
      const data = await getBookmarks();
      setSavedSchemesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to sync bookmarks", err);
      setSavedSchemesList([]);
    } finally {
      setLoadingBookmarks(false);
    }
  }, [token]);

  const setToken = useCallback((newToken) => {
    if (newToken) {
      setTokenState(newToken);
      const savedEmail = localStorage.getItem("userEmail") || "User";
      setUser({ loggedIn: true, name: savedEmail.split("@")[0] });
    } else {
      setTokenState(null);
      setUser(null);
      setSavedSchemesList([]);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();                // calls backend logout, clears tokens
    setToken(null);                    // clear state & localStorage (already done in logoutUser but also clear here)
    setUser(null);
    setSavedSchemesList([]);
  }, [setToken]);

  // Listen to forced logout event from interceptor
  useEffect(() => {
    const handleForceLogout = () => {
      setToken(null);
      setUser(null);
      setSavedSchemesList([]);
    };
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, [setToken]);

  useEffect(() => {
    if (token) fetchUserBookmarks();
  }, [token, fetchUserBookmarks]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        setToken,
        logout,
        savedSchemesList,
        setSavedSchemesList,
        fetchUserBookmarks,
        loadingBookmarks,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
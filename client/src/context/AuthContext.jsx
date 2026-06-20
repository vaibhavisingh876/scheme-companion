import React, { createContext, useState, useEffect } from 'react';
import { getBookmarks } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [savedSchemesList, setSavedSchemesList] = useState([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      const savedEmail = localStorage.getItem('userEmail') || "User";
      setUser({ loggedIn: true, name: savedEmail.split('@')[0] });
      fetchUserBookmarks();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('userEmail');
      setUser(null);
      setSavedSchemesList([]);
    }
  }, [token]);

  const fetchUserBookmarks = async () => {
    try {
      setLoadingBookmarks(true);

      const data = await getBookmarks();

      console.log("BOOKMARK API RESPONSE:", data);

      setSavedSchemesList(data);
    } catch (err) {
      console.error("Failed to sync bookmarks from database context:", err);
    } finally {
      setLoadingBookmarks(false);
    }
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, setToken, savedSchemesList, setSavedSchemesList, fetchUserBookmarks, logout, loadingBookmarks }}>
      {children}
    </AuthContext.Provider>
  );
};
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
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  const fetchUserBookmarks = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingBookmarks(true);

      const data = await getBookmarks();

      console.log("BOOKMARK API RESPONSE:", data);

      setSavedSchemesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(
        "Failed to sync bookmarks from database context:",
        err
      );

      setSavedSchemesList([]);
    } finally {
      setLoadingBookmarks(false);
    }
  }, [token]);

  const setToken = useCallback((newToken) => {
    if (newToken) {
      localStorage.setItem("token", newToken);

      const savedEmail =
        localStorage.getItem("userEmail") || "User";

      setTokenState(newToken);

      setUser({
        loggedIn: true,
        name: savedEmail.split("@")[0],
      });
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("userEmail");

      setTokenState(null);
      setUser(null);
      setSavedSchemesList([]);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
  }, [setToken]);

  useEffect(() => {
    if (token) {
      fetchUserBookmarks();
    }
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
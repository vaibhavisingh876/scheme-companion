import axios from "axios";

const API_URL = "http://localhost:5000/api";

// ── Auth tokens management ────────────────────────────────────────────────
const getAccessToken = () => localStorage.getItem("token");
const getRefreshToken = () => localStorage.getItem("refreshToken");
const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem("token", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
};
const clearTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
};

// ── Axios instance with interceptor ────────────────────────────────────────
const api = axios.create({ baseURL: API_URL });

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: on 401, try to refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          if (data.success) {
            setTokens(data.accessToken, data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          // refresh failed → force logout
          clearTokens();
          window.dispatchEvent(new Event("auth:logout"));
          return Promise.reject(refreshError);
        }
      }
      // no refresh token → force logout
      clearTokens();
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

// ── Auth API ────────────────────────────────────────────────────────────────
export const loginUser = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  if (response.data.success) {
    setTokens(response.data.accessToken, response.data.refreshToken);
    localStorage.setItem("userEmail", email);
  }
  return response.data;
};

export const registerUser = async (email, password) => {
  const response = await api.post("/auth/register", { email, password });
  return response.data;
};

export const logoutUser = async () => {
  try {
    await api.post("/auth/logout");
  } catch (e) {
    console.warn("Logout backend call failed", e);
  } finally {
    clearTokens();
    localStorage.removeItem("userEmail");
  }
};

export const verifyEmail = async (token) => {
  const response = await api.get(`/auth/verify-email?token=${token}`);
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (token, newPassword) => {
  const response = await api.post("/auth/reset-password", { token, newPassword });
  return response.data;
};

// ── Bookmarks API ──────────────────────────────────────────────────────────
export const getBookmarks = async () => {
  const response = await api.get("/bookmarks");
  return response.data;
};

export const addBookmark = async (schemeId) => {
  const response = await api.post("/bookmarks", { schemeId });
  return response.data;
};

export const removeBookmark = async (schemeId) => {
  const response = await api.delete(`/bookmarks/${schemeId}`);
  return response.data;
};

// ── Schemes API ────────────────────────────────────────────────────────────
export const getPaginatedSchemes = async (page = 1, limit = 6) => {
  const response = await api.get(`/schemes?page=${page}&limit=${limit}`);
  return response.data;
};

export const searchSchemes = async (filters) => {
  const response = await api.post("/schemes/search", filters);
  return response.data;
};

// ── AI API ─────────────────────────────────────────────────────────────────
export const getAIRecommendations = async (message) => {
  const response = await api.post("/ai/extract-profile", { message });
  return response.data;
};
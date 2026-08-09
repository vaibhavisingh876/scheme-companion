import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not configured");
}
const api = axios.create({
  baseURL: API_URL,
});

// Attach token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// ── Auth ─────────────────────────────────
export const loginUser = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (email, password) => {
  const response = await api.post("/auth/register", { email, password });
  return response.data;
};

// ── Bookmarks ────────────────────────────
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

// ── Schemes ──────────────────────────────
export const getPaginatedSchemes = async (page = 1, limit = 6) => {
  const response = await api.get(`/schemes?page=${page}&limit=${limit}`);
  return response.data;
};

export const searchSchemes = async (filters) => {
  const response = await api.post("/schemes/search", filters);
  return response.data;
};

// ── AI ───────────────────────────────────
export const getAIRecommendations = async (message) => {
  const response = await api.post("/ai/extract-profile", { message });
  return response.data;
};
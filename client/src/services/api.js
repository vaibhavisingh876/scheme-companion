import axios from 'axios';

const API_URL = "http://localhost:5000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const loginUser = async (email, password) => {
  const response = await axios.post(`${API_URL}/auth/login`, { email, password });
  return response.data;
};

export const registerUser = async (email, password) => {
  const response = await axios.post(`${API_URL}/auth/register`, { email, password });
  return response.data;
};

export const getBookmarks = async () => {
  const response = await axios.get(`${API_URL}/bookmarks`, getAuthHeaders());
  return response.data;
};

export const addBookmark = async (schemeId) => {
  const response = await axios.post(`${API_URL}/bookmarks`, { schemeId }, getAuthHeaders());
  return response.data;
};
export const removeBookmark = async (schemeId) => {
  const response = await axios.delete(
    `${API_URL}/bookmarks/${schemeId}`,
    getAuthHeaders()
  );

  return response.data;
};
export const getPaginatedSchemes = async (page = 1, limit = 6) => {
  try {
    const response = await axios.get(`${API_URL}/schemes?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error("API Engine Error:", error);
    throw error;
  }
};
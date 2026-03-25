/**
 * GreenSwing API Client
 * Handles all frontend ↔ backend communication
 * Manages JWT tokens, API calls, and error handling
 */

const API = (() => {
  const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api'
    : '/api';

  const TOKEN_KEY = 'greenswing_token';
  const USER_KEY = 'greenswing_user';

  // ===== Token Management =====
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
  }

  // ===== HTTP Helper =====
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        // Token expired → redirect to login
        if (response.status === 401 || response.status === 403) {
          clearAuth();
          if (!window.location.pathname.includes('login')) {
            window.location.href = '/pages/login.html?expired=true';
          }
        }
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        console.warn('API unavailable, using local mode');
        return null; // Allow frontend to work without backend
      }
      throw err;
    }
  }

  // ===== Auth API =====
  const auth = {
    async register(data) {
      const result = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (result) {
        setToken(result.token);
        setUser(result.user);
      }
      return result;
    },

    async login(email, password) {
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (result) {
        setToken(result.token);
        setUser(result.user);
      }
      return result;
    },

    async getProfile() {
      return await request('/auth/me');
    },

    async updateProfile(data) {
      const result = await request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (result?.user) setUser(result.user);
      return result;
    },

    logout() {
      clearAuth();
      window.location.href = '/index.html';
    }
  };

  // ===== Scores API =====
  const scores = {
    async getAll() {
      return await request('/scores');
    },

    async add(score, roundDate) {
      return await request('/scores', {
        method: 'POST',
        body: JSON.stringify({ score, round_date: roundDate })
      });
    },

    async update(id, score) {
      return await request(`/scores/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ score })
      });
    },

    async remove(id) {
      return await request(`/scores/${id}`, {
        method: 'DELETE'
      });
    }
  };

  // ===== Draws API =====
  const draws = {
    async getCurrent() {
      return await request('/draws/current');
    },

    async getHistory() {
      return await request('/draws/history');
    },

    async getResults(drawId) {
      return await request(`/draws/${drawId}/results`);
    },

    async getMyResults() {
      return await request('/draws/my/results');
    }
  };

  // ===== Subscriptions API =====
  const subscriptions = {
    async getPlans() {
      return await request('/subscriptions/plans');
    },

    async checkout(planId) {
      return await request('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId })
      });
    },

    async create(planId) {
      return await request('/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId })
      });
    },

    async getStatus() {
      return await request('/subscriptions/status');
    },

    async cancel() {
      return await request('/subscriptions/cancel', {
        method: 'PUT'
      });
    }
  };

  // ===== Charities API =====
  const charities = {
    async getAll(search, category) {
      let query = '/charities?';
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (category) query += `category=${encodeURIComponent(category)}`;
      return await request(query);
    },

    async get(id) {
      return await request(`/charities/${id}`);
    },

    async select(charityId) {
      return await request('/charities/select', {
        method: 'PUT',
        body: JSON.stringify({ charity_id: charityId })
      });
    },

    async getDonationHistory() {
      return await request('/charities/donations/history');
    }
  };

  // ===== Winners API =====
  const winners = {
    async getMy() {
      return await request('/winners/my');
    },

    async uploadProof(winnerId, proofData) {
      return await request(`/winners/${winnerId}/proof`, {
        method: 'POST',
        body: JSON.stringify(proofData)
      });
    }
  };

  // ===== Admin API =====
  const admin = {
    async getAnalytics() {
      return await request('/admin/analytics');
    },

    async getUsers(page = 1, perPage = 20, search = '') {
      let query = `/admin/users?page=${page}&per_page=${perPage}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      return await request(query);
    },

    async runDraw() {
      return await request('/admin/draws/run', { method: 'POST' });
    },

    async publishDraw(drawId) {
      return await request(`/admin/draws/${drawId}/publish`, { method: 'PUT' });
    },

    async getPendingWinners() {
      return await request('/admin/winners/pending');
    },

    async verifyWinner(winnerId, status) {
      return await request(`/admin/winners/${winnerId}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
    },

    async payWinner(winnerId) {
      return await request(`/admin/winners/${winnerId}/pay`, { method: 'PUT' });
    },

    async addCharity(data) {
      return await request('/admin/charities', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async updateCharity(id, data) {
      return await request(`/admin/charities/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async deleteCharity(id) {
      return await request(`/admin/charities/${id}`, { method: 'DELETE' });
    }
  };

  // ===== Route Guards =====
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = '/pages/login.html';
      return false;
    }
    return true;
  }

  function requireAdmin() {
    if (!isLoggedIn() || !isAdmin()) {
      window.location.href = '/pages/login.html';
      return false;
    }
    return true;
  }

  return {
    auth,
    scores,
    draws,
    subscriptions,
    charities,
    winners,
    admin,
    getUser,
    isLoggedIn,
    isAdmin,
    requireAuth,
    requireAdmin
  };
})();

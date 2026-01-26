const API_BASE = '/api';

export async function fetchApi(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Dashboard API
export const dashboardApi = {
    getOverview: () => fetchApi('/dashboard/overview'),
};

// Courses API
export const coursesApi = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/courses${query ? `?${query}` : ''}`);
    },
    getById: (id) => fetchApi(`/courses/${id}`),
};

// Users API
export const usersApi = {
    search: (query, page = 1, limit = 10) =>
        fetchApi(`/users/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
    getGrades: (userId) => fetchApi(`/users/${userId}/grades`),
};

// Logs API
export const logsApi = {
    getLoginActivity: (days = 7) => fetchApi(`/logs/login-activity?days=${days}`),
    getRecent: (limit = 50) => fetchApi(`/logs/recent?limit=${limit}`),
};

// Reports API
export const reportsApi = {
    getAll: () => fetchApi('/reports'),
    getById: (id) => fetchApi(`/reports/${id}`),
    create: (report) =>
        fetchApi('/reports', {
            method: 'POST',
            body: JSON.stringify(report),
        }),
    update: (id, report) =>
        fetchApi(`/reports/${id}`, {
            method: 'PUT',
            body: JSON.stringify(report),
        }),
    delete: (id) =>
        fetchApi(`/reports/${id}`, {
            method: 'DELETE',
        }),
    execute: (sql, limit = 100) =>
        fetchApi('/reports/execute', {
            method: 'POST',
            body: JSON.stringify({ sql, limit }),
        }),
};

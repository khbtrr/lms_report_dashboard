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
    getRecentActivity: (limit = 10) => fetchApi(`/logs/recent-activity?limit=${limit}`),
};

// Reports API
export const reportsApi = {
    getUserStatistics: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/user-statistics${query ? `?${query}` : ''}`);
    },
    getTeacherActivity: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/teacher-activity${query ? `?${query}` : ''}`);
    },
    getStudentActivity: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/student-activity${query ? `?${query}` : ''}`);
    },
    getCourseActivity: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/course-activity${query ? `?${query}` : ''}`);
    },
    getTeacherCompliance: () => {
        return fetchApi('/reports/teacher-compliance');
    },
    getExecutiveSummary: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/executive-summary${query ? `?${query}` : ''}`);
    },
    getTeacherDetailMaster: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/teacher-detail-master${query ? `?${query}` : ''}`);
    },
    getTeacherDetail: (id, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/teacher-detail/${id}${query ? `?${query}` : ''}`);
    },
    getStudentDetailMaster: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/student-detail-master${query ? `?${query}` : ''}`);
    },
    getStudentDetail: (id, params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchApi(`/reports/student-detail/${id}${query ? `?${query}` : ''}`);
    },
};



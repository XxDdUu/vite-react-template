import api from './api';

export const UserService = {
    getMe: async () => {
        const response = await api.get('/api/auth/me');
        return response.data;
    },
    
    getStats: async (userId) => {
        const response = await api.get(`/api/user/${userId}/stats`);
        return response.data;
    },
    getLeaderboard: async () => {
        const response = await api.get('/api/user/leaderboard');
        return response.data;
    },

    updateRainbowName: async (enabled) => {
        const response = await api.patch('/api/user/me/rainbow-name', {
            rainbowNameEnabled: Boolean(enabled)
        });
        return response.data;
    },

    getAdminRainbowStatuses: async () => {
        try {
            const response = await api.get('/api/user/admins/rainbow-status');
            return response.data;
        } catch (err) {
            console.warn('Could not fetch admin rainbow statuses:', err);
            return [];
        }
    }
};

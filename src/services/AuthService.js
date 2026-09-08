import axios from 'axios';
import api, { getApiBaseUrl } from './api';

const BASE_URL = '/api/auth';

export const AuthService = {
    isTokenExpired: (token) => {
        const payload = AuthService.parseToken(token);
        if (!payload) return true;

        const now = Date.now() / 1000;
        return payload.exp < now;
    },
    refreshToken: async () => {
        const response = await axios.post(`${getApiBaseUrl()}${BASE_URL}/refresh`, {}, {
            withCredentials: true
        });
        const token = response.data.token || response.data.accessToken;
        if (token) {
            localStorage.setItem("accessToken", token);
        }
        return response.data;
    },
    getValidToken: async () => {
        let token = localStorage.getItem("accessToken");

        if (!token || token === "undefined" || token === "null") {
            localStorage.removeItem("accessToken");
            return null;
        }

        if (AuthService.isTokenExpired(token)) {
            try {
                const res = await AuthService.refreshToken();
                token = res.token || res.accessToken;
                if (token) {
                    localStorage.setItem("accessToken", token);
                } else {
                    localStorage.removeItem("accessToken");
                    return null;
                }
            } catch (err) {
                localStorage.removeItem("accessToken");
                return null;
            }
        }

        return token;
    },
    

    login: async (email, password) => {
        const response = await api.post(`${BASE_URL}/login`, { email, password }, {
            withCredentials: true
        });

        const token = response.data.token || response.data.accessToken;
        if (token) {
            localStorage.setItem("accessToken", token);
        }

        return response.data;
    },

    
    register: async (username, email, password, confirmPassword, countryCode) => {
        const response = await api.post(`${BASE_URL}/register`, {
            username, email, password, confirmPassword, countryCode
        });
        return response.data;
    },

    verifyOTP: async (email, otp) => {
        const response = await api.post(`${BASE_URL}/verify-otp`, { email, otp });
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await api.post(`${BASE_URL}/forgot-password`, { email });
        return response.data;
    },

    resetPassword: async (email, otp, newPassword) => {
        const response = await api.post(`${BASE_URL}/reset-password`, { email, otp, newPassword });
        return response.data;
    },

    googleLogin: async (idToken) => {
        const response = await api.post(`${BASE_URL}/google`, 
            { idToken }, 
            { withCredentials: true }
        );
        const token = response.data.token || response.data.accessToken;
        if (token) {
            localStorage.setItem("accessToken", token);
        }
        return response.data;
    },

    parseToken: (token) => {
        if (!token || token === 'undefined' || token === 'null') return null;
        try {
            const base64Url = token.split('.')[1];
            if (!base64Url) return null;
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }
    
    // Note: The original java code opened standard OAuth URLs. 
    // In React this is better managed with @react-oauth/google if needed.
    // getGoogleClientId: () => import.meta.env.VITE_GOOGLE_CLIENT_ID
};


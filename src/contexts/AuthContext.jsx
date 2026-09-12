import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { socketClient } from '../services/SocketService';

export const AuthState = {
    LOADING: 'LOADING',
    AUTHENTICATED: 'AUTHENTICATED',
    UNAUTHENTICATED: 'UNAUTHENTICATED'
};

const AuthContext = createContext({
    authState: AuthState.LOADING,
    isLoading: true,
    isAuthenticated: false,
    isBanned: false,
    user: null,
    token: null,
    login: async () => {},
    googleLogin: async () => {},
    logout: () => {},
    checkAuth: async () => {},
    setUser: () => {}
});

export const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState(AuthState.LOADING);
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);

    const applyAuthSuccess = useCallback(async (validToken) => {
        const payload = AuthService.parseToken(validToken) || {};
        setToken(validToken);
        setUser(payload);
        setAuthState(AuthState.AUTHENTICATED);
        socketClient.connect();

        // Fetch current user details from API to sync live isBanned status
        try {
            const currentUser = await UserService.getMe();
            if (currentUser) {
                setUser(prev => ({ ...prev, ...currentUser }));
            }
        } catch (err) {
            console.debug('Could not fetch getMe in AuthContext:', err);
        }
    }, []);

    const applyUnauthenticated = useCallback(() => {
        localStorage.removeItem('accessToken');
        setToken(null);
        setUser(null);
        setAuthState(AuthState.UNAUTHENTICATED);
        socketClient.disconnect();
    }, []);

    const checkAuth = useCallback(async () => {
        try {
            const validToken = await AuthService.getValidToken();
            if (validToken) {
                applyAuthSuccess(validToken);
                return true;
            } else {
                applyUnauthenticated();
                return false;
            }
        } catch (err) {
            applyUnauthenticated();
            return false;
        }
    }, [applyAuthSuccess, applyUnauthenticated]);

    useEffect(() => {
        checkAuth();

        const handleUnauthEvent = () => {
            applyUnauthenticated();
        };

        window.addEventListener('auth-unauthenticated', handleUnauthEvent);
        return () => {
            window.removeEventListener('auth-unauthenticated', handleUnauthEvent);
        };
    }, [checkAuth, applyUnauthenticated]);

    const login = async (email, password) => {
        const data = await AuthService.login(email, password);
        const newToken = data.token || data.accessToken;
        if (newToken) {
            applyAuthSuccess(newToken);
            return data;
        }
        throw new Error('Đăng nhập thất bại. Không nhận được token.');
    };

    const googleLogin = async (idToken) => {
        const data = await AuthService.googleLogin(idToken);
        const newToken = data.token || data.accessToken;
        if (newToken) {
            applyAuthSuccess(newToken);
            return data;
        }
        throw new Error('Đăng nhập bằng Google thất bại.');
    };

    const logout = () => {
        applyUnauthenticated();
    };

    const value = {
        authState,
        isLoading: authState === AuthState.LOADING,
        isAuthenticated: authState === AuthState.AUTHENTICATED,
        isBanned: Boolean(user?.isBanned || user?.is_banned),
        user,
        token,
        login,
        googleLogin,
        logout,
        checkAuth,
        setUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

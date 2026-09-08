import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import MainMenu from './pages/MainMenu';
import AIPlay from './pages/AIPlay';
import OnlinePlay from './pages/OnlinePlay';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Leaderboard from './pages/Leaderboard';
import Tournaments from './pages/Tournaments';
import TournamentLobby from './pages/TournamentLobby';
import TournamentBreak from './pages/TournamentBreak';
import TournamentDetail from './pages/TournamentDetail';
import AdminDashboard from './pages/AdminDashboard';
import Replay from './pages/Replay';
import ReplayPage from './pages/ReplayPage';
import { AuthService } from './services/AuthService';
import { UserService } from './services/UserService';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './index.css';

import { socketClient } from './services/SocketService';
import { setAdminRainbowStatus, setAllAdminRainbowStatuses } from './components/AdminDisplayName';

// PrivateRoute wrapper using reactive AuthContext
const PrivateRoute = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
                <div>Đang kiểm tra đăng nhập...</div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Root route redirect component
const RootRedirect = () => {
    const { isLoading, isAuthenticated } = useAuth();
    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
                <div>Đang tải...</div>
            </div>
        );
    }
    return isAuthenticated ? <Navigate to="/menu" replace /> : <Navigate to="/login" replace />;
};

const GlobalSocket = ({ children }) => {
    const { token } = useAuth();

    React.useEffect(() => {
        if (token) {
            socketClient.connect();
        }

        // Initialize admin rainbow statuses on application startup
        UserService.getAdminRainbowStatuses()
            .then(statuses => {
                if (Array.isArray(statuses)) {
                    setAllAdminRainbowStatuses(statuses);
                }
            })
            .catch(err => {
                console.debug('Could not load admin rainbow statuses on startup:', err);
            });

        const handleGlobalSocketMessage = (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'ADMIN_DIRECT_MESSAGE') {
                    const currentToken = localStorage.getItem('accessToken');
                    const payload = currentToken ? AuthService.parseToken(currentToken) : null;
                    if (payload && (String(payload.userId) === String(msg.recipientId) || msg.isBroadcast || msg.sendToAll)) {
                        const key = `user_inbox_messages_${payload.userId}`;
                        const inbox = JSON.parse(localStorage.getItem(key) || '[]');
                        if (!inbox.some(m => m.id === msg.id)) {
                            inbox.unshift(msg);
                            localStorage.setItem(key, JSON.stringify(inbox));
                        }
                        window.dispatchEvent(new CustomEvent('admin-direct-message-update', { detail: msg }));
                    }
                } else if (msg.type === 'ADMIN_PROFILE_UPDATED') {
                    // Update admin rainbow status reactively across the entire application
                    const enabled = Boolean(
                        msg.rainbowNameEnabled
                        ?? msg.rainbowEnabled
                        ?? msg.isRainbowNameEnabled
                        ?? msg.enabled
                    );
                    if (msg.adminId != null) {
                        setAdminRainbowStatus(msg.adminId, enabled);
                    }
                    if (msg.userId != null) {
                        setAdminRainbowStatus(msg.userId, enabled);
                    }
                    if (msg.adminUsername) {
                        setAdminRainbowStatus(msg.adminUsername, enabled);
                    }
                    if (msg.username) {
                        setAdminRainbowStatus(msg.username, enabled);
                    }
                }
            } catch {
                // Ignore non-JSON or other socket messages
            }
        };

        socketClient.addListener(handleGlobalSocketMessage);
        return () => {
            socketClient.removeListener(handleGlobalSocketMessage);
        };
    }, [token]);
    return children;
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    <GlobalSocket>
                        <Routes>
                            <Route path="/" element={<RootRedirect />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route
                                path="/menu"
                                element={
                                    <PrivateRoute>
                                        <MainMenu />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/play-ai"
                                element={
                                    <PrivateRoute>
                                        <AIPlay />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/play-online"
                                element={
                                    <PrivateRoute>
                                        <OnlinePlay />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <PrivateRoute>
                                        <Profile />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/replay"
                                element={
                                    <PrivateRoute>
                                        <ReplayPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/friends"
                                element={
                                    <PrivateRoute>
                                        <Friends />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/leaderboard"
                                element={
                                    <PrivateRoute>
                                        <Leaderboard />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/tournaments"
                                element={
                                    <PrivateRoute>
                                        <Tournaments />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/tournaments/detail/:tournamentId"
                                element={
                                    <PrivateRoute>
                                        <TournamentDetail />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/tournaments/lobby/:tournamentId"
                                element={
                                    <PrivateRoute>
                                        <TournamentLobby />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/tournaments/break/:tournamentId"
                                element={
                                    <PrivateRoute>
                                        <TournamentBreak />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/admin"
                                element={
                                    <PrivateRoute>
                                        <AdminDashboard />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/replay/:gameId"
                                element={
                                    <PrivateRoute>
                                        <Replay />
                                    </PrivateRoute>
                                }
                            />
                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/login" replace />} />
                        </Routes>
                    </GlobalSocket>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;

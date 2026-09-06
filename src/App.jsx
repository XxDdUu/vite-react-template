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
import { ThemeProvider } from './contexts/ThemeContext';
import { useEffect, useState } from "react";
import './index.css';

import { socketClient } from './services/SocketService';

// Simple PrivateRoute wrapper
const PrivateRoute = ({ children }) => {
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkToken = async () => {
            const t = await AuthService.getValidToken();
            setToken(t);
            setLoading(false);
            if (t) {
                socketClient.connect();
            }
        };

        checkToken();
    }, []);

    if (loading) return <div>Loading...</div>;

    return token ? children : <Navigate to="/login" />;
};

const GlobalSocket = ({ children }) => {
    React.useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            socketClient.connect(token);
        }

        const handleGlobalSocketMessage = (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'ADMIN_DIRECT_MESSAGE') {
                    const currentToken = localStorage.getItem('accessToken');
                    const payload = currentToken ? AuthService.parseToken(currentToken) : null;
                    if (payload && String(payload.userId) === String(msg.recipientId)) {
                        const key = `user_inbox_messages_${payload.userId}`;
                        const inbox = JSON.parse(localStorage.getItem(key) || '[]');
                        if (!inbox.some(m => m.id === msg.id)) {
                            inbox.unshift(msg);
                            localStorage.setItem(key, JSON.stringify(inbox));
                        }
                        window.dispatchEvent(new CustomEvent('admin-direct-message-update', { detail: msg }));
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
    }, []);
    return children;
};
function App() {
    const token = localStorage.getItem('accessToken');
    return (
        <ThemeProvider>
            <Router>
                <GlobalSocket>
                    <Routes>
                        <Route path="/" element={token ? <Navigate to="/menu" /> : <Navigate to="/login" />} />
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
                        <Route path="*" element={<Navigate to="/login" />} />
                    </Routes>
                </GlobalSocket>
            </Router>
        </ThemeProvider>
    );
}

export default App;

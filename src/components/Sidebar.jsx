import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { socketClient } from '../services/SocketService';
import ThemeCustomizer from './ThemeCustomizer';
import friendsIcon from '../assets/friends.svg';

export default function Sidebar({ username }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [userRating, setUserRating] = useState(localStorage.getItem('rating') ? Number(localStorage.getItem('rating')) : null);
    const [displayUsername, setDisplayUsername] = useState(username || localStorage.getItem('username') || 'Khách');
    const [sidebarAvatar, setSidebarAvatar] = useState('👤');
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        localStorage.removeItem('rating');
        localStorage.removeItem('countryCode');
        socketClient.disconnect();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const token = localStorage.getItem('accessToken');
    const payload = token ? AuthService.parseToken(token) : null;
    const isAdmin = payload?.role === 'ROLE_ADMIN';

    const toggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar_collapsed', String(next));
            return next;
        });
    };

    const handleNavClick = (path) => (e) => {
        e.preventDefault();
        setIsMobileOpen(false);
        navigate(path);
    };

    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (username) {
            setDisplayUsername(username);
        } else {
            const saved = localStorage.getItem('username');
            if (saved) setDisplayUsername(saved);
        }
    }, [username]);

    useEffect(() => {
        const fetchUserStats = async () => {
            if (payload && payload.userId) {
                try {
                    const stats = await UserService.getStats(payload.userId);
                    if (stats) {
                        setUserRating(stats.rating);
                        localStorage.setItem('rating', String(stats.rating));
                        if (stats.username) {
                            setDisplayUsername(stats.username);
                            localStorage.setItem('username', stats.username);
                        }
                        if (stats.countryCode) {
                            localStorage.setItem('countryCode', stats.countryCode);
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch sidebar user stats:", err);
                }
            }
        };
        fetchUserStats();
    }, [payload?.userId]);

    useEffect(() => {
        const loadAvatar = () => {
            if (payload?.userId) {
                const saved = localStorage.getItem(`chess-avatar-${payload.userId}`);
                if (saved) {
                    setSidebarAvatar(saved);
                } else {
                    setSidebarAvatar('👤');
                }
            }
        };
        
        loadAvatar();
        window.addEventListener('profile-update', loadAvatar);
        return () => window.removeEventListener('profile-update', loadAvatar);
    }, [payload?.userId]);

    return (
        <>
            {/* Mobile Top Header Bar (< 768px) */}
            <div className="mobile-topbar">
                <button 
                    className="mobile-menu-btn" 
                    onClick={() => setIsMobileOpen(true)} 
                    aria-label="Open navigation menu"
                >
                    ☰
                </button>
                <div className="mobile-logo" onClick={() => navigate('/menu')} style={{ cursor: 'pointer' }}>
                    <h2>Alpha<span>One</span></h2>
                </div>
                <div className="mobile-avatar" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
                    {sidebarAvatar}
                </div>
            </div>

            {/* Backdrop for Mobile Drawer */}
            {isMobileOpen && (
                <div 
                    className="sidebar-mobile-backdrop" 
                    onClick={() => setIsMobileOpen(false)} 
                />
            )}

            {/* Sidebar Container */}
            <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <h2>Alpha<span>One</span></h2>
                    </div>
                    <button 
                        className="collapse-toggle-btn" 
                        onClick={toggleCollapse} 
                        title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
                        aria-label="Toggle desktop sidebar"
                    >
                        {isCollapsed ? '»' : '«'}
                    </button>
                    <button 
                        className="mobile-close-btn" 
                        onClick={() => setIsMobileOpen(false)} 
                        title="Đóng thanh bên"
                        aria-label="Close mobile sidebar"
                    >
                        ✕
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <a 
                        href="#" 
                        className={`nav-item ${isActive('/menu') ? 'active' : ''}`}
                        onClick={handleNavClick('/menu')}
                        title="Chơi"
                    >
                        <span className="icon" style={{ color: isActive('/menu') ? '#3b82f6' : '#d1d5db' }}>♟️</span>
                        <span className="nav-text">Chơi</span>
                    </a>
                    <a 
                        href="#" 
                        className={`nav-item ${isActive('/tournaments') ? 'active' : ''}`}
                        onClick={handleNavClick('/tournaments')}
                        title="Giải đấu"
                    >
                        <span className="icon">🏆</span>
                        <span className="nav-text">Giải đấu</span>
                    </a>
                    <a 
                        href="#" 
                        className={`nav-item ${isActive('/leaderboard') ? 'active' : ''}`}
                        onClick={handleNavClick('/leaderboard')}
                        title="Bảng xếp hạng"
                    >
                        <span className="icon">📊</span>
                        <span className="nav-text">Bảng xếp hạng</span>
                    </a>
                    <a 
                        href="#" 
                        className={`nav-item ${isActive('/friends') ? 'active' : ''}`}
                        onClick={handleNavClick('/friends')}
                        title="Bạn bè"
                    >
                        <span className="icon">
                            <img src={friendsIcon} alt="Friends" style={{ width: '24px', height: '24px' }} />
                        </span>
                        <span className="nav-text">Bạn bè</span>
                    </a>
                    {isAdmin && (
                        <a 
                            href="#" 
                            className={`nav-item ${isActive('/admin') ? 'active' : ''}`}
                            onClick={handleNavClick('/admin')}
                            title="Admin"
                        >
                            <span className="icon">🛡️</span>
                            <span className="nav-text">Admin</span>
                        </a>
                    )}
                </nav>

                <div className="sidebar-bottom">
                    <div className="search-bar">
                        <span className="icon">🔍</span>
                        <input type="text" placeholder="Tìm kiếm" className="search-input" />
                    </div>
                    <div className="user-profile" onClick={handleNavClick('/profile')} style={{ cursor: 'pointer' }}>
                        <div className="avatar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.25rem' }}>
                            {sidebarAvatar}
                        </div>
                        <div className="user-details" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, marginLeft: '10px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{displayUsername}</span>
                            {userRating !== null && (
                                <span className="user-rating" style={{ fontSize: '0.75rem', color: '#81b64c', fontWeight: 'bold', marginTop: '2px' }}>⭐ {userRating} ELO</span>
                            )}
                        </div>
                    </div>
                    <ThemeCustomizer />
                    <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
                        <span className="icon">🚪</span>
                        <span className="logout-text">Đăng xuất</span>
                    </button>
                </div>
            </div>
        </>
    );
}

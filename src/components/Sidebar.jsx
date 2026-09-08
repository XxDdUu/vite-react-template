import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { AdminService } from '../services/AdminService';
import { socketClient } from '../services/SocketService';
import { useAuth } from '../contexts/AuthContext';

import ThemeCustomizer from './ThemeCustomizer';
import AdminDisplayName, { checkIsAdmin } from './AdminDisplayName';
import AdminMessageInboxModal from './AdminMessageInboxModal';

import friendsIcon from '../assets/friends.svg';

export default function Sidebar({ username }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const token = localStorage.getItem('accessToken');
    const payload = token ? AuthService.parseToken(token) : null;
    const tokenUsername = payload?.username || payload?.preferred_username || payload?.sub;

    const [userRating, setUserRating] = useState(() => {
        const rating = localStorage.getItem('rating');
        return rating ? Number(rating) : null;
    });

    const [displayUsername, setDisplayUsername] = useState(
        username || localStorage.getItem('username') || tokenUsername || 'Khách'
    );

    const [sidebarAvatar, setSidebarAvatar] = useState('👤');

    const [isCollapsed, setIsCollapsed] = useState(
        () => localStorage.getItem('sidebar_collapsed') === 'true'
    );

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isInboxOpen, setIsInboxOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // =========================
    // Authentication
    // =========================

    const isAdmin = Boolean(
        checkIsAdmin(payload, displayUsername)
        || checkIsAdmin(payload?.role, payload?.username || displayUsername)
        || payload?.isAdmin === true
        || (Array.isArray(payload?.roles) && payload.roles.some((role) => checkIsAdmin(role)))
        || (Array.isArray(payload?.authorities) && payload.authorities.some((authority) => checkIsAdmin(authority?.authority || authority)))
    );

    // =========================
    // Navigation
    // =========================

    const isActive = (path) => location.pathname === path;

    const handleNavClick = (path) => (e) => {
        e.preventDefault();

        setIsMobileOpen(false);
        navigate(path);
    };

    const handleLogout = () => {
        localStorage.removeItem('username');
        localStorage.removeItem('rating');
        localStorage.removeItem('countryCode');

        logout();
        navigate('/login');
    };

    const toggleCollapse = () => {
        setIsCollapsed((prev) => {
            const next = !prev;

            localStorage.setItem(
                'sidebar_collapsed',
                String(next)
            );

            return next;
        });
    };

    // =========================
    // Close mobile sidebar
    // =========================

    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    // =========================
    // Admin inbox
    // =========================

    const fetchUnreadCount = async () => {
        if (!payload?.userId) {
            setUnreadCount(0);
            return;
        }

        try {
            const msgs = await AdminService.getUserInbox(payload.userId);

            const unread = msgs.filter(
                (message) => !message.read
            ).length;

            setUnreadCount(unread);
        } catch (err) {
            console.error(
                'Failed to check admin inbox messages:',
                err
            );
        }
    };

    useEffect(() => {
        fetchUnreadCount();

        const handleMsgUpdate = () => {
            fetchUnreadCount();
        };

        window.addEventListener(
            'admin-direct-message-update',
            handleMsgUpdate
        );

        window.addEventListener(
            'admin-inbox-updated',
            handleMsgUpdate
        );

        return () => {
            window.removeEventListener(
                'admin-direct-message-update',
                handleMsgUpdate
            );

            window.removeEventListener(
                'admin-inbox-updated',
                handleMsgUpdate
            );
        };
    }, [payload?.userId]);

    // =========================
    // Username
    // =========================

    useEffect(() => {
        if (username) {
            setDisplayUsername(username);
            return;
        }

        const savedUsername = localStorage.getItem('username');

        if (savedUsername) {
            setDisplayUsername(savedUsername);
        }
    }, [username]);

    // =========================
    // User stats
    // =========================

    useEffect(() => {
        const fetchUserStats = async () => {
            if (!payload?.userId) {
                return;
            }

            try {
                const stats = await UserService.getStats(
                    payload.userId
                );

                if (!stats) {
                    return;
                }

                if (stats.rating !== undefined && stats.rating !== null) {
                    setUserRating(stats.rating);

                    localStorage.setItem(
                        'rating',
                        String(stats.rating)
                    );
                }

                if (stats.username) {
                    setDisplayUsername(stats.username);

                    localStorage.setItem(
                        'username',
                        stats.username
                    );
                }

                if (stats.countryCode) {
                    localStorage.setItem(
                        'countryCode',
                        stats.countryCode
                    );
                }
            } catch (err) {
                console.error(
                    'Failed to fetch sidebar user stats:',
                    err
                );
            }
        };

        fetchUserStats();
    }, [payload?.userId]);

    // =========================
    // Avatar
    // =========================

    useEffect(() => {
        const loadAvatar = () => {
            if (!payload?.userId) {
                setSidebarAvatar('👤');
                return;
            }

            const savedAvatar = localStorage.getItem(
                `chess-avatar-${payload.userId}`
            );

            setSidebarAvatar(savedAvatar || '👤');
        };

        loadAvatar();

        window.addEventListener(
            'profile-update',
            loadAvatar
        );

        return () => {
            window.removeEventListener(
                'profile-update',
                loadAvatar
            );
        };
    }, [payload?.userId]);

    // =========================
    // Render
    // =========================

    return (
        <>
            {/* =====================================
                Mobile Top Header
            ====================================== */}

            <div className="mobile-topbar">
                <button
                    className="mobile-menu-btn"
                    onClick={() => setIsMobileOpen(true)}
                    aria-label="Open navigation menu"
                >
                    ☰
                </button>

                <div
                    className="mobile-logo"
                    onClick={() => navigate('/menu')}
                    style={{ cursor: 'pointer' }}
                >
                    <h2>
                        Alpha<span>One</span>
                    </h2>
                </div>

                <div
                    className="mobile-avatar"
                    onClick={() => navigate('/profile')}
                    style={{ cursor: 'pointer' }}
                >
                    {sidebarAvatar}
                </div>
            </div>

            {/* =====================================
                Mobile Backdrop
            ====================================== */}

            {isMobileOpen && (
                <div
                    className="sidebar-mobile-backdrop"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* =====================================
                Sidebar
            ====================================== */}

            <div
                className={`sidebar ${
                    isCollapsed ? 'collapsed' : ''
                } ${
                    isMobileOpen ? 'mobile-open' : ''
                }`}
            >
                {/* =================================
                    Sidebar Header
                ================================== */}

                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <h2>
                            Alpha<span>One</span>
                        </h2>
                    </div>

                    <button
                        className="collapse-toggle-btn"
                        onClick={toggleCollapse}
                        title={
                            isCollapsed
                                ? 'Mở rộng thanh bên'
                                : 'Thu gọn thanh bên'
                        }
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

                {/* =================================
                    Navigation
                ================================== */}

                <nav className="sidebar-nav">

                    {/* Chơi */}

                    <a
                        href="#"
                        className={`nav-item ${
                            isActive('/menu') ? 'active' : ''
                        }`}
                        onClick={handleNavClick('/menu')}
                        title="Chơi"
                    >
                        <span
                            className="icon"
                            style={{
                                color: isActive('/menu')
                                    ? '#3b82f6'
                                    : '#d1d5db'
                            }}
                        >
                            ♟️
                        </span>

                        <span className="nav-text">
                            Chơi
                        </span>
                    </a>

                    {/* Giải đấu */}

                    <a
                        href="#"
                        className={`nav-item ${
                            isActive('/tournaments') ? 'active' : ''
                        }`}
                        onClick={handleNavClick('/tournaments')}
                        title="Giải đấu"
                    >
                        <span className="icon">
                            🏆
                        </span>

                        <span className="nav-text">
                            Giải đấu
                        </span>
                    </a>

                    {/* Bảng xếp hạng */}

                    <a
                        href="#"
                        className={`nav-item ${
                            isActive('/leaderboard') ? 'active' : ''
                        }`}
                        onClick={handleNavClick('/leaderboard')}
                        title="Bảng xếp hạng"
                    >
                        <span className="icon">
                            📊
                        </span>

                        <span className="nav-text">
                            Bảng xếp hạng
                        </span>
                    </a>

                    {/* Bạn bè */}

                    <a
                        href="#"
                        className={`nav-item ${
                            isActive('/friends') ? 'active' : ''
                        }`}
                        onClick={handleNavClick('/friends')}
                        title="Bạn bè"
                    >
                        <span className="icon">
                            <img
                                src={friendsIcon}
                                alt="Friends"
                                style={{
                                    width: '24px',
                                    height: '24px'
                                }}
                            />
                        </span>

                        <span className="nav-text">
                            Bạn bè
                        </span>
                    </a>

                    {/* Tin nhắn */}

                    <a
                        href="#"
                        className="nav-item"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsInboxOpen(true);
                        }}
                        title="Hộp thư thông báo"
                    >
                        <span
                            className="icon"
                            style={{
                                position: 'relative'
                            }}
                        >
                            🔔
                        </span>

                        <span className="nav-text">
                            Tin nhắn
                        </span>

                        {unreadCount > 0 && (
                            <span
                                style={{
                                    marginLeft: 'auto',
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    fontSize: '0.68rem',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    fontWeight: 'bold'
                                }}
                            >
                                {unreadCount}
                            </span>
                        )}
                    </a>

                    {/* Admin */}

                    {isAdmin && (
                        <a
                            href="#"
                            className={`nav-item ${
                                isActive('/admin')
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={handleNavClick('/admin')}
                            title="Admin"
                        >
                            <span className="icon">
                                🛡️
                            </span>

                            <span className="nav-text">
                                Admin
                            </span>
                        </a>
                    )}
                </nav>

                {/* =================================
                    Sidebar Bottom
                ================================== */}

                <div className="sidebar-bottom">

                    {/* Search */}

                    <div className="search-bar">
                        <span className="icon">
                            🔍
                        </span>

                        <input
                            type="text"
                            placeholder="Tìm kiếm"
                            className="search-input"
                        />
                    </div>

                    {/* User Profile */}

                    <div
                        className="user-profile"
                        onClick={handleNavClick('/profile')}
                        style={{ cursor: 'pointer' }}
                    >
                        {/* Avatar */}

                        {isAdmin ? (
                            <div className="admin-avatar-rainbow-ring">
                                <div
                                    className="avatar"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        fontSize: '1.25rem'
                                    }}
                                >
                                    {sidebarAvatar}
                                </div>
                            </div>
                        ) : (
                            <div
                                className="avatar"
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    fontSize: '1.25rem'
                                }}
                            >
                                {sidebarAvatar}
                            </div>
                        )}

                        {/* User information */}

                        <div
                            className="user-details"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                minWidth: 0,
                                flex: '1 1 auto',
                                marginLeft: '10px'
                            }}
                        >
                            <AdminDisplayName
                                username={displayUsername}
                                userId={payload?.userId}
                                role={payload?.role}
                                isAdmin={isAdmin}
                                showBadge={false}
                                size="sm"
                                className="sidebar-admin-name"
                                style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}
                                nameStyle={{
                                    display: 'block',
                                    minWidth: 0,
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: '600',
                                    fontSize: '0.85rem'
                                }}
                            />

                            {userRating !== null && (
                                <span
                                    className="user-rating"
                                    style={{
                                        fontSize: '0.75rem',
                                        color: '#81b64c',
                                        fontWeight: 'bold',
                                        marginTop: '2px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    ⭐ {userRating} ELO
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Theme */}

                    <div
                        className="sidebar-theme-customizer"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <ThemeCustomizer />
                    </div>

                    {/* Logout */}

                    <button
                        className="logout-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                        }}
                        title="Đăng xuất"
                    >
                        <span className="icon">
                            🚪
                        </span>

                        <span className="logout-text">
                            Đăng xuất
                        </span>
                    </button>
                </div>
            </div>

            {/* =====================================
                Admin Message Inbox Modal
            ====================================== */}

            <AdminMessageInboxModal
                userId={payload?.userId}
                isOpen={isInboxOpen}
                onClose={() => setIsInboxOpen(false)}
                onRefreshCount={fetchUnreadCount}
            />
        </>
    );
}

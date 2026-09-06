import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { AdminService } from '../services/AdminService';
import { socketClient } from '../services/SocketService';
import ThemeCustomizer from './ThemeCustomizer';
import AdminDisplayName, { AdminRainbowCircle } from './AdminDisplayName';
import AdminMessageInboxModal from './AdminMessageInboxModal';
import friendsIcon from '../assets/friends.svg';

export default function Sidebar({ username }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [userRating, setUserRating] = useState(localStorage.getItem('rating') ? Number(localStorage.getItem('rating')) : null);
    const [displayUsername, setDisplayUsername] = useState(username || localStorage.getItem('username') || 'Khách');
    const [sidebarAvatar, setSidebarAvatar] = useState('👤');
    const [isInboxOpen, setIsInboxOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

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

    const fetchUnreadCount = async () => {
        if (payload?.userId) {
            try {
                const msgs = await AdminService.getUserInbox(payload.userId);
                setUnreadCount(msgs.filter(m => !m.read).length);
            } catch (err) {
                console.error('Failed to check admin inbox messages:', err);
            }
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        const handleMsgUpdate = () => fetchUnreadCount();
        window.addEventListener('admin-direct-message-update', handleMsgUpdate);
        window.addEventListener('admin-inbox-updated', handleMsgUpdate);
        return () => {
            window.removeEventListener('admin-direct-message-update', handleMsgUpdate);
            window.removeEventListener('admin-inbox-updated', handleMsgUpdate);
        };
    }, [payload?.userId]);

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
        <div className="sidebar">
            <div className="sidebar-logo">
                <h2>Alpha<span>One</span></h2>
            </div>
            <nav className="sidebar-nav">
                <a 
                    href="#" 
                    className={`nav-item ${isActive('/menu') ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigate('/menu'); }}
                >
                    <span className="icon" style={{ color: isActive('/menu') ? '#3b82f6' : '#d1d5db' }}>♟️</span> Chơi
                </a>
                <a 
                    href="#" 
                    className={`nav-item ${isActive('/tournaments') ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigate('/tournaments'); }}
                >
                    <span className="icon">🏆</span> Giải đấu
                </a>
                <a 
                    href="#" 
                    className={`nav-item ${isActive('/leaderboard') ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigate('/leaderboard'); }}
                >
                    <span className="icon">📊</span> Bảng xếp hạng
                </a>
                <a 
                    href="#" 
                    className={`nav-item ${isActive('/friends') ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigate('/friends'); }}
                >
                    <span className="icon">
                        <img src={friendsIcon} alt="Friends" style={{ width: '24px', height: '24px' }} />
                    </span> Bạn bè
                </a>
                <a 
                    href="#" 
                    className="nav-item"
                    onClick={(e) => { e.preventDefault(); setIsInboxOpen(true); }}
                    title="Hộp thư thông báo"
                >
                    <span className="icon" style={{ position: 'relative' }}>
                        🔔
                        {unreadCount > 0 && (
                            <span className="notification-badge-bubble">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </span>
                    <span>Tin nhắn</span>
                    {unreadCount > 0 && (
                        <span style={{
                            marginLeft: 'auto',
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontWeight: 'bold'
                        }}>
                            {unreadCount}
                        </span>
                    )}
                </a>
                {isAdmin && (
                    <a 
                        href="#" 
                        className={`nav-item ${isActive('/admin') ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); navigate('/admin'); }}
                    >
                        <span className="icon">🛡️</span> Admin
                    </a>
                )}
            </nav>
            <div className="sidebar-bottom">
                <div className="search-bar">
                    <span className="icon">🔍</span>
                    <input type="text" placeholder="Tìm kiếm" />
                </div>
                <div className="user-profile">
                    {isAdmin ? (
                        <div className="admin-avatar-rainbow-ring">
                            <div className="avatar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.25rem' }}>
                                {sidebarAvatar}
                            </div>
                        </div>
                    ) : (
                        <div className="avatar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.25rem' }}>
                            {sidebarAvatar}
                        </div>
                    )}
                    <div className="user-details" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, marginLeft: '10px' }}>
                        <AdminDisplayName
                            username={displayUsername}
                            role={payload?.role}
                            isAdmin={isAdmin}
                            showBadge={false}
                            size="sm"
                            nameStyle={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600', fontSize: '0.85rem' }}
                        />
                        {userRating !== null && (
                            <span className="user-rating" style={{ fontSize: '0.75rem', color: '#81b64c', fontWeight: 'bold', marginTop: '2px' }}>⭐ {userRating} ELO</span>
                        )}
                    </div>
                </div>
                <ThemeCustomizer />
                <button className="logout-btn" onClick={handleLogout}>
                    <span className="icon">🚪</span> Đăng xuất
                </button>
            </div>

            <AdminMessageInboxModal
                userId={payload?.userId}
                isOpen={isInboxOpen}
                onClose={() => setIsInboxOpen(false)}
                onRefreshCount={fetchUnreadCount}
            />
        </div>
    );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserService } from '../services/UserService';
import { FriendService } from '../services/FriendService';
import { socketClient } from '../services/SocketService';
import { AuthService } from '../services/AuthService';
import '../index.css';
import Sidebar from '../components/Sidebar';
import friendsIcon from '../assets/friends.svg';
import PendingFriendModal from '../components/friend/PendingFriendModal';
import SearchFriendModal from '../components/friend/SearchFriendModal';
import AdminDisplayName, { checkIsAdmin } from '../components/AdminDisplayName';

export default function Friends() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [friends, setFriends] = useState([]);
    const [pending, setPending] = useState([]);
    const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('Khách');
    const [openRemoveDropdown, setOpenRemoveDropdown] = useState(null);
    const [loadingId, setLoadingId] = useState(null);

    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');

    // Profile modal state
    const [selectedPlayerStats, setSelectedPlayerStats] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const handlePlayerClick = async (playerId) => {
        try {
            setProfileLoading(true);
            const stats = await UserService.getStats(playerId);
            setSelectedPlayerStats(stats);
        } catch (e) {
            console.error("Failed to load player profile stats", e);
        } finally {
            setProfileLoading(false);
        }
    };

    const [actionLoading, setActionLoading] = useState(false);

    const handleSendRequest = async (targetId) => {
        if (!user) return;
        try {
            setActionLoading(true);
            await FriendService.sendRequest(user.userId, targetId);
            setSelectedPlayerStats(prev => ({ ...prev, friendshipStatus: 'PENDING_SENT' }));
        } catch (error) {
            console.error("Failed to send request", error);
            alert("Không thể gửi lời mời kết bạn");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptRequest = async (targetId) => {
        if (!user) return;
        try {
            setActionLoading(true);
            await FriendService.acceptRequest(user.userId, targetId);
            setSelectedPlayerStats(prev => ({ ...prev, friendshipStatus: 'ACCEPTED' }));
            const friendsData = await FriendService.getList(user.userId);
            setFriends(friendsData);
            const pendingData = await FriendService.getPending(user.userId);
            setPending(pendingData);
        } catch (error) {
            console.error("Failed to accept request", error);
            alert("Không thể đồng ý kết bạn");
        } finally {
            setActionLoading(false);
        }
    };

    const getFlagEmoji = (code) => {
        if (!code || code.length !== 2) return '🌍';
        if (code === 'VN') return '🇻🇳';
        if (code === 'US') return '🇺🇸';
        try {
            const codeUpper = code.toUpperCase();
            const firstChar = codeUpper.charCodeAt(0) - 65 + 0x1F1E6;
            const secondChar = codeUpper.charCodeAt(1) - 65 + 0x1F1E6;
            return String.fromCodePoint(firstChar, secondChar);
        } catch (e) {
            return '🌍';
        }
    };

    useEffect(() => {
        const handleOutsideClick = () => {
            setOpenRemoveDropdown(null);
        };
        document.addEventListener('click', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, []);

    useEffect(() => {
        const init = async () => {
            const token = await AuthService.getValidToken();
            if (!token) {
                navigate('/login');
                return;
            }

            const payload = AuthService.parseToken(token);
            if (payload) {
                setUsername(payload.username || payload.sub || 'Người chơi');
            }

            await loadData();
        };

        init();

        const handleSocketMessage = (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'USER_ONLINE') {
                    setFriends(prev => prev.map(f => f.userId === msg.userId ? { ...f, status: 'ONLINE' } : f));
                } else if (msg.type === 'USER_OFFLINE') {
                    setFriends(prev => prev.map(f => f.userId === msg.userId ? { ...f, status: 'OFFLINE' } : f));
                }
            } catch (e) {
                console.error("Error parsing presence message", e);
            }
        };

        socketClient.addListener(handleSocketMessage);
        return () => {
            socketClient.removeListener(handleSocketMessage);
        };
    }, [navigate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const userData = await UserService.getMe();
            setUser(userData);

            if (userData?.userId) {
                const friendsData = await FriendService.getList(userData.userId);
                setFriends(Array.isArray(friendsData) ? friendsData : []);

                const pendingData = await FriendService.getPending(userData.userId);
                setPending(Array.isArray(pendingData) ? pendingData : []);

                const leaderboardData = await UserService.getLeaderboard();
                setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
            }
        } catch (error) {
            console.error("Failed to load friends", error);
        } finally {
            setLoading(false);
        }
    };
    const handleRemoveFriend = async (friendId) => {
        try {
            setLoadingId(friendId);
            await FriendService.removeFriend(user.userId, friendId);
            setFriends(prev => prev.filter(f => f.userId !== friendId));
            setLoadingId(null);
        } catch (error) {
            console.error("Failed to remove friend", error);
            alert("Không thể hủy kết bạn");
            setLoadingId(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        socketClient.disconnect();
        navigate('/login');
    };

    const handleAcceptSuccess = (senderId) => {
        const acceptedUser = pending.find(p => p.userId === senderId || p.senderId === senderId);
        setPending(prev => prev.filter(p => p.userId !== senderId && p.senderId !== senderId));
        if (acceptedUser) {
            setFriends(prev => [...prev, { ...acceptedUser, status: 'ONLINE' }]);
        }
    };

    if (loading) {
        return (
            <div className="main-menu-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="loader"></div>
            </div>
        );
    }

    return (
        <div className="main-menu-wrapper">
            <Sidebar username={username} />

            {/* Main Content Area */}
            <div className="friends-content">
                <div className="friends-main-col">
                    <div className="friends-header">
                        <img src={friendsIcon} alt="Friends" style={{ width: '32px', height: '32px' }} />
                        <h1>Bạn bè</h1>
                    </div>

                    {/* Action Grid */}
                    <div className="friends-actions-grid">
                        <div className="friend-action-btn" onClick={() => setIsSearchModalOpen(true)}>
                            <div className="friend-action-content">
                                <span className="icon">👤+</span>
                                <span>Tìm bạn mới</span>
                            </div>
                            <span>&gt;</span>
                        </div>
                        <div className="friend-action-btn" onClick={() => setIsPendingModalOpen(true)}>
                            <div className="friend-action-content">
                                <span className="icon">📨</span>
                                <span>Lời mời kết bạn</span>
                                {pending.length > 0 && (
                                    <span className="pending-badge">{pending.length}</span>
                                )}
                            </div>
                            <span>&gt;</span>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="friends-search-container">
                        <span className="friends-search-icon">🔍</span>
                        <input
                            type="text"
                            className="friends-search-input"
                            placeholder="Tìm theo tên hoặc tên người dùng"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Friends List */}
                    <div className="friends-list-container">
                        <div className="friends-list-header">
                            <span style={{ fontWeight: 600 }}>Bạn bè <span style={{ color: '#8b92a5', marginLeft: '5px' }}>{friends.length}</span></span>
                            <span style={{ fontSize: '0.8rem', color: '#8b92a5', cursor: 'pointer' }}>Truy cập gần đây nhất ▾</span>
                        </div>

                        <div className="friends-list">
                            {friends.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#8b92a5' }}>
                                    Không có bạn bè nào để hiển thị
                                </div>
                            ) : (
                                friends
                                    .filter(f => f.username.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(friend => (
                                        <div key={friend.userId} className="friend-item">
                                            <div className="friend-info" onClick={() => handlePlayerClick(friend.userId)} style={{ cursor: 'pointer' }}>
                                                <div className={`friend-avatar ${checkIsAdmin(friend.role, friend.username) ? 'admin-avatar-rainbow-ring' : ''}`} style={{ borderRadius: '50%' }}>
                                                    {friend.username.charAt(0).toUpperCase()}
                                                    <div style={{
                                                        position: 'absolute', bottom: '2px', right: '2px',
                                                        width: '10px', height: '10px',
                                                        background: friend.status === 'ONLINE' ? '#4ade80' : '#8b92a5',
                                                        borderRadius: '50%', border: '2px solid #262626'
                                                    }}></div>
                                                </div>
                                                <div className="friend-details">
                                                    <div className="friend-name-row">
                                                        <AdminDisplayName
                                                            username={friend.username}
                                                            role={friend.role}
                                                            nameStyle={{ fontWeight: 600 }}
                                                        />
                                                        <span className="flag">🇻🇳</span>
                                                    </div>
                                                    <span className="friend-status-text">
                                                        {friend.status === 'ONLINE' ? 'Đang trực tuyến' : 'Ngoại tuyến'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="friend-actions" style={{ position: 'relative' }}>
                                                <span className="friend-action-icon" title="Thách đấu">⚔️</span>
                                                <span className="friend-action-icon" title="Nhắn tin">✉️</span>
                                                <span className="friend-action-icon"
                                                    title="Thêm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenRemoveDropdown(openRemoveDropdown === friend.userId ? null : friend.userId);
                                                    }}
                                                >...</span>
                                                {openRemoveDropdown === friend.userId && (
                                                    <div className="friend-dropdown-menu">
                                                        <div 
                                                            className="friend-dropdown-item delete"
                                                            onClick={() => {
                                                                handleRemoveFriend(friend.userId);
                                                                setOpenRemoveDropdown(null);
                                                            }}
                                                        >
                                                            ❌ Hủy kết bạn
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="friends-sidebar-col">
                    {/* Leaderboard Panel */}
                    <div className="leaderboard-panel">
                        <div className="leaderboard-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🏆 Bảng xếp hạng
                            </h3>
                        </div>

                        <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {leaderboard.length === 0 ? (
                                <div style={{ color: '#8b92a5', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
                                    Đang tải bảng xếp hạng...
                                </div>
                            ) : (
                                leaderboard.slice(0, 8).map((player, idx) => (
                                    <div key={player.userId} 
                                    onClick={() => handlePlayerClick(player.userId)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: player.userId === user?.userId ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.01)',
                                        border: player.userId === user?.userId ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        cursor: 'pointer'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{
                                                fontWeight: 'bold',
                                                color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#8b92a5',
                                                fontSize: '0.9rem',
                                                width: '18px'
                                            }}>{idx + 1}</span>
                                            <span style={{
                                                fontWeight: player.userId === user?.userId ? 'bold' : '500',
                                                color: player.userId === user?.userId ? '#818cf8' : '#ffffff',
                                                fontSize: '0.9rem'
                                            }}>{player.username}</span>
                                            {player.countryCode && (
                                                <span style={{ fontSize: '0.8rem' }} title={player.countryCode}>
                                                    {player.countryCode === 'VN' ? '🇻🇳' : player.countryCode === 'US' ? '🇺🇸' : '🌍'}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#a5b4fc' }}>
                                            ⭐ {player.rating}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Suggested Friends */}
                    <div className="leaderboard-panel" style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '15px' }}>Đề xuất bạn bè</h3>
                        <div style={{ textAlign: 'center', padding: '20px', color: '#8b92a5', fontSize: '0.85rem' }}>
                            Không có đề xuất nào hiện tại
                        </div>
                    </div>
                </div>
            </div>

            {user && (
                <PendingFriendModal
                    isOpen={isPendingModalOpen}
                    onClose={() => setIsPendingModalOpen(false)}
                    pending={pending}
                    currentUserId={user.userId}
                    onAcceptSuccess={handleAcceptSuccess}
                />
            )}

            {user && (
                <SearchFriendModal
                    isOpen={isSearchModalOpen}
                    onClose={() => setIsSearchModalOpen(false)}
                    currentUserId={user.userId}
                    onActionSuccess={loadData}
                />
            )}

            {/* Profile Loading Overlay */}
            {profileLoading && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    color: '#ffffff', flexDirection: 'column', gap: '12px'
                }}>
                    <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.05)', borderTop: '4px solid #818cf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>Đang tải thông tin...</span>
                </div>
            )}

            {/* Profile Modal */}
            {selectedPlayerStats && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                    zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    padding: '20px'
                }} onClick={() => setSelectedPlayerStats(null)}>
                    <div style={{
                        background: '#151412',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '520px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        animation: 'profileFadeIn 0.25s ease-out'
                    }} onClick={(e) => e.stopPropagation()}>
                        
                        {/* Header info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className={checkIsAdmin(selectedPlayerStats.role, selectedPlayerStats.username) ? 'admin-avatar-rainbow-ring' : ''} style={{ borderRadius: '50%' }}>
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        fontSize: '2rem', color: '#ffffff', fontWeight: 'bold'
                                    }}>
                                        {selectedPlayerStats.username ? selectedPlayerStats.username.substring(0, 2).toUpperCase() : 'US'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AdminDisplayName
                                            username={selectedPlayerStats.username}
                                            role={selectedPlayerStats.role}
                                            showBadge={selectedPlayerStats.role === 'ROLE_ADMIN'}
                                            nameStyle={{ fontSize: '1.4rem', fontWeight: 'bold' }}
                                        />
                                        <span style={{ fontSize: '1.25rem' }}>{getFlagEmoji(selectedPlayerStats.countryCode)}</span>
                                    </div>
                                    <span style={{ display: 'inline-block', fontSize: '0.85rem', color: '#81b64c', fontWeight: 'bold', marginTop: '4px', background: 'rgba(129, 182, 76, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                        ⭐ {selectedPlayerStats.rating} ELO
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedPlayerStats(null)}
                                style={{
                                    background: 'transparent', border: 'none', color: '#8b92a5',
                                    fontSize: '1.5rem', cursor: 'pointer', outline: 'none'
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Friend Action Button */}
                        {selectedPlayerStats.friendshipStatus && selectedPlayerStats.friendshipStatus !== 'OWNER' && (
                            <div style={{ marginTop: '-8px' }}>
                                {selectedPlayerStats.friendshipStatus === 'NONE' && (
                                    <button 
                                        onClick={() => handleSendRequest(selectedPlayerStats.userId)}
                                        disabled={actionLoading}
                                        style={{
                                            width: '100%',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            padding: '10px 16px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                    >
                                        {actionLoading ? 'Đang gửi...' : '➕ Thêm bạn bè'}
                                    </button>
                                )}
                                {selectedPlayerStats.friendshipStatus === 'PENDING_SENT' && (
                                    <button 
                                        disabled
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            color: '#8b92a5',
                                            padding: '10px 16px',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            cursor: 'default'
                                        }}
                                    >
                                        ⏳ Đã gửi lời mời (Đang chờ)
                                    </button>
                                )}
                                {selectedPlayerStats.friendshipStatus === 'PENDING_RECEIVED' && (
                                    <button 
                                        onClick={() => handleAcceptRequest(selectedPlayerStats.userId)}
                                        disabled={actionLoading}
                                        style={{
                                            width: '100%',
                                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            padding: '10px 16px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                    >
                                        {actionLoading ? 'Đang xử lý...' : '✓ Chấp nhận kết bạn'}
                                    </button>
                                )}
                                {selectedPlayerStats.friendshipStatus === 'ACCEPTED' && (
                                    <div style={{
                                        width: '100%',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                        borderRadius: '8px',
                                        color: '#10b981',
                                        padding: '10px 16px',
                                        fontWeight: '600',
                                        fontSize: '0.9rem',
                                        textAlign: 'center'
                                    }}>
                                        ✓ Bạn bè
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Medal Trophies */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
                            background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '1.5rem' }}>🥇</span>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#fbbf24', fontWeight: 'bold', marginTop: '4px' }}>
                                    {selectedPlayerStats.goldMedals || 0} Vàng
                                </span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '1.5rem' }}>🥈</span>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold', marginTop: '4px' }}>
                                    {selectedPlayerStats.silverMedals || 0} Bạc
                                </span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '1.5rem' }}>🥉</span>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#b45309', fontWeight: 'bold', marginTop: '4px' }}>
                                    {selectedPlayerStats.bronzeMedals || 0} Đồng
                                </span>
                            </div>
                        </div>

                        {/* Match statistics */}
                        <div>
                            <h4 style={{ margin: '0 0 10px 0', color: '#8b92a5', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Thống kê kết quả
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#d1d5db' }}>
                                    <span>Tổng số ván đấu</span>
                                    <strong>{selectedPlayerStats.gamesPlayed || 0} ván</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#d1d5db' }}>
                                    <span>Tỉ lệ thắng</span>
                                    <strong style={{ color: '#81b64c' }}>{(selectedPlayerStats.winRate || 0.0).toFixed(1)}%</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#d1d5db' }}>
                                    <span>Số trận Thắng / Thua / Hòa</span>
                                    <strong>
                                        <span style={{ color: '#81b64c' }}>{selectedPlayerStats.wins || 0}W</span> /&nbsp;
                                        <span style={{ color: '#f87171' }}>{selectedPlayerStats.losses || 0}L</span> /&nbsp;
                                        <span style={{ color: '#94a3b8' }}>{selectedPlayerStats.draws || 0}D</span>
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* Tournament History */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, maxHeight: '180px', overflowY: 'auto' }}>
                            <h4 style={{ margin: '0 0 4px 0', color: '#8b92a5', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Lịch sử giải đấu
                            </h4>
                            {!selectedPlayerStats.tournamentHistory || selectedPlayerStats.tournamentHistory.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: '#8b92a5', margin: 0, textAlign: 'center', padding: '15px' }}>
                                    Chưa tham gia giải đấu nào
                                </p>
                            ) : (
                                selectedPlayerStats.tournamentHistory.map((t, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px',
                                        fontSize: '0.85rem'
                                    }}>
                                        <span style={{ color: '#ffffff', fontWeight: '500' }}>{t.tournamentName}</span>
                                        <span style={{ 
                                            fontWeight: 'bold', 
                                            color: t.rank === 1 ? '#fbbf24' : t.rank === 2 ? '#94a3b8' : t.rank === 3 ? '#b45309' : '#8b92a5'
                                        }}>
                                            Hạng {t.rank}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes profileFadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

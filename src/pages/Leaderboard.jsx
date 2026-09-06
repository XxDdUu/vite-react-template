import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserService } from '../services/UserService';
import { AuthService } from '../services/AuthService';
import '../index.css';
import Sidebar from '../components/Sidebar';
import { FriendService } from '../services/FriendService';
import AdminDisplayName from '../components/AdminDisplayName';

export default function Leaderboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('Khách');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [selectedPlayerStats, setSelectedPlayerStats] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
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
            await loadData();
        } catch (error) {
            console.error("Failed to accept request", error);
            alert("Không thể đồng ý kết bạn");
        } finally {
            setActionLoading(false);
        }
    };

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
    }, [navigate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const userData = await UserService.getMe();
            setUser(userData);

            const leaderboardData = await UserService.getLeaderboard();
            setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
        } catch (error) {
            console.error("Failed to load leaderboard", error);
        } finally {
            setLoading(false);
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

    const handleRowClick = async (playerId) => {
        try {
            setProfileLoading(true);
            const stats = await UserService.getStats(playerId);
            setSelectedPlayerStats(stats);
        } catch (e) {
            console.error("Failed to fetch player stats", e);
        } finally {
            setProfileLoading(false);
        }
    };

    const filteredLeaderboard = leaderboard.filter(player =>
        player.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const topPlayer = leaderboard.length > 0 ? leaderboard[0] : null;
    const totalPlayers = leaderboard.length;
    const avgElo = leaderboard.length > 0 
        ? Math.round(leaderboard.reduce((sum, p) => sum + p.rating, 0) / leaderboard.length) 
        : 1200;

    return (
        <div className="friends-page-wrapper">
            <Sidebar username={username} />
            <div className="friends-content" style={{ flexDirection: 'column', gap: '20px' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '2.5rem' }}>🏆</span>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#ffffff', fontWeight: '800' }}>Bảng xếp hạng</h1>
                            <p style={{ margin: '4px 0 0 0', color: '#8b92a5', fontSize: '0.9rem' }}>Thách đấu các kỳ thủ đứng đầu hệ thống</p>
                        </div>
                    </div>
                    <button 
                        onClick={loadData}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                        🔄 Làm mới
                    </button>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '2rem' }}>🥇</span>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#8b92a5', textTransform: 'uppercase', letterSpacing: '1px' }}>Kỳ thủ số 1</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                {topPlayer ? (
                                    <>
                                        <AdminDisplayName
                                            username={topPlayer.username}
                                            role={topPlayer.role}
                                            nameStyle={{ fontSize: '1.05rem', color: '#fbbf24', fontWeight: 'bold' }}
                                        />
                                        <span style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 'bold' }}>({topPlayer.rating})</span>
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>Chưa có</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '2rem' }}>👥</span>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#8b92a5', textTransform: 'uppercase', letterSpacing: '1px' }}>Tổng số kỳ thủ</span>
                            <strong style={{ display: 'block', fontSize: '1.05rem', color: '#ffffff', marginTop: '2px' }}>{totalPlayers} người chơi</strong>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '2rem' }}>📈</span>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#8b92a5', textTransform: 'uppercase', letterSpacing: '1px' }}>Elo Trung bình</span>
                            <strong style={{ display: 'block', fontSize: '1.05rem', color: '#818cf8', marginTop: '2px' }}>{avgElo} ELO</strong>
                        </div>
                    </div>
                </div>

                {/* Table & Search Panel */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: '400px' }}>
                    
                    {/* Search bar */}
                    <div style={{ display: 'flex', position: 'relative', width: '100%', maxWidth: '360px' }}>
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm kỳ thủ..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: '#ffffff',
                                padding: '10px 14px 10px 36px',
                                fontSize: '0.9rem',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => {
                                e.target.style.border = '1px solid rgba(129, 140, 248, 0.5)';
                                e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                            }}
                            onBlur={(e) => {
                                e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                        />
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b92a5', fontSize: '0.95rem' }}>🔍</span>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '10px', color: '#8b92a5' }}>
                                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid #818cf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                <span style={{ fontSize: '0.9rem' }}>Đang tải bảng xếp hạng...</span>
                            </div>
                        ) : filteredLeaderboard.length === 0 ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#8b92a5', fontSize: '0.9rem' }}>
                                Không tìm thấy người chơi phù hợp
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                        <th style={{ padding: '12px 16px', color: '#8b92a5', fontWeight: '600', fontSize: '0.85rem', width: '80px' }}>HẠNG</th>
                                        <th style={{ padding: '12px 16px', color: '#8b92a5', fontWeight: '600', fontSize: '0.85rem' }}>KỲ THỦ</th>
                                        <th style={{ padding: '12px 16px', color: '#8b92a5', fontWeight: '600', fontSize: '0.85rem', width: '120px' }}>ELO</th>
                                        <th style={{ padding: '12px 16px', color: '#8b92a5', fontWeight: '600', fontSize: '0.85rem', width: '120px' }}>ĐÃ CHƠI</th>
                                        <th style={{ padding: '12px 16px', color: '#8b92a5', fontWeight: '600', fontSize: '0.85rem', width: '120px' }}>TỈ LỆ THẮNG</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeaderboard.map((player, idx) => {
                                        const winRate = player.gamesPlayed > 0 
                                            ? ((player.wins * 100) / player.gamesPlayed).toFixed(1) 
                                            : '0.0';
                                        
                                        const isCurrentUser = player.userId === user?.userId;

                                        return (
                                            <tr key={player.userId} 
                                            onClick={() => handleRowClick(player.userId)}
                                            style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                                background: isCurrentUser ? 'rgba(129, 140, 248, 0.08)' : 'transparent',
                                                transition: 'background 0.2s',
                                                cursor: 'pointer'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isCurrentUser) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isCurrentUser) e.currentTarget.style.background = 'transparent';
                                            }}
                                            >
                                                <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>
                                                    {idx === 0 ? (
                                                        <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '24px', height: '24px', background: '#fbbf24', borderRadius: '50%', color: '#000000', fontSize: '0.75rem' }}>1</span>
                                                    ) : idx === 1 ? (
                                                        <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '24px', height: '24px', background: '#94a3b8', borderRadius: '50%', color: '#000000', fontSize: '0.75rem' }}>2</span>
                                                    ) : idx === 2 ? (
                                                        <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '24px', height: '24px', background: '#b45309', borderRadius: '50%', color: '#ffffff', fontSize: '0.75rem' }}>3</span>
                                                    ) : (
                                                        <span style={{ color: '#8b92a5', paddingLeft: '8px' }}>{idx + 1}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '1.25rem' }}>{getFlagEmoji(player.countryCode)}</span>
                                                        <AdminDisplayName
                                                            username={player.username}
                                                            role={player.role}
                                                            isAdmin={isCurrentUser && (user?.role === 'ROLE_ADMIN' || user?.isAdmin) ? true : undefined}
                                                            nameStyle={{ fontWeight: isCurrentUser ? 'bold' : '500', color: isCurrentUser ? '#818cf8' : '#ffffff' }}
                                                        />
                                                        {isCurrentUser && (
                                                            <span style={{ fontSize: '0.7rem', background: '#818cf8', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>BẠN</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#a5b4fc' }}>⭐ {player.rating}</td>
                                                <td style={{ padding: '14px 16px', color: '#d1d5db' }}>{player.gamesPlayed} ván</td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: '600', color: parseFloat(winRate) >= 50 ? '#81b64c' : '#f87171' }}>{winRate}%</span>
                                                        <span style={{ fontSize: '0.75rem', color: '#8b92a5' }}>({player.wins}W / {player.losses}L)</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

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

            {/* Inline keyframe animation styles */}
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

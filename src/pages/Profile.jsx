import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserService } from '../services/UserService';
import { GameService } from '../services/GameService';
import { FriendService } from '../services/FriendService';
import { MinioService, isImageUrl, formatAvatarUrl } from '../services/MinioService';
import Sidebar from '../components/Sidebar';
import { useTranslation } from '../contexts/I18nContext';
import AdminDisplayName, { checkIsAdmin, setAdminRainbowStatus } from '../components/AdminDisplayName';
import '../index.css';

const countryFlags = {
    'VN': '🇻🇳',
    'US': '🇺🇸',
    'JP': '🇯🇵',
    'GB': '🇬🇧',
    'FR': '🇫🇷',
    'KR': '🇰🇷',
    'DE': '🇩🇪',
    'CN': '🇨🇳'
};

const countryNames = {
    'VN': 'Việt Nam',
    'US': 'Hoa Kỳ',
    'JP': 'Nhật Bản',
    'GB': 'Anh Quốc',
    'FR': 'Pháp',
    'KR': 'Hàn Quốc',
    'DE': 'Đức',
    'CN': 'Trung Quốc'
};

export default function Profile() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState([]);
    const [friendsCount, setFriendsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [rainbowEnabled, setRainbowEnabled] = useState(false);
    const [rainbowLoading, setRainbowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'match-history'); // 'match-history' or 'tournaments'
    
    // Profile info state
    const [profileAvatar, setProfileAvatar] = useState('♟️');
    const [bio, setBio] = useState('');
    const [country, setCountry] = useState('VN');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editBio, setEditBio] = useState('');
    const [editAvatar, setEditAvatar] = useState('♟️');
    const [editCountry, setEditCountry] = useState('VN');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadMsg, setUploadMsg] = useState('');

    // Search Filter States
    const [filterOpponent, setFilterOpponent] = useState('');
    const [filterResult, setFilterResult] = useState('ALL');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    const loadData = async () => {
        try {
            setLoading(true);
            const userData = await UserService.getMe();
            setUser(userData);
            
            if (userData?.userId) {
                const statsData = await UserService.getStats(userData.userId);
                setStats(statsData);
                
                const isRainbow = Boolean(
                    userData?.rainbowNameEnabled
                    ?? userData?.rainbowEnabled
                    ?? userData?.isRainbowNameEnabled
                    ?? statsData?.rainbowNameEnabled
                    ?? statsData?.rainbowEnabled
                    ?? statsData?.isRainbowNameEnabled
                );
                setRainbowEnabled(isRainbow);
                setAdminRainbowStatus(userData.userId, isRainbow);
                if (userData.username) {
                    setAdminRainbowStatus(userData.username, isRainbow);
                }
                
                const historyData = await GameService.getHistory(userData.userId);
                console.log("History Data received:", historyData);
                setHistory(Array.isArray(historyData) ? historyData : []);

                try {
                    const friendsData = await FriendService.getList(userData.userId);
                    setFriendsCount(Array.isArray(friendsData) ? friendsData.length : 0);
                } catch (friendErr) {
                    console.error("Failed to load friends count", friendErr);
                }

                // Load custom profile information
                const savedProfile = localStorage.getItem(`chess-profile-${userData.userId}`);
                if (savedProfile) {
                    try {
                        const parsed = JSON.parse(savedProfile);
                        if (parsed.bio !== undefined) {
                            setBio(parsed.bio);
                            setEditBio(parsed.bio);
                        }
                        if (parsed.avatar !== undefined) {
                            setProfileAvatar(parsed.avatar);
                            setEditAvatar(parsed.avatar);
                            localStorage.setItem(`chess-avatar-${userData.userId}`, parsed.avatar);
                        }
                        if (parsed.countryCode !== undefined) {
                            setCountry(parsed.countryCode);
                            setEditCountry(parsed.countryCode);
                        }
                    } catch (e) {
                        console.error("Failed to parse local profile info:", e);
                    }
                } else {
                    if (statsData?.countryCode) {
                        setCountry(statsData.countryCode);
                        setEditCountry(statsData.countryCode);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRainbowName = async () => {
        if (rainbowLoading) return;
        setRainbowLoading(true);
        const nextStatus = !rainbowEnabled;
        try {
            await UserService.updateRainbowName(nextStatus);
            setRainbowEnabled(nextStatus);
            setUser(prev => prev ? { ...prev, rainbowNameEnabled: nextStatus } : prev);
            if (user?.userId) {
                setAdminRainbowStatus(user.userId, nextStatus);
            }
            if (user?.username) {
                setAdminRainbowStatus(user.username, nextStatus);
            }
        } catch (err) {
            console.error("Failed to toggle rainbow admin name", err);
            alert("Không thể cập nhật tên cầu vồng: " + (err.response?.data?.message || err.message));
        } finally {
            setRainbowLoading(false);
        }
    };

    const handleAvatarFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setUploadMsg('');
        try {
            const res = await MinioService.uploadAvatar(file);
            if (res?.url) {
                setEditAvatar(res.url);
                setUploadMsg(t('profile.uploadSuccess', 'Đã tải ảnh đại diện thành công!'));
            }
        } catch (err) {
            console.error("Failed to upload avatar:", err);
            setUploadMsg(t('profile.uploadError', 'Tải ảnh đại diện thất bại.'));
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!user?.userId) return;
        
        setBio(editBio);
        setProfileAvatar(editAvatar);
        setCountry(editCountry);
        
        localStorage.setItem(`chess-profile-${user.userId}`, JSON.stringify({
            bio: editBio,
            avatar: editAvatar,
            countryCode: editCountry
        }));
        localStorage.setItem(`chess-avatar-${user.userId}`, editAvatar);
        
        try {
            await UserService.updateProfile({
                bio: editBio,
                avatarUrl: editAvatar,
                countryCode: editCountry
            });
        } catch (err) {
            console.warn("API profile update skipped:", err);
        }

        // Dispatch event to sync sidebar avatar
        window.dispatchEvent(new Event('profile-update'));
        setIsEditingProfile(false);
    };

    const handleReplay = (game) => {
        navigate('/replay', { state: { gameData: game } });
    };

    // Helper to calculate win/loss status
    const getGameOutcome = (game) => {
        const isWhite = game.myColor === 'WHITE';
        if (game.result === '1/2-1/2') return { text: `${t('game.drawResult')} 🤝`, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' };
        
        const whiteWon = game.result === '1-0';
        const won = (isWhite && whiteWon) || (!isWhite && !whiteWon);
        
        return won 
            ? { text: `${t('game.win')} 🏆`, color: '#81b64c', bg: 'rgba(129,182,76,0.1)' }
            : { text: `${t('game.loss')} ❌`, color: '#f87171', bg: 'rgba(248,113,113,0.1)' };
    };

    // Parse moves count from PGN string
    const getMovesCount = (pgn) => {
        if (!pgn) return 0;
        const cleanPgn = pgn.replace(/\[.*?\]/g, '').trim();
        const noNumbers = cleanPgn.replace(/\d+\.+/g, ' ');
        const tokens = noNumbers.split(/\s+/).filter(t => t.trim() !== "");
        const results = ["1-0", "0-1", "1/2-1/2", "*"];
        const moves = tokens.filter(t => !results.includes(t));
        return moves.length;
    };

    if (loading) {
        return (
            <div className="main-menu-wrapper" style={{ display: 'flex', background: '#1c1a17', minHeight: '100vh', width: '100vw' }}>
                <div className="lobby-spinner-container">
                    <div className="lobby-pulse-ring"></div>
                    <div className="lobby-spinner"></div>
                </div>
            </div>
        );
    }

    // Filter history based on search sidebar inputs
    const filteredHistory = history.filter(game => {
        const opponent = game.opponentName || "Máy AI 🤖";
        if (filterOpponent && !opponent.toLowerCase().includes(filterOpponent.toLowerCase())) {
            return false;
        }
        if (filterResult !== 'ALL') {
            const outcome = getGameOutcome(game);
            const isWin = outcome.text.includes('Thắng');
            const isLoss = outcome.text.includes('Thua');
            const isDraw = outcome.text.includes('Hòa');
            
            if (filterResult === 'WIN' && !isWin) return false;
            if (filterResult === 'LOSS' && !isLoss) return false;
            if (filterResult === 'DRAW' && !isDraw) return false;
        }
        return true;
    });

    return (
        <div className="main-menu-wrapper" style={{ display: 'flex', background: '#1c1a17', minHeight: '100vh', width: '100vw', color: '#fff', overflow: 'hidden' }}>
            <Sidebar username={user?.username || 'Người chơi'} />

            {/* Main Profile Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }} className="custom-scrollbar">
                
                {/* Chess.com Style Profile Card */}
                <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '6px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', width: '100%', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            {/* Profile Picture */}
                            <div style={{ position: 'relative' }}>
                                <div className={checkIsAdmin(user?.role, user?.username) ? 'admin-avatar-ring' : ''} style={{ borderRadius: '10px' }}>
                                    <div style={{ width: '90px', height: '90px', borderRadius: '8px', background: '#312e2b', border: '1px solid #403d39', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: '#babfc3', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                                        {isImageUrl(profileAvatar) ? (
                                            <img src={formatAvatarUrl(profileAvatar)} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            profileAvatar
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Player info details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <AdminDisplayName
                                        username={user?.username}
                                        role={user?.role}
                                        rainbowNameEnabled={rainbowEnabled}
                                        showBadge={user?.role === 'ROLE_ADMIN'}
                                        size="lg"
                                        nameStyle={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: '"Outfit", sans-serif' }}
                                    />
                                    <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} title={countryNames[country] || 'Quốc gia'}>
                                        {countryFlags[country] || '🌐'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', fontSize: '0.85rem', color: '#babfc3', fontWeight: 'bold', flexWrap: 'wrap' }}>
                                    <span>{t('profile.rating')}: <strong style={{ color: '#81b64c' }}>{stats?.rating || 1200}</strong></span>
                                    <span>•</span>
                                    <span>👥 {friendsCount} {t('friends.title')}</span>
                                    <span>•</span>
                                    <span style={{ color: '#4ade80' }}>{t('profile.wins')}: {stats?.wins || 0}</span>
                                    <span style={{ color: '#f87171' }}>{t('profile.losses')}: {stats?.losses || 0}</span>
                                    <span style={{ color: '#9ca3af' }}>{t('profile.draws')}: {stats?.draws || 0}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                                    {checkIsAdmin(user?.role, user?.username) && (
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            padding: '5px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            width: 'fit-content'
                                        }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#e5e7eb' }}>
                                                {t('profile.rainbowAdmin')}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleToggleRainbowName}
                                                disabled={rainbowLoading}
                                                style={{
                                                    background: rainbowEnabled
                                                        ? 'linear-gradient(135deg, #10b981, #059669)'
                                                        : '#374151',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '4px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '800',
                                                    cursor: rainbowLoading ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: rainbowEnabled ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
                                                }}
                                                title={rainbowEnabled ? 'Off' : 'On'}
                                            >
                                                {rainbowLoading ? '...' : rainbowEnabled ? '[ ON ]' : '[ OFF ]'}
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditBio(bio);
                                            setEditAvatar(profileAvatar);
                                            setEditCountry(country);
                                            setUploadMsg('');
                                            setIsEditingProfile(true);
                                        }}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'linear-gradient(135deg, #81b64c, #64963b)',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(129, 182, 76, 0.3)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        ✏️ {t('profile.bioAndPersonal', 'Chỉnh sửa hồ sơ')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Win Rate & Medals Badges */}
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', minWidth: '90px' }}>
                                <span style={{ fontSize: '0.7rem', color: '#babfc3', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800' }}>{t('profile.winRate')}</span>
                                <strong style={{ fontSize: '1.5rem', color: '#81b64c', marginTop: '4px', fontFamily: '"Outfit", sans-serif' }}>{stats?.winRate || 0}%</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.7rem', color: '#babfc3', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800' }}>{t('profile.medalCount')}</span>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    <span title={t('tournament.gold')}>🥇 {stats?.goldMedals || 0}</span>
                                    <span title={t('tournament.silver')}>🥈 {stats?.silverMedals || 0}</span>
                                    <span title={t('tournament.bronze')}>🥉 {stats?.bronzeMedals || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab selector bar */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '24px', borderBottom: '1px solid #312e2b', paddingBottom: '10px' }}>
                    <button 
                        onClick={() => setActiveTab('match-history')}
                        style={{
                            background: activeTab === 'match-history' ? '#81b64c' : 'transparent',
                            color: activeTab === 'match-history' ? 'white' : '#babfc3',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        ⚔️ {t('profile.matchHistory')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('tournaments')}
                        style={{
                            background: activeTab === 'tournaments' ? '#81b64c' : 'transparent',
                            color: activeTab === 'tournaments' ? 'white' : '#babfc3',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        🏆 {t('nav.tournaments')} & {t('profile.medalCount')}
                    </button>
                </div>

                {/* Tab Content Rendering */}
                {activeTab === 'match-history' ? (
                    /* Lower Layout Section: Match History & Search Sidebar */
                    <div style={{ display: 'flex', gap: '24px', marginTop: '24px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
                        
                        {/* Left Column: Match History List (70%) */}
                        <div style={{ flex: 1.7, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                            
                            {/* Match History Table */}
                            <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: '800', fontFamily: '"Outfit", sans-serif' }}>
                                        {t('profile.matchHistory')} ({filteredHistory.length})
                                    </h3>
                                </div>

                                {filteredHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#62605e', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                        {t('profile.noGames')}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#312e2b' }}>
                                        {/* Table Headers */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr 0.8fr 1.2fr', background: '#1c1a17', padding: '10px 16px', fontSize: '0.75rem', color: '#62605e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <span>{t('profile.players')}</span>
                                            <span style={{ textAlign: 'center' }}>{t('profile.result')}</span>
                                            <span style={{ textAlign: 'center' }}>{t('profile.moves')}</span>
                                            <span style={{ textAlign: 'right' }}>{t('profile.date')}</span>
                                        </div>

                                        {/* Table Body Games Rows */}
                                        {filteredHistory.map((game, idx) => {
                                            const outcome = getGameOutcome(game);
                                            const opponent = game.opponentName || "Máy AI 🤖";
                                            const isWin = outcome.text.includes(t('game.win'));
                                            const isLoss = outcome.text.includes(t('game.loss'));

                                            // Set player color assignments
                                            const isMyColorWhite = game.myColor === 'WHITE';
                                            
                                            // Calculate exact scores based on result
                                            let myScore = '0';
                                            let oppScore = '0';
                                            if (game.result === '1-0') {
                                                if (isMyColorWhite) { myScore = '1'; oppScore = '0'; }
                                                else { myScore = '0'; oppScore = '1'; }
                                            } else if (game.result === '0-1') {
                                                if (isMyColorWhite) { myScore = '0'; oppScore = '1'; }
                                                else { myScore = '1'; oppScore = '0'; }
                                            } else if (game.result === '1/2-1/2') {
                                                myScore = '½';
                                                oppScore = '½';
                                            }

                                            // Badge letter & colors matching Chess.com game history
                                            let badgeBg = '#312e2b';
                                            let badgeColor = '#babfc3';
                                            let badgeSign = '=';
                                            if (isWin) {
                                                badgeBg = 'rgba(129,182,76,0.15)';
                                                badgeColor = '#81b64c';
                                                badgeSign = '+';
                                            } else if (isLoss) {
                                                badgeBg = 'rgba(248,113,113,0.15)';
                                                badgeColor = '#f87171';
                                                badgeSign = '-';
                                            }

                                            return (
                                                <div 
                                                    key={idx} 
                                                    style={{ 
                                                        display: 'grid', 
                                                        gridTemplateColumns: '1.8fr 1.2fr 0.8fr 1.2fr', 
                                                        alignItems: 'center', 
                                                        padding: '12px 16px', 
                                                        background: '#262421', 
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onClick={() => handleReplay(game)}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#2d2b28'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#262421'}
                                                >
                                                    {/* Column 1: Players Detail Rows */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {/* Player Row 1 (Opponent) */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                                            <span style={{ 
                                                                width: '8px', 
                                                                height: '8px', 
                                                                background: isMyColorWhite ? '#000' : '#fff', 
                                                                border: '1px solid #62605e',
                                                                borderRadius: '1px',
                                                                display: 'inline-block' 
                                                            }}></span>
                                                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{opponent}</span>
                                                        </div>

                                                        {/* Player Row 2 (You) */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                                            <span style={{ 
                                                                width: '8px', 
                                                                height: '8px', 
                                                                background: isMyColorWhite ? '#fff' : '#000', 
                                                                border: '1px solid #62605e',
                                                                borderRadius: '1px',
                                                                display: 'inline-block' 
                                                            }}></span>
                                                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{user?.username}</span>
                                                        </div>
                                                    </div>

                                                    {/* Column 2: Game Result Score representation */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: '#babfc3', textAlign: 'right', minWidth: '15px' }}>
                                                            <span>{oppScore}</span>
                                                            <span>{myScore}</span>
                                                        </div>
                                                        <div style={{ 
                                                            width: '24px', 
                                                            height: '24px', 
                                                            borderRadius: '4px', 
                                                            background: badgeBg, 
                                                            color: badgeColor, 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'center', 
                                                            fontWeight: '800', 
                                                            fontSize: '0.8rem' 
                                                        }}>
                                                            {badgeSign}
                                                        </div>
                                                    </div>

                                                    {/* Column 3: Moves count */}
                                                    <div style={{ textFile: 'center', textAlign: 'center', fontSize: '0.85rem', color: '#babfc3', fontWeight: 'bold' }}>
                                                        {getMovesCount(game.pgn)}
                                                    </div>

                                                    {/* Column 4: Date played & Analysis button */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: '#62605e', fontWeight: 'bold' }}>
                                                            {new Date(game.playedAt).toLocaleDateString('vi-VN')}
                                                        </span>
                                                        <button 
                                                            style={{ 
                                                                background: '#312e2b', 
                                                                border: '1px solid #403d39', 
                                                                borderRadius: '4px', 
                                                                color: '#babfc3', 
                                                                fontSize: '0.7rem', 
                                                                padding: '4px 10px', 
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s'
                                                            }}
                                                        >
                                                            {t('profile.viewReplay')}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Right Column: Search & Filter Panel (30%) */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '260px' }}>
                            
                            {/* Search games Card */}
                            <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: '800', fontFamily: '"Outfit", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {t('profile.searchGames')}
                                </h3>

                                {/* Dropdown (Result filter) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.75rem', color: '#62605e', fontWeight: 'bold', textTransform: 'uppercase' }}>{t('profile.filterResult')}</label>
                                    <select 
                                        value={filterResult}
                                        onChange={e => setFilterResult(e.target.value)}
                                        style={{ background: '#312e2b', border: '1px solid #403d39', padding: '10px', borderRadius: '4px', color: 'white', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
                                    >
                                        <option value="ALL">{t('profile.allResults')}</option>
                                        <option value="WIN">{t('game.win')}</option>
                                        <option value="LOSS">{t('game.loss')}</option>
                                        <option value="DRAW">{t('game.drawResult')}</option>
                                    </select>
                                </div>

                                {/* Text Input (Opponent) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.75rem', color: '#62605e', fontWeight: 'bold', textTransform: 'uppercase' }}>{t('game.opponent')}</label>
                                    <input 
                                        type="text"
                                        placeholder={t('profile.filterOpponent')}
                                        value={filterOpponent}
                                        onChange={e => setFilterOpponent(e.target.value)}
                                        style={{ background: '#312e2b', border: '1px solid #403d39', padding: '10px', borderRadius: '4px', color: 'white', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                                    <button 
                                        onClick={() => { setFilterOpponent(''); setFilterResult('ALL'); }}
                                        style={{ 
                                            background: '#312e2b', 
                                            border: '1px solid #403d39', 
                                            padding: '10px', 
                                            borderRadius: '4px', 
                                            color: '#babfc3', 
                                            fontWeight: 'bold', 
                                            fontSize: '0.85rem', 
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            width: '100%'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#403d39'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#312e2b'; e.currentTarget.style.color = '#babfc3'; }}
                                    >
                                        {t('common.reset')}
                                    </button>
                                </div>
                            </div>

                        </div>

                    </div>
                ) : (
                    /* Tab 2: Tournaments and Medals Showcase */
                    <div style={{ display: 'flex', gap: '24px', marginTop: '24px', flex: 1, width: '100%', boxSizing: 'border-box', flexWrap: 'wrap' }}>
                        
                        {/* Tournament History List */}
                        <div style={{ flex: 1.7, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '320px' }}>
                            <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: '800', fontFamily: '"Outfit", sans-serif' }}>
                                    {t('tournament.historyTitle')} ({stats?.tournamentHistory?.length || 0})
                                </h3>

                                {!stats?.tournamentHistory || stats.tournamentHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#62605e', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                        {t('tournament.noTournaments')}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#312e2b' }}>
                                        {/* Table Headers */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr 0.8fr 1.2fr', background: '#1c1a17', padding: '10px 16px', fontSize: '0.75rem', color: '#62605e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <span>{t('tournament.name')}</span>
                                            <span style={{ textAlign: 'center' }}>{t('tournament.score')}</span>
                                            <span style={{ textAlign: 'center' }}>{t('tournament.rank')}</span>
                                            <span style={{ textAlign: 'right' }}>{t('tournament.medal')}</span>
                                        </div>

                                        {/* Table rows */}
                                        {stats.tournamentHistory.map((tItem, idx) => {
                                            let medalLabel = '-';
                                            let medalStyle = { color: '#62605e' };
                                            if (tItem.medal === 'GOLD') {
                                                medalLabel = `🥇 ${t('tournament.gold')}`;
                                                medalStyle = { color: '#f5b041', fontWeight: 'bold' };
                                            } else if (tItem.medal === 'SILVER') {
                                                medalLabel = `🥈 ${t('tournament.silver')}`;
                                                medalStyle = { color: '#cbd5e1', fontWeight: 'bold' };
                                            } else if (tItem.medal === 'BRONZE') {
                                                medalLabel = `🥉 ${t('tournament.bronze')}`;
                                                medalStyle = { color: '#b75a14', fontWeight: 'bold' };
                                            }

                                            return (
                                                <div 
                                                    key={idx} 
                                                    style={{ 
                                                        display: 'grid', 
                                                        gridTemplateColumns: '1.8fr 1.2fr 0.8fr 1.2fr', 
                                                        alignItems: 'center', 
                                                        padding: '14px 16px', 
                                                        background: '#262421',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ fontWeight: 'bold', color: 'white' }}>{tItem.tournamentName}</span>
                                                        <span style={{ fontSize: '0.75rem', color: '#62605e' }}>
                                                            {tItem.startTime ? new Date(tItem.startTime).toLocaleDateString('vi-VN') : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign: 'center', color: '#81b64c', fontWeight: 'bold' }}>
                                                        {tItem.score} {t('tournament.points')}
                                                    </div>
                                                    <div style={{ textAlign: 'center', fontWeight: '800' }}>
                                                        #{tItem.rank}
                                                    </div>
                                                    <div style={{ textAlign: 'right', ...medalStyle }}>
                                                        {medalLabel}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Medal Showcase & Info */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '280px' }}>
                            <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: '800', fontFamily: '"Outfit", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {t('profile.medalCollection')}
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    
                                    {/* Gold Card */}
                                    <div style={{ 
                                        background: 'linear-gradient(135deg, rgba(245, 176, 65, 0.1) 0%, rgba(245, 176, 65, 0.25) 100%)', 
                                        border: '1px solid rgba(245, 176, 65, 0.3)', 
                                        borderRadius: '8px', 
                                        padding: '12px 16px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '2rem' }}>🥇</span>
                                            <div>
                                                <strong style={{ display: 'block', color: '#f5b041', fontSize: '0.9rem' }}>{t('profile.goldChampion')}</strong>
                                                <span style={{ fontSize: '0.75rem', color: '#babfc3' }}>{t('profile.goldDesc')}</span>
                                            </div>
                                        </div>
                                        <strong style={{ fontSize: '1.5rem', color: '#f5b041', fontFamily: '"Outfit", sans-serif' }}>{stats?.goldMedals || 0}</strong>
                                    </div>

                                    {/* Silver Card */}
                                    <div style={{ 
                                        background: 'linear-gradient(135deg, rgba(203, 213, 225, 0.1) 0%, rgba(203, 213, 225, 0.25) 100%)', 
                                        border: '1px solid rgba(203, 213, 225, 0.3)', 
                                        borderRadius: '8px', 
                                        padding: '12px 16px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '2rem' }}>🥈</span>
                                            <div>
                                                <strong style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem' }}>{t('profile.silverRunnerUp')}</strong>
                                                <span style={{ fontSize: '0.75rem', color: '#babfc3' }}>{t('profile.silverDesc')}</span>
                                            </div>
                                        </div>
                                        <strong style={{ fontSize: '1.5rem', color: '#cbd5e1', fontFamily: '"Outfit", sans-serif' }}>{stats?.silverMedals || 0}</strong>
                                    </div>

                                    {/* Bronze Card */}
                                    <div style={{ 
                                        background: 'linear-gradient(135deg, rgba(183, 90, 20, 0.1) 0%, rgba(183, 90, 20, 0.25) 100%)', 
                                        border: '1px solid rgba(183, 90, 20, 0.3)', 
                                        borderRadius: '8px', 
                                        padding: '12px 16px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '2rem' }}>🥉</span>
                                            <div>
                                                <strong style={{ display: 'block', color: '#b75a14', fontSize: '0.9rem' }}>{t('profile.bronzeThird')}</strong>
                                                <span style={{ fontSize: '0.75rem', color: '#babfc3' }}>{t('profile.bronzeDesc')}</span>
                                            </div>
                                        </div>
                                        <strong style={{ fontSize: '1.5rem', color: '#b75a14', fontFamily: '"Outfit", sans-serif' }}>{stats?.bronzeMedals || 0}</strong>
                                    </div>

                                </div>
                            </div>

                            {/* Bio & Edit Profile Card */}
                            <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: '800', fontFamily: '"Outfit", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {t('profile.bioAndPersonal')}
                                    </h3>
                                    <button 
                                        onClick={() => {
                                            setEditBio(bio);
                                            setEditAvatar(profileAvatar);
                                            setEditCountry(country);
                                            setUploadMsg('');
                                            setIsEditingProfile(true);
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#81b64c', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        ✏️ {t('common.edit')}
                                    </button>
                                </div>
                            </div>

                        </div>

                    </div>
                )}

            </div>

            {/* Edit Bio & Personal Info Pop-Up Modal */}
            {isEditingProfile && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 1100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsEditingProfile(false);
                    }}
                >
                    <div 
                        style={{
                            background: '#262421',
                            border: '1px solid #403d39',
                            borderRadius: '12px',
                            width: '100%',
                            maxWidth: '520px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: '24px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '18px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: '800', fontFamily: '"Outfit", sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ✏️ {t('profile.bioAndPersonal')}
                            </h3>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setIsEditingProfile(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
                            {/* Preset Avatar Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ color: '#babfc3', fontWeight: 'bold' }}>{t('profile.selectAvatar')}</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                    {['♟️', '♞', '♝', '♜', '♛', '♚', '🦁', '🦊', '🦅', '🐉'].map(av => (
                                        <button 
                                            key={av}
                                            type="button"
                                            onClick={() => setEditAvatar(av)}
                                            style={{
                                                background: editAvatar === av ? '#81b64c' : '#312e2b',
                                                border: editAvatar === av ? '1px solid #81b64c' : '1px solid #403d39',
                                                borderRadius: '6px',
                                                fontSize: '1.4rem',
                                                padding: '8px 0',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}
                                        >
                                            {av}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Image Upload */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px dashed #403d39' }}>
                                <label style={{ color: '#babfc3', fontWeight: 'bold' }}>
                                    ☁️ {t('profile.uploadAvatar', 'Tải ảnh đại diện:')}
                                </label>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarFileUpload}
                                        disabled={uploadingAvatar}
                                        id="avatar-upload-file-modal"
                                        style={{ display: 'none' }}
                                    />
                                    <label
                                        htmlFor="avatar-upload-file-modal"
                                        style={{
                                            background: '#312e2b',
                                            border: '1px solid #81b64c',
                                            color: '#81b64c',
                                            padding: '8px 14px',
                                            borderRadius: '6px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        {uploadingAvatar ? `⏳ ${t('profile.uploading', 'Đang tải...')}` : `📁 ${t('profile.chooseFile', 'Chọn tệp ảnh...')}`}
                                    </label>

                                    {isImageUrl(editAvatar) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #81b64c' }}>
                                                <img src={formatAvatarUrl(editAvatar)} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#81b64c', fontWeight: 'bold' }}>✓ Ảnh đã chọn</span>
                                        </div>
                                    )}
                                </div>
                                {uploadMsg && (
                                    <span style={{ fontSize: '0.8rem', marginTop: '4px', color: uploadMsg.includes('thành công') || uploadMsg.includes('success') ? '#4ade80' : '#f87171' }}>
                                        {uploadMsg}
                                    </span>
                                )}
                            </div>

                            {/* Country Selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ color: '#babfc3', fontWeight: 'bold' }}>{t('profile.countryLabel')}</label>
                                <select 
                                    value={editCountry}
                                    onChange={e => setEditCountry(e.target.value)}
                                    style={{ background: '#312e2b', border: '1px solid #403d39', padding: '10px', borderRadius: '6px', color: 'white', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
                                >
                                    {Object.entries(countryFlags).map(([code, flag]) => (
                                        <option key={code} value={code} style={{ background: '#262421' }}>
                                            {flag} {countryNames[code]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Bio Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ color: '#babfc3', fontWeight: 'bold' }}>{t('profile.bioLabel')}</label>
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{editBio.length}/200</span>
                                </div>
                                <textarea 
                                    value={editBio}
                                    onChange={e => setEditBio(e.target.value.slice(0, 200))}
                                    placeholder={t('profile.bioPlaceholder')}
                                    rows={3}
                                    style={{ background: '#312e2b', border: '1px solid #403d39', padding: '10px', borderRadius: '6px', color: 'white', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', lineHeight: '1.4' }}
                                />
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                            <button 
                                type="button"
                                onClick={handleSaveProfile}
                                style={{ flex: 1, background: '#81b64c', border: 'none', padding: '12px', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
                            >
                                {t('common.save')}
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsEditingProfile(false)}
                                style={{ flex: 1, background: '#403d39', border: 'none', padding: '12px', borderRadius: '6px', color: '#babfc3', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


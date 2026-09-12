import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTranslation } from '../contexts/I18nContext';
import { TournamentService } from '../services/TournamentService';
import { ReplayService } from '../services/ReplayService';
import { AuthService } from '../services/AuthService';
import AdminDisplayName, { checkIsAdmin } from '../components/AdminDisplayName';
import { isImageUrl, formatAvatarUrl } from '../services/MinioService';
import '../index.css';

// Mock Constants and Data Helpers for visual testing / server down fallbacks
const MOCK_TOURNAMENT_ID = '9';

const getMockTournament = (id) => ({
    tournamentId: id,
    tournamentName: "Giải vô địch Grandmaster Arena - Mùa Hè 2026",
    description: "Giải đấu cờ vua cấp độ chuyên nghiệp dành cho các kỳ thủ hàng đầu của hệ thống. Thi đấu theo thể thức Thụy Sĩ (Swiss System), tính điểm số và chỉ số phụ Buchholz để chọn ra nhà vô địch.",
    timeControl: "10+5 | Blitz",
    totalRounds: 5,
    registrationStart: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    registrationEnd: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    startTime: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    status: 'ONGOING'
});

const getMockStandings = (username, userId) => {
    const currentUserId = userId || 999;
    const currentUsername = username || "Người chơi";
    return [
        { userId: 101, username: "Magnus Carlsen", initialRating: 2882, currentScore: 3.5, buchholz: 7.5, sonnebornBerger: 6.25 },
        { userId: currentUserId, username: `${currentUsername} (Bạn)`, initialRating: 1850, currentScore: 3.0, buchholz: 8.0, sonnebornBerger: 5.50 },
        { userId: 102, username: "Hikaru Nakamura", initialRating: 2875, currentScore: 3.0, buchholz: 7.5, sonnebornBerger: 4.75 },
        { userId: 103, username: "Ding Liren", initialRating: 2780, currentScore: 2.5, buchholz: 6.0, sonnebornBerger: 3.50 },
        { userId: 104, username: "Praggnanandhaa", initialRating: 2750, currentScore: 2.0, buchholz: 6.5, sonnebornBerger: 2.25 },
        { userId: 105, username: "Gukesh D", initialRating: 2765, currentScore: 2.0, buchholz: 6.0, sonnebornBerger: 2.00 },
        { userId: 106, username: "Alireza Firouzja", initialRating: 2778, currentScore: 1.0, buchholz: 5.5, sonnebornBerger: 1.00 },
        { userId: 107, username: "Levon Aronian", initialRating: 2745, currentScore: 1.0, buchholz: 5.0, sonnebornBerger: 0.50 }
    ].sort((a, b) => b.currentScore - a.currentScore || b.buchholz - a.buchholz || b.sonnebornBerger - a.sonnebornBerger);
};

const getMockRounds = () => [
    { roundId: 1001, roundNumber: 1 },
    { roundId: 1002, roundNumber: 2 },
    { roundId: 1003, roundNumber: 3 },
    { roundId: 1004, roundNumber: 4 }
];

const getMockPairings = (roundId, username, userId) => {
    const currentUserId = userId || 999;
    const currentUsername = username || "Người chơi";
    
    // Round 1
    if (roundId === 1001) {
        return [
            { pairingId: 2001, whitePlayerName: "Magnus Carlsen", whitePlayerRating: 2882, whitePlayerId: 101, blackPlayerName: "Ding Liren", blackPlayerRating: 2780, blackPlayerId: 103, isBye: false, result: "1-0", gameId: "1" },
            { pairingId: 2002, whitePlayerName: "Hikaru Nakamura", whitePlayerRating: 2875, whitePlayerId: 102, blackPlayerName: "Alireza Firouzja", blackPlayerRating: 2778, blackPlayerId: 106, isBye: false, result: "1-0", gameId: "2" },
            { pairingId: 2003, whitePlayerName: currentUsername, whitePlayerRating: 1850, whitePlayerId: currentUserId, blackPlayerName: "Levon Aronian", blackPlayerRating: 2745, blackPlayerId: 107, isBye: false, result: "1-0", gameId: "3" },
            { pairingId: 2004, whitePlayerName: "Praggnanandhaa", whitePlayerRating: 2750, whitePlayerId: 104, blackPlayerName: "Gukesh D", blackPlayerRating: 2765, blackPlayerId: 105, isBye: false, result: "1/2-1/2", gameId: "4" }
        ];
    }
    // Round 2
    if (roundId === 1002) {
        return [
            { pairingId: 2005, whitePlayerName: "Magnus Carlsen", whitePlayerRating: 2882, whitePlayerId: 101, blackPlayerName: currentUsername, blackPlayerRating: 1850, blackPlayerId: currentUserId, isBye: false, result: "1/2-1/2", gameId: "5" },
            { pairingId: 2006, whitePlayerName: "Hikaru Nakamura", whitePlayerRating: 2875, whitePlayerId: 102, blackPlayerName: "Praggnanandhaa", blackPlayerRating: 2750, blackPlayerId: 104, isBye: false, result: "1-0", gameId: "6" },
            { pairingId: 2007, whitePlayerName: "Gukesh D", whitePlayerRating: 2765, whitePlayerId: 105, blackPlayerName: "Ding Liren", blackPlayerRating: 2780, blackPlayerId: 103, isBye: false, result: "1/2-1/2", gameId: "7" },
            { pairingId: 2008, whitePlayerName: "Alireza Firouzja", whitePlayerRating: 2778, blackPlayerName: "Levon Aronian", blackPlayerRating: 2745, blackPlayerId: 107, isBye: false, result: "1-0", gameId: "8" }
        ];
    }
    // Round 3
    if (roundId === 1003) {
        return [
            { pairingId: 2009, whitePlayerName: "Hikaru Nakamura", whitePlayerRating: 2875, whitePlayerId: 102, blackPlayerName: "Magnus Carlsen", blackPlayerRating: 2882, blackPlayerId: 101, isBye: false, result: "1/2-1/2", gameId: "9" },
            { pairingId: 2010, whitePlayerName: currentUsername, whitePlayerRating: 1850, whitePlayerId: currentUserId, blackPlayerName: "Gukesh D", blackPlayerRating: 2765, blackPlayerId: 105, isBye: false, result: "1-0", gameId: "10" },
            { pairingId: 2011, whitePlayerName: "Ding Liren", whitePlayerRating: 2780, whitePlayerId: 103, blackPlayerName: "Alireza Firouzja", blackPlayerRating: 2778, blackPlayerId: 106, isBye: false, result: "1-0", gameId: "11" },
            { pairingId: 2012, whitePlayerName: "Levon Aronian", whitePlayerRating: 2745, whitePlayerId: 107, blackPlayerName: "Praggnanandhaa", blackPlayerRating: 2750, blackPlayerId: 104, isBye: false, result: "0-1", gameId: "12" }
        ];
    }
    // Round 4 (Ongoing)
    return [
        { pairingId: 2013, whitePlayerName: "Magnus Carlsen", whitePlayerRating: 2882, whitePlayerId: 101, blackPlayerName: "Gukesh D", blackPlayerRating: 2765, blackPlayerId: 105, isBye: false, result: "1-0", gameId: "13" },
        { pairingId: 2014, whitePlayerName: "Praggnanandhaa", whitePlayerRating: 2750, whitePlayerId: 104, blackPlayerName: currentUsername, blackPlayerRating: 1850, blackPlayerId: currentUserId, isBye: false, result: null, gameId: null },
        { pairingId: 2015, whitePlayerName: "Ding Liren", whitePlayerRating: 2780, whitePlayerId: 103, blackPlayerName: "Hikaru Nakamura", blackPlayerRating: 2875, blackPlayerId: 102, isBye: false, result: null, gameId: null },
        { pairingId: 2016, whitePlayerName: "Alireza Firouzja", whitePlayerRating: 2778, whitePlayerId: 106, blackPlayerName: "Levon Aronian", blackPlayerRating: 2745, blackPlayerId: 107, isBye: false, result: null, gameId: null }
    ];
};

const getMockMyPairing = (username, userId) => ({
    pairingId: 2014,
    whitePlayerName: "Praggnanandhaa",
    whitePlayerRating: 2750,
    whitePlayerId: 104,
    blackPlayerName: username || "Người chơi",
    blackPlayerRating: 1850,
    blackPlayerId: userId || 999,
    isBye: false,
    result: null,
    inBreak: false,
    breakTimeLeftSeconds: 0
});

export default function TournamentDetail() {
    const { t } = useTranslation();
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    const [username, setUsername] = useState('Người chơi');
    const [userId, setUserId] = useState(null);
    const [tournament, setTournament] = useState(null);
    const [standings, setStandings] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [selectedRoundId, setSelectedRoundId] = useState(null);
    const [pairings, setPairings] = useState([]);
    const [activeTab, setActiveTab] = useState('standings'); // standings, rounds
    const [myPairing, setMyPairing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    useEffect(() => {
        const checkToken = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            const payload = AuthService.parseToken(token);
            if (payload) {
                setUsername(payload.username || 'Người chơi');
                setUserId(payload.userId);
            }
        };
        checkToken();
    }, [navigate]);

    // Re-trigger fetch details if username or userId changes to ensure highlight is correctly colored
    useEffect(() => {
        if (userId) {
            fetchTournamentDetails();
        }
    }, [tournamentId, userId]);

    const fetchTournamentDetails = async () => {
        setLoading(true);
        setIsDemoMode(false);
        try {
            // Force mock if tournamentId is '9' for visual demo
            if (tournamentId === MOCK_TOURNAMENT_ID) {
                throw new Error("Demo Mode Forced");
            }

            const details = await TournamentService.getTournamentById(tournamentId);
            setTournament(details);
            
            // Fetch standings
            const std = await TournamentService.getStandings(tournamentId);
            setStandings(std || []);

            // Fetch rounds
            try {
                const rds = await ReplayService.getRounds(tournamentId);
                setRounds(rds || []);
                if (rds && rds.length > 0) {
                    setSelectedRoundId(rds[rds.length - 1].roundId);
                    // fetch pairings for latest round
                    const prs = await ReplayService.getPairings(tournamentId, rds[rds.length - 1].roundId);
                    setPairings(prs || []);
                }
            } catch (err) {
                setRounds([]);
                setPairings([]);
            }

            // Fetch my pairing if ongoing
            if (details.status === 'ONGOING') {
                try {
                    const mp = await TournamentService.getMyPairing(tournamentId);
                    setMyPairing(mp);
                } catch (err) {
                    setMyPairing(null);
                }
            } else {
                setMyPairing(null);
            }
        } catch (err) {
            console.warn("Error fetching tournament details, falling back to high-fidelity mock data:", err);
            setIsDemoMode(true);
            
            // Set mock data
            const details = getMockTournament(tournamentId);
            setTournament(details);
            
            const std = getMockStandings(username, userId);
            setStandings(std);
            
            const rds = getMockRounds();
            setRounds(rds);
            
            if (rds.length > 0) {
                const latestRoundId = rds[rds.length - 1].roundId;
                setSelectedRoundId(latestRoundId);
                const prs = getMockPairings(latestRoundId, username, userId);
                setPairings(prs);
            }
            
            const mp = getMockMyPairing(username, userId);
            setMyPairing(mp);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchPairings = async (rId) => {
        setSelectedRoundId(rId);
        if (isDemoMode) {
            const prs = getMockPairings(rId, username, userId);
            setPairings(prs);
            return;
        }
        try {
            const prs = await ReplayService.getPairings(tournamentId, rId);
            setPairings(prs || []);
        } catch (err) {
            setPairings([]);
        }
    };

    const handleJoin = async () => {
        try {
            await TournamentService.joinTournament(tournamentId);
            alert("Đăng ký tham gia thành công!");
            fetchTournamentDetails();
        } catch (err) {
            alert(err.response?.data?.message || "Đăng ký thất bại!");
        }
    };

    const handleLeave = async () => {
        try {
            await TournamentService.leaveTournament(tournamentId);
            alert("Hủy đăng ký thành công!");
            fetchTournamentDetails();
        } catch (err) {
            alert(err.response?.data?.message || "Hủy đăng ký thất bại!");
        }
    };

    const handleEnterLobby = () => {
        if (myPairing) {
            if (myPairing.inBreak) {
                navigate(`/tournaments/break/${tournamentId}?duration=${myPairing.breakTimeLeftSeconds || 600}`);
            } else {
                navigate(`/tournaments/lobby/${tournamentId}`);
            }
        }
    };

    const isUserRegistered = standings.some(s => s.userId === userId);

    const formatDate = (dateString) => {
        if (!dateString) return 'Chưa thiết lập';
        try {
            return new Date(dateString).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    if (loading) {
        return (
            <div className="friends-page-wrapper">
                <Sidebar username={username} />
                <div className="friends-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', letterSpacing: '0.5px' }}>⏳ Đang tải thông tin giải đấu...</div>
                </div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="friends-page-wrapper">
                <Sidebar username={username} />
                <div className="friends-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>❌ Không tìm thấy giải đấu.</div>
                </div>
            </div>
        );
    }

    const renderTimeline = () => {
        const steps = [
            { key: 'registering', label: 'Mở Đăng Ký', time: tournament.registrationStart },
            { key: 'closed', label: 'Đóng Đăng Ký', time: tournament.registrationEnd },
            { key: 'ongoing', label: 'Thi Đấu', time: tournament.startTime }
        ];

        return steps.map((step, idx) => {
            let stateClass = 'upcoming';
            if (tournament.status === 'REGISTERING') {
                if (idx === 0) stateClass = 'active';
            } else if (tournament.status === 'ONGOING') {
                if (idx < 2) stateClass = 'completed';
                else if (idx === 2) stateClass = 'active';
            } else if (tournament.status === 'FINISHED') {
                stateClass = 'completed';
            }

            return (
                <div key={step.key} className={`timeline-step ${stateClass}`}>
                    <div className="timeline-circle">
                        {stateClass === 'completed' ? '✓' : idx + 1}
                    </div>
                    <div className="timeline-label">{step.label}</div>
                    <div className="timeline-time">{formatDate(step.time)}</div>
                </div>
            );
        });
    };

    return (
        <div className="friends-page-wrapper">
            <Sidebar username={username} />
            
            <div className="friends-content" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '24px', padding: '24px' }}>
                {/* Back button & Breadcrumbs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <button 
                        className="secondary-btn" 
                        onClick={() => navigate('/tournaments')}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                        ⬅️ Danh sách giải đấu
                    </button>
                    {isDemoMode && (
                        <span style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold' }}>
                            ⚡ CHẾ ĐỘ DEMO
                        </span>
                    )}
                </div>

                {/* Hero Header Section */}
                <div className="tournament-hero-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', zIndex: 1, position: 'relative' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                <span className={`tournament-badge ${
                                    tournament.status === 'REGISTERING' ? 'badge-registering' :
                                    tournament.status === 'ONGOING' ? 'badge-ongoing' : 'badge-finished'
                                }`}>
                                    {tournament.status === 'REGISTERING' && <span>🟢 Đang mở đăng ký</span>}
                                    {tournament.status === 'ONGOING' && <span>⚔️ Đang diễn ra</span>}
                                    {tournament.status === 'FINISHED' && <span>🏆 Đã kết thúc</span>}
                                </span>
                            </div>
                            <h1 style={{ fontSize: '2.2rem', fontWeight: '800', margin: '0 0 10px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: '1.2' }}>
                                {tournament.tournamentName}
                            </h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '800px', margin: 0 }}>
                                {tournament.description || 'Không có mô tả chi tiết cho giải đấu này.'}
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="tournament-stats-row">
                        <div className="tournament-stat-item">
                            <span className="tournament-stat-label">⏱️ Thể thức</span>
                            <span className="tournament-stat-value">{tournament.timeControl}</span>
                        </div>
                        <div className="tournament-stat-item">
                            <span className="tournament-stat-label">🔄 Số vòng đấu</span>
                            <span className="tournament-stat-value">{tournament.totalRounds}</span>
                        </div>
                        <div className="tournament-stat-item">
                            <span className="tournament-stat-label">👥 Đã tham gia</span>
                            <span className="tournament-stat-value">{standings.length} Kỳ thủ</span>
                        </div>
                        <div className="tournament-stat-item">
                            <span className="tournament-stat-label">🏆 Điểm số</span>
                            <span className="tournament-stat-value">Swiss System</span>
                        </div>
                    </div>
                </div>

                {/* Timeline Progress */}
                <div className="timeline-container">
                    {renderTimeline()}
                </div>

                {/* 2-Column Main Dashboard Layout */}
                <div style={{ display: 'flex', gap: '24px', width: '100%', flexWrap: 'wrap' }}>
                    {/* Left Column: CTA Actions & Info Details */}
                    <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Action CTA Panel */}
                        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', fontWeight: 'bold' }}>
                                🎮 Sảnh Hành Động
                            </h3>
                            
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                {tournament.status === 'REGISTERING' && (
                                    <div>
                                        {isUserRegistered ? (
                                            <p style={{ color: '#4ade80', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                ✓ Bạn đã đăng ký tham gia giải đấu. Hãy chờ đến giờ bắt đầu!
                                            </p>
                                        ) : (
                                            <p>Giải đấu đang mở đăng ký. Hãy tham gia thi đấu cùng các đại kiện tướng!</p>
                                        )}
                                    </div>
                                )}
                                {tournament.status === 'ONGOING' && (
                                    <div>
                                        {isUserRegistered ? (
                                            <p style={{ color: '#60a5fa' }}>Giải đấu đang diễn ra! Hãy vào phòng đấu để ghép cặp thi đấu ván mới.</p>
                                        ) : (
                                            <p>Giải đấu đang diễn ra. Bạn chỉ có thể theo dõi và xem bảng xếp hạng.</p>
                                        )}
                                    </div>
                                )}
                                {tournament.status === 'FINISHED' && (
                                    <p>Giải đấu đã kết thúc thành công tốt đẹp. Hãy xem bảng xếp hạng chung cuộc bên cạnh!</p>
                                )}
                            </div>

                            <div>
                                {tournament.status === 'REGISTERING' && (
                                    <div>
                                        {isUserRegistered ? (
                                            <button 
                                                className="secondary-btn" 
                                                style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444', padding: '12px', borderRadius: '10px' }} 
                                                onClick={handleLeave}
                                            >
                                                Hủy đăng ký tham gia
                                            </button>
                                        ) : (
                                            <button 
                                                className="primary-btn" 
                                                style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', fontWeight: '700' }} 
                                                onClick={handleJoin}
                                            >
                                                Đăng ký tham gia ngay
                                            </button>
                                        )}
                                    </div>
                                )}

                                {tournament.status === 'ONGOING' && isUserRegistered && (
                                    <div>
                                        {myPairing ? (
                                            <button
                                                className="primary-btn"
                                                style={{ 
                                                    width: '100%', 
                                                    background: 'linear-gradient(135deg, var(--accent-purple), #ec4899)', 
                                                    border: 'none', 
                                                    color: 'white', 
                                                    padding: '14px', 
                                                    borderRadius: '10px',
                                                    fontWeight: '700',
                                                    boxShadow: '0 6px 15px rgba(236, 72, 153, 0.25)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={handleEnterLobby}
                                            >
                                                {myPairing.inBreak ? '⏳ GIẢI LAO (VÀO PHÒNG CHỜ)' : '⚔️ VÀO PHÒNG CHỜ THI ĐẤU'}
                                            </button>
                                        ) : (
                                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                                ⏳ Đang đợi hệ thống ghép cặp vòng đấu mới...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rules Card */}
                        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', fontWeight: 'bold' }}>
                                📜 Thể thức & Điều lệ
                            </h3>
                            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '16px', margin: 0, lineHeight: '1.5' }}>
                                <li><strong>Hệ Thụy Sĩ (Swiss System):</strong> Kỳ thủ sẽ được ghép cặp đấu với các đối thủ có cùng điểm số trong suốt giải đấu. Không ai bị loại.</li>
                                <li><strong>Tính điểm:</strong> Thắng được 1.0 điểm, Hòa được 0.5 điểm, Thua được 0 điểm.</li>
                                <li><strong>Chỉ số phụ Buchholz (BH):</strong> Tổng điểm của tất cả đối thủ đã gặp. BH cao hơn chứng minh bạn đã gặp những đối thủ mạnh hơn.</li>
                                <li><strong>Sonneborn-Berger (SB):</strong> Tổng điểm của những đối thủ mà bạn đã thắng, cộng với một nửa điểm số của những đối thủ bạn đã hòa.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Column: Dynamic Tabs View (Standings & Pairings) */}
                    <div style={{ flex: '2 2 500px', display: 'flex', flexDirection: 'column' }}>
                        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px', width: '100%' }}>
                            {/* Tabs Header */}
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                                <button
                                    onClick={() => setActiveTab('standings')}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        color: activeTab === 'standings' ? 'var(--accent-blue-hover)' : 'var(--text-muted)',
                                        borderBottom: activeTab === 'standings' ? '2.5px solid var(--accent-blue)' : 'none',
                                        borderRadius: 0,
                                        padding: '12px 0',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🏆 Bảng xếp hạng
                                </button>
                                <button
                                    onClick={() => setActiveTab('rounds')}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        color: activeTab === 'rounds' ? 'var(--accent-blue-hover)' : 'var(--text-muted)',
                                        borderBottom: activeTab === 'rounds' ? '2.5px solid var(--accent-blue)' : 'none',
                                        borderRadius: 0,
                                        padding: '12px 0',
                                        fontWeight: '700',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🔄 Vòng đấu & Trận đấu
                                </button>
                            </div>

                            {/* Tab Content Box */}
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {activeTab === 'standings' ? (
                                    <div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                                    <th style={{ padding: '12px 10px', textAlign: 'center', width: '60px' }}>Hạng</th>
                                                    <th style={{ padding: '12px 10px' }}>Kỳ thủ</th>
                                                    <th style={{ padding: '12px 10px' }}>Elo</th>
                                                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Điểm</th>
                                                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>BH</th>
                                                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>SB</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chưa có kỳ thủ nào đăng ký tham gia.</td>
                                                    </tr>
                                                ) : (
                                                    standings.map((p, idx) => {
                                                        const isCurrentUser = p.userId === userId;
                                                        const rank = idx + 1;
                                                        let rankDisplay = rank;
                                                        if (rank === 1) rankDisplay = <span className="medal-badge medal-1">🥇</span>;
                                                        else if (rank === 2) rankDisplay = <span className="medal-badge medal-2">🥈</span>;
                                                        else if (rank === 3) rankDisplay = <span className="medal-badge medal-3">🥉</span>;

                                                        return (
                                                            <tr key={p.userId} style={{ 
                                                                borderBottom: '1px solid rgba(255,255,255,0.02)', 
                                                                background: isCurrentUser ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                                                transition: 'background 0.2s'
                                                            }}>
                                                                 <td style={{ padding: '12px 10px', fontWeight: 'bold', textAlign: 'center' }}>{rankDisplay}</td>
                                                                 <td style={{ padding: '12px 10px' }}>
                                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                         <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: '#312e2b', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>
                                                                             {isImageUrl(p.avatarUrl || p.avatar) ? (
                                                                                 <img src={formatAvatarUrl(p.avatarUrl || p.avatar)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                             ) : (
                                                                                 p.avatarUrl || p.avatar || (p.username ? p.username.charAt(0).toUpperCase() : '👤')
                                                                             )}
                                                                         </div>
                                                                         <AdminDisplayName
                                                                             username={p.username}
                                                                             role={p.role}
                                                                             rainbowNameEnabled={p.rainbowNameEnabled}
                                                                             nameStyle={{ fontWeight: isCurrentUser ? 'bold' : '500', color: isCurrentUser ? 'var(--accent-blue-hover)' : 'var(--text-primary)' }}
                                                                         />
                                                                         {isCurrentUser && <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue-hover)', marginLeft: '4px', fontWeight: 'bold' }}>(Bạn)</span>}
                                                                     </div>
                                                                 </td>
                                                                <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{p.initialRating}</td>
                                                                <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-blue-hover)', fontSize: '0.95rem' }}>{p.currentScore}</td>
                                                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.buchholz}</td>
                                                                <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.sonnebornBerger}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div>
                                        {rounds.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px', fontSize: '0.9rem' }}>
                                                {tournament.status === 'REGISTERING' ? 'ℹ️ Vòng đấu sẽ được tạo tự động khi giải đấu chính thức bắt đầu.' : 'Thông tin vòng đấu chưa có hoặc không khả dụng.'}
                                            </p>
                                        ) : (
                                            <div>
                                                {/* Round Capsules Selector */}
                                                <div className="round-capsule-bar">
                                                    {rounds.map(r => (
                                                        <button
                                                            key={r.roundId}
                                                            onClick={() => handleFetchPairings(r.roundId)}
                                                            className={`round-capsule ${selectedRoundId === r.roundId ? 'active' : ''}`}
                                                        >
                                                            Vòng {r.roundNumber}
                                                        </button>
                                                    ))}
                                                </div>
 
                                                {/* Pairing cards list */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                                                    {pairings.length === 0 ? (
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>Không có cặp đấu nào trong vòng này.</p>
                                                    ) : (
                                                        pairings.map((p, idx) => {
                                                            const isWhiteUser = p.whitePlayerId === userId;
                                                            const isBlackUser = p.blackPlayerId === userId;
                                                            const isMatchOngoing = p.result === null && !p.isBye && tournament.status === 'ONGOING';
                                                            
                                                            // Determine winner style
                                                            let whiteResultClass = '';
                                                            let blackResultClass = '';
                                                            if (p.result === '1-0') {
                                                                whiteResultClass = 'result-win';
                                                                blackResultClass = 'result-lose';
                                                            } else if (p.result === '0-1') {
                                                                whiteResultClass = 'result-lose';
                                                                blackResultClass = 'result-win';
                                                            } else if (p.result === '1/2-1/2' || p.result === '0.5-0.5') {
                                                                whiteResultClass = 'result-draw';
                                                                blackResultClass = 'result-draw';
                                                            }

                                                            return (
                                                                <div key={p.pairingId || idx} className="pairing-board-card">
                                                                    <div className="board-label">Bàn {idx + 1}</div>
                                                                    
                                                                    {/* White Player Row */}
                                                                    <div className="player-row" style={{ marginTop: '8px' }}>
                                                                        <div className="player-name-wrapper">
                                                                            <span className="color-indicator color-white" title="Quân Trắng"></span>
                                                                            <span className={`player-name-text ${isWhiteUser ? 'is-user' : ''}`}>
                                                                                {p.whitePlayerName}
                                                                            </span>
                                                                            <span className="player-rating-text">({p.whitePlayerRating})</span>
                                                                        </div>
                                                                        {p.result && (
                                                                            <span className={`match-result-status ${whiteResultClass}`}>
                                                                                {p.result === '1-0' ? '1' : p.result === '0-1' ? '0' : '½'}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Black Player Row */}
                                                                    {!p.isBye && (
                                                                        <div className="player-row">
                                                                            <div className="player-name-wrapper">
                                                                                <span className="color-indicator color-black" title="Quân Đen"></span>
                                                                                <span className={`player-name-text ${isBlackUser ? 'is-user' : ''}`}>
                                                                                    {p.blackPlayerName}
                                                                                </span>
                                                                                <span className="player-rating-text">({p.blackPlayerRating})</span>
                                                                            </div>
                                                                            {p.result && (
                                                                                <span className={`match-result-status ${blackResultClass}`}>
                                                                                    {p.result === '1-0' ? '0' : p.result === '0-1' ? '1' : '½'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Bye Match Handling */}
                                                                    {p.isBye && (
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', paddingLeft: '24px' }}>
                                                                            Nhận điểm miễn phí (Bye Round)
                                                                        </div>
                                                                    )}

                                                                    {/* Match Status / CTA Actions Footer */}
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px', marginTop: '4px' }}>
                                                                        <div>
                                                                            {isMatchOngoing && (
                                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>
                                                                                    <span className="live-pulse"></span> TRẬN ĐẤU ĐANG DIỄN RA
                                                                                </span>
                                                                            )}
                                                                            {!p.result && !isMatchOngoing && !p.isBye && (
                                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa thi đấu</span>
                                                                            )}
                                                                            {p.result && (
                                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã kết thúc</span>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        <div>
                                                                            {p.gameId && (
                                                                                <button
                                                                                    className="action-link-btn"
                                                                                    onClick={() => navigate(`/replay/${p.gameId}`)}
                                                                                >
                                                                                    🎬 Xem Replay
                                                                                </button>
                                                                            )}
                                                                            {isMatchOngoing && (isWhiteUser || isBlackUser) && (
                                                                                <button
                                                                                    className="action-link-btn"
                                                                                    style={{ color: '#ef4444', fontWeight: 'bold' }}
                                                                                    onClick={handleEnterLobby}
                                                                                >
                                                                                    ⚔️ Vào Thi Đấu
                                                                                </button>
                                                                            )}
                                                                            {isMatchOngoing && !(isWhiteUser || isBlackUser) && (
                                                                                <button
                                                                                    className="action-link-btn"
                                                                                    style={{ color: 'var(--accent-blue-hover)' }}
                                                                                    onClick={() => alert("Chức năng theo dõi trực tiếp sẽ sớm được cập nhật!")}
                                                                                >
                                                                                    👁️ Xem Trực Tiếp
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

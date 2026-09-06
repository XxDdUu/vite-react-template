import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { GameService } from '../services/GameService';
import { FriendService } from '../services/FriendService';
import { AiGameService } from '../services/AiGameService';
import { socketClient } from '../services/SocketService';
import api from '../services/api';
import '../index.css';
import Sidebar from '../components/Sidebar';
import AdminDisplayName, { checkIsAdmin } from '../components/AdminDisplayName';

const getFlagEmoji = (code) => {
    if (!code || code.length !== 2) return '🇻🇳';
    try {
        const codeUpper = code.toUpperCase();
        const firstChar = codeUpper.charCodeAt(0) - 65 + 0x1F1E6;
        const secondChar = codeUpper.charCodeAt(1) - 65 + 0x1F1E6;
        return String.fromCodePoint(firstChar, secondChar);
    } catch {
        return '🇻🇳';
    }
};

export default function MainMenu() {
    const navigate = useNavigate();
    const location = useLocation();
    const boardRef = useRef(null);
    const [username, setUsername] = useState(localStorage.getItem('username') || 'Khách');
    const [myRole, setMyRole] = useState(null);
    const [rating, setRating] = useState(Number(localStorage.getItem('rating')) || 1200);
    const [countryCode, setCountryCode] = useState(localStorage.getItem('countryCode') || 'VN');
    const [friends, setFriends] = useState([]);
    const [matchType, setMatchType] = useState('rapid');

    // AI Play Lobby Modal States
    const [isAiLobbyOpen, setIsAiLobbyOpen] = useState(false);
    const [aiMode, setAiMode] = useState('human-white'); // 'human-white' or 'human-black'
    const [aiDifficulty, setAiDifficulty] = useState(3); // 1 = Easy, 2 = Medium, 3 = Hard, 4 = Expert
    const [aiModels, setAiModels] = useState([]);
    const [selectedAiModel, setSelectedAiModel] = useState('best_model');
    const [inviteReceived, setInviteReceived] = useState(null);

    // Online Play Lobby Modal States
    const [isLobbyOpen, setIsLobbyOpen] = useState(false);
    const [matchState, setMatchState] = useState('INITIALIZING');
    const [status, setStatus] = useState('Đã kết nối. Chọn một chế độ chơi.');
    const [gameId, setGameId] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [confirmCountdown, setConfirmCountdown] = useState(10);
    const [hasAccepted, setHasAccepted] = useState(false);
    
    // Private Room State
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');

    const confirmTimer = useRef(null);
    const gameIdRef = useRef(null);

    useEffect(() => {
        gameIdRef.current = gameId;
    }, [gameId]);

    // Handle check for openLobby or openAiLobby from redirect
    useEffect(() => {
        if (location.state?.openLobby) {
            setIsLobbyOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        } else if (location.state?.openAiLobby) {
            setIsAiLobbyOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    useEffect(() => {
        const init = async () => {
            // Render background board immediately to avoid black screen flashing
            if (window.Chessboard && !boardRef.current) {
                setTimeout(() => {
                    const boardEl = document.getElementById('main-menu-board');
                    if (boardEl && !boardRef.current) {
                        boardRef.current = window.Chessboard('main-menu-board', {
                            position: 'start',
                            showNotation: true,
                            pieceTheme: '/chessPieces/{piece}.png'
                        });
                    }
                }, 0);
            }

            const token = await AuthService.getValidToken();
            if (!token) {
                navigate('/login');
                return;
            }

            socketClient.connect();

            const payload = AuthService.parseToken(token);
            if (payload) {
                setMyRole(payload.role || null);
                if (!localStorage.getItem('username')) {
                    setUsername(payload.username || payload.sub || 'Người chơi');
                }
                
                // Fetch user stats
                try {
                    const stats = await UserService.getStats(payload.userId);
                    if (stats) {
                        if (stats.username) {
                            setUsername(stats.username);
                            localStorage.setItem('username', stats.username);
                        }
                        if (stats.rating) {
                            setRating(stats.rating);
                            localStorage.setItem('rating', String(stats.rating));
                        }
                        if (stats.countryCode) {
                            setCountryCode(stats.countryCode);
                            localStorage.setItem('countryCode', stats.countryCode);
                        }
                    }
                } catch (err) {
                    console.error("Failed to load user stats", err);
                }
                
                // Fetch friends
                try {
                    const friendsList = await FriendService.getList(payload.userId);
                    setFriends(friendsList || []);
                } catch (err) {
                    console.error("Failed to load friends", err);
                }
            }

            // Check for active game
            try {
                const activeGameId = await GameService.getActiveGame(payload.userId);
                if (activeGameId) {
                    console.log("Found active game, redirecting...", activeGameId);
                    navigate('/play-online');
                }
            } catch (error) {
                console.error("Reconnection check failed", error);
            }

            // Fetch AI Checkpoints/Models
            try {
                const data = await AiGameService.getModels();
                const modelList = Array.isArray(data) ? data : (data.models || []);
                setAiModels(modelList);
                const defaultKey = data.default || (modelList[0]?.key || 'best_model');
                setSelectedAiModel(defaultKey);
            } catch (e) {
                console.error('Failed to load AI checkpoints in MainMenu', e);
            }
        };

        init();

        const handleSocketMessage = (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'USER_ONLINE') {
                    setFriends(prev => prev.map(f => f.userId === msg.userId ? { ...f, status: 'ONLINE' } : f));
                } else if (msg.type === 'USER_OFFLINE') {
                    setFriends(prev => prev.map(f => f.userId === msg.userId ? { ...f, status: 'OFFLINE' } : f));
                } else if (msg.type === 'MATCH_INVITE') {
                    setInviteReceived({ hostId: msg.hostId, hostName: msg.hostName });
                }
            } catch (e) {
                console.error("Main menu socket update error", e);
            }
        };

        socketClient.addListener(handleSocketMessage);

        const handleResize = () => {
            if (boardRef.current) {
                boardRef.current.resize();
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            socketClient.removeListener(handleSocketMessage);
            window.removeEventListener('resize', handleResize);
        };
    }, [navigate]);

    // Socket client message listener for the lobby modal
    useEffect(() => {
        const handleLobbySocketMessage = (data) => {
            try {
                const msg = JSON.parse(data);
                console.log("Lobby Socket Message:", msg);
                switch (msg.type) {
                    case 'ROOM_CREATED':
                        setRoomCode(msg.code);
                        setStatus('Waiting for opponent to join room: ' + msg.code);
                        setMatchState('SEARCHING');
                        break;
                    case 'PREPARE_GAME':
                        setMatchState('FOUND');
                        setGameId(msg.gameId);
                        setOpponent({
                            id: msg.opponentId,
                            name: msg.opponentName,
                            country: msg.opponentCountry || 'Trái Đất',
                            rating: msg.opponentRating || 1200
                        });
                        setHasAccepted(false);
                        startConfirmCountdown(msg.timeout || 10);
                        break;
                    case 'MATCH_CANCELLED':
                        if (confirmTimer.current) {
                            clearInterval(confirmTimer.current);
                            clearTimeout(confirmTimer.current);
                        }
                        if (msg.reason === 'MATCH_TIMEOUT') {
                            setMatchState('SEARCHING');
                            setStatus('Đối thủ không phản hồi. Đang tự động tìm đối thủ mới...');
                        } else {
                            setMatchState('INITIALIZING');
                            setStatus(msg.reason || 'Trận đấu bị hủy');
                        }
                        break;
                    case 'GAME_START':
                        if (confirmTimer.current) {
                            clearInterval(confirmTimer.current);
                            clearTimeout(confirmTimer.current);
                        }
                        setIsLobbyOpen(false);
                        // Reset modal state
                        setMatchState('INITIALIZING');
                        setStatus('Đã kết nối. Chọn một chế độ chơi.');
                        // Navigate to play-online with game details in state
                        navigate('/play-online', { state: { gameStartMsg: msg } });
                        break;
                    default:
                        break;
                }
            } catch (e) {
                console.error("Lobby socket handling error", e);
            }
        };

        if (isLobbyOpen) {
            socketClient.addListener(handleLobbySocketMessage);
        }
        return () => {
            socketClient.removeListener(handleLobbySocketMessage);
            if (confirmTimer.current) {
                clearInterval(confirmTimer.current);
                clearTimeout(confirmTimer.current);
            }
        };
    }, [isLobbyOpen]);

    const startConfirmCountdown = (t) => {
        setConfirmCountdown(t);
        if (confirmTimer.current) clearInterval(confirmTimer.current);
        confirmTimer.current = setInterval(() => {
            setConfirmCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(confirmTimer.current);
                    handleReject();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const joinMatchmaking = async () => {
        setMatchState('SEARCHING');
        setHasAccepted(false);
        setStatus('Đang tìm đối thủ...');
        try {
            const token = await AuthService.getValidToken();
            const userData = AuthService.parseToken(token);
            await api.post(`/api/matchmaking/join?userId=${userData.userId}&type=${matchType}`);
        } catch (err) {
            setStatus('Lỗi ghép trận: ' + err.message);
        }
    };

    const handleStartAiGame = async () => {
        const playerColor = aiMode === 'human-white' ? 'WHITE' : 'BLACK';
        try {
            await AiGameService.startGame(selectedAiModel, aiDifficulty, playerColor);
            setIsAiLobbyOpen(false);
            navigate('/play-ai');
        } catch (e) {
            alert('Không thể bắt đầu trận đấu với AI. Hãy chắc chắn rằng máy chủ AI đang chạy.');
        }
    };

    const handleCreateRoom = () => {
        setStatus('Đang tạo phòng riêng...');
        socketClient.send({ type: 'CREATE_ROOM', matchType: matchType });
    };

    const handleJoinRoom = () => {
        if (!joinRoomCode) return;
        setStatus(`Đang vào phòng ${joinRoomCode}...`);
        socketClient.send({ type: 'JOIN_ROOM', code: joinRoomCode });
    };

    const handleAccept = () => {
        if (confirmTimer.current) clearInterval(confirmTimer.current);
        setHasAccepted(true);
        socketClient.send({ type: 'READY', gameId: gameIdRef.current });

        // Start 13 seconds client-side failsafe buffer
        confirmTimer.current = setTimeout(() => {
            setMatchState(prev => {
                if (prev === 'FOUND') {
                    // Send reject match so server frees our matchmaking state
                    socketClient.send({ type: 'REJECT_MATCH', gameId: gameIdRef.current });
                    // Automatically find a new opponent
                    joinMatchmaking();
                }
                return prev;
            });
        }, 13000);
    };

    const handleReject = () => {
        if (confirmTimer.current) {
            clearInterval(confirmTimer.current);
            clearTimeout(confirmTimer.current);
        }
        socketClient.send({ type: 'REJECT_MATCH', gameId: gameIdRef.current });
        setMatchState('INITIALIZING');
        setStatus('Đã kết nối. Chọn một chế độ chơi.');
    };

    const cancelSearch = () => {
        if (confirmTimer.current) {
            clearInterval(confirmTimer.current);
            clearTimeout(confirmTimer.current);
        }
        setMatchState('INITIALIZING');
        setRoomCode('');
        socketClient.send({ type: 'LEAVE_QUEUE' });
        setStatus('Đã kết nối. Chọn một chế độ chơi.');
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        localStorage.removeItem('rating');
        localStorage.removeItem('countryCode');
        socketClient.disconnect();
        navigate('/login');
    };

    const handleInvite = (friendId) => {
        navigate('/play-online', { state: { inviteFriendId: friendId, matchType: matchType } });
    };

    const handleAcceptInvite = () => {
        if (!inviteReceived?.hostId) return;
        const hostId = inviteReceived.hostId;
        setInviteReceived(null);
        navigate('/play-online', { state: { acceptInviteHostId: hostId } });
    };

    return (
        <div className="main-menu-wrapper">
            <Sidebar username={username} />

            {/* Center Area (Board) */}
            <div className="board-area">
                <div className="board-container">
                    <div id="main-menu-board" className="chess-board-wrapper"></div>
                    <div className="player-info-bottom">
                        <div className={`avatar-small ${checkIsAdmin(myRole, username) ? 'admin-avatar-ring' : ''}`} style={{ borderRadius: '4px' }}>
                            <span className="icon">👤</span>
                        </div>
                        <span className="username" style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AdminDisplayName username={username} role={myRole} nameStyle={{ fontWeight: '600' }} />
                            <span style={{ color: '#81b64c', fontWeight: 'bold', fontSize: '0.9rem' }}>({rating})</span> 
                            <span className="flag">{getFlagEmoji(countryCode)}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="right-panel">
                <div className="glass-panel menu-glass-panel">
                    <div className="panel-header">
                        <h2>🏆 So tài cờ vua</h2>
                    </div>
                    <div className="action-buttons">
                        <button onClick={() => setIsLobbyOpen(true)} className="action-btn primary-action">
                            <span className="btn-icon">⚡</span>
                            <div className="btn-text">
                                <strong>Chơi trực tuyến</strong>
                                <span>Chơi với người khác cùng kĩ năng</span>
                            </div>
                        </button>

                        <button onClick={() => setIsAiLobbyOpen(true)} className="action-btn secondary-action">
                            <span className="btn-icon">🤖</span>
                            <div className="btn-text">
                                <strong>Chơi với Bot</strong>
                                <span>Thách đấu với máy từ mức độ Dễ đến Kiện Tướng</span>
                            </div>
                        </button>

                        <button className="action-btn secondary-action" onClick={() => navigate('/friends')}>
                            <span className="btn-icon">🤝</span>
                            <div className="btn-text">
                                <strong>Chơi với một người bạn</strong>
                                <span>Mời bạn đấu một ván cờ</span>
                            </div>
                        </button>
                    </div>

                    <div className="panel-footer">
                        <a href="#" className="footer-link" onClick={() => navigate('/profile')}>📁 Thông tin & Lịch sử đấu</a>
                        <a href="#" className="footer-link" onClick={(e) => { e.preventDefault(); navigate('/leaderboard'); }}>📊 Bảng xếp hạng</a>
                    </div>
                </div>

                {/* Friends Zone */}
                <div className="glass-panel" style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Bạn bè trực tuyến</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', cursor: 'pointer' }} onClick={() => navigate('/friends')}>Xem tất cả</span>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {friends.filter(f => f.status === 'ONLINE').length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>Không có bạn bè nào trực tuyến</p>
                        ) : (
                            friends.filter(f => f.status === 'ONLINE').map(friend => (
                                <div key={friend.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ width: '32px', height: '32px', background: 'var(--eval-white)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                {friend.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', background: '#4ade80', borderRadius: '50%', border: '2px solid var(--bg-dark)' }}></div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <AdminDisplayName username={friend.username} role={friend.role} nameStyle={{ fontSize: '0.9rem', fontWeight: '600' }} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{friend.rating}</span>
                                        </div>
                                    </div>
                                    <button 
                                        className="primary-btn" 
                                        style={{ padding: '5px 10px', fontSize: '0.75rem', flex: 'none' }}
                                        onClick={() => handleInvite(friend.userId)}
                                    >
                                        Mời
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ marginTop: '15px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                        <select 
                            value={matchType} 
                            onChange={(e) => setMatchType(e.target.value)}
                            className="custom-input"
                            style={{ fontSize: '0.8rem', padding: '5px' }}
                        >
                            <option value="bullet">Bullet (1m)</option>
                            <option value="blitz">Blitz (3m)</option>
                            <option value="rapid">Rapid (10m)</option>
                            <option value="classical">Classical (30m)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Lobby Modal Overlay */}
            {isLobbyOpen && (
                <div className="lobby-modal-overlay">
                    <div className="lobby-modal-card">
                        
                        {matchState === 'INITIALIZING' && (
                            <div className="lobby-modal-content">
                                <div className="lobby-modal-header">
                                    <h2>⚡ Trực tuyến Matchmaking</h2>
                                    <p className="lobby-status-pill">{status}</p>
                                </div>

                                <div className="time-controls-section">
                                    <h3>Chọn thời gian chơi</h3>
                                    <div className="time-controls-grid">
                                        <div 
                                            className={`time-card ${matchType === 'bullet' ? 'active' : ''}`} 
                                            onClick={() => setMatchType('bullet')}
                                        >
                                            <span className="time-icon">⚡</span>
                                            <div className="time-info">
                                                <span className="time-name">Bullet</span>
                                                <span className="time-duration">1 phút</span>
                                            </div>
                                        </div>
                                        <div 
                                            className={`time-card ${matchType === 'blitz' ? 'active' : ''}`} 
                                            onClick={() => setMatchType('blitz')}
                                        >
                                            <span className="time-icon">🔥</span>
                                            <div className="time-info">
                                                <span className="time-name">Blitz</span>
                                                <span className="time-duration">3 phút</span>
                                            </div>
                                        </div>
                                        <div 
                                            className={`time-card ${matchType === 'rapid' ? 'active' : ''}`} 
                                            onClick={() => setMatchType('rapid')}
                                        >
                                            <span className="time-icon">⏱️</span>
                                            <div className="time-info">
                                                <span className="time-name">Rapid</span>
                                                <span className="time-duration">10 phút</span>
                                            </div>
                                        </div>
                                        <div 
                                            className={`time-card ${matchType === 'classical' ? 'active' : ''}`} 
                                            onClick={() => setMatchType('classical')}
                                        >
                                            <span className="time-icon">🏆</span>
                                            <div className="time-info">
                                                <span className="time-name">Classical</span>
                                                <span className="time-duration">30 phút</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lobby-actions-section">
                                    <button onClick={joinMatchmaking} className="lobby-primary-btn">
                                        🚀 Tìm đối thủ ngẫu nhiên
                                    </button>

                                    <div className="lobby-separator">
                                        <span>HOẶC</span>
                                    </div>

                                    <div className="lobby-private-actions">
                                        <button onClick={handleCreateRoom} className="lobby-secondary-btn">
                                            🏠 Tạo phòng riêng
                                        </button>
                                        <div className="lobby-join-group">
                                            <input
                                                type="text"
                                                className="lobby-input"
                                                placeholder="Mã phòng..."
                                                value={joinRoomCode}
                                                onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                                            />
                                            <button onClick={handleJoinRoom} className="lobby-join-btn">
                                                Vào phòng
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => setIsLobbyOpen(false)} className="lobby-back-btn">
                                    Quay lại Menu
                                </button>
                            </div>
                        )}

                        {matchState === 'SEARCHING' && (
                            <div className="lobby-modal-content searching-content">
                                <div className="lobby-spinner-container">
                                    <div className="lobby-pulse-ring"></div>
                                    <div className="lobby-spinner"></div>
                                    <span className="lobby-search-icon">🔍</span>
                                </div>
                                <h2 className="searching-title">Đang tìm trận đấu...</h2>
                                <p className="searching-status">{status}</p>
                                
                                {roomCode && (
                                    <div className="lobby-room-code-box">
                                        <span className="room-label">MÃ PHÒNG CỦA BẠN:</span>
                                        <h1 className="room-code">{roomCode}</h1>
                                        <p className="room-desc">Hãy gửi mã này cho bạn bè để cùng chơi!</p>
                                    </div>
                                )}

                                <button onClick={cancelSearch} className="lobby-cancel-btn">
                                    Hủy tìm kiếm
                                </button>
                            </div>
                        )}

                        {matchState === 'FOUND' && (
                            <div className="lobby-modal-content found-content">
                                <div className="match-found-badge">
                                    <span>ĐÃ TÌM THẤY TRẬN!</span>
                                </div>
                                
                                <div className="opponent-card">
                                    <div className="opponent-avatar">👤</div>
                                    <div className="opponent-details">
                                        <h2 className="opponent-name">{opponent?.name}</h2>
                                        <p className="opponent-stats">🌍 {opponent?.country} • ⭐ Hệ số: {opponent?.rating}</p>
                                    </div>
                                </div>

                                {!hasAccepted ? (
                                    <div className="lobby-decision-group">
                                        <button onClick={handleAccept} className="lobby-accept-btn">
                                            CHẤP NHẬN ({confirmCountdown}s)
                                        </button>
                                        <button onClick={handleReject} className="lobby-reject-btn">
                                            TỪ CHỐI
                                        </button>
                                    </div>
                                ) : (
                                    <div className="lobby-waiting-opponent">
                                        <div className="small-loader"></div>
                                        <p>Đã chấp nhận! Đang chờ đối thủ xác nhận...</p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* AI Lobby Modal Overlay */}
            {isAiLobbyOpen && (
                <div className="lobby-modal-overlay">
                    <div className="lobby-modal-card" style={{ maxWidth: '520px' }}>
                        <div className="lobby-modal-content" style={{ padding: '30px 20px' }}>
                            <div className="lobby-modal-header" style={{ textAlign: 'center', marginBottom: '25px' }}>
                                <h2 style={{ fontSize: '1.8rem', color: 'white', fontWeight: 'bold' }}>🤖 Chơi với máy AI</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '5px' }}>
                                    Thách đấu hệ thống mạng nơ-ron nhân tạo AlphaOne
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                                {/* Side Selection */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Chọn quân cờ</span>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setAiMode('human-white')}
                                            className={aiMode === 'human-white' ? "lobby-primary-btn" : "lobby-secondary-btn"}
                                            style={{ flex: 1, padding: '12px', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: aiMode === 'human-white' ? 'none' : '1px solid var(--glass-border)' }}
                                        >
                                            ⚪ Trắng đi trước
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAiMode('human-black')}
                                            className={aiMode === 'human-black' ? "lobby-primary-btn" : "lobby-secondary-btn"}
                                            style={{ flex: 1, padding: '12px', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: aiMode === 'human-black' ? 'none' : '1px solid var(--glass-border)' }}
                                        >
                                            ⚫ Đen đi sau
                                        </button>
                                    </div>
                                </div>

                                {/* AI Model Checkpoint */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Mô hình nơ-ron AI</span>
                                    <select
                                        value={selectedAiModel}
                                        onChange={e => setSelectedAiModel(e.target.value)}
                                        className="custom-input"
                                        style={{ width: '100%', padding: '12px', fontSize: '0.95rem', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.4)', color: 'white', border: '1px solid var(--glass-border)' }}
                                    >
                                        <option value="best_model">Mặc định (Khuyên dùng)</option>
                                        {aiModels.map(m => (
                                            <option key={`model-${m.key}`} value={m.key}>
                                                {m.display || m.key}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* AI Difficulty */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Độ khó máy</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {[
                                            { value: 1, label: 'Dễ (Level 1)' },
                                            { value: 2, label: 'Thường (Level 2)' },
                                            { value: 3, label: 'Khó (Level 3)' },
                                            { value: 4, label: 'Bậc thầy (Level 4)' }
                                        ].map(diffItem => (
                                            <button
                                                key={diffItem.value}
                                                type="button"
                                                onClick={() => setAiDifficulty(diffItem.value)}
                                                className={aiDifficulty === diffItem.value ? "lobby-primary-btn" : "lobby-secondary-btn"}
                                                style={{ padding: '12px', fontSize: '0.85rem', border: aiDifficulty === diffItem.value ? 'none' : '1px solid var(--glass-border)' }}
                                            >
                                                {diffItem.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleStartAiGame}
                                    className="lobby-primary-btn"
                                    style={{ padding: '15px', marginTop: '15px', fontSize: '1rem', width: '100%', fontWeight: 'bold', letterSpacing: '0.5px', background: 'linear-gradient(135deg, var(--accent-blue), #3b82f6)' }}
                                >
                                    Bắt đầu trận đấu 🏁
                                </button>

                                <button onClick={() => setIsAiLobbyOpen(false)} className="lobby-back-btn" style={{ marginTop: '10px' }}>
                                    ← Quay lại Menu chính
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {inviteReceived && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
                        <h2>Lời mời đấu cờ!</h2>
                        <p>{inviteReceived.hostName} đã mời bạn tham gia trận đấu.</p>
                        <div className="btn-group" style={{ marginTop: '20px' }}>
                            <button onClick={handleAcceptInvite} className="primary-btn">Chấp nhận</button>
                            <button onClick={() => setInviteReceived(null)} className="secondary-btn">Từ chối</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { socketClient } from '../services/SocketService';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { FriendService } from '../services/FriendService';
import Sidebar from '../components/Sidebar';
import AdminDisplayName, { checkIsAdmin } from '../components/AdminDisplayName';
import EmojiBox from '../components/EmojiBox';
import { useTranslation } from '../contexts/I18nContext';
import { isImageUrl, formatAvatarUrl } from '../services/MinioService';
import '../index.css';

const MATCH_STATES = {
    INITIALIZING: 'INITIALIZING',
    SEARCHING: 'SEARCHING',
    FOUND: 'FOUND',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    OVER: 'OVER',
    CANCELLED: 'CANCELLED'
};

export default function OnlinePlay() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const initialMatchType = location.state?.matchType || 'rapid';
    const isTournament = location.state?.gameStartMsg?.isTournament || false;

    const [username, setUsername] = useState('Người chơi');
    const [myRole, setMyRole] = useState(null);
    const [matchState, setMatchState] = useState(MATCH_STATES.INITIALIZING);
    const [matchType, setMatchType] = useState(initialMatchType);
    const [status, setStatus] = useState('Đang kết nối...');
    const [gameId, setGameId] = useState(null);
    const [side, setSide] = useState('WHITE');
    const [opponent, setOpponent] = useState(null);
    const [myAvatar, setMyAvatar] = useState('👤');

    useEffect(() => {
        const loadMyAvatar = () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            const payload = AuthService.parseToken(token);
            if (payload?.userId) {
                const saved = localStorage.getItem(`chess-avatar-${payload.userId}`);
                if (saved) {
                    setMyAvatar(saved);
                }
            }
        };
        loadMyAvatar();
        window.addEventListener('profile-update', loadMyAvatar);
        return () => window.removeEventListener('profile-update', loadMyAvatar);
    }, []);

    const [countdown, setCountdown] = useState(5);
    const [hasAccepted, setHasAccepted] = useState(false);
    const [confirmCountdown, setConfirmCountdown] = useState(10);
    const [currentTurn, setCurrentTurn] = useState('w');

    // Private Room State
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');

    // Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [showEmojiBox, setShowEmojiBox] = useState(false);

    // Timer State
    const [whiteTime, setWhiteTime] = useState(600);
    const [blackTime, setBlackTime] = useState(600);

    // Rematch State
    const [rematchOffered, setRematchOffered] = useState(false);
    const [rematchSent, setRematchSent] = useState(false);

    // Draw State
    const [drawOfferReceived, setDrawOfferReceived] = useState(false);
    const [drawOfferSent, setDrawOfferSent] = useState(false);

    // Friend Invite State
    const [inviteReceived, setInviteReceived] = useState(null);
    const [friendRequestSent, setFriendRequestSent] = useState(false);

    const gameRef = useRef(null);
    const boardRef = useRef(null);
    const matchStateRef = useRef(MATCH_STATES.INITIALIZING);
    const sideRef = useRef('WHITE');
    const hasStarted = useRef(false);
    const confirmTimer = useRef(null);
    const initTimer = useRef(null);
    const clockTimer = useRef(null);
    const selectedSquareRef = useRef(null);
    const boardClickHandlerRef = useRef(null);

    useEffect(() => { matchStateRef.current = matchState; }, [matchState]);
    useEffect(() => { sideRef.current = side; }, [side]);

    useEffect(() => {
        const init = async () => {
            if (hasStarted.current) return;
            hasStarted.current = true;

            const token = localStorage.getItem('accessToken');
            if (!token) return;

            const formatName = (str) => {
                if (!str) return 'Người chơi';
                const s = String(str).trim();
                return s.includes('@') ? s.split('@')[0] : s;
            };

            const payload = AuthService.parseToken(token);
            if (payload) {
                const savedName = localStorage.getItem('username');
                setUsername(formatName(savedName || payload.username || payload.sub || 'Người chơi'));
                setMyRole(payload.role || null);
            }

            try {
                const me = await UserService.getMe();
                if (me?.username) {
                    setUsername(formatName(me.username));
                }
            } catch (e) {
                console.warn('Could not fetch user me in OnlinePlay:', e);
            }

            socketClient.addListener(handleSocketMessage);

            // 1. If gameStartMsg is passed from the Main Menu lobby modal redirect
            if (location.state?.gameStartMsg) {
                const msg = location.state.gameStartMsg;
                setSide(msg.side);
                setOpponent({
                    id: msg.opponent,
                    name: msg.opponentName || 'Đối thủ',
                    rating: msg.opponentRating || 1200,
                    avatarUrl: msg.opponentAvatarUrl || msg.opponentAvatar || msg.avatarUrl || msg.avatar,
                    avatar: msg.opponentAvatar || msg.avatar
                });
                setGameId(msg.gameId);
                setWhiteTime(msg.timeLimit || 600);
                setBlackTime(msg.timeLimit || 600);
                setChatMessages([]);
                setRematchOffered(false);
                setRematchSent(false);
                setMatchState(MATCH_STATES.PLAYING);
                initBoard(msg.side, msg.fen, msg.gameId);
            }
            // 2. If redirected here with a friend invite
            else if (location.state?.inviteFriendId) {
                setMatchState(MATCH_STATES.SEARCHING);
                setStatus('Đang mời bạn...');
                setTimeout(() => {
                    socketClient.send({
                        type: 'INVITE_FRIEND',
                        friendId: location.state.inviteFriendId,
                        matchType: location.state.matchType || 'rapid'
                    });
                }, 500);
            }
            // 3. If redirected here after accepting a friend invite
            else if (location.state?.acceptInviteHostId) {
                setMatchState(MATCH_STATES.SEARCHING);
                setStatus('Đang chấp nhận lời mời...');
                socketClient.send({
                    type: 'ACCEPT_INVITE',
                    hostId: location.state.acceptInviteHostId
                });
            }
            // 4. Fallback: check if there's an active game on backend
            else {
                const userData = AuthService.parseToken(token);
                if (userData) {
                    setStatus('Đang kiểm tra ván đấu đang diễn ra...');
                    try {
                        const response = await api.get(`/api/game/active?userId=${userData.userId}`);
                        if (response.status === 200 && response.data) {
                            // Active game exists. Give RECONNECT_GAME socket message 1.5s to arrive
                            initTimer.current = setTimeout(() => {
                                if (matchStateRef.current === MATCH_STATES.INITIALIZING) {
                                    console.log("No active game socket state found, redirecting to menu...");
                                    navigate('/menu', { state: { openLobby: true } });
                                }
                            }, 1500);
                        } else {
                            // No active game, redirect back to menu to open lobby modal
                            console.log("No active game found on backend, redirecting to menu lobby...");
                            navigate('/menu', { state: { openLobby: true } });
                        }
                    } catch (e) {
                        console.error("Active game check failed", e);
                        navigate('/menu', { state: { openLobby: true } });
                    }
                } else {
                    navigate('/menu', { state: { openLobby: true } });
                }
            }
        };

        init();

        return () => {
            socketClient.removeListener(handleSocketMessage);
            if (confirmTimer.current) clearInterval(confirmTimer.current);
            if (initTimer.current) clearTimeout(initTimer.current);
            if (clockTimer.current) clearInterval(clockTimer.current);
            hasStarted.current = false;

            const boardEl = document.getElementById('board');
            if (boardEl && boardClickHandlerRef.current) {
                boardEl.removeEventListener('click', boardClickHandlerRef.current);
            }
        };
    }, [location, navigate]);

    // Clock Timer Effect
    useEffect(() => {
        if (matchState === MATCH_STATES.PLAYING) {
            if (clockTimer.current) clearInterval(clockTimer.current);
            clockTimer.current = setInterval(() => {
                if (currentTurn === 'w') {
                    setWhiteTime(prev => Math.max(0, prev - 1));
                } else {
                    setBlackTime(prev => Math.max(0, prev - 1));
                }
            }, 1000);
        } else {
            if (clockTimer.current) clearInterval(clockTimer.current);
        }
        return () => {
            if (clockTimer.current) clearInterval(clockTimer.current);
        };
    }, [matchState, currentTurn]);

    const joinMatchmaking = async () => {
        setMatchState(MATCH_STATES.SEARCHING);
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

    const handleCreateRoom = () => {
        setStatus('Đang tạo phòng riêng...');
        socketClient.send({ type: 'CREATE_ROOM', matchType: matchType });
    };

    const handleJoinRoom = () => {
        if (!joinRoomCode) return;
        setStatus(`Đang vào phòng ${joinRoomCode}...`);
        socketClient.send({ type: 'JOIN_ROOM', code: joinRoomCode });
    };

    const handleSocketMessage = (data) => {
        const msg = JSON.parse(data);
        console.log("WS Message Received:", msg);

        switch (msg.type) {
            case 'ROOM_CREATED':
                setRoomCode(msg.code);
                setStatus('Đang chờ đối thủ vào phòng: ' + msg.code);
                setMatchState(MATCH_STATES.SEARCHING);
                break;

            case 'MATCH_INVITE':
                setInviteReceived({ hostId: msg.hostId, hostName: msg.hostName });
                break;

            case 'RECONNECT_GAME':
                if (initTimer.current) clearTimeout(initTimer.current);
                setSide(msg.side);
                setGameId(msg.gameId);
                setOpponent({
                    id: msg.opponentId,
                    name: msg.opponentName,
                    rating: msg.opponentRating,
                    avatarUrl: msg.opponentAvatarUrl || msg.opponentAvatar || msg.avatarUrl || msg.avatar,
                    avatar: msg.opponentAvatar || msg.avatar
                });
                setWhiteTime(msg.timeWhite || 600);
                setBlackTime(msg.timeBlack || 600);

                if (msg.chatHistory) {
                    const token = localStorage.getItem('accessToken');
                    const myUser = AuthService.parseToken(token);
                    const parsedChat = msg.chatHistory.map(chatStr => {
                        try {
                            const c = JSON.parse(chatStr);
                            return {
                                sender: c.senderId === myUser.userId ? 'You' : (c.senderName || 'Đối thủ'),
                                text: c.text
                            };
                        } catch (e) { return null; }
                    }).filter(c => c !== null);
                    setChatMessages(parsedChat);
                }

                setMatchState(MATCH_STATES.PLAYING);
                initBoard(msg.side, msg.fen, msg.gameId);
                break;

            case 'PREPARE_GAME':
                if (initTimer.current) clearTimeout(initTimer.current);
                setMatchState(MATCH_STATES.FOUND);
                setGameId(msg.gameId);
                setOpponent({
                    id: msg.opponentId,
                    name: msg.opponentName,
                    country: msg.opponentCountry,
                    rating: msg.opponentRating,
                    avatarUrl: msg.opponentAvatarUrl || msg.opponentAvatar || msg.avatarUrl || msg.avatar,
                    avatar: msg.opponentAvatar || msg.avatar
                });
                startConfirmCountdown(msg.timeout || 10);
                break;

            case 'MATCH_CANCELLED':
                if (confirmTimer.current) clearInterval(confirmTimer.current);
                setMatchState(MATCH_STATES.CANCELLED);
                setStatus(msg.reason);
                setTimeout(() => {
                    setMatchState(MATCH_STATES.INITIALIZING);
                    setStatus('Đã kết nối. Chọn chế độ chơi.');
                    // Don't auto-join here, let user decide
                }, 2000);
                break;

            case 'GAME_START':
                if (confirmTimer.current) clearInterval(confirmTimer.current);
                setSide(msg.side);
                setOpponent(prev => ({
                    ...prev,
                    id: msg.opponent || prev?.id,
                    name: msg.opponentName || prev?.name || 'Đối thủ',
                    rating: msg.opponentRating || prev?.rating || 1200,
                    avatarUrl: msg.opponentAvatarUrl || msg.opponentAvatar || msg.avatarUrl || msg.avatar || prev?.avatarUrl || prev?.avatar,
                    avatar: msg.opponentAvatar || msg.avatar || prev?.avatar
                }));
                setGameId(msg.gameId);
                setMatchState(MATCH_STATES.COUNTDOWN);
                setWhiteTime(msg.timeLimit || 600);
                setBlackTime(msg.timeLimit || 600);
                setChatMessages([]);
                setRematchOffered(false);
                setRematchSent(false);
                initBoard(msg.side, msg.fen, msg.gameId);
                startStartCountdown();
                break;

            case 'OPPONENT_MOVE':
                if (gameRef.current && boardRef.current) {
                    let moveResult = gameRef.current.move(msg.move.toLowerCase(), { sloppy: true });

                    if (!moveResult && msg.fen) {
                        gameRef.current.load(msg.fen);
                    }

                    boardRef.current.position(gameRef.current.fen());
                    setCurrentTurn(gameRef.current.turn());

                    // Sync opponent's time
                    const oppColorChar = sideRef.current.toLowerCase().startsWith('w') ? 'b' : 'w';
                    if (oppColorChar === 'w') {
                        if (msg.timeRemaining !== undefined) setWhiteTime(msg.timeRemaining);
                    } else {
                        if (msg.timeRemaining !== undefined) setBlackTime(msg.timeRemaining);
                    }
                }
                break;

            case 'ERROR':
                if (boardRef.current && gameRef.current) {
                    boardRef.current.position(gameRef.current.fen());
                    setCurrentTurn(gameRef.current.turn());
                    setStatus(msg.message || "Nước đi không hợp lệ! Hãy thử lại.");
                }
                break;

            case 'GAME_OVER':
                setMatchState(MATCH_STATES.OVER);
                setStatus(`Kết thúc: ${msg.reason === 'CHECKMATE' ? 'Chiếu bí' : msg.reason === 'RESIGNATION' ? 'Đầu hàng' : msg.reason === 'TIMEOUT' ? 'Hết giờ' : msg.reason === 'DRAW' ? 'Hòa' : msg.reason} (${msg.result === '1-0' ? 'Trắng thắng' : msg.result === '0-1' ? 'Đen thắng' : 'Hòa'})`);
                if (isTournament) {
                    setTimeout(() => {
                        navigate('/tournaments');
                    }, 5000); // 5 seconds to let them see the final board
                }
                break;

            case 'DRAW_OFFERED':
                setDrawOfferReceived(true);
                break;

            case 'DRAW_REJECTED':
                setStatus("Lời cầu hòa bị từ chối.");
                setDrawOfferSent(false);
                setTimeout(() => setStatus(isMyTurn() ? "LƯỢT CỦA BẠN" : "ĐANG CHỜ..."), 2000);
                break;

            case 'CHAT_MESSAGE':
                setChatMessages(prev => [...prev, { sender: msg.senderName || 'Đối thủ', text: msg.text }]);
                break;

            case 'REMATCH_OFFERED':
                setRematchOffered(true);
                break;
            default:
                break;
        }
    };

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

    const handleAccept = () => {
        if (confirmTimer.current) clearInterval(confirmTimer.current);
        setHasAccepted(true);
        socketClient.send({ type: 'READY', gameId: gameId });
    };

    const handleReject = () => {
        if (confirmTimer.current) clearInterval(confirmTimer.current);
        socketClient.send({ type: 'REJECT_MATCH', gameId: gameId });
        setMatchState(MATCH_STATES.INITIALIZING);
        setStatus('Đã kết nối. Chọn chế độ chơi.');
    };

    const startStartCountdown = () => {
        let count = 5;
        setCountdown(5);
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                setMatchState(MATCH_STATES.PLAYING);
            }
        }, 1000);
    };

    const initBoard = (playerSide, initialFen, activeGameId) => {
        if (!window.Chess || !window.Chessboard) return;

        const checkExist = setInterval(() => {
            const boardEl = document.getElementById('board');
            if (boardEl) {
                clearInterval(checkExist);

                gameRef.current = new window.Chess(initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
                setCurrentTurn(gameRef.current.turn());

                const clearHighlights = () => {
                    document.querySelectorAll('#board .highlight-square').forEach(el => {
                        el.classList.remove('highlight-square');
                    });
                    document.querySelectorAll('#board .highlight-square-selected').forEach(el => {
                        el.classList.remove('highlight-square-selected');
                    });
                };

                const handleBoardClick = (event) => {
                    if (matchStateRef.current !== MATCH_STATES.PLAYING) return;
                    if (!gameRef.current || !boardRef.current) return;

                    const clickedSquareEl = event.target.closest('[data-square]');
                    if (!clickedSquareEl) return;

                    const square = clickedSquareEl.getAttribute('data-square');

                    // Check turn
                    const turn = gameRef.current.turn(); // 'w' or 'b'
                    const playerChar = playerSide.toLowerCase().startsWith('w') ? 'w' : 'b';
                    if (turn !== playerChar) return;

                    const piece = gameRef.current.get(square);

                    // If clicked own piece, select it and highlight legal moves
                    if (piece && piece.color === playerChar) {
                        clearHighlights();
                        selectedSquareRef.current = square;

                        clickedSquareEl.classList.add('highlight-square-selected');

                        const moves = gameRef.current.moves({ square: square, verbose: true });
                        moves.forEach(m => {
                            const destEl = document.querySelector(`#board [data-square="${m.to}"]`);
                            if (destEl) {
                                destEl.classList.add('highlight-square');
                            }
                        });
                    } else if (selectedSquareRef.current) {
                        // Try to move
                        const source = selectedSquareRef.current;
                        let move = gameRef.current.move({
                            from: source,
                            to: square,
                            promotion: 'q'
                        });

                        clearHighlights();
                        selectedSquareRef.current = null;

                        if (move !== null) {
                            // Redraw board instantly
                            boardRef.current.position(gameRef.current.fen());
                            
                            setCurrentTurn(gameRef.current.turn());

                            const promo = move.promotion ? move.promotion : '';
                            const moveCoords = (move.from + move.to + promo).toUpperCase();

                            socketClient.send({
                                type: 'MOVE',
                                gameId: activeGameId,
                                move: moveCoords
                            });
                        }
                    }
                };

                const onDragStart = (source, piece) => {
                    if (matchStateRef.current !== MATCH_STATES.PLAYING) return false;

                    const turn = gameRef.current.turn();
                    const playerChar = playerSide.toLowerCase().startsWith('w') ? 'w' : 'b';
                    if (turn !== playerChar) return false;

                    if ((playerChar === 'w' && piece.search(/^b/) !== -1) ||
                        (playerChar === 'b' && piece.search(/^w/) !== -1)) return false;

                    // Select this square and show legal moves during drag
                    clearHighlights();
                    selectedSquareRef.current = source;

                    const sourceEl = document.querySelector(`#board [data-square="${source}"]`);
                    if (sourceEl) {
                        sourceEl.classList.add('highlight-square-selected');
                    }

                    const moves = gameRef.current.moves({ square: source, verbose: true });
                    moves.forEach(m => {
                        const destEl = document.querySelector(`#board [data-square="${m.to}"]`);
                        if (destEl) {
                            destEl.classList.add('highlight-square');
                        }
                    });

                    return true;
                };

                const onDrop = (source, target) => {
                    let move = gameRef.current.move({ from: source, to: target, promotion: 'q' });
                    if (move === null) return 'snapback';

                    clearHighlights();
                    selectedSquareRef.current = null;

                    setCurrentTurn(gameRef.current.turn());

                    const promo = move.promotion ? move.promotion : '';
                    const moveCoords = (move.from + move.to + promo).toUpperCase();

                    socketClient.send({
                        type: 'MOVE',
                        gameId: activeGameId,
                        move: moveCoords
                    });
                };

                const config = {
                    draggable: true,
                    position: initialFen || 'start',
                    orientation: playerSide.toLowerCase(),
                    onDragStart: onDragStart,
                    onDrop: onDrop,
                    onSnapEnd: () => boardRef.current.position(gameRef.current.fen()),
                    moveSpeed: 'fast',
                    snapbackSpeed: 150,
                    snapSpeed: 100,
                    pieceTheme: '/chessPieces/{piece}.png'
                };

                boardRef.current = window.Chessboard('board', config);

                // Register event listeners
                if (boardEl) {
                    if (boardClickHandlerRef.current) {
                        boardEl.removeEventListener('click', boardClickHandlerRef.current);
                    }
                    boardClickHandlerRef.current = handleBoardClick;
                    boardEl.addEventListener('click', handleBoardClick);
                }
            }
        }, 50);
    };

    const isMyTurn = () => {
        if (!side) return false;
        const playerSideChar = side.toLowerCase().startsWith('w') ? 'w' : 'b';
        return currentTurn === playerSideChar;
    };

    const handleSendChat = () => {
        if (!chatInput.trim()) return;
        socketClient.send({ type: 'CHAT_MESSAGE', gameId: gameId, text: chatInput });
        setChatMessages(prev => [...prev, { sender: 'You', text: chatInput }]);
        setChatInput('');
    };

    const handleAcceptInvite = () => {
        socketClient.send({ type: 'ACCEPT_INVITE', hostId: inviteReceived.hostId });
        setInviteReceived(null);
    };

    const handleOfferRematch = () => {
        socketClient.send({ type: 'REMATCH_OFFER', gameId: gameId });
        setRematchSent(true);
    };

    const handleAcceptRematch = () => {
        socketClient.send({ type: 'REMATCH_RESPONSE', gameId: gameId, accepted: true });
        setRematchOffered(false);
    };

    const handleResign = () => {
        if (window.confirm("Bạn có chắc chắn muốn xin thua?")) {
            socketClient.send({ type: 'RESIGN', gameId: gameId });
        }
    };

    const handleOfferDraw = () => {
        socketClient.send({ type: 'DRAW_OFFER', gameId: gameId });
        setDrawOfferSent(true);
        setStatus("Đã gửi lời cầu hòa...");
    };

    const handleDrawResponse = (accepted) => {
        socketClient.send({ type: 'DRAW_RESPONSE', gameId: gameId, accepted: accepted });
        setDrawOfferReceived(false);
    };

    const handleAddFriend = async () => {
        if (!opponent?.id) return;
        try {
            const token = await AuthService.getValidToken();
            const userData = AuthService.parseToken(token);
            await FriendService.sendRequest(userData.userId, opponent.id);
            setFriendRequestSent(true);
            setStatus("Đã gửi yêu cầu kết bạn!");
        } catch (err) {
            setStatus(err.response?.data?.message || err.message || "Không thể gửi yêu cầu kết bạn.");
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const myTime = side.toLowerCase().startsWith('w') ? whiteTime : blackTime;
    const oppTime = side.toLowerCase().startsWith('w') ? blackTime : whiteTime;

    return (
        <div className="main-menu-wrapper">
            <Sidebar username={username} />

            {/* Friend Invite Overlay */}
            {inviteReceived && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
                        <h2>Lời mời đấu cờ!</h2>
                        <p>{inviteReceived.hostName} đã mời bạn tham gia ván đấu.</p>
                        <div className="btn-group" style={{ marginTop: '20px' }}>
                            <button onClick={handleAcceptInvite} className="primary-btn">Chấp nhận</button>
                            <button onClick={() => setInviteReceived(null)} className="secondary-btn">Từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Draw Offer Overlay */}
            {drawOfferReceived && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
                        <h2>Lời cầu hòa</h2>
                        <p>{opponent?.name} muốn cầu hòa.</p>
                        <div className="btn-group" style={{ marginTop: '20px' }}>
                            <button onClick={() => handleDrawResponse(true)} className="primary-btn">Chấp nhận Hòa</button>
                            <button onClick={() => handleDrawResponse(false)} className="secondary-btn">Từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {matchState === MATCH_STATES.PLAYING || matchState === MATCH_STATES.COUNTDOWN || matchState === MATCH_STATES.OVER ? (
                <>
                    {/* Center Area (Chess Board) */}
                    <div className="board-area">
                        <div className="board-container" style={{ position: 'relative' }}>
                            {/* Opponent Info Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className={`avatar-small ${checkIsAdmin(opponent?.role, opponent?.name) ? 'admin-avatar-ring' : ''}`} style={{ width: '32px', height: '32px', fontSize: '0.9rem', overflow: 'hidden' }}>
                                        {isImageUrl(opponent?.avatarUrl || opponent?.avatar) ? (
                                            <img src={formatAvatarUrl(opponent?.avatarUrl || opponent?.avatar)} alt={opponent?.name || 'Đối thủ'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <span className="icon">{opponent?.avatarUrl || opponent?.avatar || '👤'}</span>
                                        )}
                                    </div>
                                    <AdminDisplayName
                                        username={opponent?.name || 'Đối thủ'}
                                        role={opponent?.role}
                                        nameStyle={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}
                                    />
                                    {matchState === MATCH_STATES.PLAYING && (
                                        <button
                                            onClick={handleAddFriend}
                                            disabled={friendRequestSent}
                                            style={{ background: 'none', border: '1px solid var(--glass-border)', color: 'var(--accent-blue)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', cursor: friendRequestSent ? 'default' : 'pointer', opacity: friendRequestSent ? 0.5 : 1 }}
                                        >
                                            {friendRequestSent ? "✓ Đã gửi yêu cầu" : "+ Kết bạn"}
                                        </button>
                                    )}
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '1.2rem', color: !isMyTurn() ? '#f87171' : 'white', fontWeight: 'bold' }}>
                                    {formatTime(oppTime)}
                                </div>
                            </div>

                            {/* Chess Board element */}
                            <div id="board" className="chess-board-wrapper" style={{ width: '100%', aspectRatio: '1/1', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}></div>

                            {/* Your Info Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className={`avatar-small ${checkIsAdmin(myRole, username) ? 'admin-avatar-ring' : ''}`} style={{ width: '32px', height: '32px', fontSize: '0.9rem', overflow: 'hidden' }}>
                                        {isImageUrl(myAvatar) ? (
                                            <img src={formatAvatarUrl(myAvatar)} alt={username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <span className="icon">{myAvatar || '👤'}</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AdminDisplayName
                                            username={username}
                                            role={myRole}
                                            nameStyle={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}
                                        />
                                        <span className="flag">🇻🇳</span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '1.2rem', color: isMyTurn() ? '#4ade80' : 'white', fontWeight: 'bold' }}>
                                    {formatTime(myTime)}
                                </div>
                            </div>

                            {/* Countdown overlay */}
                            {matchState === MATCH_STATES.COUNTDOWN && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(8,10,15,0.85)', padding: '20px 40px', borderRadius: '16px', backdropFilter: 'blur(10px)', border: '1px solid var(--accent-purple)', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                    <h1 style={{ fontSize: '4rem', margin: 0, color: 'white', textShadow: '0 0 10px rgba(167,139,250,0.5)' }}>{countdown}</h1>
                                </div>
                            )}

                            {/* Game Over overlay */}
                            {matchState === MATCH_STATES.OVER && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(8,10,15,0.9)', padding: '30px 40px', borderRadius: '20px', backdropFilter: 'blur(12px)', border: '1px solid var(--accent-blue)', zIndex: 10, textAlign: 'center', minWidth: '350px', boxShadow: '0 15px 40px rgba(0,0,0,0.6)' }}>
                                    <h1 style={{ fontSize: '2.2rem', margin: '0 0 10px 0', color: 'white', letterSpacing: '1px' }}>VÁN ĐẤU KẾT THÚC</h1>
                                    <p style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>{status}</p>

                                    {isTournament ? (
                                        <div style={{ marginTop: '20px' }}>
                                            <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '10px' }}>⌛ Tự động quay lại bảng xếp hạng giải đấu...</p>
                                            <button onClick={() => navigate('/tournaments')} className="primary-btn" style={{ width: '100%' }}>Quay lại Giải đấu</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ marginTop: '20px' }}>
                                                {rematchOffered ? (
                                                    <div>
                                                        <p style={{ color: '#4ade80', marginBottom: '10px', fontWeight: 'bold' }}>Đối thủ muốn đấu lại!</p>
                                                        <button onClick={handleAcceptRematch} className="primary-btn" style={{ width: '100%' }}>Chấp nhận đấu lại</button>
                                                    </div>
                                                ) : (
                                                    rematchSent ? (
                                                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Đã gửi lời mời đấu lại...</p>
                                                    ) : (
                                                        <button onClick={handleOfferRematch} className="primary-btn" style={{ width: '100%' }}>Yêu cầu đấu lại</button>
                                                    )
                                                )}
                                            </div>
                                            <button onClick={() => navigate('/menu')} className="secondary-btn" style={{ marginTop: '10px', width: '100%' }}>Rời phòng</button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel (Dashboard) */}
                    <div className="right-panel">
                        <div className="glass-panel" style={{ width: '100%', marginBottom: '20px', boxSizing: 'border-box' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', color: 'var(--text-primary)' }}>📊 Chi tiết trận đấu</h2>
                            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đối thủ</span>
                                <strong style={{ color: 'var(--accent-blue)', fontSize: '0.9rem' }}>{opponent?.name || 'Đối thủ'}</strong>
                            </div>
                            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Hệ số đối thủ</span>
                                <strong style={{ fontSize: '0.9rem' }}>⭐ {opponent?.rating || '1200'}</strong>
                            </div>
                            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Quân cờ của bạn</span>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{side === 'WHITE' ? 'Trắng ⚪' : 'Đen ⚫'}</strong>
                            </div>
                            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Trạng thái</span>
                                <strong style={{ fontSize: '0.9rem', color: matchState === MATCH_STATES.OVER ? 'white' : (isMyTurn() ? '#4ade80' : '#f87171') }}>
                                    {matchState === MATCH_STATES.PLAYING
                                        ? (isMyTurn() ? "LƯỢT CỦA BẠN" : "ĐANG CHỜ...")
                                        : (matchState === MATCH_STATES.OVER ? "KẾT THÚC" : "CHUẨN BỊ")
                                    }
                                </strong>
                            </div>
                        </div>

                        {/* In-Game Chat */}
                        <div className="glass-panel" style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', marginBottom: '20px' }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>💬 Trò chuyện</h3>
                            <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {chatMessages.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '10px' }}>Gửi lời chào tới đối thủ...</span>}
                                {chatMessages.map((msg, idx) => {
                                    const isSenderMe = msg.sender === 'You' || msg.sender === 'Bạn';
                                    const senderDisplayName = isSenderMe ? 'Bạn' : msg.sender;
                                    const isAdminSender = isSenderMe 
                                        ? checkIsAdmin(myRole, username) 
                                        : checkIsAdmin(msg.role || (opponent?.name === msg.sender ? opponent?.role : null), msg.sender);

                                    return (
                                        <div key={idx} style={{ alignSelf: isSenderMe ? 'flex-end' : 'flex-start', background: isSenderMe ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid', borderColor: isSenderMe ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', maxWidth: '85%' }}>
                                            <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: isSenderMe ? '#60a5fa' : 'var(--text-muted)', fontWeight: 'bold', marginBottom: '2px' }}>
                                                <AdminDisplayName
                                                    username={senderDisplayName}
                                                    isAdmin={isAdminSender}
                                                    size="sm"
                                                    nameStyle={{ fontWeight: 'bold', color: isSenderMe ? '#60a5fa' : 'inherit' }}
                                                />
                                            </span>
                                            <span style={{ fontSize: '0.85rem', wordBreak: 'break-word', color: 'var(--text-primary)' }}>{msg.text}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', position: 'relative' }}>
                                {showEmojiBox && (
                                    <EmojiBox
                                        onSelectEmoji={(emoji) => {
                                            setChatInput(prev => prev + emoji);
                                        }}
                                        onSelectPhrase={(phrase) => {
                                            setChatInput(phrase);
                                        }}
                                        onClose={() => setShowEmojiBox(false)}
                                    />
                                )}
                                <button
                                    type="button"
                                    className="emoji-toggle-btn"
                                    onClick={() => setShowEmojiBox(prev => !prev)}
                                    title="Biểu cảm và Tin nhanh"
                                    style={{
                                        background: showEmojiBox ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${showEmojiBox ? 'rgba(59, 130, 246, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        borderRadius: '8px',
                                        fontSize: '1.25rem',
                                        padding: '0 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0
                                    }}
                                >
                                    😊
                                </button>
                                <input
                                    type="text"
                                    className="custom-input"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                                    placeholder="Nhập tin nhắn..."
                                    style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                                />
                                <button onClick={handleSendChat} className="primary-btn" style={{ padding: '0 15px', fontSize: '0.85rem' }}>Gửi</button>
                            </div>
                        </div>

                        {/* In-Game Actions */}
                        {matchState === MATCH_STATES.PLAYING && (
                            <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>⚙️ Hành động</h3>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={handleOfferDraw}
                                        className="secondary-btn"
                                        disabled={drawOfferSent}
                                        style={{ flex: 1, padding: '12px', fontSize: '0.85rem', opacity: drawOfferSent ? 0.5 : 1 }}
                                    >
                                        {drawOfferSent ? "Đã cầu hòa" : "Cầu hòa 🤝"}
                                    </button>
                                    <button 
                                        onClick={handleResign} 
                                        className="secondary-btn" 
                                        style={{ flex: 1, padding: '12px', fontSize: '0.85rem', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.2)' }}
                                    >
                                        Đầu hàng 🏳️
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* Non-playing central area (e.g. friend invite pending) */
                <div className="board-area">
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', textAlign: 'center', padding: '40px 30px', borderRadius: '24px' }}>
                        {matchState === MATCH_STATES.SEARCHING && (
                            <div className="searching-ui">
                                <div className="lobby-spinner-container" style={{ margin: '0 auto 25px' }}>
                                    <div className="lobby-pulse-ring"></div>
                                    <div className="lobby-spinner"></div>
                                    <span className="lobby-search-icon">🔍</span>
                                </div>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'white' }}>Đang kết nối trận đấu</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>{status}</p>
                                
                                {roomCode && (
                                    <div className="lobby-room-code-box" style={{ margin: '15px 0' }}>
                                        <span className="room-label">MÃ PHÒNG:</span>
                                        <h1 className="room-code">{roomCode}</h1>
                                        <p className="room-desc">Chia sẻ mã này với bạn bè để mời chơi!</p>
                                    </div>
                                )}

                                <button onClick={() => {
                                    setMatchState(MATCH_STATES.INITIALIZING);
                                    setRoomCode('');
                                    socketClient.send({ type: 'LEAVE_QUEUE' });
                                    navigate('/menu');
                                }} className="lobby-cancel-btn" style={{ marginTop: '20px', width: '100%' }}>Hủy lời mời</button>
                            </div>
                        )}

                        {matchState === MATCH_STATES.FOUND && (
                            <div className="found-ui">
                                <div className="match-found-badge">ĐÃ TÌM THẤY TRẬN!</div>
                                <div className="opponent-card" style={{ margin: '20px 0' }}>
                                    <div className="opponent-avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isImageUrl(opponent?.avatarUrl || opponent?.avatar) ? (
                                            <img src={formatAvatarUrl(opponent?.avatarUrl || opponent?.avatar)} alt={opponent?.name || 'Đối thủ'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span>{opponent?.avatarUrl || opponent?.avatar || '👤'}</span>
                                        )}
                                    </div>
                                    <div className="opponent-details">
                                        <h2 className="opponent-name">{opponent?.name}</h2>
                                        <p className="opponent-stats">🌍 {opponent?.country || 'Earth'} • ⭐ Rating: {opponent?.rating}</p>
                                    </div>
                                </div>
                                {!hasAccepted ? (
                                    <div className="lobby-decision-group">
                                        <button onClick={handleAccept} className="lobby-accept-btn">CHẤP NHẬN ({confirmCountdown}s)</button>
                                        <button onClick={handleReject} className="lobby-reject-btn">TỪ CHỐI</button>
                                    </div>
                                ) : (
                                    <div className="lobby-waiting-opponent">
                                        <div className="small-loader"></div>
                                        <p>Đã chấp nhận! Đang chờ đối thủ xác nhận...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {matchState === MATCH_STATES.CANCELLED && (
                            <div className="cancelled-ui">
                                <h2 style={{ color: '#f87171', fontSize: '1.5rem', marginBottom: '10px' }}>Trận đấu đã bị hủy</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '30px' }}>{status}</p>
                                <button onClick={() => navigate('/menu')} className="primary-btn" style={{ width: '100%' }}>Quay lại Menu</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

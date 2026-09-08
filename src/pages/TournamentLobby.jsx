import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { TournamentService } from '../services/TournamentService';
import { socketClient } from '../services/SocketService';
import { AuthService } from '../services/AuthService';
import '../index.css';

export default function TournamentLobby() {
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    const [username, setUsername] = useState('Người chơi');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pairing, setPairing] = useState(null);
    const pairingRef = useRef(null);
    useEffect(() => {
        pairingRef.current = pairing;
    }, [pairing]);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isForfeited, setIsForfeited] = useState(false);
    const [forfeitMessage, setForfeitMessage] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);
    const [completedMessage, setCompletedMessage] = useState('');

    const intervalRef = useRef(null);
    const countdownRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            const payload = AuthService.parseToken(token);
            if (payload) {
                setUsername(payload.username || 'Người chơi');
            }

            // Connect socket if not connected
            socketClient.connect();

            await fetchPairing();
            setLoading(false);

            // Start polling pairing
            intervalRef.current = setInterval(fetchPairing, 5000);
            
            // Listen to socket
            socketClient.addListener(handleSocketMessage);
        };

        init();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            socketClient.removeListener(handleSocketMessage);
        };
    }, [tournamentId, navigate]);

    const fetchPairing = async () => {
        try {
            const data = await TournamentService.getMyPairing(tournamentId);
            console.log("Fetched pairing from polling:", data);
            setPairing(data);
            if (data) {
                if (data.inBreak) {
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    navigate(`/tournaments/break/${tournamentId}?duration=${data.breakTimeLeftSeconds || 600}`);
                    return;
                }

                if (data.result) {
                    console.log("Pairing has a result (forfeited or finished):", data.result);
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    
                    const iAmWhite = data.myColor === 'WHITE';
                    const iWon = (data.result === '1-0' && iAmWhite) || (data.result === '0-1' && !iAmWhite);
                    const isDraw = data.result === '1/2-1/2';
                    
                    // Case 1: You did not check in -> forfeited!
                    if (!data.iAmReady && !data.gameId) {
                        setIsForfeited(true);
                        setIsCompleted(false);
                        if (data.result === '0-0') {
                            setForfeitMessage('Cả hai đấu thủ đều bị xử thua do không điểm danh!');
                        } else {
                            setForfeitMessage('Bạn bị xử thua do không điểm danh đúng giờ!');
                        }
                    } else {
                        // Case 2: You completed the match early
                        setIsCompleted(true);
                        setIsForfeited(false);
                        if (isDraw) {
                            setCompletedMessage('Kết quả: Hòa (½ - ½)');
                        } else if (iWon) {
                            if (!data.gameId) {
                                setCompletedMessage('Bạn đã thắng cuộc do đối thủ không điểm danh! (1 - 0)');
                            } else {
                                setCompletedMessage('Chúc mừng! Bạn đã thắng ván đấu này! (1 - 0)');
                            }
                        } else {
                            if (!data.gameId) {
                                setCompletedMessage('Bạn bị xử thua do không điểm danh đúng giờ! (0 - 1)');
                            } else {
                                setCompletedMessage('Bạn đã thua ván đấu này. (0 - 1)');
                            }
                        }
                    }
                    return;
                }

                if (data.gameId) {
                    console.log("Game already started, navigating to game:", data.gameId);
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    navigate('/play-online', {
                        state: {
                            gameStartMsg: {
                                gameId: data.gameId,
                                side: data.myColor,
                                opponentName: data.opponentName,
                                opponentRating: data.opponentRating,
                                timeLimit: data.lobbyTimeLimitSeconds || 600,
                                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                                isTournament: true,
                                tournamentId: tournamentId
                            }
                        }
                    });
                    return;
                }

                setTimeLeft(data.lobbyTimeLeftSeconds);
                startCountdown(data.lobbyTimeLeftSeconds);
            }
        } catch (err) {
            console.error("Error fetching pairing", err);
            setError(err.response?.data?.message || "Không thể tải thông tin cặp đấu.");
        }
    };

    const startCountdown = (secs) => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        let current = secs;
        setTimeLeft(current);
        countdownRef.current = setInterval(() => {
            current = Math.max(0, current - 1);
            setTimeLeft(current);
            if (current <= 0) {
                clearInterval(countdownRef.current);
            }
        }, 1000);
    };

    const handleReady = () => {
        if (!pairing) return;
        console.log("handleReady clicked. Sending TOURNAMENT_JOIN_LOBBY. pairingId:", pairing.pairingId);
        socketClient.send({
            type: 'TOURNAMENT_JOIN_LOBBY',
            pairingId: pairing.pairingId
        });
        setPairing(prev => {
            console.log("Setting iAmReady to true locally");
            return prev ? { ...prev, iAmReady: true } : null;
        });
    };

    const handleSocketMessage = (data) => {
        try {
            const msg = JSON.parse(data);
            console.log("Lobby socket event:", msg);

            const currentPairing = pairingRef.current;
            switch (msg.type) {
                case 'TOURNAMENT_LOBBY_UPDATE':
                    console.log("Processing TOURNAMENT_LOBBY_UPDATE. currentPairing:", currentPairing, "msg:", msg);
                    if (currentPairing && msg.pairingId === currentPairing.pairingId) {
                        setPairing(prev => {
                            if (!prev) return null;
                            const amIWhite = prev.myColor === 'WHITE';
                            const updated = {
                                ...prev,
                                iAmReady: amIWhite ? msg.whiteReady : msg.blackReady,
                                opponentReady: amIWhite ? msg.blackReady : msg.whiteReady
                            };
                            console.log("Updated pairing readiness state locally:", updated);
                            return updated;
                        });
                    } else {
                        console.warn("Lobby update ignored. currentPairing is null or pairingId mismatch. msg.pairingId:", msg.pairingId, "current:", currentPairing?.pairingId);
                    }
                    break;

                case 'TOURNAMENT_MATCH_START':
                case 'GAME_START':
                    // If game has started
                    if (currentPairing && (msg.pairingId === currentPairing.pairingId || msg.type === 'GAME_START')) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        if (intervalRef.current) clearInterval(intervalRef.current);

                        navigate('/play-online', {
                            state: {
                                gameStartMsg: {
                                    gameId: msg.gameId,
                                    side: msg.side || currentPairing.myColor,
                                    opponent: msg.opponent || currentPairing.opponentId,
                                    opponentName: msg.opponentName || currentPairing.opponentName,
                                    opponentRating: msg.opponentRating || currentPairing.opponentRating,
                                    timeLimit: msg.timeLimit || 600,
                                    fen: msg.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                                    isTournament: true,
                                    tournamentId: tournamentId
                                }
                            }
                        });
                    }
                    break;

                case 'TOURNAMENT_PAIRING_FORFEITED':
                    if (currentPairing && msg.pairingId === currentPairing.pairingId) {
                        setIsForfeited(true);
                        setForfeitMessage(`Trận đấu bị xử thua do quá giờ check-in. Kết quả: ${msg.result}`);
                    }
                    break;

                case 'ROUND_BREAK_START':
                    if (msg.tournamentId === parseInt(tournamentId)) {
                        navigate(`/tournaments/break/${tournamentId}?duration=${msg.breakDurationSeconds || 600}`);
                    }
                    break;

                case 'ROUND_STARTED':
                    if (msg.tournamentId === parseInt(tournamentId)) {
                        setIsForfeited(false);
                        setForfeitMessage('');
                        setIsCompleted(false);
                        setCompletedMessage('');
                        fetchPairing();
                    }
                    break;

                default:
                    break;
            }
        } catch (e) {
            console.error("Failed parsing socket data", e);
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (loading) {
        return (
            <div className="friends-page-wrapper">
                <Sidebar username={username} />
                <div className="friends-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ color: 'white', fontSize: '1.2rem' }}>Đang tải phòng chờ...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="friends-page-wrapper">
            <Sidebar username={username} />

            <div className="friends-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '20px' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '30px', textAlign: 'center' }}>
                    
                    {error && (
                        <div style={{ color: '#ef4444', marginBottom: '20px', fontWeight: 'bold' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {!pairing ? (
                        <div>
                            <h2 style={{ color: 'var(--text-muted)' }}>Đang đợi phân cặp đấu...</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '10px' }}>Vui lòng giữ kết nối. Trận đấu của bạn sẽ xuất hiện tại đây khi vòng mới bắt đầu.</p>
                            <button className="secondary-btn" onClick={() => navigate('/tournaments')} style={{ marginTop: '20px' }}>Quay lại</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                            {/* Round Number Header */}
                            <div>
                                <h1 style={{ color: 'var(--accent-blue-hover)', fontSize: '2rem', margin: '0 0 5px 0' }}>VÒNG {pairing.roundNumber}</h1>
                                <p style={{ color: 'var(--text-muted)' }}>Phòng Chờ Điểm Danh Trận Đấu</p>
                            </div>

                            {pairing.isBye ? (
                                <div className="glass-panel" style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', padding: '30px' }}>
                                    <h2 style={{ color: '#4ade80', margin: '0 0 10px 0' }}>🎉 Bạn được BYE vòng này!</h2>
                                    <p style={{ color: 'var(--text-muted)' }}>Bạn tự động nhận được 1.0 điểm mà không cần thi đấu ở vòng này.</p>
                                    <button className="primary-btn" onClick={() => navigate('/tournaments')} style={{ marginTop: '20px' }}>Quay lại Giải đấu</button>
                                </div>
                            ) : isCompleted ? (
                                <div className="glass-panel" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '30px' }}>
                                    <h2 style={{ color: '#60a5fa', margin: '0 0 10px 0' }}>✓ Bạn Đã Hoàn Thành Vòng Này</h2>
                                    <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: '500', marginBottom: '15px' }}>
                                        {completedMessage}
                                    </p>
                                    <p style={{ color: 'var(--text-muted)' }}>
                                        Đang chờ tất cả các cặp đấu khác kết thúc để ban tổ chức cập nhật kết quả và bước vào vòng tiếp theo. Vui lòng không rời đi.
                                    </p>
                                    <div style={{ marginTop: '25px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                        <button className="primary-btn" onClick={() => navigate('/tournaments')}>Xem Bảng Xếp Hạng</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Players Card Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '20px' }}>
                                        {/* Player 1 (You) */}
                                        <div className="glass-panel" style={{ flex: 1, padding: '20px', border: pairing.iAmReady ? '1px solid #4ade80' : '1px solid var(--glass-border)' }}>
                                            <h3 style={{ margin: '0 0 5px 0' }}>Bạn</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Quân cờ: {pairing.myColor === 'WHITE' ? 'Trắng ⚪' : 'Đen ⚫'}</p>
                                            <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: pairing.iAmReady ? '#4ade80' : '#ef4444' }}></span>
                                                <strong style={{ color: pairing.iAmReady ? '#4ade80' : '#ef4444', fontSize: '0.85rem' }}>
                                                    {pairing.iAmReady ? 'ĐÃ SẴN SÀNG' : 'CHƯA SẴN SÀNG'}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* VS Badge */}
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-purple)' }}>VS</div>

                                        {/* Player 2 (Opponent) */}
                                        <div className="glass-panel" style={{ flex: 1, padding: '20px', border: pairing.opponentReady ? '1px solid #4ade80' : '1px solid var(--glass-border)' }}>
                                            <h3 style={{ margin: '0 0 5px 0' }}>{pairing.opponentName}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Elo: {pairing.opponentRating}</p>
                                            <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: pairing.opponentReady ? '#4ade80' : '#ef4444' }}></span>
                                                <strong style={{ color: pairing.opponentReady ? '#4ade80' : '#ef4444', fontSize: '0.85rem' }}>
                                                    {pairing.opponentReady ? 'ĐÃ SẴN SÀNG' : 'CHƯA SẴN SÀNG'}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Warnings / Forfeit banner */}
                                    {isForfeited ? (
                                        <div className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '15px' }}>
                                            <strong>{forfeitMessage}</strong>
                                        </div>
                                    ) : (
                                        /* Countdown area */
                                        <div style={{ margin: '20px 0' }}>
                                            <div style={{ fontSize: '3rem', fontFamily: 'monospace', fontWeight: 'bold', color: timeLeft < 60 ? '#ef4444' : 'white' }}>
                                                {formatTime(timeLeft)}
                                            </div>
                                            <p style={{ color: '#fbbf24', fontSize: '0.85rem', marginTop: '5px' }}>
                                                ⚠️ Bạn phải ấn nút SẴN SÀNG trước khi thời gian kết thúc để tránh bị xử thua vắng mặt!
                                            </p>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                        {isForfeited ? (
                                            <button className="primary-btn" onClick={() => navigate('/tournaments')}>Quay lại Giải đấu</button>
                                        ) : (
                                            <>
                                                <button
                                                    className="primary-btn"
                                                    onClick={handleReady}
                                                    disabled={pairing.iAmReady}
                                                    style={{ minWidth: '150px', background: pairing.iAmReady ? 'rgba(74, 222, 128, 0.2)' : 'var(--accent-blue)', color: pairing.iAmReady ? '#4ade80' : 'white', cursor: pairing.iAmReady ? 'default' : 'pointer' }}
                                                >
                                                    {pairing.iAmReady ? '✓ ĐÃ CHECK IN' : 'SẴN SÀNG'}
                                                </button>
                                                <button className="secondary-btn" onClick={() => navigate('/tournaments')}>Bảng xếp hạng</button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

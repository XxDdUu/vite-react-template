import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { ReplayService } from '../services/ReplayService';
import { AuthService } from '../services/AuthService';
import '../index.css';

export default function Replay() {
    const navigate = useNavigate();
    const { gameId } = useParams();
    const [username, setUsername] = useState('Người chơi');
    const [game, setGame] = useState(null);
    const [moves, setMoves] = useState([]);
    const [analysis, setAnalysis] = useState(null);
    const [currentMoveIdx, setCurrentMoveIdx] = useState(-1); // -1 is starting position
    const [errorMsg, setErrorMsg] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1500); // ms per move

    const gameRef = useRef(null);
    const boardRef = useRef(null);

    useEffect(() => {
        let active = true;
        const init = async () => {
            const token = localStorage.getItem('accessToken');
            if (!active || !token) return;
            const payload = AuthService.parseToken(token);
            if (!active) return;
            if (payload) {
                setUsername(payload.username || 'Người chơi');
            }

            try {
                const gameData = await ReplayService.getGame(gameId);
                if (!active) return;
                setGame(gameData);

                const moveList = await ReplayService.getGameMoves(gameId);
                if (!active) return;
                setMoves(moveList || []);

                const analysisData = await ReplayService.getGameAnalysis(gameId);
                if (!active) return;
                setAnalysis(analysisData);

                // Initialize board after data loads
                if (window.Chess && window.Chessboard) {
                    gameRef.current = new window.Chess();
                    
                    const config = {
                        position: 'start',
                        draggable: false, // Replay mode is read-only
                        pieceTheme: '/chessPieces/{piece}.png'
                    };

                    setTimeout(() => {
                        if (!active) return;
                        const boardEl = document.getElementById('replay-board');
                        if (boardEl) {
                            boardRef.current = window.Chessboard('replay-board', config);
                        }
                    }, 200);
                }
            } catch (err) {
                if (!active) return;
                console.error(err);
                if (err.response?.status === 403) {
                    setErrorMsg(err.response?.data?.message || "Replay trận đấu trong giải chỉ khả dụng sau khi giải đấu đã kết thúc hoàn toàn.");
                } else {
                    setErrorMsg("Không thể tải thông tin ván đấu.");
                }
            }
        };

        init();

        return () => {
            active = false;
            if (boardRef.current) {
                try {
                    boardRef.current.destroy();
                    boardRef.current = null;
                } catch (e) {
                    console.warn("Failed to destroy boardRef in Replay", e);
                }
            }
        };
    }, [gameId, navigate]);

    // Autoplay Timer effect
    useEffect(() => {
        if (!isPlaying) return;

        const timer = setTimeout(() => {
            if (currentMoveIdx < moves.length - 1) {
                handleJumpToMove(currentMoveIdx + 1);
            } else {
                setIsPlaying(false);
            }
        }, playSpeed);

        return () => clearTimeout(timer);
    }, [isPlaying, currentMoveIdx, moves, playSpeed]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentMoveIdx, moves]);

    const handleJumpToMove = (idx) => {
        if (!gameRef.current || !boardRef.current) return;
        
        gameRef.current.reset();
        for (let i = 0; i <= idx; i++) {
            gameRef.current.move(moves[i].sanMove);
        }
        
        boardRef.current.position(gameRef.current.fen(), false);
        setCurrentMoveIdx(idx);
    };

    const handleNext = () => {
        if (currentMoveIdx < moves.length - 1) {
            handleJumpToMove(currentMoveIdx + 1);
        }
    };

    const handlePrev = () => {
        if (currentMoveIdx >= 0) {
            handleJumpToMove(currentMoveIdx - 1);
        }
    };

    const handleFirst = () => {
        if (!gameRef.current || !boardRef.current) return;
        gameRef.current.reset();
        boardRef.current.position(gameRef.current.fen(), false);
        setCurrentMoveIdx(-1);
    };

    const handleLast = () => {
        if (moves.length > 0) {
            handleJumpToMove(moves.length - 1);
        }
    };

    // Calculate evaluation bar height
    // Standard starting FEN is 50%
    const getEvalPercentage = () => {
        if (currentMoveIdx === -1 || moves.length === 0) return 50;
        const currentMove = moves[currentMoveIdx];
        if (currentMove.evaluation === null || currentMove.evaluation === undefined) return 50;
        
        let evalVal = currentMove.evaluation;
        // Map evaluation (-5 to +5) to percentage (5% to 95%)
        let percentage = 50 + (evalVal * 8); // 8% per pawn advantage
        return Math.max(5, Math.min(95, percentage));
    };

    const getEvalText = () => {
        if (currentMoveIdx === -1 || moves.length === 0) return '0.0';
        const currentMove = moves[currentMoveIdx];
        if (currentMove.evaluation === null || currentMove.evaluation === undefined) return '-';
        return currentMove.evaluation > 0 ? `+${currentMove.evaluation.toFixed(1)}` : currentMove.evaluation.toFixed(1);
    };

    if (errorMsg) {
        return (
            <div className="main-menu-wrapper" style={{ display: 'flex', background: '#1c1a17', minHeight: '100vh', width: '100vw', color: '#fff', overflow: 'hidden' }}>
                <Sidebar username={username} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#262421', border: '1px solid #312e2b', padding: '40px', borderRadius: '8px', textAlign: 'center', maxWidth: '500px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                        <h2 style={{ color: '#ef4444', marginBottom: '15px', marginTop: 0 }}>🚫 Truy cập bị từ chối</h2>
                        <p style={{ color: '#babfc3', fontSize: '1rem', lineHeight: '1.5', margin: '0 0 20px 0' }}>{errorMsg}</p>
                        <button className="primary-btn" style={{ background: '#81b64c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => navigate('/tournaments')}>Quay lại Giải đấu</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-menu-wrapper" style={{ display: 'flex', background: '#1c1a17', minHeight: '100vh', width: '100vw', color: '#fff', overflow: 'hidden' }}>
            <Sidebar username={username} />

            {/* Center Area (Chess Board) */}
            <div className="board-area" style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className="board-container" style={{ position: 'relative', width: '100%', maxWidth: '85vh' }}>
                    
                    {/* Opponent Info Bar (Black) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar-small" style={{ width: '32px', height: '32px', fontSize: '0.9rem', background: '#302e2c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.1rem' }}>👤</span>
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '1rem', color: '#e3e3e3', fontFamily: '"Outfit", sans-serif' }}>
                                {game?.blackPlayer?.username || 'Đối thủ'}
                            </span>
                        </div>
                        <div style={{ background: '#262421', border: '1px solid rgba(255,255,255,0.06)', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', color: '#babfc3', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>⚫</span>
                            <span>ĐEN</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                        {/* Eval Bar */}
                        <div className="eval-wrapper" style={{ height: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <div className="eval-fill" style={{ height: `${getEvalPercentage()}%` }}></div>
                            <div className="eval-text">{getEvalText()}</div>
                        </div>

                        {/* Chess Board Wrapper */}
                        <div id="replay-board" className="chess-board-wrapper" style={{ flex: 1, aspectRatio: '1/1', boxShadow: '0 12px 40px rgba(0,0,0,0.65)', borderRadius: '6px', overflow: 'hidden', border: '1px solid #403d39' }}></div>
                    </div>

                    {/* Player Info Bar (White) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '0 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar-small" style={{ width: '32px', height: '32px', fontSize: '0.9rem', background: '#302e2c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.1rem' }}>👤</span>
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '1rem', color: '#e3e3e3', fontFamily: '"Outfit", sans-serif' }}>
                                {game?.whitePlayer?.username || 'Bạn'}
                            </span>
                        </div>
                        <div style={{ background: '#262421', border: '1px solid rgba(255,255,255,0.06)', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', color: '#babfc3', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>⚪</span>
                            <span>TRẮNG</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Right Panel (Dashboard) */}
            <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', padding: '24px 12px', boxSizing: 'border-box', overflow: 'hidden', flex: '0 0 340px', width: '340px' }}>
                <div style={{ background: '#262421', border: '1px solid #312e2b', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', overflow: 'hidden', boxSizing: 'border-box', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: '800', fontFamily: '"Outfit", sans-serif' }}>Phân tích ván đấu</h3>
                            <span style={{ color: '#babfc3', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>
                                Giải đấu 🏆
                            </span>
                        </div>
                        <button 
                            onClick={() => navigate('/tournaments')} 
                            style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem', 
                                color: '#babfc3', 
                                background: '#312e2b', 
                                border: '1px solid #403d39', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#babfc3'; e.currentTarget.style.borderColor = '#403d39'; }}
                        >
                            ← Trở lại
                        </button>
                    </div>

                    {/* Outcome Banner */}
                    {game && (
                        <div style={{ 
                            background: 'rgba(129,182,76,0.1)', 
                            color: '#81b64c', 
                            padding: '10px 15px', 
                            borderRadius: '6px', 
                            fontSize: '0.85rem', 
                            fontWeight: '800',
                            textAlign: 'center',
                            marginBottom: '15px',
                            border: `1px solid rgba(129,182,76,0.2)`
                        }}>
                            Kết quả: {game.result || '*'}
                        </div>
                    )}

                    {/* Autoplay Speed Control */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#1c1a17', padding: '8px 12px', borderRadius: '6px', border: '1px solid #312e2b' }}>
                        <span style={{ fontSize: '0.8rem', color: '#babfc3', fontWeight: 'bold' }}>Tốc độ phát:</span>
                        <select 
                            value={playSpeed} 
                            onChange={(e) => setPlaySpeed(Number(e.target.value))}
                            style={{ background: '#262421', color: 'white', border: '1px solid #403d39', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                        >
                            <option value={3000}>Chậm (3s)</option>
                            <option value={1500}>Bình thường (1.5s)</option>
                            <option value={800}>Nhanh (0.8s)</option>
                            <option value={400}>Cực nhanh (0.4s)</option>
                        </select>
                    </div>

                    {/* Analysis Stats */}
                    {analysis && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                            <div className="stat-box" style={{ background: '#1c1a17', border: '1px solid #312e2b', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#babfc3', display: 'block' }}>Lỗi nghiêm trọng</span>
                                <strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>{analysis.blundersCount}</strong>
                            </div>
                            <div className="stat-box" style={{ background: '#1c1a17', border: '1px solid #312e2b', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#babfc3', display: 'block' }}>Sai sót</span>
                                <strong style={{ color: '#f57c00', fontSize: '1.2rem' }}>{analysis.mistakesCount}</strong>
                            </div>
                        </div>
                    )}

                    {/* Scrollable Move Sheet */}
                    <div style={{ flex: 1, overflowY: 'auto', background: '#1c1a17', borderRadius: '6px', border: '1px solid #312e2b', padding: '8px' }} className="custom-scrollbar">
                        {moves.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, idx) => {
                                    const wIdx = idx * 2;
                                    const bIdx = idx * 2 + 1;
                                    return (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.01)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                            <span style={{ color: '#62605e', fontSize: '0.85rem', fontWeight: 'bold' }}>{idx + 1}.</span>
                                            
                                            {/* White Move */}
                                            <button 
                                                onClick={() => { setIsPlaying(false); handleJumpToMove(wIdx); }}
                                                style={{
                                                    border: 'none',
                                                    padding: '5px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    fontWeight: '700',
                                                    fontFamily: 'monospace',
                                                    background: currentMoveIdx === wIdx ? '#3d5e3a' : 'transparent',
                                                    color: currentMoveIdx === wIdx ? '#95d03a' : '#babfc3',
                                                    transition: 'all 0.1s ease',
                                                    width: 'fit-content'
                                                }}
                                            >
                                                {moves[wIdx].sanMove}
                                                {moves[wIdx].evaluation !== null && (
                                                    <span style={{ fontSize: '0.7rem', color: '#62605e', marginLeft: '4px' }}>
                                                        ({moves[wIdx].evaluation > 0 ? '+' : ''}{moves[wIdx].evaluation.toFixed(1)})
                                                    </span>
                                                )}
                                            </button>

                                            {/* Black Move */}
                                            {moves[bIdx] ? (
                                                <button 
                                                    onClick={() => { setIsPlaying(false); handleJumpToMove(bIdx); }}
                                                    style={{
                                                        border: 'none',
                                                        padding: '5px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.9rem',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        fontWeight: '700',
                                                        fontFamily: 'monospace',
                                                        background: currentMoveIdx === bIdx ? '#3d5e3a' : 'transparent',
                                                        color: currentMoveIdx === bIdx ? '#95d03a' : '#babfc3',
                                                        transition: 'all 0.1s ease',
                                                        width: 'fit-content'
                                                    }}
                                                >
                                                    {moves[bIdx].sanMove}
                                                    {moves[bIdx].evaluation !== null && (
                                                        <span style={{ fontSize: '0.7rem', color: '#62605e', marginLeft: '4px' }}>
                                                            ({moves[bIdx].evaluation > 0 ? '+' : ''}{moves[bIdx].evaluation.toFixed(1)})
                                                        </span>
                                                    )}
                                                </button>
                                            ) : (
                                                <span></span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#62605e', fontStyle: 'italic', fontSize: '0.85rem' }}>Không có nước đi nào.</div>
                        )}
                    </div>

                    {/* Premium Control Bar */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '15px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '15px' }}>
                        <button onClick={() => { setIsPlaying(false); handleFirst(); }} style={{ background: 'none', border: 'none', color: '#babfc3', fontSize: '1.4rem', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#babfc3'} title="Về đầu trận">⏮</button>
                        <button onClick={() => { setIsPlaying(false); handlePrev(); }} style={{ background: 'none', border: 'none', color: '#babfc3', fontSize: '1.4rem', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#babfc3'} title="Lùi 1 nước (ArrowLeft)">◀</button>
                        
                        <button 
                            onClick={() => setIsPlaying(!isPlaying)} 
                            style={{ 
                                background: '#81b64c', 
                                border: 'none', 
                                width: '44px', 
                                height: '44px', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'white', 
                                fontSize: '1.2rem', 
                                cursor: 'pointer', 
                                boxShadow: '0 4px 12px rgba(129,182,76,0.3)', 
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }} 
                            onMouseEnter={e => { e.currentTarget.style.background = '#95ca5c'; e.currentTarget.style.transform = 'scale(1.05)'; }} 
                            onMouseLeave={e => { e.currentTarget.style.background = '#81b64c'; e.currentTarget.style.transform = 'scale(1)'; }}
                            title={isPlaying ? "Tạm dừng" : "Tự động phát"}
                        >
                            {isPlaying ? "⏸" : "▶"}
                        </button>

                        <button onClick={() => { setIsPlaying(false); handleNext(); }} style={{ background: 'none', border: 'none', color: '#babfc3', fontSize: '1.4rem', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#babfc3'} title="Tiến 1 nước (ArrowRight)">▶</button>
                        <button onClick={() => { setIsPlaying(false); handleLast(); }} style={{ background: 'none', border: 'none', color: '#babfc3', fontSize: '1.4rem', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#babfc3'} title="Đến cuối trận">⏭</button>
                    </div>
                    
                    <div style={{ textAlign: 'center', marginTop: '10px', color: '#62605e', fontSize: '0.8rem' }}>
                        Nước đi: <strong>{currentMoveIdx + 1}</strong> / {moves.length}
                    </div>
                </div>
            </div>
        </div>
    );
}

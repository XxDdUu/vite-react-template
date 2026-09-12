import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiGameService } from '../services/AiGameService';
import { AuthService } from '../services/AuthService';
import Sidebar from '../components/Sidebar';
import { useTranslation } from '../contexts/I18nContext';
import '../index.css';

function AIPlay() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState('Người dùng');
  const [mode, setMode] = useState('human-white'); // 'human-white' or 'human-black'
  const [status, setStatus] = useState('Chọn cài đặt của bạn và nhấp vào Bắt đầu trận đấu');
  const [difficulty, setDifficulty] = useState(3); // 1 = Easy, 2 = Medium, 3 = Hard, 4 = Expert
  const [gameId, setGameId] = useState(null);
  
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('best_model');
  const [gameHistory, setGameHistory] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  
  const isWait = useRef(false);
  const gameRef = useRef(null);
  const boardRef = useRef(null);
  const modeRef = useRef('human-white');
  const gameIdRef = useRef(null);
  const selectedSquareRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await AuthService.getValidToken();
        if (token) {
          const payload = AuthService.parseToken(token);
          if (payload) {
            setUsername(payload.username || payload.sub || 'Người chơi');
          }
        }
      } catch (e) {
        console.error("Failed to parse token in AIPlay", e);
      }
    };
    fetchUser();
  }, []);

  // Keep references fresh for vanilla JS callbacks
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  // Load models and check for active game on mount
  useEffect(() => {
    loadModels();
    resumeActiveGame();
  }, []);

  // Initialize board and game logic only when gameId is active
  useEffect(() => {
    if (!gameId) return;

    if (!window.Chess || !window.Chessboard) {
      setStatus('Đang chờ các mã script của bàn cờ tải...');
      return;
    }

    if (!gameRef.current) {
      gameRef.current = new window.Chess();
    }

    const clearHighlights = () => {
      document.querySelectorAll('#board .highlight-square').forEach(el => {
        el.classList.remove('highlight-square');
      });
      document.querySelectorAll('#board .highlight-square-selected').forEach(el => {
        el.classList.remove('highlight-square-selected');
      });
    };

    const handleBoardClick = async (event) => {
      if (isGameOver || isWait.current) return;
      if (!gameRef.current || !boardRef.current) return;

      const clickedSquareEl = event.target.closest('[data-square]');
      if (!clickedSquareEl) return;

      const square = clickedSquareEl.getAttribute('data-square');

      // Check turn
      const turn = gameRef.current.turn(); // 'w' or 'b'
      const playerChar = modeRef.current === 'human-white' ? 'w' : 'b';
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

          isWait.current = true;
          setStatus('AI đang tính toán nước đi...');

          const prevHistory = [...gameHistory];
          if (move.san) {
            setGameHistory(prev => [...prev, move.san]);
          }

          try {
              const state = await AiGameService.makeMove(gameIdRef.current, move.san);
              updateGameStatus(state);
          } catch (e) {
              console.error(e);
              setStatus(e.response?.data?.message || 'Nước đi bị từ chối hoặc máy chủ AI đang ngoại tuyến.');
              isWait.current = false;
              
              gameRef.current.undo();
              setGameHistory(prevHistory);
              
              if (boardRef.current && gameRef.current) {
                boardRef.current.position(gameRef.current.fen());
              }
          }
        }
      }
    };

    const onDragStart = (source, piece, position, orientation) => {
      if (isWait.current) return false;
      if (gameRef.current.game_over()) return false;
      if (!gameIdRef.current) return false; // Game must be started on backend

      // Ensure player can only move their own color pieces
      if (modeRef.current === 'human-white' && piece.search(/^b/) !== -1) return false;
      if (modeRef.current === 'human-black' && piece.search(/^w/) !== -1) return false;
      
      // Ensure player only moves when it is their turn
      const turn = gameRef.current.turn(); // 'w' or 'b'
      if (modeRef.current === 'human-white' && turn === 'b') return false;
      if (modeRef.current === 'human-black' && turn === 'w') return false;

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

    const onDrop = async (source, target) => {
      let move = gameRef.current.move({
          from: source,
          to: target,
          promotion: 'q'
      });

      if (move === null) return 'snapback';

      // Clear highlights on drag drop
      clearHighlights();
      selectedSquareRef.current = null;

      isWait.current = true;
      setStatus('AI đang tính toán nước đi...');

      // Update history immediately for instant responsive feedback
      const prevHistory = [...gameHistory];
      if (move.san) {
        setGameHistory(prev => [...prev, move.san]);
      }

      // Redraw board immediately to show user's move
      if (boardRef.current) {
        boardRef.current.position(gameRef.current.fen());
      }

      try {
          const state = await AiGameService.makeMove(gameIdRef.current, move.san);
          
          // Apply server's new state (contains both player's move and AI's counter-move)
          updateGameStatus(state);
      } catch (e) {
          console.error(e);
          setStatus(e.response?.data?.message || 'Nước đi bị từ chối hoặc máy chủ AI đang ngoại tuyến.');
          isWait.current = false;
          
          // Roll back local move on failure
          gameRef.current.undo();
          setGameHistory(prevHistory);
          
          // Trigger board redraw to reset incorrect move
          if (boardRef.current && gameRef.current) {
            boardRef.current.position(gameRef.current.fen());
          }
          return 'snapback';
      }
    };

    const onSnapEnd = () => {
      if (boardRef.current && gameRef.current) {
        boardRef.current.position(gameRef.current.fen());
      }
    };

    const playerColor = modeRef.current === 'human-white' ? 'white' : 'black';
    const config = {
      draggable: true,
      position: gameRef.current.fen() || 'start',
      orientation: playerColor,
      onDragStart: onDragStart,
      onDrop: onDrop,
      onSnapEnd: onSnapEnd,
      moveSpeed: 'fast',
      snapbackSpeed: 150,
      snapSpeed: 100,
      pieceTheme: '/chessPieces/{piece}.png'
    };

    // Use interval to wait until #board container is loaded in DOM
    const checkBoardExist = setInterval(() => {
      if (document.getElementById('board')) {
        clearInterval(checkBoardExist);
        boardRef.current = window.Chessboard('board', config);

        // Bind custom board click event listener
        const boardEl = document.getElementById('board');
        if (boardEl) {
          boardEl.removeEventListener('click', handleBoardClick);
          boardEl.addEventListener('click', handleBoardClick);
        }
      }
    }, 50);

    return () => {
      clearInterval(checkBoardExist);
      const boardEl = document.getElementById('board');
      if (boardEl) {
        boardEl.removeEventListener('click', handleBoardClick);
      }
    };
  }, [gameId]);

  const loadModels = async () => {
    try {
      const data = await AiGameService.getModels();
      const modelList = Array.isArray(data) ? data : (data.models || []);
      setModels(modelList);
      
      const defaultKey = data.default || (modelList[0]?.key || 'best_model');
      setSelectedModel(defaultKey);
    } catch (e) {
      console.error('Failed to load AI checkpoints', e);
    }
  };

  const resumeActiveGame = async () => {
    try {
      const active = await AiGameService.getActiveGame();
      if (active) {
        if (!gameRef.current) {
          gameRef.current = new window.Chess();
        }
        gameRef.current.load(active.fen);

        const playerCol = active.playerColor; // "WHITE" or "BLACK"
        setMode(playerCol === 'WHITE' ? 'human-white' : 'human-black');
        setDifficulty(active.difficulty);
        setSelectedModel(active.aiModel);
        setGameHistory(active.history || []);
        setIsGameOver(active.isGameOver || active.is_game_over || false);
        setGameId(active.gameId);
        
        if (active.isGameOver || active.is_game_over) {
          setStatus('Trận đấu đã kết thúc.');
          isWait.current = true;
        } else {
          setStatus('Đã khôi phục ván đấu! Lượt của bạn.');
          isWait.current = false;
        }
      } else {
        navigate('/menu', { state: { openAiLobby: true } });
      }
    } catch (e) {
      console.error('Error checking active game session:', e);
      navigate('/menu', { state: { openAiLobby: true } });
    }
  };

  const updateGameStatus = (stateData) => {
    if (!gameRef.current || !boardRef.current) return;
    
    // Load FEN state from backend
    gameRef.current.load(stateData.fen);
    boardRef.current.position(stateData.fen);

    if (stateData.isGameOver || stateData.is_game_over) {
      const resultText = stateData.result ? ` [Kết quả: ${stateData.result}]` : '';
      setStatus(`Ván đấu kết thúc! ${stateData.termination || 'Hoàn thành.'}${resultText}`);
      setIsGameOver(true);
      isWait.current = true;
    } else {
      setStatus('Lượt của bạn');
      isWait.current = false;
    }

    // Refresh history
    fetchHistoryDetails(stateData.gameId);
  };

  const fetchHistoryDetails = async (gId) => {
    if (!gId) return;
    try {
      const details = await AiGameService.getGameDetails(gId);
      if (details && details.history) {
        setGameHistory(details.history);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartFreshGame = async () => {
    isWait.current = true;
    setStatus('Đang khởi tạo bàn cờ và kết nối tới máy chủ AI...');

    const playerColor = mode === 'human-white' ? 'WHITE' : 'BLACK';

    try {
      const state = await AiGameService.startGame(selectedModel, difficulty, playerColor);
      
      if (!gameRef.current) {
        gameRef.current = new window.Chess();
      }
      gameRef.current.reset();
      gameRef.current.load(state.fen);

      setGameHistory([]);
      setIsGameOver(false);
      setGameId(state.gameId);

      if (state.isGameOver) {
        setStatus(`Ván đấu kết thúc sớm. Kết quả: ${state.result}`);
        setIsGameOver(true);
        isWait.current = true;
      } else {
        if (playerColor === 'BLACK' && state.aiFirstMove) {
          setStatus(`AI đã đi trước quân ${state.aiFirstMove}. Lượt của bạn!`);
          setGameHistory([state.aiFirstMove]);
        } else {
          setStatus('Trận đấu bắt đầu! Lượt của bạn.');
        }
        isWait.current = false;
      }
    } catch (e) {
      console.error(e);
      setStatus('Không thể bắt đầu trận đấu AI. Vui lòng thử lại.');
      isWait.current = false;
    }
  };

  const handleResign = async () => {
    if (!gameId) return;
    if (window.confirm('Bạn có chắc chắn muốn xin thua ván đấu này?')) {
      try {
        const res = await AiGameService.resignGame(gameId);
        setStatus(`Bạn đã xin thua. Kết quả: ${res.result} (AI thắng)`);
        setIsGameOver(true);
        isWait.current = true;
      } catch (e) {
        console.error(e);
        setStatus('Không thể xin thua ván đấu.');
      }
    }
  };

  if (!gameId) {
    return (
      <div className="main-menu-wrapper">
        <Sidebar username={username} />
        <div className="board-area" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', maxWidth: '360px', borderRadius: '20px' }}>
            <div className="lobby-spinner-container" style={{ margin: '0 auto 20px', position: 'relative', width: '60px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="lobby-pulse-ring" style={{ position: 'absolute', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', animation: 'lobbyPulse 1.5s infinite ease-in-out' }}></div>
              <div className="lobby-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255, 255, 255, 0.1)', borderTop: '3px solid var(--accent-blue)', borderRadius: '50%', animation: 'lobbySpin 1s infinite linear' }}></div>
            </div>
            <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '1.2rem', fontWeight: 'bold' }}>Đang tải ván đấu AI...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vui lòng đợi giây lát</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu-wrapper">
      <Sidebar username={username} />

      {/* Center Area (Chess Board) */}
      <div className="board-area">
        <div className="board-container" style={{ position: 'relative' }}>
          {/* Top Player (AI Player Metadata) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar-small" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}><span className="icon">🤖</span></div>
              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent-blue)' }}>
                Máy AI (Độ khó: {difficulty === 1 ? 'Dễ' : difficulty === 2 ? 'Trung bình' : difficulty === 3 ? 'Khó' : 'Chuyên gia'})
              </span>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
              {selectedModel === 'best_model' ? 'Mô hình tốt nhất' : selectedModel}
            </div>
          </div>

          <div id="board" className="chess-board-wrapper" style={{ width: '100%', aspectRatio: '1/1', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}></div>

          {/* Bottom Player (Human Player Metadata) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar-small" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}><span className="icon">👤</span></div>
              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {username} <span className="flag">🇻🇳</span>
              </span>
            </div>
            <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#4ade80', fontWeight: 'bold' }}>
              Bạn
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel (Dashboard) */}
      <div className="right-panel">
        {/* Match Settings Panel / Game State Info */}
        <div className="glass-panel" style={{ width: '100%', marginBottom: '20px', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', color: 'var(--text-primary)' }}>📊 {t('tournament.details', 'Chi tiết trận đấu')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('ai.modelSelect', 'Mô hình AI')}</span>
              <strong>{selectedModel === 'best_model' ? t('ai.defaultModel', 'Mặc định') : selectedModel}</strong>
            </div>
            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('ai.difficulty', 'Độ khó')}</span>
              <strong>{difficulty === 1 ? t('ai.easy', 'Dễ') : difficulty === 2 ? t('ai.medium', 'Thường') : difficulty === 3 ? t('ai.hard', 'Khó') : t('ai.expert', 'Chuyên gia')}</strong>
            </div>
            <div className="stat-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('tournament.status', 'Trạng thái')}</span>
              <strong style={{ color: isGameOver ? '#f87171' : isWait.current ? '#fbbf24' : '#4ade80' }}>
                {isGameOver ? t('game.gameOver', 'ĐÃ KẾT THÚC') : isWait.current ? t('common.loading', 'AI ĐANG NGHĨ...') : t('game.turn', 'LƯỢT CỦA BẠN')}
              </strong>
            </div>

            {isGameOver ? (
              <button onClick={() => navigate('/menu')} className="primary-btn" style={{ padding: '12px', fontSize: '0.85rem', marginTop: '10px', width: '100%', fontWeight: 'bold' }}>
                {t('ai.backToMenu', 'Quay lại Menu chính ↩️')}
              </button>
            ) : (
              <button onClick={handleResign} className="secondary-btn" style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.2)', padding: '12px', fontSize: '0.85rem', marginTop: '10px', width: '100%' }}>
                {t('game.resign', 'Xin thua 🏳️')}
              </button>
            )}
          </div>
        </div>

        {/* Status Info Box / Engine Logs */}
        <div className="glass-panel" style={{ width: '100%', padding: '15px', marginBottom: '20px', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>📡 {t('admin.title', 'Phản hồi từ hệ thống AI')}</span>
          <strong style={{ fontSize: '0.95rem', color: '#4ade80', lineHeight: '1.4' }}>{status}</strong>
        </div>

        {/* Move History Panel */}
        <div className="glass-panel" style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>📜 {t('game.moveHistory', 'Lịch sử nước đi')}</h3>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px', overflowY: 'auto' }}>
            {gameHistory.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                {Array.from({ length: Math.ceil(gameHistory.length / 2) }).map((_, idx) => (
                  <React.Fragment key={idx}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {idx + 1}. <span style={{ color: 'white', fontWeight: 'bold' }}>{gameHistory[idx * 2]}</span>
                    </div>
                    <div>
                      {gameHistory[idx * 2 + 1] ? (
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{gameHistory[idx * 2 + 1]}</span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>...</span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', display: 'block', textAlign: 'center', marginTop: '10px' }}>Chưa có nước đi nào được thực hiện.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIPlay;
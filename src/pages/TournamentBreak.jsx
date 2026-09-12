import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useTranslation } from '../contexts/I18nContext';
import { TournamentService } from '../services/TournamentService';
import { socketClient } from '../services/SocketService';
import { AuthService } from '../services/AuthService';
import '../index.css';

export default function TournamentBreak() {
    const { t } = useTranslation();
    const { tournamentId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [username, setUsername] = useState('Người chơi');
    const [standings, setStandings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(parseInt(searchParams.get('duration') || '600'));

    const countdownRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            const payload = AuthService.parseToken(token);
            if (payload) {
                setUsername(payload.username || 'Người chơi');
            }

            // Fetch current standings during break
            try {
                const std = await TournamentService.getStandings(tournamentId);
                setStandings(std || []);
            } catch (err) {
                console.error("Failed to load standings", err);
            }

            // Fetch dynamic break time left
            try {
                const myPairing = await TournamentService.getMyPairing(tournamentId);
                if (myPairing) {
                    if (myPairing.inBreak) {
                        setTimeLeft(myPairing.breakTimeLeftSeconds);
                    } else {
                        navigate(`/tournaments/lobby/${tournamentId}`);
                        return;
                    }
                }
            } catch (err) {
                console.error("Failed to load break time from backend", err);
            }
            
            setLoading(false);
            startCountdown();

            // Listen to socket to auto navigate when round starts early
            socketClient.addListener(handleSocketMessage);
        };

        init();

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
            socketClient.removeListener(handleSocketMessage);
        };
    }, [tournamentId, navigate]);

    const startCountdown = () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    navigate(`/tournaments/lobby/${tournamentId}`);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleSocketMessage = (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'ROUND_STARTED' && msg.tournamentId === parseInt(tournamentId)) {
                if (countdownRef.current) clearInterval(countdownRef.current);
                navigate(`/tournaments/lobby/${tournamentId}`);
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

    return (
        <div className="friends-page-wrapper">
            <Sidebar username={username} />

            <div className="friends-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '20px' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '30px', textAlign: 'center' }}>
                    
                    {/* Header */}
                    <div>
                        <h1 style={{ color: 'var(--accent-blue-hover)', fontSize: '2rem', margin: '0 0 5px 0' }}>{t('tournament.breakTimeTitle')}</h1>
                        <p style={{ color: 'var(--text-muted)' }}>{t('tournament.breakTimeSub')}</p>
                    </div>

                    {/* Clock countdown */}
                    <div style={{ margin: '30px 0' }}>
                        <div style={{ fontSize: '4rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-blue-hover)' }}>
                            {formatTime(timeLeft)}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '5px' }}>
                            {t('tournament.breakTimeDesc')}
                        </p>
                    </div>

                    {/* Standings table */}
                    <div style={{ marginTop: '20px', textAlign: 'left' }}>
                        <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>{t('tournament.currentStandings')}</h3>
                        
                        {loading ? (
                            <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px' }}>{t('tournament.rank')}</th>
                                        <th style={{ padding: '8px' }}>{t('tournament.participants')}</th>
                                        <th style={{ padding: '8px' }}>Elo</th>
                                        <th style={{ padding: '8px', textAlign: 'center' }}>{t('tournament.score')}</th>
                                        <th style={{ padding: '8px', textAlign: 'center' }}>BH</th>
                                        <th style={{ padding: '8px', textAlign: 'center' }}>SB</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {standings.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('tournament.noTournaments')}</td>
                                        </tr>
                                    ) : (
                                        standings.map((p, idx) => (
                                            <tr key={p.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{idx + 1}</td>
                                                <td style={{ padding: '8px' }}>{p.username}</td>
                                                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{p.initialRating}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-blue-hover)' }}>{p.currentScore}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.buchholz}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.sonnebornBerger}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Back to tournament list button */}
                    <div style={{ marginTop: '30px' }}>
                        <button className="secondary-btn" onClick={() => navigate('/tournaments')}>{t('tournament.backToList')}</button>
                    </div>

                </div>
            </div>
        </div>
    );
}

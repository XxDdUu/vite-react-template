import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { TournamentService } from '../services/TournamentService';
import { ReplayService } from '../services/ReplayService';
import { AuthService } from '../services/AuthService';
import { useTranslation } from '../contexts/I18nContext';
import '../index.css';

export default function Tournaments() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [username, setUsername] = useState('Người chơi');
    const [userId, setUserId] = useState(null);
    const [tournaments, setTournaments] = useState([]);
    const [listTab, setListTab] = useState('all'); // all, registering, ongoing, finished

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
        fetchTournaments();
    }, [navigate]);

    const fetchTournaments = async () => {
        try {
            const list = await TournamentService.getAllTournaments();
            setTournaments(list || []);
        } catch (err) {
            console.error("Failed to fetch tournaments", err);
        }
    };

    const filteredTournaments = tournaments.filter(t => {
        if (listTab === 'all') return true;
        return t.status.toLowerCase() === listTab;
    });

    return (
        <div className="friends-page-wrapper">
            <Sidebar username={username} />
            
            <div className="friends-content" style={{ display: 'flex', gap: '30px', width: '100%' }}>
                {/* Main list column */}
                <div className="friends-main-col" style={{ flex: 1 }}>
                    <div className="friends-header">
                        <h1>🏆 {t('tournament.title', 'Giải đấu cờ vua')}</h1>
                    </div>

                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        {['all', 'registering', 'ongoing', 'finished'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setListTab(tab)}
                                className={listTab === tab ? 'primary-btn' : 'secondary-btn'}
                                style={{ padding: '8px 15px', textTransform: 'capitalize', fontSize: '0.85rem' }}
                            >
                                {tab === 'all' ? t('profile.allResults', 'Tất cả') : tab === 'registering' ? t('tournament.upcoming', 'Mở đăng ký') : tab === 'ongoing' ? t('tournament.ongoing', 'Đang diễn ra') : t('tournament.finished', 'Đã kết thúc')}
                            </button>
                        ))}
                    </div>

                    {/* Tournament list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredTournaments.length === 0 ? (
                            <div className="glass-panel" style={{ width: '100%', textAlign: 'center', padding: '40px' }}>
                                <p style={{ color: 'var(--text-muted)' }}>{t('common.info', 'Không tìm thấy giải đấu nào.')}</p>
                            </div>
                        ) : (
                            filteredTournaments.map(t => (
                                <div
                                    key={t.tournamentId}
                                    className="glass-panel friend-item"
                                    style={{
                                        width: '100%',
                                        cursor: 'pointer',
                                        border: '1px solid var(--glass-border)',
                                        background: 'var(--panel-bg)'
                                    }}
                                    onClick={() => navigate(`/tournaments/detail/${t.tournamentId}`)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div>
                                            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{t.tournamentName}</h3>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                                                <span>⏱️ Thể thức: {t.timeControl} | 🔄 Vòng: {t.totalRounds}</span>
                                                <span style={{ fontSize: '0.75rem' }}>📅 Đăng ký: {t.registrationStart ? new Date(t.registrationStart).toLocaleString('vi-VN') : 'Chưa thiết lập'} - {t.registrationEnd ? new Date(t.registrationEnd).toLocaleString('vi-VN') : 'Chưa thiết lập'}</span>
                                                <span style={{ fontSize: '0.75rem' }}>🏁 Bắt đầu: {t.startTime ? new Date(t.startTime).toLocaleString('vi-VN') : 'Chưa thiết lập'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    background: t.status === 'REGISTERING' ? 'rgba(74, 222, 128, 0.2)' : 
                                                                t.status === 'ONGOING' ? 'rgba(59, 130, 246, 0.2)' : 
                                                                t.status === 'UPCOMING' ? 'rgba(6, 182, 212, 0.2)' : 
                                                                t.status === 'REGISTRATION_CLOSED' ? 'rgba(156, 163, 175, 0.2)' : 
                                                                'rgba(139, 92, 246, 0.2)',
                                                    color: t.status === 'REGISTERING' ? '#4ade80' : 
                                                           t.status === 'ONGOING' ? '#60a5fa' : 
                                                           t.status === 'UPCOMING' ? '#06b6d4' : 
                                                           t.status === 'REGISTRATION_CLOSED' ? '#9ca3af' : 
                                                           '#a78bfa'
                                                }}
                                            >
                                                {t.status === 'REGISTERING' ? 'Mở đăng ký' :
                                                 t.status === 'ONGOING' ? 'Đang diễn ra' :
                                                 t.status === 'UPCOMING' ? 'Sắp diễn ra' :
                                                 t.status === 'REGISTRATION_CLOSED' ? 'Đã đóng đăng ký' :
                                                 t.status === 'FINISHED' ? 'Đã kết thúc' : t.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

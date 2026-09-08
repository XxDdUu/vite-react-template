import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { AdminService } from '../services/AdminService';
import { TournamentService } from '../services/TournamentService';
import { ReplayService } from '../services/ReplayService';
import { AuthService } from '../services/AuthService';
import AdminDisplayName from '../components/AdminDisplayName';
import AdminDirectMessageModal from '../components/admin/AdminDirectMessageModal';
import '../index.css';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('Quản trị viên');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    
    // Direct Messaging state
    const [isDmModalOpen, setIsDmModalOpen] = useState(false);
    const [dmTargetUser, setDmTargetUser] = useState(null);
    const [dmDefaultSendToAll, setDmDefaultSendToAll] = useState(false);
    const [allDirectMessages, setAllDirectMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageSearch, setMessageSearch] = useState('');

    // Tournament form fields
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [selectedRoundId, setSelectedRoundId] = useState(null);
    const [pairings, setPairings] = useState([]);

    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formRounds, setFormRounds] = useState(5);
    const [formTimeControl, setFormTimeControl] = useState('10+0');
    const [formRegStart, setFormRegStart] = useState('');
    const [formRegEnd, setFormRegEnd] = useState('');
    const [formStart, setFormStart] = useState('');

    const [activeSection, setActiveSection] = useState('stats'); // stats, users, messages, tournaments, pairings

    useEffect(() => {
        const checkToken = () => {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                navigate('/login');
                return;
            }
            const payload = AuthService.parseToken(token);
            if (!payload || payload.role !== 'ROLE_ADMIN') {
                navigate('/menu');
                return;
            }
            setUsername(payload.username || 'Quản trị viên');
        };
        checkToken();
        loadStats();
        loadTournaments();
        loadAllDirectMessages();

        const handleDmEvent = () => {
            loadAllDirectMessages();
        };
        window.addEventListener('admin-direct-message-update', handleDmEvent);
        return () => window.removeEventListener('admin-direct-message-update', handleDmEvent);
    }, [navigate]);

    useEffect(() => {
        if (activeSection === 'messages') {
            loadAllDirectMessages();
        }
    }, [activeSection]);

    const loadAllDirectMessages = async () => {
        setLoadingMessages(true);
        try {
            const list = await AdminService.getAllDirectMessages();
            setAllDirectMessages(Array.isArray(list) ? list : []);
        } catch (err) {
            console.error("Failed to load direct messages", err);
            setAllDirectMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleOpenDm = (targetUser, isSendToAll = false) => {
        setDmDefaultSendToAll(isSendToAll);
        if (!targetUser) {
            setDmTargetUser(null);
            setIsDmModalOpen(true);
            return;
        }
        const normalizedUser = {
            ...targetUser,
            userId: targetUser.userId ?? targetUser.id,
            username: targetUser.username ?? targetUser.name ?? (targetUser.userId || targetUser.id ? `User #${targetUser.userId || targetUser.id}` : 'Người chơi')
        };
        setDmTargetUser(normalizedUser);
        setIsDmModalOpen(true);
    };

    const loadStats = async () => {
        try {
            const data = await AdminService.getStats();
            setStats(data);
        } catch (err) {
            console.error("Failed to load admin stats", err);
        }
    };

    const loadTournaments = async () => {
        try {
            const list = await TournamentService.getAllTournaments();
            setTournaments(list || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearchUsers = async (e) => {
        if (e) e.preventDefault();
        try {
            const list = await AdminService.getUsers(searchQuery);
            setUsers(list || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectUser = async (userId) => {
        try {
            const profile = await AdminService.getUserProfile(userId);
            setSelectedUser(profile);
        } catch (err) {
            console.error(err);
        }
    };

    const handleBanUser = async (userId) => {
        if (!window.confirm("Bạn có chắc chắn muốn KHÓA tài khoản này?")) return;
        try {
            await AdminService.banUser(userId);
            alert("Đã khóa tài khoản thành công!");
            handleSelectUser(userId);
            handleSearchUsers();
        } catch (err) {
            alert("Thao tác thất bại!");
        }
    };

    const handleUnbanUser = async (userId) => {
        try {
            await AdminService.unbanUser(userId);
            alert("Đã mở khóa tài khoản thành công!");
            handleSelectUser(userId);
            handleSearchUsers();
        } catch (err) {
            alert("Thao tác thất bại!");
        }
    };

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        try {
            const data = {
                tournamentName: formName,
                description: formDesc,
                totalRounds: parseInt(formRounds),
                timeControl: formTimeControl,
                registrationStart: formRegStart ? new Date(formRegStart).toISOString() : null,
                registrationEnd: formRegEnd ? new Date(formRegEnd).toISOString() : null,
                startTime: formStart ? new Date(formStart).toISOString() : null
            };
            await AdminService.createTournament(data);
            alert("Tạo giải đấu thành công!");
            // Reset form
            setFormName('');
            setFormDesc('');
            setFormRounds(5);
            setFormTimeControl('10+0');
            setFormRegStart('');
            setFormRegEnd('');
            setFormStart('');
            loadTournaments();
        } catch (err) {
            alert("Tạo giải đấu thất bại!");
        }
    };

    const handleFinishTournament = async (tId) => {
        try {
            await AdminService.finishTournament(tId);
            alert("Đã kết thúc giải đấu!");
            loadTournaments();
        } catch (err) {
            alert("Thất bại!");
        }
    };

    const handleSelectTournamentPairings = async (t) => {
        setSelectedTournament(t);
        try {
            // Standings or rounds
            const rds = await ReplayService.getRounds(t.tournamentId);
            setRounds(rds || []);
            if (rds && rds.length > 0) {
                const latestRound = rds[rds.length - 1];
                setSelectedRoundId(latestRound.roundId);
                const prs = await ReplayService.getPairings(t.tournamentId, latestRound.roundId);
                setPairings(prs || []);
            } else {
                setPairings([]);
            }
        } catch (err) {
            setRounds([]);
            setPairings([]);
        }
    };

    const handleSelectRound = async (rId) => {
        setSelectedRoundId(rId);
        try {
            const prs = await ReplayService.getPairings(selectedTournament.tournamentId, rId);
            setPairings(prs || []);
        } catch (err) {
            setPairings([]);
        }
    };

    const handleSubmitResult = async (pairingId, result) => {
        try {
            await AdminService.submitPairingResult(pairingId, result);
            alert("Đã cập nhật kết quả trận đấu!");
            // Refresh pairings and tournament state
            handleSelectTournamentPairings(selectedTournament);
            loadTournaments();
        } catch (err) {
            alert("Thất bại!");
        }
    };

    return (
        <div className="friends-page-wrapper">
            <Sidebar username={username} />

            <div className="friends-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                <div className="friends-header" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        🛡️ Hệ thống Quản trị (Admin Panel)
                    </h1>
                    <span className="admin-badge-pill" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                        🛡️ Admin
                    </span>
                </div>

                {/* Main Navigation tabs */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setActiveSection('stats')} className={activeSection === 'stats' ? 'primary-btn' : 'secondary-btn'} style={{ padding: '10px 20px', flex: 'none' }}>📊 Thống kê chung</button>
                    <button onClick={() => { setActiveSection('users'); handleSearchUsers(); }} className={activeSection === 'users' ? 'primary-btn' : 'secondary-btn'} style={{ padding: '10px 20px', flex: 'none' }}>👥 Quản lý người dùng</button>
                    <button onClick={() => { setActiveSection('messages'); loadAllDirectMessages(); }} className={activeSection === 'messages' ? 'primary-btn' : 'secondary-btn'} style={{ padding: '10px 20px', flex: 'none' }}>
                        📨 Tin nhắn trực tiếp {allDirectMessages.length > 0 && `(${allDirectMessages.length})`}
                    </button>
                    <button onClick={() => setActiveSection('tournaments')} className={activeSection === 'tournaments' ? 'primary-btn' : 'secondary-btn'} style={{ padding: '10px 20px', flex: 'none' }}>🏆 Quản lý giải đấu</button>
                    <button onClick={() => setActiveSection('pairings')} className={activeSection === 'pairings' ? 'primary-btn' : 'secondary-btn'} style={{ padding: '10px 20px', flex: 'none' }}>⚔️ Kết quả cặp đấu</button>
                </div>

                {/* Stats Panel */}
                {activeSection === 'stats' && stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <div className="friends-actions-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <div className="stat-box" style={{ padding: '20px' }}>
                                <span>Tổng số người dùng</span>
                                <strong style={{ fontSize: '1.8rem', color: 'var(--accent-blue-hover)' }}>{stats.totalUsers}</strong>
                            </div>
                            <div className="stat-box" style={{ padding: '20px' }}>
                                <span>Tổng số ván đấu</span>
                                <strong style={{ fontSize: '1.8rem', color: 'var(--accent-purple)' }}>{stats.totalGames}</strong>
                            </div>
                            <div className="stat-box" style={{ padding: '20px' }}>
                                <span>Giải đấu đã tạo</span>
                                <strong style={{ fontSize: '1.8rem', color: '#f57c00' }}>{stats.totalTournaments}</strong>
                            </div>
                            <div className="stat-box" style={{ padding: '20px' }}>
                                <span>Người chơi trực tuyến</span>
                                <strong style={{ fontSize: '1.8rem', color: '#4ade80' }}>{stats.onlinePlayersCount}</strong>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ width: '100%' }}>
                            <h2>Top 10 Kỳ thủ Elo cao nhất</h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                        <th style={{ padding: '10px' }}>Hạng</th>
                                        <th style={{ padding: '10px' }}>Kỳ thủ</th>
                                        <th style={{ padding: '10px' }}>Quốc gia</th>
                                        <th style={{ padding: '10px' }}>Elo</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Số trận</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Thắng - Thua - Hòa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topPlayers.map((p, idx) => (
                                        <tr key={p.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{idx + 1}</td>
                                            <td style={{ padding: '10px' }}>{p.username}</td>
                                            <td style={{ padding: '10px' }}><span className="flag">{p.countryCode}</span></td>
                                            <td style={{ padding: '10px', color: 'var(--accent-blue-hover)', fontWeight: 'bold' }}>{p.rating}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>{p.gamesPlayed}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {p.wins}W - {p.losses}L - {p.draws}D
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* User Moderation Section */}
                {activeSection === 'users' && (
                    <div style={{ display: 'flex', gap: '30px' }}>
                        {/* Search list */}
                        <div style={{ flex: 3 }}>
                            <form onSubmit={handleSearchUsers} className="friends-search-container" style={{ marginBottom: '20px' }}>
                                <span className="friends-search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm theo email hoặc tên tài khoản..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="friends-search-input"
                                />
                            </form>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {users.map(u => (
                                    <div
                                        key={u.userId}
                                        className="glass-panel friend-item"
                                        style={{ width: '100%', cursor: 'pointer', padding: '15px' }}
                                        onClick={() => handleSelectUser(u.userId)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <AdminDisplayName
                                                    username={u.username}
                                                    role={u.role}
                                                    showBadge={u.role === 'ROLE_ADMIN'}
                                                    nameStyle={{ fontSize: '1rem', fontWeight: 'bold' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDm(u);
                                                    }}
                                                    className="secondary-btn"
                                                    style={{
                                                        padding: '4px 10px',
                                                        fontSize: '0.75rem',
                                                        borderColor: 'rgba(59, 130, 246, 0.4)',
                                                        color: '#60a5fa',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title={`Gửi tin nhắn trực tiếp tới ${u.username}`}
                                                >
                                                    ✉️ Nhắn tin
                                                </button>
                                                <span style={{ color: 'var(--accent-blue-hover)' }}>Elo: {u.rating}</span>
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '10px',
                                                    fontSize: '0.75rem',
                                                    background: u.isBanned ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)',
                                                    color: u.isBanned ? '#ef4444' : '#4ade80'
                                                }}>
                                                    {u.isBanned ? 'Bị khóa' : 'Hoạt động'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Selected profile */}
                        <div style={{ flex: 2, minWidth: '300px' }}>
                            {selectedUser ? (
                                <div className="glass-panel" style={{ width: '100%' }}>
                                    <h2>Hồ sơ người dùng</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>Tên tài khoản:</span>
                                            <AdminDisplayName
                                                username={selectedUser.username}
                                                role={selectedUser.role}
                                                showBadge={selectedUser.role === 'ROLE_ADMIN'}
                                                nameStyle={{ fontWeight: 'bold' }}
                                            />
                                        </div>
                                        <div>Email: <strong>{selectedUser.email}</strong></div>
                                        <div>Vai trò: <strong>{selectedUser.role}</strong></div>
                                        <div>Trạng thái: <strong style={{ color: selectedUser.isBanned ? '#ef4444' : '#4ade80' }}>
                                            {selectedUser.isBanned ? 'Bị khóa' : 'Hoạt động'}
                                        </strong></div>
                                        <div>Quốc tịch: <span>{selectedUser.countryCode}</span></div>
                                        <div>Elo hiện tại: <strong>{selectedUser.rating}</strong></div>
                                        
                                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <button
                                                type="button"
                                                className="primary-btn"
                                                style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                onClick={() => handleOpenDm(selectedUser)}
                                            >
                                                💬 Gửi tin nhắn trực tiếp
                                            </button>
                                            {selectedUser.isBanned ? (
                                                <button className="primary-btn" style={{ width: '100%', background: '#10b981' }} onClick={() => handleUnbanUser(selectedUser.userId)}>
                                                    Mở khóa tài khoản
                                                </button>
                                            ) : (
                                                <button className="primary-btn" style={{ width: '100%', background: '#ef4444' }} onClick={() => handleBanUser(selectedUser.userId)}>
                                                    Khóa tài khoản
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="glass-panel" style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                                    Chọn người dùng từ danh sách để xem chi tiết
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tournaments Section */}
                {activeSection === 'tournaments' && (
                    <div style={{ display: 'flex', gap: '30px' }}>
                        {/* Tournament Creation Form */}
                        <div style={{ flex: 2 }}>
                            <form onSubmit={handleCreateTournament} className="glass-panel" style={{ width: '100%' }}>
                                <h2>Tạo Giải đấu mới</h2>
                                <div className="control-group">
                                    <label>Tên giải đấu</label>
                                    <input type="text" className="custom-input" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                                </div>
                                <div className="control-group">
                                    <label>Mô tả giải đấu</label>
                                    <textarea className="custom-input" rows="3" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} style={{ resize: 'none' }}></textarea>
                                </div>
                                <div className="control-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <div className="control-group">
                                        <label>Số vòng (Swiss Rounds)</label>
                                        <input type="number" className="custom-input" min="3" max="15" value={formRounds} onChange={(e) => setFormRounds(e.target.value)} required />
                                    </div>
                                    <div className="control-group">
                                        <label>Thời gian (Time Control)</label>
                                        <input type="text" className="custom-input" placeholder="e.g. 10+0, 3+2" value={formTimeControl} onChange={(e) => setFormTimeControl(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="control-group">
                                    <label>Bắt đầu đăng ký</label>
                                    <input type="datetime-local" className="custom-input" value={formRegStart} onChange={(e) => setFormRegStart(e.target.value)} />
                                </div>
                                <div className="control-group">
                                    <label>Hạn đăng ký</label>
                                    <input type="datetime-local" className="custom-input" value={formRegEnd} onChange={(e) => setFormRegEnd(e.target.value)} />
                                </div>
                                <div className="control-group">
                                    <label>Thời gian khai mạc (Khai mạc giải)</label>
                                    <input type="datetime-local" className="custom-input" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                                </div>
                                <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: '10px' }}>Tạo giải đấu</button>
                            </form>
                        </div>

                        {/* Tournaments Administration List */}
                        <div style={{ flex: 3 }}>
                            <h2>Giải đấu hiện có</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                {tournaments.map(t => (
                                    <div key={t.tournamentId} className="glass-panel" style={{ width: '100%', padding: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <h3>{t.tournamentName}</h3>
                                            <span style={{
                                                padding: '3px 8px',
                                                borderRadius: '10px',
                                                fontSize: '0.75rem',
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
                                            }}>{t.status === "REGISTERING" ? "Mở đăng ký" : t.status === "ONGOING" ? "Đang diễn ra" : t.status === "UPCOMING" ? "Sắp diễn ra" : t.status === "REGISTRATION_CLOSED" ? "Đã đóng đăng ký" : t.status === "FINISHED" ? "Đã kết thúc" : t.status}</span>
                                        </div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.description || 'Không có mô tả.'}</p>
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                            {t.status === 'ONGOING' && (
                                                <button className="primary-btn" style={{ background: '#8b5cf6' }} onClick={() => handleFinishTournament(t.tournamentId)}>Kết thúc giải</button>
                                            )}
                                            <button className="secondary-btn" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={async () => {
                                                if (window.confirm("Xóa giải đấu này?")) {
                                                    await AdminService.cancelTournament(t.tournamentId);
                                                    loadTournaments();
                                                }
                                            }}>Xóa</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Pairing Results Section */}
                {activeSection === 'pairings' && (
                    <div style={{ display: 'flex', gap: '30px' }}>
                        {/* Select tournament */}
                        <div style={{ flex: 2 }}>
                            <h2>Chọn giải đấu đang diễn ra</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                                {tournaments.filter(t => t.status === 'ONGOING').map(t => (
                                    <div
                                        key={t.tournamentId}
                                        className="glass-panel"
                                        style={{
                                            width: '100%',
                                            cursor: 'pointer',
                                            border: selectedTournament?.tournamentId === t.tournamentId ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)'
                                        }}
                                        onClick={() => handleSelectTournamentPairings(t)}
                                    >
                                        <strong>{t.tournamentName}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* List pairings and submit */}
                        <div style={{ flex: 3 }}>
                            {selectedTournament ? (
                                <div className="glass-panel" style={{ width: '100%' }}>
                                    <h2>Cặp đấu giải: {selectedTournament.tournamentName}</h2>

                                    {/* Rounds selector */}
                                    <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px', margin: '15px 0' }}>
                                        {rounds.map(r => (
                                            <button
                                                key={r.roundId}
                                                onClick={() => handleSelectRound(r.roundId)}
                                                className={selectedRoundId === r.roundId ? 'primary-btn' : 'secondary-btn'}
                                                style={{ padding: '5px 10px', fontSize: '0.75rem', flex: 'none' }}
                                            >
                                                Vòng {r.roundNumber}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Pairings list with controls */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {pairings.map(p => (
                                            <div key={p.pairingId} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', marginBottom: '10px' }}>
                                                    <div>⚪ <strong>{p.whitePlayerName}</strong></div>
                                                    <div>{p.isBye ? 'BYE' : p.result || 'vs'}</div>
                                                    <div>⚫ <strong>{p.blackPlayerName}</strong></div>
                                                </div>

                                                {!p.result && !p.isBye && (
                                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                                        <button className="primary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 'none', background: '#3b82f6' }} onClick={() => handleSubmitResult(p.pairingId, '1-0')}>Trắng thắng (1-0)</button>
                                                        <button className="primary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 'none', background: '#a78bfa' }} onClick={() => handleSubmitResult(p.pairingId, '1/2-1/2')}>Hòa (1/2-1/2)</button>
                                                        <button className="primary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 'none', background: '#10b981' }} onClick={() => handleSubmitResult(p.pairingId, '0-1')}>Đen thắng (0-1)</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="glass-panel" style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                                    Chọn một giải đấu để quản lý kết quả cặp đấu
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Direct Messaging Section */}
                {activeSection === 'messages' && (() => {
                    const safeDirectMessages = Array.isArray(allDirectMessages) ? allDirectMessages : [];
                    const filteredMessages = safeDirectMessages.filter(m => {
                        if (!messageSearch.trim()) return true;
                        const q = messageSearch.trim().toLowerCase();
                        const recipient = String(m.recipientUsername || m.receiverUsername || m.recipient?.username || m.receiver?.username || (m.recipientId ? `User #${m.recipientId}` : '')).toLowerCase();
                        const title = String(m.title || m.subject || '').toLowerCase();
                        const content = String(m.content || m.message || m.body || '').toLowerCase();
                        const sender = String(m.senderUsername || m.senderName || '').toLowerCase();
                        return recipient.includes(q) || title.includes(q) || content.includes(q) || sender.includes(q);
                    });

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                                            📨 Danh sách Tin nhắn Trực tiếp đã gửi ({safeDirectMessages.length})
                                        </h2>
                                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            Quản lý và theo dõi toàn bộ tin nhắn do Quản trị viên gửi tới người dùng trong hệ thống
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDm(null, false)}
                                            className="primary-btn"
                                            style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                                        >
                                            ➕ Soạn tin nhắn mới
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDm(null, true)}
                                            className="primary-btn"
                                            style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
                                        >
                                            📢 Gửi tất cả người dùng
                                        </button>
                                        <button
                                            type="button"
                                            onClick={loadAllDirectMessages}
                                            className="secondary-btn"
                                            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                                        >
                                            🔄 Làm mới
                                        </button>
                                    </div>
                                </div>

                                {/* Search filter for messages */}
                                <div className="friends-search-container" style={{ marginBottom: '16px' }}>
                                    <span className="friends-search-icon">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Lọc tin nhắn theo người nhận, tiêu đề hoặc nội dung..."
                                        value={messageSearch}
                                        onChange={(e) => setMessageSearch(e.target.value)}
                                        className="friends-search-input"
                                    />
                                    {messageSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setMessageSearch('')}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                padding: '0 8px',
                                                fontSize: '0.9rem'
                                            }}
                                            title="Xóa tìm kiếm"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Messages list */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {loadingMessages ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '2rem' }}>⏳</span>
                                            <span>Đang tải danh sách tin nhắn...</span>
                                        </div>
                                    ) : filteredMessages.length > 0 ? (
                                        filteredMessages.map((msg, idx) => {
                                            const isBroadcastMsg = Boolean(
                                                msg.isBroadcast ||
                                                msg.sendToAll ||
                                                msg.recipientUsername === 'Tất cả người dùng' ||
                                                msg.receiverUsername === 'Tất cả người dùng'
                                            );
                                            const recipientName = isBroadcastMsg 
                                                ? 'Tất cả người dùng' 
                                                : (msg.recipientUsername || msg.receiverUsername || msg.recipient?.username || msg.receiver?.username || (msg.recipientId ? `User #${msg.recipientId}` : 'Người chơi'));
                                            const recipientId = msg.recipientId ?? msg.receiverId ?? msg.recipient?.id ?? msg.receiver?.id;
                                            const msgType = String(msg.type || msg.messageType || msg.category || 'INFO').toUpperCase();
                                            const dateVal = msg.sentAt || msg.createdAt || msg.timestamp;
                                            const dateDisplay = dateVal ? new Date(dateVal).toLocaleString('vi-VN') : 'Vừa xong';

                                            return (
                                                <div
                                                    key={msg.id || `msg_${idx}`}
                                                    style={{
                                                        background: isBroadcastMsg ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0, 0, 0, 0.25)',
                                                        border: isBroadcastMsg ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                        borderRadius: '12px',
                                                        padding: '16px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '1.2rem' }}>{isBroadcastMsg ? '📢' : '👤'}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gửi tới:</span>
                                                                {isBroadcastMsg ? (
                                                                    <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>Tất cả người dùng</span>
                                                                ) : (
                                                                    <AdminDisplayName
                                                                        username={recipientName}
                                                                        nameStyle={{ fontWeight: 'bold' }}
                                                                    />
                                                                )}
                                                            </div>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '8px',
                                                                fontSize: '0.72rem',
                                                                fontWeight: 'bold',
                                                                background: msgType === 'WARNING' ? 'rgba(239, 68, 68, 0.2)' :
                                                                            msgType === 'ANNOUNCEMENT' ? 'rgba(245, 158, 11, 0.2)' :
                                                                            msgType === 'CHAT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                                                color: msgType === 'WARNING' ? '#ef4444' :
                                                                       msgType === 'ANNOUNCEMENT' ? '#f59e0b' :
                                                                       msgType === 'CHAT' ? '#10b981' : '#60a5fa'
                                                            }}>
                                                                {msgType}
                                                            </span>
                                                            {isBroadcastMsg && (
                                                                <span style={{
                                                                    padding: '2px 8px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 'bold',
                                                                    background: 'rgba(245, 158, 11, 0.2)',
                                                                    color: '#f59e0b',
                                                                    border: '1px solid rgba(245, 158, 11, 0.4)'
                                                                }}>
                                                                    📢 Toàn hệ thống
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                                {dateDisplay}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => isBroadcastMsg ? handleOpenDm(null, true) : handleOpenDm({ userId: recipientId, username: recipientName })}
                                                                className="secondary-btn"
                                                                style={{ padding: '3px 10px', fontSize: '0.75rem', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
                                                            >
                                                                ✉️ Nhắn tiếp
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <strong style={{ fontSize: '0.98rem', color: '#ffffff' }}>
                                                        {msg.title || msg.subject || 'Thông báo từ Quản trị viên'}
                                                    </strong>
                                                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                                        {msg.content || msg.message || msg.body || ''}
                                                    </p>
                                                </div>
                                            );
                                        })
                                    ) : safeDirectMessages.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '2.5rem' }}>📭</span>
                                            <span>Chưa có tin nhắn trực tiếp nào được gửi.</span>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenDm(null)}
                                                className="primary-btn"
                                                style={{ marginTop: '10px', padding: '8px 16px', fontSize: '0.85rem' }}
                                            >
                                                Soạn tin nhắn đầu tiên
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '2rem' }}>🔍</span>
                                            <span>Không tìm thấy tin nhắn nào khớp với "{messageSearch}".</span>
                                            <button
                                                type="button"
                                                onClick={() => setMessageSearch('')}
                                                className="secondary-btn"
                                                style={{ marginTop: '6px', padding: '6px 14px', fontSize: '0.82rem' }}
                                            >
                                                Xóa bộ lọc tìm kiếm
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <AdminDirectMessageModal
                user={dmTargetUser}
                adminUsername={username}
                isOpen={isDmModalOpen}
                defaultSendToAll={dmDefaultSendToAll}
                onClose={() => setIsDmModalOpen(false)}
                onMessageSent={loadAllDirectMessages}
            />
        </div>
    );
}

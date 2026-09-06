import React, { useState, useEffect } from 'react';
import { AdminService } from '../../services/AdminService';
import AdminDisplayName from '../AdminDisplayName';

const MESSAGE_TYPES = [
    { key: 'INFO', label: 'ℹ️ Thông tin', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    { key: 'WARNING', label: '⚠️ Cảnh báo', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    { key: 'ANNOUNCEMENT', label: '📢 Thông báo', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    { key: 'CHAT', label: '💬 Trò chuyện', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
];

const TEMPLATES = [
    {
        name: '📢 Thông báo hệ thống',
        type: 'ANNOUNCEMENT',
        title: 'Thông báo từ Ban Quản trị AlphaOne',
        content: 'Chào bạn, đây là thông báo chính thức từ Ban Quản trị AlphaOne Chess. Chúc bạn có những ván cờ vui vẻ và bổ ích!'
    },
    {
        name: '⚠️ Cảnh báo thi đấu',
        type: 'WARNING',
        title: 'Cảnh báo về hành vi thi đấu',
        content: 'Ban Quản trị nhận thấy tài khoản của bạn có dấu hiệu thoát trận đấu đột ngột hoặc vi phạm quy tắc fair-play. Vui lòng duy trì tinh thần thể thao công bằng để tránh bị tạm khóa tài khoản.'
    },
    {
        name: '🏆 Chúc mừng thành tích',
        type: 'ANNOUNCEMENT',
        title: 'Chúc mừng thành tích xuất sắc',
        content: 'Ban Quản trị AlphaOne xin gửi lời chúc mừng bạn đã đạt thành tích thi đấu ấn tượng trên bảng xếp hạng! Hãy tiếp tục phát huy nhé!'
    },
    {
        name: '🛠️ Hỗ trợ kỹ thuật',
        type: 'INFO',
        title: 'Phản hồi yêu cầu hỗ trợ',
        content: 'Chào bạn, Ban Quản trị đã tiếp nhận thắc mắc/báo cáo từ bạn. Chúng tôi đã tiến hành kiểm tra và khắc phục. Cảm ơn bạn đã đóng góp!'
    }
];

export default function AdminDirectMessageModal({ user, adminUsername = 'Quản trị viên', isOpen, onClose, onMessageSent, defaultSendToAll = false }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('INFO');
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'history'
    const [sending, setSending] = useState(false);
    const [successNotice, setSuccessNotice] = useState('');
    const [manualRecipient, setManualRecipient] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [sendToAll, setSendToAll] = useState(false);

    const targetUserId = user?.userId ?? user?.id ?? selectedUser?.userId ?? selectedUser?.id ?? (manualRecipient ? (isNaN(manualRecipient) ? null : Number(manualRecipient)) : null);
    const targetUsername = user?.username ?? user?.name ?? selectedUser?.username ?? (manualRecipient || (targetUserId ? `User #${targetUserId}` : ''));

    const loadHistory = async (isAll = sendToAll, userId = targetUserId) => {
        setHistoryLoading(true);
        try {
            if (isAll) {
                const list = await AdminService.getBroadcastMessages();
                setHistory(list || []);
            } else if (userId) {
                const list = await AdminService.getUserDirectMessages(userId);
                setHistory(list || []);
            } else {
                const list = await AdminService.getAllDirectMessages();
                setHistory(list || []);
            }
        } catch (err) {
            console.error('Failed to load message history:', err);
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setContent('');
            const isAll = Boolean(defaultSendToAll && !user);
            setSendToAll(isAll);
            setType(isAll ? 'ANNOUNCEMENT' : 'INFO');
            setSuccessNotice('');
            setActiveTab('compose');
            setSelectedUser(null);
            setSearchQuery('');
            setSearchResults([]);
            loadHistory(isAll, isAll ? null : (user?.userId ?? user?.id));
        }
    }, [isOpen, user?.userId, user?.id, defaultSendToAll]);

    useEffect(() => {
        // When an admin selects a user from search, load their history
        if (selectedUser?.userId || selectedUser?.id) {
            loadHistory(false, selectedUser.userId ?? selectedUser.id);
        }
    }, [selectedUser]);

    const handleSwitchToSendToAll = () => {
        setSendToAll(true);
        setSelectedUser(null);
        setType('ANNOUNCEMENT');
        loadHistory(true, null);
    };

    const handleSwitchToPersonal = () => {
        setSendToAll(false);
        loadHistory(false, targetUserId);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'history') {
            loadHistory(sendToAll, targetUserId);
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        try {
            setSearchLoading(true);
            const users = await AdminService.getUsers(searchQuery.trim());
            setSearchResults(Array.isArray(users) ? users : []);
        } catch (err) {
            console.error('User search failed:', err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectUser = (u) => {
        setSelectedUser(u);
        setManualRecipient('');
        setSearchResults([]);
        setSearchQuery('');
    };

    const handleApplyTemplate = (tmpl) => {
        setTitle(tmpl.title);
        setContent(tmpl.content);
        setType(tmpl.type);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const resolvedName = sendToAll ? 'Tất cả người dùng' : (targetUsername || manualRecipient.trim());
        if (!sendToAll && !resolvedName) {
            alert('Vui lòng chỉ định người nhận tin nhắn!');
            return;
        }
        if (!content.trim()) {
            alert('Vui lòng nhập nội dung tin nhắn!');
            return;
        }

        try {
            setSending(true);
            if (sendToAll) {
                await AdminService.broadcastMessage({
                    title: title.trim() || 'Thông báo từ Quản trị viên',
                    content: content.trim(),
                    type: type || 'ANNOUNCEMENT',
                    senderName: adminUsername
                });
                setSuccessNotice('✓ Đã gửi thông báo tới TẤT CẢ người dùng thành công!');
            } else {
                const resolvedId = targetUserId || `custom_${Date.now()}`;
                await AdminService.sendDirectMessage(resolvedId, {
                    title: title.trim() || 'Thông báo từ Quản trị viên',
                    content: content.trim(),
                    type,
                    targetUsername: resolvedName,
                    senderName: adminUsername
                });
                setSuccessNotice(`✓ Đã gửi tin nhắn trực tiếp tới ${resolvedName} thành công!`);
            }

            setTitle('');
            setContent('');
            if (onMessageSent) onMessageSent();

            // Refresh history and switch to history view to display the newly sent message
            await loadHistory(sendToAll, targetUserId);
            setTimeout(() => {
                setActiveTab('history');
                setSuccessNotice('');
            }, 1000);
        } catch (err) {
            alert('Gửi tin nhắn thất bại: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(5, 7, 12, 0.82)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
            onClick={onClose}
        >
            <div
                className="glass-panel"
                style={{
                    width: '100%',
                    maxWidth: '640px',
                    maxHeight: '90vh',
                    margin: 0,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                    <div style={{ flex: 1, paddingRight: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.4rem' }}>💬</span>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', border: 'none', padding: 0 }}>
                                Nhắn tin trực tiếp tới người dùng
                            </h2>
                        </div>
                        {user ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Người nhận:</span>
                                <AdminDisplayName
                                    username={user.username || user.name || `User #${user.userId || user.id}`}
                                    role={user.role}
                                    showBadge={user.role === 'ROLE_ADMIN'}
                                    nameStyle={{ fontWeight: 'bold' }}
                                />
                                {user.email && <span style={{ color: 'var(--text-muted)' }}>({user.email})</span>}
                                {user.rating && <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>⭐ {user.rating}</span>}
                            </div>
                        ) : (
                            <div style={{ marginTop: '8px' }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                    <button
                                        type="button"
                                        className={!sendToAll ? 'primary-btn' : 'secondary-btn'}
                                        onClick={handleSwitchToPersonal}
                                        style={{ padding: '5px 12px', fontSize: '0.82rem', borderRadius: '6px' }}
                                    >
                                        👤 Gửi cá nhân
                                    </button>
                                    <button
                                        type="button"
                                        className={sendToAll ? 'primary-btn' : 'secondary-btn'}
                                        onClick={handleSwitchToSendToAll}
                                        style={{
                                            padding: '5px 12px',
                                            fontSize: '0.82rem',
                                            borderRadius: '6px',
                                            background: sendToAll ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : undefined,
                                            borderColor: sendToAll ? '#f59e0b' : undefined
                                        }}
                                    >
                                        📢 Gửi tất cả người dùng
                                    </button>
                                </div>

                                {sendToAll ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', fontSize: '0.88rem' }}>
                                        <span style={{ fontSize: '1.4rem' }}>📢</span>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#f59e0b' }}>Toàn bộ người chơi trong hệ thống</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mọi tài khoản sẽ nhận được thông báo này trong hộp thư và nhận tin tức thì nếu đang online</div>
                                        </div>
                                    </div>
                                ) : selectedUser ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                                        <AdminDisplayName
                                            username={selectedUser.username || selectedUser.name || `User #${selectedUser.userId || selectedUser.id}`}
                                            role={selectedUser.role}
                                            showBadge={selectedUser.role === 'ROLE_ADMIN'}
                                            nameStyle={{ fontWeight: 'bold' }}
                                        />
                                        <button type="button" className="secondary-btn" onClick={() => setSelectedUser(null)} style={{ padding: '6px 10px' }}>Thay đổi</button>
                                    </div>
                                ) : (
                                    <div>
                                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="Tìm tên người dùng..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="friends-search-input"
                                                style={{ flex: 1, boxSizing: 'border-box', fontSize: '0.88rem', padding: '7px 12px' }}
                                            />
                                            <button type="submit" className="primary-btn" style={{ padding: '7px 12px' }}>{searchLoading ? 'Đang tìm...' : 'Tìm'}</button>
                                        </form>
                                        {searchResults && searchResults.length > 0 && (
                                            <div style={{ marginTop: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                                                {searchResults.map(u => (
                                                    <div key={u.userId || u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{(u.username || '').charAt(0).toUpperCase()}</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <div style={{ fontWeight: 600 }}>{u.username || u.name || `User #${u.userId || u.id}`}</div>
                                                                {u.rating != null && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⭐ {u.rating}</div>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <button type="button" className="primary-btn" onClick={() => handleSelectUser(u)} style={{ padding: '6px 10px' }}>Chọn</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: 'var(--text-muted)',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flex: 'none'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Sub-nav Tabs */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '8px' }}>
                    <button
                        type="button"
                        className={activeTab === 'compose' ? 'primary-btn' : 'secondary-btn'}
                        onClick={() => setActiveTab('compose')}
                        style={{ padding: '7px 14px', fontSize: '0.82rem', flex: 'none' }}
                    >
                        ✍️ Soạn tin nhắn
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'history' ? 'primary-btn' : 'secondary-btn'}
                        onClick={() => handleTabChange('history')}
                        style={{ padding: '7px 14px', fontSize: '0.82rem', flex: 'none' }}
                    >
                        📜 Lịch sử đã gửi ({history.length})
                    </button>
                </div>

                {successNotice && (
                    <div
                        style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                        }}
                    >
                        {successNotice}
                    </div>
                )}

                {/* Tab: Compose Message */}
                {activeTab === 'compose' && (
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '4px' }}>
                        {/* Type Selection */}
                        <div className="control-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                                Phân loại tin nhắn:
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {MESSAGE_TYPES.map((t) => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setType(t.key)}
                                        style={{
                                            padding: '8px 4px',
                                            borderRadius: '8px',
                                            border: `1px solid ${type === t.key ? t.color : 'rgba(255, 255, 255, 0.08)'}`,
                                            background: type === t.key ? t.bg : 'rgba(255, 255, 255, 0.02)',
                                            color: type === t.key ? '#ffffff' : 'var(--text-muted)',
                                            fontSize: '0.78rem',
                                            fontWeight: type === t.key ? 'bold' : 'normal',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick Templates */}
                        <div className="control-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                                Mẫu tin nhắn nhanh:
                            </label>
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {TEMPLATES.map((tmpl, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleApplyTemplate(tmpl)}
                                        style={{
                                            whiteSpace: 'nowrap',
                                            padding: '5px 10px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {tmpl.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Subject / Title */}
                        <div className="control-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                                Tiêu đề tin nhắn:
                            </label>
                            <input
                                type="text"
                                className="custom-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ví dụ: Thông báo quan trọng từ Admin..."
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Content Body */}
                        <div className="control-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                                Nội dung tin nhắn (*):
                            </label>
                            <textarea
                                className="custom-input"
                                rows="4"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Nhập nội dung cần gửi đến người chơi..."
                                required
                                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '90px' }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                className="secondary-btn"
                                style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={sending}
                                className="primary-btn"
                                style={{ padding: '10px 24px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                            >
                                {sending ? 'Đang gửi...' : '🚀 Gửi tin nhắn'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Tab: History */}
                {activeTab === 'history' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                        {historyLoading ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', fontSize: '0.88rem' }}>
                                Đang tải lịch sử tin nhắn...
                            </div>
                        ) : history.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', fontSize: '0.88rem' }}>
                                {sendToAll
                                    ? 'Chưa có thông báo nào được gửi tới toàn bộ người dùng'
                                    : `Chưa có tin nhắn nào được gửi tới ${targetUsername || user?.username || selectedUser?.username || manualRecipient || 'Người dùng'}`}
                            </div>
                        ) : (
                            history.map((msg) => {
                                const isBroadcast = Boolean(
                                    msg.isBroadcast ||
                                    msg.sendToAll ||
                                    msg.recipientUsername === 'Tất cả người dùng' ||
                                    msg.receiverUsername === 'Tất cả người dùng'
                                );
                                const typeConfig = MESSAGE_TYPES.find(t => t.key === msg.type) || MESSAGE_TYPES[0];
                                const dateDisplay = msg.sentAt ? new Date(msg.sentAt).toLocaleString('vi-VN') : 'Vừa xong';

                                return (
                                    <div
                                        key={msg.id}
                                        style={{
                                            background: isBroadcast ? 'rgba(245, 158, 11, 0.06)' : 'rgba(0, 0, 0, 0.25)',
                                            border: isBroadcast ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '10px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 'bold',
                                                        background: typeConfig.bg,
                                                        color: typeConfig.color,
                                                        border: `1px solid ${typeConfig.color}40`
                                                    }}
                                                >
                                                    {typeConfig.label}
                                                </span>
                                                {isBroadcast && (
                                                    <span
                                                        style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '10px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 'bold',
                                                            background: 'rgba(245, 158, 11, 0.2)',
                                                            color: '#f59e0b',
                                                            border: '1px solid rgba(245, 158, 11, 0.4)'
                                                        }}
                                                    >
                                                        📢 Toàn hệ thống
                                                    </span>
                                                )}
                                                <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>{msg.title}</strong>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {dateDisplay}
                                            </span>
                                        </div>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                            {msg.content}
                                        </p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '4px' }}>
                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    Người gửi: <AdminDisplayName username={msg.senderName || msg.senderUsername || 'Admin'} userId={msg.senderId} role="ROLE_ADMIN" nameStyle={{ fontSize: '0.75rem', fontWeight: 'bold' }} />
                                                </span>
                                                <span>Người nhận: <strong style={{ color: isBroadcast ? '#f59e0b' : 'var(--accent-purple)' }}>{isBroadcast ? 'Tất cả người dùng' : (msg.recipientUsername || targetUsername || 'Người chơi')}</strong></span>
                                            </div>
                                            <span style={{ color: '#10b981' }}>✓ Đã gửi</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { AdminService } from '../services/AdminService';
import AdminDisplayName from './AdminDisplayName';

const MESSAGE_TYPES = {
    INFO: { label: 'ℹ️ Thông tin', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    WARNING: { label: '⚠️ Cảnh báo', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    ANNOUNCEMENT: { label: '📢 Thông báo', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    CHAT: { label: '💬 Trò chuyện', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
};

export default function AdminMessageInboxModal({ userId, isOpen, onClose, onRefreshCount }) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            loadInbox();
        }
    }, [isOpen, userId]);

    const loadInbox = async () => {
        setLoading(true);
        try {
            const list = await AdminService.getUserInbox(userId);
            setMessages(list || []);
        } catch (err) {
            console.error('Failed to load user inbox:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = (msgId) => {
        AdminService.markMessageAsRead(userId, msgId);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m));
        if (onRefreshCount) onRefreshCount();
    };

    const handleMarkAllRead = () => {
        messages.forEach(m => AdminService.markMessageAsRead(userId, m.id));
        setMessages(prev => prev.map(m => ({ ...m, read: true })));
        if (onRefreshCount) onRefreshCount();
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
                    maxWidth: '560px',
                    maxHeight: '85vh',
                    margin: 0,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📨</span>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', border: 'none', padding: 0 }}>
                            {t('nav.messages')}
                        </h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {messages.some(m => !m.read) && (
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                className="action-link-btn"
                                style={{ fontSize: '0.75rem', textTransform: 'none' }}
                            >
                                {t('admin.markAllRead')}
                            </button>
                        )}
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
                                fontSize: '1.1rem'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Messages List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '55vh', paddingRight: '4px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            {t('common.loading')}
                        </div>
                    ) : messages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '2.5rem' }}>📭</span>
                            <span style={{ fontSize: '0.95rem' }}>{t('friends.noFriendsFound')}</span>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const typeConfig = MESSAGE_TYPES[msg.type] || MESSAGE_TYPES.INFO;
                            return (
                                <div
                                    key={msg.id}
                                    style={{
                                        background: msg.read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(59, 130, 246, 0.08)',
                                        border: '1px solid',
                                        borderColor: msg.read ? 'rgba(255, 255, 255, 0.06)' : 'rgba(59, 130, 246, 0.3)',
                                        borderRadius: '12px',
                                        padding: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        position: 'relative'
                                    }}
                                    onClick={() => !msg.read && handleMarkAsRead(msg.id)}
                                >
                                    {/* Top info */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AdminDisplayName
                                                username={msg.senderName || 'Ban Quản trị'}
                                                userId={msg.senderId}
                                                role="ROLE_ADMIN"
                                                nameStyle={{ fontSize: '0.82rem', fontWeight: 'bold' }}
                                            />
                                            <span
                                                style={{
                                                    padding: '2px 7px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    background: typeConfig.bg,
                                                    color: typeConfig.color,
                                                    marginLeft: '4px'
                                                }}
                                            >
                                                {typeConfig.label}
                                            </span>
                                            {Boolean(msg.isBroadcast || msg.sendToAll || msg.recipientUsername === 'Tất cả người dùng') && (
                                                <span
                                                    style={{
                                                        padding: '2px 7px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'bold',
                                                        background: 'rgba(245, 158, 11, 0.2)',
                                                        color: '#f59e0b',
                                                        border: '1px solid rgba(245, 158, 11, 0.4)',
                                                        marginLeft: '4px'
                                                    }}
                                                >
                                                    📢 Toàn hệ thống
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {new Date(msg.sentAt).toLocaleString('vi-VN')}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>
                                        {msg.title}
                                    </strong>

                                    {/* Content */}
                                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                        {msg.content}
                                    </p>

                                    {/* Read status footer */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px' }}>
                                        {!msg.read ? (
                                            <button
                                                type="button"
                                                onClick={() => handleMarkAsRead(msg.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--accent-blue-hover)',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                ✓ Đánh dấu đã đọc
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>✓ Đã đọc</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

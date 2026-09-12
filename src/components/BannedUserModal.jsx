import React from 'react';
import { useTranslation } from '../contexts/I18nContext';

export default function BannedUserModal({ isOpen, user, onOpenInbox, onLogout }) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const username = user?.username || localStorage.getItem('username') || 'Người chơi';

    return (
        <div 
            className="banned-modal-overlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
        >
            <div 
                className="banned-modal-card"
                style={{
                    background: 'linear-gradient(145deg, #2a1515 0%, #1a0c0c 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '16px',
                    maxWidth: '500px',
                    width: '100%',
                    padding: '28px',
                    boxShadow: '0 20px 60px rgba(239, 68, 68, 0.25), 0 0 40px rgba(0, 0, 0, 0.8)',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '18px',
                    animation: 'bannedPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                <style>{`
                    @keyframes bannedPopIn {
                        from { opacity: 0; transform: scale(0.9) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    @keyframes bannedPulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                `}</style>

                {/* Ban Icon */}
                <div 
                    style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '2px solid #ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                        animation: 'bannedPulse 2s infinite'
                    }}
                >
                    ⛔
                </div>

                {/* Header */}
                <div>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', color: '#f87171', fontWeight: '800', letterSpacing: '0.5px' }}>
                        {t('banned.title', 'TÀI KHOẢN ĐÃ BỊ KHÓA')}
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                        {t('banned.userLabel', 'Tài khoản')}: <strong style={{ color: '#ffffff' }}>{username}</strong>
                    </span>
                </div>

                {/* Default Notice Message */}
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#d1d5db', lineHeight: '1.5', background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', width: '100%', boxSizing: 'border-box' }}>
                    {t('banned.message', 'Tài khoản của bạn hiện đang bị tạm khóa do vi phạm Quy định của hệ thống. Tất cả tính năng chơi game, tạo phòng và tương tác đã bị vô hiệu hóa.')}
                </p>

                {/* Custom Ban Reason & Description Container */}
                <div style={{
                    width: '100%',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px dashed rgba(239, 68, 68, 0.4)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: '700', fontSize: '0.88rem' }}>
                        <span>📌</span>
                        <span>{t('banned.reasonTitle', 'Lý do khóa tài khoản')}:</span>
                        <span style={{ color: '#ffffff', fontWeight: '600' }}>
                            {user?.banReason || user?.ban_reason || t('banned.defaultReason', 'Vi phạm Quy định dịch vụ')}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '0.8rem' }}>
                        <span>🛡️</span>
                        <span>{t('banned.bannedByTitle', 'Người thực hiện khóa')}:</span>
                        <span style={{ color: '#60a5fa', fontWeight: '600' }}>
                            {user?.bannedByUser || user?.banned_by_user || t('banned.defaultBy', 'Quản trị viên')}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#e5e7eb', lineHeight: '1.45', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong style={{ color: '#fca5a5' }}>📝 {t('banned.descriptionTitle', 'Chi tiết vi phạm')}: </strong>
                        {user?.banDescription || user?.ban_description || t('banned.defaultDescription', 'Tài khoản của bạn đã bị Quản trị viên khóa do vi phạm điều khoản sử dụng. Vui lòng xem thông báo từ Admin trong Hộp Thư để biết chi tiết.')}
                    </div>
                </div>

                {/* Allowed vs Restricted List */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <span>🔒</span>
                        <span style={{ color: '#fca5a5' }}>{t('banned.restrictedActions', 'Bị hạn chế: Đấu trực tuyến, Chơi AI, Giải đấu, Thêm bạn, Sửa hồ sơ')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(74, 222, 128, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                        <span>🔔</span>
                        <span style={{ color: '#86efac' }}>{t('banned.allowedActions', 'Được phép: Xem Hộp Thư & Thông Báo từ Quản trị viên')}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                    {onOpenInbox && (
                        <button
                            type="button"
                            onClick={onOpenInbox}
                            style={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#ffffff',
                                padding: '12px',
                                fontWeight: '700',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            🔔 {t('banned.viewInbox', 'Xem Thông Báo')}
                        </button>
                    )}
                    {onLogout && (
                        <button
                            type="button"
                            onClick={onLogout}
                            style={{
                                flex: 'none',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                color: '#9ca3af',
                                padding: '12px 18px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            🚪 {t('banned.logout', 'Đăng xuất')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

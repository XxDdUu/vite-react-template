import React, { useState } from 'react';
import { FriendService } from '../../services/FriendService';
import { useTranslation } from '../../contexts/I18nContext';
import { isImageUrl, formatAvatarUrl } from '../../services/MinioService';
import '../../index.css';

export default function PendingFriendModal({ isOpen, onClose, pending, currentUserId, onAcceptSuccess }) {
    const [loadingId, setLoadingId] = useState(null);
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handleAccept = async (senderId) => {
        try {
            setLoadingId(senderId);
            await FriendService.acceptRequest(currentUserId, senderId);
            if (onAcceptSuccess) {
                onAcceptSuccess(senderId);
            }
        } catch (error) {
            console.error("Failed to accept request", error);
            alert("Could not accept friend request");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('friends.requests', 'Lời mời kết bạn')} ({pending.length})</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                
                <div className="pending-list">
                    {pending.length === 0 ? (
                        <div className="empty-state" style={{ color: '#8b92a5', textAlign: 'center', padding: '20px' }}>
                            {t('friends.noFriendsFound', 'Không có lời mời kết bạn nào.')}
                        </div>
                    ) : (
                        pending.map(req => (
                            <div key={req.userId || req.senderId} className="friend-item" style={{ borderBottom: 'none', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '10px' }}>
                                <div className="friend-info">
                                    <div className="friend-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isImageUrl(req.avatarUrl || req.avatar) ? (
                                            <img src={formatAvatarUrl(req.avatarUrl || req.avatar)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            req.avatarUrl || req.avatar || ((req.username || '?').charAt(0).toUpperCase())
                                        )}
                                    </div>
                                    <div className="friend-details">
                                        <span style={{ fontWeight: 600 }}>{req.username}</span>
                                    </div>
                                </div>
                                <div className="pending-actions">
                                    <button 
                                        className="primary-btn" 
                                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                        onClick={() => handleAccept(req.userId || req.senderId)}
                                        disabled={loadingId === (req.userId || req.senderId)}
                                    >
                                        {loadingId === (req.userId || req.senderId) ? t('common.loading', 'Đang xử lý...') : t('friends.accept', 'Chấp nhận')}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

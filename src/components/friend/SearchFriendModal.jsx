import React, { useState } from 'react';
import { FriendService } from '../../services/FriendService';
import { useTranslation } from '../../contexts/I18nContext';
import { isImageUrl, formatAvatarUrl } from '../../services/MinioService';

export default function SearchFriendModal({ isOpen, onClose, currentUserId, onActionSuccess }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    if (!isOpen) return null;

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        try {
            setLoading(true);
            const data = await FriendService.searchNewFriends(currentUserId, query);
            setResults(data);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (targetId) => {
        try {
            setActionLoadingId(targetId);
            await FriendService.sendRequest(currentUserId, targetId);
            setResults(prev => prev.map(u => 
                u.userId === targetId ? { ...u, friendshipStatus: 'PENDING_SENT' } : u
            ));
            if (onActionSuccess) onActionSuccess();
        } catch (error) {
            console.error("Failed to send request", error);
            alert("Không thể gửi lời mời kết bạn");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleAcceptRequest = async (targetId) => {
        try {
            setActionLoadingId(targetId);
            await FriendService.acceptRequest(currentUserId, targetId);
            setResults(prev => prev.map(u => 
                u.userId === targetId ? { ...u, friendshipStatus: 'ACCEPTED' } : u
            ));
            if (onActionSuccess) onActionSuccess();
        } catch (error) {
            console.error("Failed to accept request", error);
            alert("Không thể đồng ý kết bạn");
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="search-modal-overlay" onClick={onClose}>
            <style>{`
                .search-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(10, 11, 14, 0.75);
                    backdrop-filter: blur(12px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    animation: searchFadeIn 0.25s ease-out;
                }

                .search-modal-content {
                    background: linear-gradient(145deg, #1e2026, #14161c);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    width: 480px;
                    max-width: 90vw;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
                    overflow: hidden;
                    animation: searchSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes searchFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes searchSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .search-modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .search-modal-header h2 {
                    font-size: 1.35rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin: 0;
                }

                .search-close-btn {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #8b92a5;
                    font-size: 1.1rem;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    min-width: 32px;
                    max-width: 32px;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    padding: 0;
                    flex: 0 0 32px;
                    margin-left: auto;
                    transition: all 0.2s;
                }

                .search-close-btn:hover {
                    background: rgba(239, 68, 68, 0.15);
                    border-color: rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                }

                .search-form-wrapper {
                    padding: 20px 24px;
                    background: rgba(255, 255, 255, 0.01);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                }

                .search-input-group {
                    display: flex;
                    align-items: center;
                    background: rgba(0, 0, 0, 0.25);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 4px 6px 4px 16px;
                    transition: all 0.2s;
                }

                .search-input-group:focus-within {
                    border-color: #818cf8;
                    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
                }

                .search-input-field {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: #ffffff;
                    font-size: 0.95rem;
                    padding: 10px 0;
                    outline: none;
                }

                .search-input-field::placeholder {
                    color: #626a7f;
                }

                .search-submit-button {
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .search-submit-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
                }

                .search-results-list {
                    padding: 20px 24px;
                    overflow-y: auto;
                    flex: 1;
                    max-height: 380px;
                }

                .search-result-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    border-radius: 14px;
                    padding: 14px 16px;
                    margin-bottom: 12px;
                    transition: all 0.2s;
                }

                .search-result-card:hover {
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 255, 255, 0.08);
                    transform: translateY(-1px);
                }

                .search-avatar-circle {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                    font-weight: 700;
                    font-size: 1.15rem;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }

                .search-friend-details {
                    display: flex;
                    flex-direction: column;
                    margin-left: 14px;
                    flex: 1;
                }

                .search-friend-name {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: #ffffff;
                }

                .search-friend-rating {
                    font-size: 0.8rem;
                    color: #8b92a5;
                    margin-top: 2px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .search-action-btn-green {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .search-action-btn-green:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }

                .search-action-btn-blue {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .search-action-btn-blue:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }

                .search-status-badge {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: #8b92a5;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: default;
                    box-sizing: border-box;
                }
            `}</style>
            <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <h2>{t('friends.search', 'Tìm bạn mới')}</h2>
                    <button className="search-close-btn" onClick={onClose}>&times;</button>
                </div>
                
                <div className="search-form-wrapper">
                    <form onSubmit={handleSearch}>
                        <div className="search-input-group">
                            <span style={{ marginRight: '10px', color: '#626a7f' }}>🔍</span>
                            <input
                                type="text"
                                className="search-input-field"
                                placeholder={t('friends.searchPlaceholder', 'Nhập tên người dùng cần tìm...')}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <button type="submit" className="search-submit-button">
                                {t('common.search', 'Tìm kiếm')}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="search-results-list">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#8b92a5' }}>
                            {t('common.loading', 'Đang tìm kiếm...')}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="empty-state" style={{ color: '#8b92a5', textAlign: 'center', padding: '30px' }}>
                            {query ? t('friends.noFriendsFound', 'Không tìm thấy người dùng nào.') : t('friends.searchPlaceholder', 'Nhập tên người dùng ở trên để bắt đầu tìm kiếm.')}
                        </div>
                    ) : (
                        results.map(u => (
                            <div key={u.userId} className="search-result-card">
                                <div className="search-avatar-circle" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isImageUrl(u.avatarUrl || u.avatar) ? (
                                        <img src={formatAvatarUrl(u.avatarUrl || u.avatar)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        u.avatarUrl || u.avatar || (u.username ? u.username.charAt(0).toUpperCase() : '👤')
                                    )}
                                </div>
                                <div className="search-friend-details">
                                    <span className="search-friend-name">{u.username}</span>
                                    <span className="search-friend-rating">🛡️ Rating: {u.rating}</span>
                                </div>
                                <div className="search-actions">
                                    {u.friendshipStatus === 'NONE' && (
                                        <button 
                                            className="search-action-btn-green" 
                                            onClick={() => handleSendRequest(u.userId)}
                                            disabled={actionLoadingId === u.userId}
                                        >
                                            {actionLoadingId === u.userId ? t('common.loading', 'Đang gửi...') : t('friends.add', 'Kết bạn')}
                                        </button>
                                    )}
                                    {u.friendshipStatus === 'PENDING_SENT' && (
                                        <button 
                                            className="search-status-badge"
                                            disabled
                                        >
                                            {t('friends.pendingSent', 'Đang chờ')}
                                        </button>
                                    )}
                                    {u.friendshipStatus === 'PENDING_RECEIVED' && (
                                        <button 
                                            className="search-action-btn-blue" 
                                            onClick={() => handleAcceptRequest(u.userId)}
                                            disabled={actionLoadingId === u.userId}
                                        >
                                            {actionLoadingId === u.userId ? '...' : t('friends.accept', 'Chấp nhận')}
                                        </button>
                                    )}
                                    {u.friendshipStatus === 'ACCEPTED' && (
                                        <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, paddingRight: '10px' }}>
                                            ✓ {t('nav.friends', 'Bạn bè')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

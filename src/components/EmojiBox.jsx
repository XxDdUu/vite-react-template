import React, { useState, useEffect, useRef } from 'react';

const CHESS_EMOJIS = [
    '♟️', '♞', '♝', '♜', '♛', '♚',
    '⚔️', '🛡️', '🏆', '👑', '🎯', '⌛',
    '🤝', '🏳️', '💥', '🔥', '🧠', '⚡'
];

const FACE_EMOJIS = [
    '😀', '😂', '🤣', '😅', '😊', '😎',
    '😍', '🤔', '🤫', '😱', '🤯', '🥳',
    '😴', '🥶', '😈', '🤖', '🤡', '😭'
];

const REACTION_EMOJIS = [
    '👍', '👎', '👏', '🙌', '🤝', '✌️',
    '👊', '🫡', '🙏', '❤️', '💔', '💯',
    '✨', '🎉', '💪', '👀', '👋', '⭐'
];

const QUICK_PHRASES = [
    { text: 'Chúc may mắn! 🍀', icon: '🍀' },
    { text: 'Ván đấu hay lắm! 👏', icon: '👏' },
    { text: 'Cố lên! 💪', icon: '💪' },
    { text: 'Cảm ơn đối thủ! 🤝', icon: '🤝' },
    { text: 'Nước cờ xuất sắc! 🧠', icon: '🧠' },
    { text: 'Cầu hòa không bạn? 🏳️', icon: '🏳️' },
    { text: 'Tập trung nào! 🎯', icon: '🎯' },
    { text: 'Rất vui được đấu với bạn! ✨', icon: '✨' }
];

export default function EmojiBox({ onSelectEmoji, onSelectPhrase, onClose }) {
    const [activeTab, setActiveTab] = useState('chess'); // 'chess', 'faces', 'reactions', 'phrases'
    const popoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                // If the click is on the emoji toggle button, let that handler manage it
                if (!e.target.closest('.emoji-toggle-btn')) {
                    onClose();
                }
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div ref={popoverRef} className="emoji-box-popover">
            <div className="emoji-box-header">
                <span>Chọn biểu cảm & Tin nhanh</span>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        lineHeight: 1
                    }}
                >
                    ✕
                </button>
            </div>

            <div className="emoji-tabs-bar">
                <button
                    type="button"
                    className={`emoji-tab-button ${activeTab === 'chess' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chess')}
                    title="Cờ vua"
                >
                    ♟️ Cờ vua
                </button>
                <button
                    type="button"
                    className={`emoji-tab-button ${activeTab === 'faces' ? 'active' : ''}`}
                    onClick={() => setActiveTab('faces')}
                    title="Biểu cảm"
                >
                    😀 Biểu cảm
                </button>
                <button
                    type="button"
                    className={`emoji-tab-button ${activeTab === 'reactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reactions')}
                    title="Phản ứng"
                >
                    👍 Tương tác
                </button>
                <button
                    type="button"
                    className={`emoji-tab-button ${activeTab === 'phrases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('phrases')}
                    title="Tin nhanh"
                >
                    💬 Tin nhanh
                </button>
            </div>

            {activeTab === 'chess' && (
                <div className="emoji-grid-content">
                    {CHESS_EMOJIS.map((emoji, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="emoji-item-btn"
                            onClick={() => onSelectEmoji(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'faces' && (
                <div className="emoji-grid-content">
                    {FACE_EMOJIS.map((emoji, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="emoji-item-btn"
                            onClick={() => onSelectEmoji(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'reactions' && (
                <div className="emoji-grid-content">
                    {REACTION_EMOJIS.map((emoji, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="emoji-item-btn"
                            onClick={() => onSelectEmoji(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'phrases' && (
                <div className="quick-phrases-list">
                    {QUICK_PHRASES.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="quick-phrase-item"
                            onClick={() => onSelectPhrase ? onSelectPhrase(item.text) : onSelectEmoji(item.text)}
                        >
                            <span>{item.text}</span>
                            <span>{item.icon}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

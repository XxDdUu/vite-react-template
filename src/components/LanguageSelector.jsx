import React, { useState } from 'react';
import { useTranslation } from '../contexts/I18nContext';

export default function LanguageSelector() {
    const { language, changeLanguage, supportedLanguages, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const currentLangObj = supportedLanguages.find(l => l.code === language) || supportedLanguages[1];

    return (
        <div className="language-selector-wrapper" style={{ position: 'relative', width: '100%' }}>
            <button
                type="button"
                className={`theme-toggle-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(prev => !prev)}
                title={t('language.title', 'Ngôn ngữ')}
                style={{ width: '100%', cursor: 'pointer' }}
            >
                <span style={{ fontSize: '1rem' }}>🌐</span>
                <span className="theme-toggle-label">{t(`language.${language}`, currentLangObj.native)}</span>
                <span className={`theme-toggle-chevron ${isOpen ? 'open' : ''}`}>›</span>
            </button>

            {isOpen && (
                <div
                    className="language-dropdown-panel"
                    style={{
                        marginTop: '6px',
                        background: 'var(--sidebar-bg, #14161c)',
                        border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        zIndex: 200,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                    }}
                >
                    {supportedLanguages.map(langItem => (
                        <button
                            key={langItem.code}
                            type="button"
                            onClick={() => {
                                changeLanguage(langItem.code);
                                setIsOpen(false);
                            }}
                            className={`lang-option-btn ${language === langItem.code ? 'selected' : ''}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: language === langItem.code ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: language === langItem.code ? '#60a5fa' : 'var(--text-primary, #f0f2f5)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: language === langItem.code ? '600' : 'normal',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <span>{t(`language.${langItem.code}`, langItem.native)}</span>
                            {language === langItem.code && <span>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

import React, { useState } from 'react';
import { useTheme, PRESET_THEMES } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/I18nContext';

export default function ThemeCustomizer() {
    const { currentTheme, selectPreset, updateColor } = useTheme();
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="theme-customizer-wrapper">
            {/* Toggle button */}
            <button
                className={`theme-toggle-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(prev => !prev)}
                title={t('nav.theme', 'Giao diện')}
            >
                <span style={{ fontSize: '1rem' }}>🎨</span>
                <span className="theme-toggle-label">{t('nav.theme', 'Giao diện')}</span>
                <span className={`theme-toggle-chevron ${isOpen ? 'open' : ''}`}>›</span>
            </button>

            {/* Collapsible panel */}
            <div className={`theme-panel ${isOpen ? 'open' : ''}`}>
                {/* Preset dots */}
                <p className="theme-section-label">Chủ đề màu</p>
                <div className="theme-presets-grid">
                    {PRESET_THEMES.map(preset => (
                        <button
                            key={preset.id}
                            className={`preset-dot ${currentTheme.id === preset.id ? 'selected' : ''}`}
                            style={{ '--dot-color': preset.accentBlue, '--dot-bg': preset.accentPurple }}
                            onClick={() => selectPreset(preset)}
                            title={preset.name}
                        >
                            <span className="preset-dot-inner" />
                            <span className="preset-dot-name">{preset.name}</span>
                        </button>
                    ))}
                </div>

                {/* Manual color pickers */}
                <p className="theme-section-label" style={{ marginTop: '14px' }}>Tùy chỉnh màu</p>
                <div className="theme-pickers">
                    <label className="theme-picker-row">
                        <span className="picker-label">Màu nhấn chính</span>
                        <div className="picker-right">
                            <input
                                type="color"
                                className="color-input"
                                value={currentTheme.accentBlue}
                                onChange={e => updateColor('accentBlue', e.target.value)}
                            />
                            <span className="picker-hex">{currentTheme.accentBlue}</span>
                        </div>
                    </label>
                    <label className="theme-picker-row">
                        <span className="picker-label">Màu nhấn phụ</span>
                        <div className="picker-right">
                            <input
                                type="color"
                                className="color-input"
                                value={currentTheme.accentPurple}
                                onChange={e => updateColor('accentPurple', e.target.value)}
                            />
                            <span className="picker-hex">{currentTheme.accentPurple}</span>
                        </div>
                    </label>
                </div>

                {/* Active theme label */}
                <div className="theme-active-label">
                    <span>{currentTheme.emoji} {currentTheme.name}</span>
                </div>
            </div>
        </div>
    );
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import vi from '../i18n/locales/vi.json';
import en from '../i18n/locales/en.json';
import zh from '../i18n/locales/zh.json';
import ko from '../i18n/locales/ko.json';
import { UserService } from '../services/UserService';

export const SUPPORTED_LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt', native: 'Tiếng Việt' },
    { code: 'en', label: 'English', native: 'English' },
    { code: 'zh', label: 'Chinese', native: '中文' },
    { code: 'ko', label: 'Korean', native: '한국어' }
];

const DICTIONARIES = { vi, en, zh, ko };

export const resolveSystemLanguage = () => {
    try {
        const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
        if (browserLang && ['vi', 'en', 'zh', 'ko'].includes(browserLang)) {
            return browserLang;
        }
    } catch {
        // Ignore browser environment issues
    }
    return 'en';
};

export const resolveInitialLanguage = () => {
    try {
        const saved = localStorage.getItem('language');
        if (saved && ['vi', 'en', 'zh', 'ko'].includes(saved)) {
            return saved;
        }
    } catch {
        // Ignore storage access errors
    }
    return resolveSystemLanguage();
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
    const [language, setLanguageState] = useState(resolveInitialLanguage);

    const setLanguage = useCallback((lang) => {
        const targetLang = ['vi', 'en', 'zh', 'ko'].includes(lang) ? lang : 'en';
        setLanguageState(targetLang);
        try {
            localStorage.setItem('language', targetLang);
        } catch {
            // Ignore localStorage quota/access errors
        }
    }, []);

    const changeLanguage = useCallback(async (newLang) => {
        const validLang = ['vi', 'en', 'zh', 'ko'].includes(newLang) ? newLang : 'en';
        setLanguage(validLang);

        const token = localStorage.getItem('accessToken');
        if (token) {
            try {
                await UserService.updatePreferences(validLang);
            } catch (err) {
                console.error('Failed to sync language preference to backend:', err);
            }
        }
    }, [setLanguage]);

    const syncUserLanguage = useCallback((dbLang) => {
        if (dbLang && ['vi', 'en', 'zh', 'ko'].includes(dbLang)) {
            setLanguage(dbLang);
        }
    }, [setLanguage]);

    const t = useCallback((key, fallback) => {
        if (!key) return fallback || '';
        const dict = DICTIONARIES[language] || DICTIONARIES['en'];
        const keys = key.split('.');
        let val = dict;
        for (const k of keys) {
            if (val && typeof val === 'object' && k in val) {
                val = val[k];
            } else {
                val = undefined;
                break;
            }
        }
        if (typeof val === 'string') return val;

        // Fallback to English dictionary if key missing in target language
        let fallbackVal = DICTIONARIES['en'];
        for (const k of keys) {
            if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
                fallbackVal = fallbackVal[k];
            } else {
                fallbackVal = undefined;
                break;
            }
        }
        if (typeof fallbackVal === 'string') return fallbackVal;

        return fallback || key;
    }, [language]);

    return (
        <I18nContext.Provider value={{
            language,
            changeLanguage,
            syncUserLanguage,
            t,
            supportedLanguages: SUPPORTED_LANGUAGES
        }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
}

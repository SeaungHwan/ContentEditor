"use client";
import { useEffect, useCallback } from 'react';
import { getDOMParser } from '../utils/htmlCleaners';

const STORAGE_KEY = 'table-editor-autosave';

export default function useAutoSave(getContent) {
    const save = useCallback(() => {
        try {
            const html = getContent();
            if (!html || html.trim() === '') {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            const doc = getDOMParser().parseFromString(html, 'text/html');
            const hasTable = !!doc.querySelector('table');
            const hasText = doc.body.textContent.trim().length > 0;
            if (!hasTable && !hasText) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ html, savedAt: Date.now() }));
        } catch { /* localStorage 접근 불가 환경 무시 */ }
    }, [getContent]);

    const restore = useCallback(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }, []);

    const clearSaved = useCallback(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* 무시 */ }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleUnload = () => save();
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [save]);

    return { save, restore, clearSaved };
}

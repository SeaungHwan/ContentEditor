"use client";
import { useEffect, useCallback, useRef } from 'react';
import { getDOMParser } from '../utils/htmlCleaners';

const STORAGE_KEY = 'table-editor-autosave';
const SESSION_ALIVE_KEY = 'table-editor-session-alive';

export default function useAutoSave(getContent) {
    // 이전 세션이 beforeunload를 끝까지 실행하지 못하고 끝났는지(크래시 등 비정상 종료)를
    // 이번 세션이 SESSION_ALIVE_KEY를 다시 세팅하기 전에, 최초 렌더에서 1회만 읽어둔다.
    const wasUncleanShutdownRef = useRef(null);
    if (wasUncleanShutdownRef.current === null) {
        try {
            wasUncleanShutdownRef.current = localStorage.getItem(SESSION_ALIVE_KEY) === '1';
        } catch {
            wasUncleanShutdownRef.current = false;
        }
    }

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
        try { localStorage.setItem(SESSION_ALIVE_KEY, '1'); } catch { /* 무시 */ }
        const handleUnload = () => {
            save();
            // 정상적으로 unload가 끝까지 실행됐다는 표시 — 다음 로드 때 이 키가 없으면 정상 종료였다는 뜻
            try { localStorage.removeItem(SESSION_ALIVE_KEY); } catch { /* 무시 */ }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [save]);

    return { save, restore, clearSaved, wasUncleanShutdown: wasUncleanShutdownRef.current };
}

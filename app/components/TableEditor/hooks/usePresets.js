"use client";
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'table-editor-presets';

const loadPresets = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
};

export default function usePresets() {
    const [presets, setPresets] = useState(() => {
        if (typeof window === 'undefined') return [];
        return loadPresets();
    });

    const savePreset = useCallback((name, config) => {
        setPresets(prev => {
            const updated = [
                ...prev.filter(p => p.name !== name),
                { name, config, savedAt: Date.now() },
            ];
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* 무시 */ }
            return updated;
        });
    }, []);

    const deletePreset = useCallback((name) => {
        setPresets(prev => {
            const updated = prev.filter(p => p.name !== name);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* 무시 */ }
            return updated;
        });
    }, []);

    return { presets, savePreset, deletePreset };
}

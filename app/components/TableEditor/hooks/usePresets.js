"use client";
import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'table-editor-presets';

// 삭제 불가 고정 프리셋 — 이 배열에 직접 추가·수정하세요.
const DEFAULT_PRESETS = [
    {
        name: '충남',
        locked: true,
        config: {
            wrapperClassName: 'table_st',
            ulClassName: 'list_st',
            olType: [],
            keepMarker: false,
            useAtteMarker: false,
            tableUlClassName: 'list_st',
            tableOlType: [],
            tableKeepMarker: false,
            tableUseAtteMarker: false,
            tableType: 'default',
            isColorMode: false,
            isColorClassMode: true,
            tableIsColorMode: false,
            tableIsColorClassMode: true,
            isWrapDiv: false,
            isVerticalHeader: false,
            headerRows: 1,
            headerCols: 1,
            tit1: { type: 'custom', val: '' },
            tit2: { type: 'custom', val: '' },
            tit3: { type: 'custom', val: '' },
            tit1Class: 'tit1',
            tit2Class: 'tit2',
            tit3Class: 'tit3',
            colWidths: [''],
        },
    },
    {
        name: '경남행정기관',
        locked: true,
        config: {
            wrapperClassName: 'tbl_type01',
            ulClassName: 'listTy0',
            olType: [],
            keepMarker: false,
            useAtteMarker: false,
            tableUlClassName: 'listTy0',
            tableOlType: [],
            tableKeepMarker: false,
            tableUseAtteMarker: false,
            tableType: 'default',
            isColorMode: false,
            isColorClassMode: true,
            tableIsColorMode: false,
            tableIsColorClassMode: true,
            isWrapDiv: true,
            isVerticalHeader: false,
            headerRows: 1,
            headerCols: 1,
            tit1: { type: 'custom', val: '' },
            tit2: { type: 'custom', val: '' },
            tit3: { type: 'custom', val: '' },
            tit1Class: 'tit01',
            tit2Class: 'tit02',
            tit3Class: 'tit03',
            colWidths: [''],
        },
    },
    {
        name: '광주학통',
        locked: true,
        config: {
            wrapperClassName: 'tbl-st',
            ulClassName: 'list bu-st',
            olType: [],
            olClassName: 'order-st',
            numClassName: 'mrk',
            keepMarker: false,
            useAtteMarker: true,
            tableUlClassName: 'list bu-st',
            tableOlType: [],
            tableOlClassName: 'order-st',
            tableNumClassName: 'mrk',
            tableKeepMarker: false,
            tableUseAtteMarker: false,
            tableType: 'default',
            isColorMode: false,
            isColorClassMode: true,
            tableIsColorMode: false,
            tableIsColorClassMode: true,
            isWrapDiv: true,
            isVerticalHeader: false,
            headerRows: 1,
            headerCols: 1,
            tit1: { type: 'custom', val: '' },
            tit2: { type: 'custom', val: '' },
            tit3: { type: 'custom', val: '' },
            tit1Class: 'tit-st section',
            tit2Class: 'tit-st contents',
            tit3Class: 'tit-st unit',
            boxClassName: 'box-st basic',
            linkClassName: 'link-st link',
            mailClassName: 'bu_mail',
            colWidths: [''],
        },
    },
];

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
        if (DEFAULT_PRESETS.some(p => p.name === name)) return;
        setPresets(prev => {
            const updated = prev.filter(p => p.name !== name);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* 무시 */ }
            return updated;
        });
    }, []);

    const mergedPresets = useMemo(() => [...DEFAULT_PRESETS, ...presets], [presets]);

    return { presets: mergedPresets, savePreset, deletePreset };
}

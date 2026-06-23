/*
 * [TableEditor.jsx] 에디터 핵심 오케스트레이터
 */
"use client";
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import layout from "../../layout.module.css";
import { cleanTableHtml, updateStylesOnly } from './cleanTableHtml';
import TableConfigToolbar from './TableConfigToolbar';
import { GUIDE_MESSAGES, RE_NUMERIC } from './utils/constants';

import ErrorBoundary from './modal/ErrorBoundary';
import useToast from './hooks/useToast';
import { TableConfigProvider, useTableConfig, useTableConfigDispatch } from './TableConfigContext';
import JoditCustomEditor from './JoditCustomEditor';

import PreviewModal from './modal/PreviewModal';
import GuideModal from './modal/GuideModal';
import TableEditModal from './modal/TableEditModal';
import GlobalTableConfigModal from './modal/GlobalTableConfigModal';
import ContentConfigModal from './modal/ContentConfigModal';
import PresetsModal from './modal/PresetsModal';
import TemplateModal from './modal/TemplateModal';

import useModals from './hooks/useModals';
import useEditorActions from './hooks/useEditorActions';
import useAutoSave from './hooks/useAutoSave';
import usePresets from './hooks/usePresets';
import GlobalLoader from '../loading/GlobalLoader';
import { wrapWithTheme, unwrapThemeDiv } from './utils/themeWrapper';
import { fillSeqInTable, sortTableByCol, getColHeaders } from './utils/tableEditUtils';
import { getDOMParser } from './utils/htmlCleaners';
import { extractHeadingCandidates } from './utils/headingExtractor';

// 문서 아웃라인 목차가 인식하는 요소 (querySelectorAll 순서 = 문서 순서)
const TOC_SELECTOR = 'h2, h3, h4, h5, table, ul, ol';
const HEADING_INDENT = { h2: 0, h3: 1, h4: 2, h5: 3 };

export default function TableEditorWrapper() {
    return (
        <TableConfigProvider>
            <TableEditor />
        </TableConfigProvider>
    );
}

function TableEditor({ initialHtml = '' }) {
    const config = useTableConfig();
    const { updateConfig, updateMultipleConfig } = useTableConfigDispatch();
    const [content, setContent] = useState(initialHtml);
    const [colWidths, setColWidths] = useState(['']);
    const [selectedTableNode, setSelectedTableNode] = useState(null);
    const selectedTableNodeRef = useRef(null);
    const editorComponentRef = useRef(null);
    const editBoxRef = useRef(null);
    const [tableBtnPos, setTableBtnPos] = useState(null);

    // 자동 저장 복구 배너 상태
    const [autoSaveData, setAutoSaveData] = useState(null);

    // 붙여넣기 자동 정리 중 로딩 상태
    const [isCleaning, setIsCleaning] = useState(false);

    // 문서 목차 패널 표시 여부
    const [showToc, setShowToc] = useState(true);
    // A: 현재 활성 항목 domIndex (클릭/스크롤 추적)
    const [activeItemIndex, setActiveItemIndex] = useState(null);
    // B: 인라인 라벨 편집 (표만 지원)
    const [editingTocIndex, setEditingTocIndex] = useState(null);
    const [editingTocLabel, setEditingTocLabel] = useState('');
    // 목차 타입 필터 (제목 / 표 / 목록)
    const [tocFilter, setTocFilter] = useState({ heading: true, table: true, list: true });
    // 제목 후보 (자동 감지 결과)
    const [headingCandidates, setHeadingCandidates] = useState([]);
    // 변환 이력 (되돌리기용) — 각 항목: { items: [{convId, originalTag, originalInner, originalClass}] }
    const [conversionHistory, setConversionHistory] = useState([]);

    // 정렬 패널 상태 (선택된 표 위 오버레이에서 사용)
    const [showSortPanel, setShowSortPanel] = useState(false);
    const [sortState, setSortState] = useState({ colIndex: -1, direction: 'asc' });

    const { toast, triggerToast } = useToast();
    const {
        modals, getFadeStyle, toggleModal, isGuideMode, setIsGuideMode,
        tableEditModal, openTableEditModal, closeTableEditModal
    } = useModals();

    const { presets, savePreset, deletePreset } = usePresets();

    const formattedWidthString = useMemo(() =>
        colWidths.map(w => RE_NUMERIC.test(w.trim()) ? w.trim() + '%' : w).join(','),
    [colWidths]);

    const colorOverrideStyle = useMemo(() => {
        const s = {};
        if (config.primaryColor)   s['--color-primary']   = config.primaryColor;
        if (config.secondaryColor) s['--color-secondary'] = config.secondaryColor;
        if (config.tertiaryColor)  s['--color-tertiary']  = config.tertiaryColor;
        if (config.accentColor)    s['--color-accent']    = config.accentColor;
        return s;
    }, [config.primaryColor, config.secondaryColor, config.tertiaryColor, config.accentColor]);

    const hasCustomColors = Object.keys(colorOverrideStyle).length > 0;

    const editorClasses = useMemo(() => ({
        tit1: config.tit1Class,
        tit2: config.tit2Class,
        tit3: config.tit3Class,
        tit4: config.tit4Class,
    }), [config.tit1Class, config.tit2Class, config.tit3Class, config.tit4Class]);

    const configRef = useRef(config);
    useEffect(() => { configRef.current = config; }, [config]);

    const { handleClear, handleManualClean, handleCopy, handleExternalTableEdit, handleInsertTemplate } = useEditorActions({
        editorRef: editorComponentRef,
        config,
        formattedWidthString,
        setContent,
        triggerToast,
        openTableEditModal,
    });

    const handleManualCleanRef = useRef(handleManualClean);
    useEffect(() => { handleManualCleanRef.current = handleManualClean; }, [handleManualClean]);

    const handleCopyRef = useRef(handleCopy);
    useEffect(() => { handleCopyRef.current = handleCopy; }, [handleCopy]);

    // ===== [제목 후보 감지] ========================================================
    const runHeadingDetect = useCallback((htmlOverride) => {
        const html = htmlOverride ?? (editorComponentRef.current?.getInstance()?.value || '');
        if (!html) return;
        const { markedHtml, candidates } = extractHeadingCandidates(html);
        if (!candidates.length) { setHeadingCandidates([]); return; }
        const instance = editorComponentRef.current?.getInstance();
        if (instance) {
            instance.value = markedHtml;
            if (editorComponentRef.current.setFullContent) editorComponentRef.current.setFullContent(markedHtml);
        }
        setContent(markedHtml);
        setHeadingCandidates(candidates);
        setShowToc(true);
        triggerToast(`제목 후보 ${candidates.length}개를 감지했습니다.`);
    }, [triggerToast]);

    const runHeadingDetectRef = useRef(runHeadingDetect);
    useEffect(() => { runHeadingDetectRef.current = runHeadingDetect; }, [runHeadingDetect]);

    // 정리 + 감지를 묶은 래퍼 (툴바·단축키에서 사용)
    const handleManualCleanAndDetect = useCallback(async (...args) => {
        await handleManualClean(...args);
        setTimeout(() => runHeadingDetectRef.current(), 150);
    }, [handleManualClean]);

    // ===== [자동 저장] ==========================================================
    const getEditorContent = useCallback(() =>
        editorComponentRef.current?.getInstance()?.value || '',
    []);

    const { restore, clearSaved } = useAutoSave(getEditorContent);

    useEffect(() => {
        if (sessionStorage.getItem('autosave-restore-skip')) return;
        const saved = restore();
        if (saved?.html && saved.html.trim()) setAutoSaveData(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAutoSaveRestore = useCallback(() => {
        if (!autoSaveData?.html) return;
        setContent(autoSaveData.html);
        const instance = editorComponentRef.current?.getInstance();
        if (instance) instance.value = autoSaveData.html;
        clearSaved();
        setAutoSaveData(null);
        sessionStorage.setItem('autosave-restore-skip', '1');
        triggerToast('이전 작업을 복구했습니다.');
    }, [autoSaveData, clearSaved, triggerToast]);

    const handleAutoSaveDismiss = useCallback(() => {
        clearSaved();
        setAutoSaveData(null);
        sessionStorage.setItem('autosave-restore-skip', '1');
    }, [clearSaved]);

    // ===== [단축키] =============================================================
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!e.ctrlKey || !e.shiftKey) return;
            switch (e.key.toLowerCase()) {
                case 'c': e.preventDefault(); handleCopyRef.current(); break;
                case 'k': e.preventDefault(); handleManualCleanRef.current()?.then?.(() => setTimeout(() => runHeadingDetectRef.current(), 150)); break;
                case 'p': e.preventDefault(); toggleModal('preview', true); break;
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toggleModal]);

    // ===== [붙여넣기 자동 정리] ==================================================
    // handleManualCleanRef를 통해 항상 최신 config를 참조 (JoditCustomEditor memo로 인한 stale closure 방지)
    const handleAutoPaste = useCallback(async () => {
        setIsCleaning(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            await handleManualCleanRef.current({ clearFirst: true });
            setTimeout(() => runHeadingDetectRef.current(), 150);
        } finally {
            setIsCleaning(false);
        }
    }, []);

    // ===== [통계] ================================================================
    const [stats, setStats] = useState({ chars: 0, tables: 0, images: 0 });

    useEffect(() => {
        if (!content) { setStats({ chars: 0, tables: 0, images: 0 }); return; }
        try {
            const doc = getDOMParser().parseFromString(content, 'text/html');
            const chars = (doc.body.textContent || '').replace(/\s/g, '').length;
            const tables = doc.querySelectorAll('table').length;
            const images = doc.querySelectorAll('img').length;
            setStats({ chars, tables, images });
        } catch { setStats({ chars: 0, tables: 0, images: 0 }); }
    }, [content]);

    const handleStatsChange = useCallback((newStats) => {
        setStats(newStats);
    }, []);

    // ===== [문서 아웃라인 목차] ====================================================
    // h2~h5, table, ul/ol을 DOM 순서대로 수집 (중첩 표·목록 제외)
    const tocItems = useMemo(() => {
        if (!content) return [];
        try {
            const doc = getDOMParser().parseFromString(content, 'text/html');
            const allEls = Array.from(doc.querySelectorAll(TOC_SELECTOR));
            let tableSeq = 0, listSeq = 0;
            const items = [];
            allEls.forEach((el, domIndex) => {
                const tag = el.tagName.toLowerCase();
                if (tag === 'table' && el.parentElement?.closest('table')) return;
                if ((tag === 'ul' || tag === 'ol') && el.parentElement?.closest('ul, ol')) return;

                let type, fullLabel, indent;
                if (tag.startsWith('h')) {
                    type = 'heading';
                    fullLabel = el.textContent?.trim() || '제목';
                    indent = HEADING_INDENT[tag] ?? 0;
                } else if (tag === 'table') {
                    type = 'table';
                    tableSeq++;
                    const cap = el.querySelector('caption')?.textContent?.trim();
                    const th  = el.querySelector('th')?.textContent?.trim();
                    const td  = el.querySelector('td')?.textContent?.trim();
                    fullLabel = cap || th || td || `표 ${tableSeq}`;
                    indent = 0;
                } else {
                    type = 'list';
                    listSeq++;
                    const li = el.querySelector('li')?.textContent?.trim();
                    fullLabel = li || `목록 ${listSeq}`;
                    indent = 0;
                }
                const label = fullLabel.length > 18 ? fullLabel.slice(0, 18) + '…' : fullLabel;
                items.push({ domIndex, tag, type, label, fullLabel, indent });
            });
            return items;
        } catch { return []; }
    }, [content]);

    // 타입 필터 적용
    const filteredTocItems = useMemo(() =>
        tocItems.filter(({ type }) => tocFilter[type]),
    [tocItems, tocFilter]);

    // A: 클릭으로 active가 설정된 경우 스크롤 추적이 덮어쓰지 않도록 잠금
    const clickLockedRef = useRef(false);

    // A: 항목 클릭 시 스크롤 + 활성 인덱스 설정
    const scrollToItem = useCallback((domIndex) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const elements = instance.editor.querySelectorAll(TOC_SELECTOR);
        if (elements[domIndex]) {
            clickLockedRef.current = true;
            setActiveItemIndex(domIndex);
            elements[domIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // A: 에디터 스크롤에 따라 뷰포트 상단을 지나간 마지막 항목을 활성으로 감지
    useEffect(() => {
        if (!showToc || tocItems.length < 2) return;
        const instance = editorComponentRef.current?.getInstance();
        const editorEl = instance?.editor;
        if (!editorEl) return;

        const handleScroll = () => {
            if (clickLockedRef.current) return;
            const elements = editorEl.querySelectorAll(TOC_SELECTOR);
            if (!elements.length) return;
            const viewTop = editorEl.getBoundingClientRect().top;
            let activeIdx = 0;
            elements.forEach((el, i) => {
                if (el.getBoundingClientRect().top <= viewTop + 16) activeIdx = i;
            });
            setActiveItemIndex(activeIdx);
        };

        editorEl.addEventListener('scroll', handleScroll, { passive: true });
        return () => editorEl.removeEventListener('scroll', handleScroll);
    }, [showToc, tocItems.length]);

    // 에디터 DOM 변경 후 instance·state 동기화 공통 헬퍼
    const syncEditorHtml = useCallback(() => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const html = instance.editor.innerHTML;
        instance.value = html;
        instance.events.fire('change');
        editorComponentRef.current?.setFullContent?.(html);
        setContent(html);
    }, []);

    // B: 표 라벨 더블클릭 인라인 편집 (표 타입만 지원)
    const handleTocDoubleClick = useCallback((domIndex, fullLabel) => {
        setEditingTocIndex(domIndex);
        setEditingTocLabel(fullLabel);
    }, []);

    const handleTocLabelSave = useCallback((domIndex) => {
        const newLabel = editingTocLabel.trim();
        setEditingTocIndex(null);
        if (!newLabel) return;
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const el = instance.editor.querySelectorAll(TOC_SELECTOR)[domIndex];
        if (!el || el.tagName.toLowerCase() !== 'table') return;
        let caption = el.querySelector('caption');
        if (!caption) {
            caption = document.createElement('caption');
            el.insertBefore(caption, el.firstChild);
        }
        caption.textContent = newLabel;
        syncEditorHtml();
        triggerToast('목차 라벨이 수정되었습니다.');
    }, [editingTocLabel, syncEditorHtml, triggerToast]);

    const handleTocLabelKeyDown = useCallback((e, domIndex) => {
        if (e.key === 'Enter') { e.preventDefault(); handleTocLabelSave(domIndex); }
        if (e.key === 'Escape') setEditingTocIndex(null);
    }, [handleTocLabelSave]);

    // ===== [제목 후보 조작] ========================================================
    const headingCandidatesRef = useRef(headingCandidates);
    useEffect(() => { headingCandidatesRef.current = headingCandidates; }, [headingCandidates]);

    // 후보 항목 클릭 → 에디터에서 하이라이트 + 스크롤
    const scrollToCandidate = useCallback((id) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.outline = '2px solid #f59e0b';
        el.style.outlineOffset = '2px';
        setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 1500);
    }, []);

    // 개별 변환
    const handleCandidateConvert = useCallback((id, level) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
        if (!el) return;
        const levelClassMap = { h2: config.tit1Class, h3: config.tit2Class, h4: config.tit3Class, h5: config.tit4Class };
        // 되돌리기를 위해 원본 정보 보존 (후보 데이터 포함)
        const candidateData = headingCandidatesRef.current.find(c => c.id === id);
        const snapshot = { convId: id, originalTag: el.tagName.toLowerCase(), originalInner: el.innerHTML, originalClass: el.className || '', candidateData };
        const heading = document.createElement(level);
        if (levelClassMap[level]) heading.className = levelClassMap[level];
        heading.innerHTML = el.innerHTML;
        heading.setAttribute('data-hconv-id', id);
        el.replaceWith(heading);
        syncEditorHtml();
        setHeadingCandidates(prev => prev.filter(c => c.id !== id));
        setConversionHistory(prev => [...prev, { items: [snapshot] }]);
        triggerToast('제목으로 변환했습니다.');
    }, [config.tit1Class, config.tit2Class, config.tit3Class, config.tit4Class, syncEditorHtml, triggerToast]);

    // 개별 무시 (마커만 제거)
    const handleCandidateDismiss = useCallback((id) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
        if (el) el.removeAttribute('data-hcand-id');
        syncEditorHtml();
        setHeadingCandidates(prev => prev.filter(c => c.id !== id));
    }, [syncEditorHtml]);

    // 전체 변환
    const handleCandidateConvertAll = useCallback(() => {
        const candidates = headingCandidatesRef.current;
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !candidates.length) return;
        const levelClassMap = { h2: config.tit1Class, h3: config.tit2Class, h4: config.tit3Class, h5: config.tit4Class };
        const snapshots = [];
        candidates.forEach((cand) => {
            const { id, suggestedLevel } = cand;
            const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
            if (!el) return;
            snapshots.push({ convId: id, originalTag: el.tagName.toLowerCase(), originalInner: el.innerHTML, originalClass: el.className || '', candidateData: cand });
            const heading = document.createElement(suggestedLevel);
            if (levelClassMap[suggestedLevel]) heading.className = levelClassMap[suggestedLevel];
            heading.innerHTML = el.innerHTML;
            heading.setAttribute('data-hconv-id', id);
            el.replaceWith(heading);
        });
        syncEditorHtml();
        if (snapshots.length) setConversionHistory(prev => [...prev, { items: snapshots }]);
        triggerToast(`${candidates.length}개를 제목으로 변환했습니다.`);
        setHeadingCandidates([]);
    }, [config.tit1Class, config.tit2Class, config.tit3Class, config.tit4Class, syncEditorHtml, triggerToast]);

    // 전체 무시
    const handleCandidateDismissAll = useCallback(() => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        instance.editor.querySelectorAll('[data-hcand-id]').forEach(el => el.removeAttribute('data-hcand-id'));
        syncEditorHtml();
        setHeadingCandidates([]);
    }, [syncEditorHtml]);

    // 레벨 순환 변경 (H2 → H3 → H4 → H5 → H2)
    const handleCandidateLevelChange = useCallback((id) => {
        const CYCLE = ['h2', 'h3', 'h4', 'h5'];
        setHeadingCandidates(prev => prev.map(c => {
            if (c.id !== id) return c;
            const next = (CYCLE.indexOf(c.suggestedLevel) + 1) % CYCLE.length;
            return { ...c, suggestedLevel: CYCLE[next] };
        }));
    }, []);

    // 마지막 변환 되돌리기
    const conversionHistoryRef = useRef(conversionHistory);
    useEffect(() => { conversionHistoryRef.current = conversionHistory; }, [conversionHistory]);

    const handleConversionUndo = useCallback(() => {
        const history = conversionHistoryRef.current;
        const last = history[history.length - 1];
        if (!last) return;
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const restoredCandidates = [];
        last.items.forEach(({ convId, originalTag, originalInner, originalClass, candidateData }) => {
            const el = instance.editor.querySelector(`[data-hconv-id="${convId}"]`);
            if (!el) return;
            const restored = document.createElement(originalTag);
            if (originalClass) restored.className = originalClass;
            restored.innerHTML = originalInner;
            if (candidateData) {
                restored.setAttribute('data-hcand-id', convId);
                restoredCandidates.push(candidateData);
            }
            el.replaceWith(restored);
        });
        syncEditorHtml();
        setConversionHistory(prev => prev.slice(0, -1));
        if (restoredCandidates.length) setHeadingCandidates(prev => [...restoredCandidates, ...prev]);
        triggerToast('변환을 되돌렸습니다.');
    }, [syncEditorHtml, triggerToast]);

    // ===== [설정 프리셋 적용] ====================================================
    const handlePresetApply = useCallback((presetConfig) => {
        const { colWidths: savedColWidths, ...configOnly } = presetConfig;
        updateMultipleConfig(configOnly);
        if (savedColWidths) setColWidths(savedColWidths);
        triggerToast('프리셋이 적용되었습니다.');
    }, [updateMultipleConfig, setColWidths, triggerToast]);

    // ===== [이미지 박스 치환] =====================================================
    const handleReplaceWithImageBox = useCallback(() => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !selectedTableNode) return;

        const newNode = document.createElement('div');
        newNode.className = 'box-st rsp_img ac';
        newNode.innerHTML = '\n    <img src="https://placehold.co/200x200" alt="">\n';

        const wrapperDiv = selectedTableNode.closest('div.tbl-st, div.box-st');
        (wrapperDiv || selectedTableNode).replaceWith(newNode);
        const newHtml = instance.editor.innerHTML;
        instance.value = newHtml;
        instance.events.fire('change');
        if (editorComponentRef.current.setFullContent) editorComponentRef.current.setFullContent(newHtml);
        setContent(newHtml);
        setSelectedTableNode(null);
        setTableBtnPos(null);
        triggerToast('이미지 박스로 치환되었습니다.');
    }, [selectedTableNode, triggerToast]);

    // ===== [순번 채우기] =========================================================
    const handleFillSeq = useCallback(() => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !selectedTableNode) return;
        fillSeqInTable(selectedTableNode, 0);
        const newHtml = instance.editor.innerHTML;
        instance.value = newHtml;
        instance.events.fire('change');
        if (editorComponentRef.current.setFullContent) editorComponentRef.current.setFullContent(newHtml);
        setContent(newHtml);
        triggerToast('순번이 채워졌습니다.');
    }, [selectedTableNode, triggerToast]);

    // ===== [행 정렬] =============================================================
    const colHeaders = useMemo(() => {
        if (!selectedTableNode) return [];
        return getColHeaders(selectedTableNode);
    }, [selectedTableNode]);

    const handleSort = useCallback((colIndex) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !selectedTableNode) return;

        const newDir = sortState.colIndex === colIndex && sortState.direction === 'asc' ? 'desc' : 'asc';
        setSortState({ colIndex, direction: newDir });

        sortTableByCol(selectedTableNode, colIndex, newDir);
        const newHtml = instance.editor.innerHTML;
        instance.value = newHtml;
        instance.events.fire('change');
        if (editorComponentRef.current.setFullContent) editorComponentRef.current.setFullContent(newHtml);
        setContent(newHtml);
        triggerToast(`${colHeaders[colIndex]?.label || (colIndex + 1) + '열'} 기준 ${newDir === 'asc' ? '오름차순' : '내림차순'} 정렬`);
        setShowSortPanel(false);
    }, [selectedTableNode, sortState, colHeaders, triggerToast]);

    // 표 선택 해제 시 정렬 패널도 닫기
    useEffect(() => {
        if (!selectedTableNode) setShowSortPanel(false);
    }, [selectedTableNode]);

    // ===== [템플릿 삽입] =========================================================
    const handleTemplateInsert = useCallback(async (templateHtml) => {
        toggleModal('template', false);
        setIsCleaning(true);
        try {
            await handleInsertTemplate(templateHtml);
        } finally {
            setIsCleaning(false);
        }
    }, [handleInsertTemplate, toggleModal]);

    // ===== [JSP 등록 연동] =====================================================
    useEffect(() => {
        window.getTableEditorHTML = () => {
            const val = editorComponentRef.current?.getInstance()?.value;
            if (!val) return '';
            const doc = getDOMParser().parseFromString(unwrapThemeDiv(val), 'text/html');
            ['data-local-config','data-local-colwidths','data-temp-id','data-origin-html','data-hcand-id','data-hconv-id'].forEach(attr => {
                doc.querySelectorAll(`[${attr}]`).forEach(el => el.removeAttribute(attr));
            });
            doc.querySelectorAll('td, th').forEach(cell => {
                if (cell.textContent.replace(/[\s ​-‍﻿]/g, '') === '' &&
                    cell.querySelectorAll('img, iframe, table').length === 0) {
                    cell.innerHTML = '';
                }
            });
            let html = doc.body.innerHTML;
            html = html.replace(/<\/table>\s*<br\s*\/?>/gi, '</table>');
            return wrapWithTheme(html, configRef.current);
        };
        window.setTableEditorHTML = (html) => {
            if (!html) return;
            setContent(html);
            const instance = editorComponentRef.current?.getInstance();
            if (instance) instance.value = html;
        };
        return () => {
            delete window.getTableEditorHTML;
            delete window.setTableEditorHTML;
        };
    }, []);

    useEffect(() => {
        if (isGuideMode) {
            const blockClick = (e) => {
                if (e.target.closest('[data-guide-toggle]')) return;
                e.preventDefault();
                e.stopPropagation();
            };
            document.addEventListener('click', blockClick, true);
            return () => document.removeEventListener('click', blockClick, true);
        }
    }, [isGuideMode]);

    useEffect(() => {
        selectedTableNodeRef.current = selectedTableNode;
    }, [selectedTableNode]);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!selectedTableNodeRef.current) return;
            const editorInstance = editorComponentRef.current?.getInstance();
            if (!editorInstance) return;
            const isInsideEditor = editorInstance.container && editorInstance.container.contains(e.target);
            const isInsideBtn = e.target.closest(`.${layout.tableBtn}`);
            if (!isInsideEditor && !isInsideBtn) {
                setSelectedTableNode(null);
                setTableBtnPos(null);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    const updateBtnPos = useCallback(() => {
        const tableEl = selectedTableNodeRef.current;
        if (!tableEl || !editBoxRef.current) { setTableBtnPos(null); return; }
        const tableRect = tableEl.getBoundingClientRect();
        const boxRect = editBoxRef.current.getBoundingClientRect();
        setTableBtnPos({
            top: Math.round(tableRect.top - boxRect.top) - 40,
            left: Math.round(tableRect.right - boxRect.left),
        });
    }, []);

    useEffect(() => { updateBtnPos(); }, [selectedTableNode, updateBtnPos]);

    useEffect(() => {
        if (!selectedTableNode) { setTableBtnPos(null); return; }
        let rafId = null;
        const throttled = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => { rafId = null; updateBtnPos(); });
        };
        window.addEventListener('scroll', throttled, true);
        window.addEventListener('resize', throttled);
        return () => {
            window.removeEventListener('scroll', throttled, true);
            window.removeEventListener('resize', throttled);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [selectedTableNode, updateBtnPos]);

    useEffect(() => {
        if (!editorComponentRef.current) return;
        const instance = editorComponentRef.current.getInstance();
        if (!instance) return;
        if (instance.getMode() === 2) return;
        const isEditorFocused = instance.editor && (instance.editor.contains(document.activeElement) || document.activeElement === instance.editor);
        let markers = null;
        if (isEditorFocused) {
            try { markers = instance.s.save(); } catch (e) {}
        }
        const currentContent = instance.value;
        if (!currentContent) {
            if (isEditorFocused && markers) {
                try { instance.s.restore(markers); } catch(e) {}
            }
            return;
        }
        const rawContent = unwrapThemeDiv(currentContent);
        const updatedRaw = updateStylesOnly(rawContent, config, formattedWidthString);
        const updatedHtml = wrapWithTheme(updatedRaw, config);
        if (updatedHtml !== currentContent) {
            instance.value = updatedHtml;
            if (isEditorFocused && markers) {
                try { instance.s.restore(markers); } catch (e) {}
            }
            instance.events.fire('synchro');
            if (editorComponentRef.current.setFullContent) {
                editorComponentRef.current.setFullContent(updatedHtml);
            }
            setContent(updatedHtml);
        } else {
            if (isEditorFocused && markers) {
                try { instance.s.restore(markers); } catch (e) {}
            }
        }
    }, [config, formattedWidthString]);


    const handleTableEditApply = useCallback((localConfig, localColWidths) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !tableEditModal.tempId) return;

        const targetNode = instance.editor.querySelector(`[data-temp-id="${tableEditModal.tempId}"]`);

        if (targetNode) {
            const formattedWidth = localColWidths.map(w => RE_NUMERIC.test(w.trim()) ? w.trim() + '%' : w).join(',');
            const tempParserDiv = document.createElement('div');
            tempParserDiv.innerHTML = tableEditModal.html;
            tempParserDiv.querySelectorAll('[data-local-config]').forEach(el => el.removeAttribute('data-local-config'));
            tempParserDiv.querySelectorAll('[data-local-colwidths]').forEach(el => el.removeAttribute('data-local-colwidths'));
            const cleanedHtml = cleanTableHtml(
                tempParserDiv.innerHTML,
                localConfig,
                formattedWidth
            );

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleanedHtml;
            const newTargetNode = tempDiv.firstElementChild;

            if (newTargetNode) {
                newTargetNode.setAttribute('data-local-config', JSON.stringify(localConfig));
                newTargetNode.setAttribute('data-local-colwidths', JSON.stringify(localColWidths));
                newTargetNode.setAttribute('data-temp-id', tableEditModal.tempId);
                targetNode.replaceWith(newTargetNode);
                const newEditorHtml = instance.editor.innerHTML;
                instance.value = newEditorHtml;
                instance.events.fire('change');

                if (editorComponentRef.current.setFullContent) {
                    editorComponentRef.current.setFullContent(newEditorHtml);
                }
                setContent(newEditorHtml);
                setSelectedTableNode(newTargetNode);
                triggerToast('선택한 표의 설정이 개별 변경되었습니다.');
            }
        }
        closeTableEditModal();
    }, [tableEditModal, triggerToast, closeTableEditModal]);

    const handlePreviewOpen = useCallback(() => {
        toggleModal('preview', true);
    }, [toggleModal]);

    const handleGlobalTableConfigApply = useCallback((newConfig, newColWidths) => {
        updateMultipleConfig(newConfig);
        setColWidths(newColWidths);
        toggleModal('globalTableConfig', false);
        triggerToast('테이블 기본 설정이 변경되었습니다.');
    }, [updateMultipleConfig, setColWidths, toggleModal, triggerToast]);

    const handleContentConfigApply = useCallback((newConfig) => {
        updateMultipleConfig(newConfig);
        toggleModal('contentConfig', false);
        triggerToast('컨텐츠 기본 설정이 변경되었습니다.');
    }, [updateMultipleConfig, toggleModal, triggerToast]);

    const showTocPanel = showToc && (tocItems.length >= 1 || headingCandidates.length > 0 || conversionHistory.length > 0);

    return (
        <div className={layout.tableWrap} suppressHydrationWarning>
            <div className={layout.contBox}>
                <TableConfigToolbar
                    isGuideMode={isGuideMode}
                    setIsGuideMode={setIsGuideMode}
                    toggleModal={toggleModal}
                    modals={modals}
                    handleCopy={handleCopy}
                    handleClear={handleClear}
                    handleManualClean={handleManualCleanAndDetect}
                    onTemplateOpen={() => toggleModal('template', true)}
                    theme={config.theme}
                    onThemeChange={(t) => updateMultipleConfig({ theme: t, primaryColor: '', secondaryColor: '', tertiaryColor: '', accentColor: '' })}
                    primaryColor={config.primaryColor}
                    secondaryColor={config.secondaryColor}
                    tertiaryColor={config.tertiaryColor}
                    accentColor={config.accentColor}
                    onColorChange={(key, val) => updateConfig(key, val)}
                    stats={stats}
                />

                {/* 자동 저장 복구 배너 */}
                {autoSaveData && (
                    <div className={layout.autoSaveBanner}>
                        <span><strong>자동 저장된 내용이 있습니다.</strong> 복구하시겠습니까?</span>
                        <div className={layout.autoSaveBannerBtns}>
                            <button type="button" className={layout.autoSaveRestore} onClick={handleAutoSaveRestore}>복구하기</button>
                            <button type="button" className={layout.autoSaveDismiss} onClick={handleAutoSaveDismiss}>삭제</button>
                        </div>
                    </div>
                )}

                <div className={layout.editorArea}>
                    <div ref={editBoxRef} data-theme={hasCustomColors ? undefined : config.theme} style={colorOverrideStyle} className={`${layout.editBox} ${isGuideMode ? `${layout.guideTarget} ${layout.guideCenter}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.editorConfig : undefined} >
                        {tableBtnPos && (
                            <div className={layout.tableBtn} style={{ top: tableBtnPos.top, left: tableBtnPos.left }}>
                                <div className={layout.tableBtnGroup}>
                                    {/* 기존: 개별 표 설정 */}
                                    <button type="button" onClick={handleExternalTableEdit} className={`${layout.Btn} ${isGuideMode ? `${layout.guideTarget} ${layout.guideLeft}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.tableBtn : undefined} title="개별 표 설정">
                                        <i className="ri-settings-4-line"></i>
                                    </button>
                                    {/* 순번 채우기 */}
                                    <button type="button" onClick={handleFillSeq} className={layout.Btn} title="첫 번째 열에 순번(1,2,3…) 자동 입력">
                                        <i className="ri-list-ordered"></i>
                                    </button>
                                    {/* 이미지 박스 치환 */}
                                    <button type="button" onClick={handleReplaceWithImageBox} className={layout.Btn} title="표를 이미지 박스로 치환">
                                        <i className="ri-image-line"></i>
                                    </button>
                                    {/* 행 정렬 */}
                                    <div className={layout.sortBtnWrap}>
                                        <button
                                            type="button"
                                            className={`${layout.Btn}${showSortPanel ? ` ${layout.BtnActive}` : ''}`}
                                            title="열 기준 행 정렬"
                                            onClick={() => setShowSortPanel(p => !p)}
                                        >
                                            <i className="ri-sort-asc"></i>
                                        </button>
                                        {showSortPanel && colHeaders.length > 0 && (
                                            <div className={layout.sortPanel}>
                                                <span>정렬 기준 열 선택</span>
                                                <div className={layout.sortColBtns}>
                                                    {colHeaders.map(col => (
                                                        <button
                                                            key={col.index}
                                                            type="button"
                                                            className={layout.sortColBtn}
                                                            onClick={() => handleSort(col.index)}
                                                            title={`${col.label} 기준 정렬`}
                                                        >
                                                            {col.label}
                                                            {sortState.colIndex === col.index && (
                                                                <i className={`ri-arrow-${sortState.direction === 'asc' ? 'up' : 'down'}-line ${layout.sortArrow}`} />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <ErrorBoundary key="editor-boundary">
                            <JoditCustomEditor
                                ref={editorComponentRef}
                                initialData={initialHtml}
                                onChange={setContent}
                                onPreview={handlePreviewOpen}
                                onTableSelect={setSelectedTableNode}
                                editorClasses={editorClasses}
                                triggerToast={triggerToast}
                                onAutoPaste={handleAutoPaste}
                                onStatsChange={handleStatsChange}
                            />
                        </ErrorBoundary>
                    </div>

                    {/* 문서 아웃라인 목차 패널 */}
                    {showTocPanel ? (
                        <div className={layout.tocPanel}>
                            <div className={layout.tocHeader}>
                                <span>문서 목차 ({tocItems.length})</span>
                                <div className={layout.tocFilters}>
                                    <button type="button" title="제목 항목" className={tocFilter.heading ? layout.tocFilterOn : layout.tocFilterOff} onClick={() => setTocFilter(p => ({ ...p, heading: !p.heading }))}>
                                        <i className="ri-heading" />
                                    </button>
                                    <button type="button" title="표 항목" className={tocFilter.table ? layout.tocFilterOn : layout.tocFilterOff} onClick={() => setTocFilter(p => ({ ...p, table: !p.table }))}>
                                        <i className="ri-table-2" />
                                    </button>
                                    <button type="button" title="목록 항목" className={tocFilter.list ? layout.tocFilterOn : layout.tocFilterOff} onClick={() => setTocFilter(p => ({ ...p, list: !p.list }))}>
                                        <i className="ri-list-unordered" />
                                    </button>
                                </div>
                                <button type="button" onClick={() => setShowToc(false)} title="패널 닫기">
                                    <i className="ri-close-line" />
                                </button>
                            </div>

                            {/* 제목 후보 + 되돌리기 섹션 */}
                            {(headingCandidates.length > 0 || conversionHistory.length > 0) && (
                                <div className={layout.tocCandSection}>
                                    {conversionHistory.length > 0 && (
                                        <div className={layout.tocCandUndo}>
                                            <button type="button" onClick={handleConversionUndo} title={`마지막 변환 되돌리기 (${conversionHistory.length}단계 가능)`}>
                                                <i className="ri-arrow-go-back-line" />
                                                <span>되돌리기 ({conversionHistory.length})</span>
                                            </button>
                                        </div>
                                    )}
                                    {headingCandidates.length > 0 && (<>
                                    <div className={layout.tocCandHeader}>
                                        <span>후보 {headingCandidates.length}개</span>
                                        <div className={layout.tocCandHeaderBtns}>
                                            <button type="button" onClick={handleCandidateConvertAll} title="전체 변환">전체 변환</button>
                                            <button type="button" onClick={handleCandidateDismissAll} title="취소">취소</button>
                                        </div>
                                    </div>
                                    {headingCandidates.map(({ id, text, fullText, suggestedLevel, confidence, pattern }) => (
                                        <div key={id} className={`${layout.tocCandItem}${confidence === 'medium' ? ` ${layout.tocCandMedium}` : ''}`}>
                                            <button
                                                type="button"
                                                className={layout.tocCandText}
                                                onClick={() => scrollToCandidate(id)}
                                                title={confidence === 'medium' ? `${fullText}\n[${pattern} 패턴 — 직접 확인 권장]` : fullText}
                                            >
                                                {text}
                                            </button>
                                            <div className={layout.tocCandActions}>
                                                <button type="button" className={layout.tocCandLevel} onClick={() => handleCandidateLevelChange(id)} title="클릭으로 레벨 변경">
                                                    {suggestedLevel.toUpperCase()}{confidence === 'medium' ? '?' : ''}
                                                </button>
                                                <button type="button" className={layout.tocCandConvert} onClick={() => handleCandidateConvert(id, suggestedLevel)} title="제목으로 변환">
                                                    <i className="ri-arrow-right-line" />
                                                </button>
                                                <button type="button" className={layout.tocCandDismiss} onClick={() => handleCandidateDismiss(id)} title="무시">
                                                    <i className="ri-close-line" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    </>)}
                                </div>
                            )}

                            <div className={layout.tocList}>
                                {filteredTocItems.map(({ domIndex, tag, type, label, fullLabel, indent }) => (
                                    editingTocIndex === domIndex ? (
                                        <div key={domIndex} className={`${layout.tocItem} ${layout.tocItemEditing}`}>
                                            <span className={`${layout.tocIndex} ${layout.tocBadgeT}`}>표</span>
                                            <input
                                                className={layout.tocEditInput}
                                                autoFocus
                                                value={editingTocLabel}
                                                onChange={e => setEditingTocLabel(e.target.value)}
                                                onBlur={() => handleTocLabelSave(domIndex)}
                                                onKeyDown={e => handleTocLabelKeyDown(e, domIndex)}
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            key={domIndex}
                                            type="button"
                                            className={`${layout.tocItem}${activeItemIndex === domIndex ? ` ${layout.tocItemActive}` : ''}`}
                                            style={type === 'heading' ? { paddingLeft: `${0.75 + indent * 0.65}rem` } : undefined}
                                            onClick={() => scrollToItem(domIndex)}
                                            onDoubleClick={() => type === 'table' ? handleTocDoubleClick(domIndex, fullLabel) : undefined}
                                            title={type === 'table' ? `${fullLabel}\n(더블클릭으로 라벨 편집)` : fullLabel}
                                        >
                                            <span className={`${layout.tocIndex} ${type === 'heading' ? layout.tocBadgeH : type === 'table' ? layout.tocBadgeT : layout.tocBadgeL}`}>
                                                {type === 'heading' ? tag.toUpperCase() : type === 'table' ? '표' : '목'}
                                            </span>
                                            {label}
                                        </button>
                                    )
                                ))}
                            </div>
                        </div>
                    ) : (tocItems.length >= 1 || headingCandidates.length > 0 || conversionHistory.length > 0) && (
                        <button
                            type="button"
                            className={layout.tocToggleBtn}
                            onClick={() => setShowToc(true)}
                            title="문서 목차 열기"
                        >
                            <i className="ri-list-check" />
                            <span>목차</span>
                            {headingCandidates.length > 0 && (
                                <span className={layout.tocToggleBadge}>{headingCandidates.length}</span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {isGuideMode && <div className={layout.guideWrap}/>}
            {toast.show && <div key={toast.id} className="toast-popup">{toast.message}</div>}
            {modals.preview && <PreviewModal content={content} config={config} widthString={formattedWidthString} onClose={() => toggleModal('preview', false)} layout={layout} fadeStyle={getFadeStyle('preview')} />}
            {modals.guide && <GuideModal onClose={() => toggleModal('guide', false)} layout={layout} fadeStyle={getFadeStyle('guide')} />}

            {modals.tableEdit && (
                <TableEditModal
                    onClose={closeTableEditModal}
                    onApply={handleTableEditApply}
                    globalConfig={config}
                    layout={layout}
                    existingConfig={tableEditModal.existingConfig}
                    existingColWidths={tableEditModal.existingColWidths}
                    fadeStyle={getFadeStyle('tableEdit')}
                />
            )}

            {modals.globalTableConfig && (
                <GlobalTableConfigModal
                    onClose={() => toggleModal('globalTableConfig', false)}
                    onApply={handleGlobalTableConfigApply}
                    globalConfig={config}
                    colWidths={colWidths}
                    layout={layout}
                    isGuideMode={isGuideMode}
                    setIsGuideMode={setIsGuideMode}
                    fadeStyle={getFadeStyle('globalTableConfig')}
                />
            )}
            {modals.contentConfig && (
                <ContentConfigModal
                    onClose={() => toggleModal('contentConfig', false)}
                    onApply={handleContentConfigApply}
                    globalConfig={config}
                    layout={layout}
                    isGuideMode={isGuideMode}
                    setIsGuideMode={setIsGuideMode}
                    fadeStyle={getFadeStyle('contentConfig')}
                />
            )}
            {modals.presets && (
                <PresetsModal
                    onClose={() => toggleModal('presets', false)}
                    onApply={handlePresetApply}
                    onSave={(name) => savePreset(name, { ...config, colWidths })}
                    onDelete={deletePreset}
                    presets={presets}
                    layout={layout}
                    fadeStyle={getFadeStyle('presets')}
                />
            )}
            {modals.template && (
                <TemplateModal
                    onClose={() => toggleModal('template', false)}
                    onInsert={handleTemplateInsert}
                    layout={layout}
                    fadeStyle={getFadeStyle('template')}
                    config={config}
                />
            )}
            {isCleaning && <GlobalLoader />}
        </div>
    );
}

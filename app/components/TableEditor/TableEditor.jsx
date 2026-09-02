/*
 * [TableEditor.jsx] 에디터 핵심 오케스트레이터
 */
"use client";
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import layout from "../../layout.module.css";
import { cleanTableHtml, updateStylesOnly } from './cleanTableHtml';
import TableConfigToolbar from './TableConfigToolbar';
import TocPanel from './TocPanel';
import { GUIDE_MESSAGES, formatColWidths, TEMP_ATTRS, TEMP_ATTRS_SELECTOR, RE_WHITESPACE, PLACEHOLDER_IMAGE_SRC } from './utils/constants';

const AUTO_PASTE_KEY = 'table-editor-auto-paste';

import ErrorBoundary from './modal/ErrorBoundary';
import useToast from './hooks/useToast';
import { TableConfigProvider, useTableConfig, useTableConfigDispatch } from './TableConfigContext';
import JoditCustomEditor from './JoditCustomEditor';

import PreviewModal from './modal/PreviewModal';
import GuideModal from './modal/GuideModal';
import TableEditModal from './modal/TableEditModal';
import GlobalTableConfigModal from './modal/GlobalTableConfigModal';
import ContentConfigModal from './modal/ContentConfigModal';
import EtcConfigModal from './modal/EtcConfigModal';
import PresetsModal from './modal/PresetsModal';
// 챗봇은 초기 렌더/타이핑 경로와 무관한 독립 위젯이라 별도 청크로 분리하고 SSR 대상에서 제외한다.
const ChatBot = dynamic(() => import('./ChatBot/ChatBot'), { ssr: false });

import useModals from './hooks/useModals';
import useEditorActions from './hooks/useEditorActions';
import useAutoSave from './hooks/useAutoSave';
import usePresets from './hooks/usePresets';
import GlobalLoader from '../loading/GlobalLoader';
import { fillSeqInTable, createRafThrottle } from './utils/tableEditUtils';
import { applyColGroupHelper } from './utils/tableFormatters';
import { getDOMParser } from './utils/htmlCleaners';
import { extractHeadingCandidates } from './utils/headingExtractor';

// 문서 아웃라인 목차가 인식하는 요소 (querySelectorAll 순서 = 문서 순서)
const TOC_SELECTOR = 'h3, h4, h5, table, ul, ol';
const HEADING_INDENT = { h3: 0, h4: 1, h5: 2 };
const MAX_HISTORY = 20;

// li를 목록의 제자리에서 추출하고 newEl로 대체한다 (목록을 앞/뒤로 분리)
function replaceLiInList(li, newEl) {
    const list = li.parentElement;
    if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) {
        li.replaceWith(newEl);
        return;
    }
    const items = Array.from(list.children);
    const idx = items.indexOf(li);
    const beforeItems = items.slice(0, idx);
    const afterItems = items.slice(idx + 1);
    const replacements = [];
    if (beforeItems.length > 0) {
        const beforeList = document.createElement(list.tagName.toLowerCase());
        if (list.className) beforeList.className = list.className;
        beforeItems.forEach(item => beforeList.appendChild(item));
        replacements.push(beforeList);
    }
    replacements.push(newEl);
    if (afterItems.length > 0) {
        const afterList = document.createElement(list.tagName.toLowerCase());
        if (list.className) afterList.className = list.className;
        afterItems.forEach(item => afterList.appendChild(item));
        replacements.push(afterList);
    }
    list.replaceWith(...replacements);
}

// 후보 엘리먼트를 무시 처리: li면 p로 추출, 아니면 마커 속성만 제거
// (handleCandidateDismiss/handleCandidateDismissAll 공용)
function dismissCandidateElement(el) {
    const li = el.tagName === 'LI' ? el : el.closest('li');
    if (li) {
        const p = document.createElement('p');
        p.innerHTML = el.innerHTML;
        replaceLiInList(li, p);
    } else {
        el.removeAttribute('data-hcand-id');
    }
}

// localStorage에 저장된 자동 정리 활성 여부를 읽는다 (기본값 true)
function readAutoPasteEnabled() {
    try {
        const stored = localStorage.getItem(AUTO_PASTE_KEY);
        return stored === null ? true : stored === 'true';
    } catch { return true; }
}

// 값이 바뀔 때마다 ref.current를 최신 상태로 동기화 (stale closure 방지용 보일러플레이트 통합)
function useLatestRef(value) {
    const ref = useRef(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref;
}

export default function TableEditorWrapper({ initialHtml = '', onChange }) {
    return (
        <TableConfigProvider>
            <TableEditor initialHtml={initialHtml} onChange={onChange} />
        </TableConfigProvider>
    );
}

function TableEditor({ initialHtml = '', onChange }) {
    const config = useTableConfig();
    const { updateConfig, updateMultipleConfig } = useTableConfigDispatch();
    const [content, setContent] = useState(initialHtml);
    const [colWidths, setColWidths] = useState(['']);
    const [selectedTableNode, setSelectedTableNode] = useState(null);
    const [isEqualColWidths, setIsEqualColWidths] = useState(false);
    const selectedTableNodeRef = useLatestRef(selectedTableNode);
    const contentRef = useLatestRef(content);
    const editorComponentRef = useRef(null);
    const editBoxRef = useRef(null);
    const tableBtnRef = useRef(null);

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

    const { toast, triggerToast } = useToast();
    const {
        modals, getFadeStyle, toggleModal, isGuideMode, setIsGuideMode,
        isChatBotVisible, setIsChatBotVisible,
        tableEditModal, openTableEditModal, closeTableEditModal
    } = useModals();

    // 인라인 화살표를 그대로 넘기면 매 렌더(타이핑 등)마다 새 참조가 생겨 ChatBot(React.memo)의
    // 리렌더 방지가 무력화되므로, 참조가 고정된 콜백으로 감싼다.
    const handleHideChatBot = useCallback(() => setIsChatBotVisible(false), [setIsChatBotVisible]);

    const { presets, savePreset, deletePreset } = usePresets();

    const formattedWidthString = useMemo(() => formatColWidths(colWidths), [colWidths]);

    const editorClasses = useMemo(() => ({
        tit1: config.tit1Class,
        tit2: config.tit2Class,
        tit3: config.tit3Class,
    }), [config.tit1Class, config.tit2Class, config.tit3Class]);

    const { handleClear, handleManualClean, handleCopy, handleExternalTableEdit } = useEditorActions({
        setSelectedTableNode,
        editorRef: editorComponentRef,
        config,
        formattedWidthString,
        setContent,
        triggerToast,
        openTableEditModal,
    });

    const handleManualCleanRef = useLatestRef(handleManualClean);
    const handleCopyRef = useLatestRef(handleCopy);
    const handleClearRef = useLatestRef(handleClear);

    // ===== [제목 후보 감지] ========================================================
    const headingCacheRef = useRef({ html: '', result: null });
    const runHeadingDetect = useCallback((htmlOverride) => {
        const html = htmlOverride ?? (editorComponentRef.current?.getInstance()?.value || '');
        if (!html) return;
        let markedHtml, candidates;
        if (headingCacheRef.current.html === html && headingCacheRef.current.result) {
            ({ markedHtml, candidates } = headingCacheRef.current.result);
        } else {
            ({ markedHtml, candidates } = extractHeadingCandidates(html));
            headingCacheRef.current = { html, result: { markedHtml, candidates } };
        }
        if (!candidates.length) { setHeadingCandidates([]); return; }
        const instance = editorComponentRef.current?.getInstance();
        if (instance) {
            instance.value = markedHtml;
            if (editorComponentRef.current.setFullContent) editorComponentRef.current.setFullContent(markedHtml);
            // setFullContent가 에디터 DOM을 통째로 교체하므로, 이전에 선택돼 있던 표 노드는
            // detach된 참조가 된다(useEditorActions의 handleManualClean/handleClear와 동일한 이유).
            setSelectedTableNode(null);
        }
        setContent(markedHtml);
        setHeadingCandidates(candidates);
        setShowToc(true);
        triggerToast(`제목 후보 ${candidates.length}개를 감지했습니다.`);
    }, [triggerToast]);

    const runHeadingDetectRef = useLatestRef(runHeadingDetect);

    // 정리 + 감지를 묶은 래퍼 (툴바·단축키에서 사용)
    const handleManualCleanAndDetect = useCallback(async (...args) => {
        await handleManualClean(...args);
        requestAnimationFrame(() => runHeadingDetectRef.current());
    }, [handleManualClean]);

    // ===== [자동 저장] ==========================================================
    const getEditorContent = useCallback(() =>
        editorComponentRef.current?.getInstance()?.value || '',
    []);

    const { restore, clearSaved, wasUncleanShutdown } = useAutoSave(getEditorContent);

    useEffect(() => {
        // 지난 세션이 정상 종료(beforeunload 완료)됐다면 복구 배너를 띄우지 않는다.
        if (!wasUncleanShutdown) return;
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
                case 'z': e.preventDefault(); handleManualCleanRef.current()?.then?.(() => requestAnimationFrame(() => runHeadingDetectRef.current())); break;
                case 'x': e.preventDefault(); toggleModal('preview', true); break;
                case 'd': e.preventDefault(); handleClearRef.current(); break;
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [toggleModal]);

    // ===== [붙여넣기 자동 정리] ==================================================
    const [isAutoPasteEnabled, setIsAutoPasteEnabled] = useState(readAutoPasteEnabled);
    const toggleAutoPaste = useCallback(() => {
        setIsAutoPasteEnabled(prev => {
            const next = !prev;
            try { localStorage.setItem(AUTO_PASTE_KEY, String(next)); } catch {}
            return next;
        });
    }, []);

    // handleManualCleanRef를 통해 항상 최신 config를 참조 (JoditCustomEditor memo로 인한 stale closure 방지)
    const handleAutoPaste = useCallback(async () => {
        if (!readAutoPasteEnabled()) return;
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

    // content가 연속으로 바뀔 때 tocItems의 parseFromString이 과도하게 실행되지 않도록 300ms 디바운스
    const debounceTocTimerRef = useRef(null);
    const [debouncedContent, setDebouncedContent] = useState(content);
    useEffect(() => {
        if (debounceTocTimerRef.current) clearTimeout(debounceTocTimerRef.current);
        debounceTocTimerRef.current = setTimeout(() => setDebouncedContent(content), 300);
        return () => { if (debounceTocTimerRef.current) clearTimeout(debounceTocTimerRef.current); };
    }, [content]);

    // ===== [문서 아웃라인 목차] ====================================================
    // h2~h5, table, ul/ol을 DOM 순서대로 수집 (중첩 표·목록 제외)
    // showToc가 닫혀있으면 파싱을 스킵하고 브라우저 유휴 시간에 비동기 처리
    const [tocItems, setTocItems] = useState([]);
    const tocIdleRef = useRef(null);
    useEffect(() => {
        if (typeof cancelIdleCallback !== 'undefined' && tocIdleRef.current) {
            cancelIdleCallback(tocIdleRef.current);
        }
        if (!debouncedContent) { setTocItems([]); return; }
        if (!showToc) return; // 파싱만 스킵. tocItems를 비우면 재오픈 버튼(hasAnyItem 판단 기준)까지 사라진다.
        const parse = () => {
            try {
                const doc = getDOMParser().parseFromString(debouncedContent, 'text/html');
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
                setTocItems(items);
            } catch { setTocItems([]); }
        };
        if (typeof requestIdleCallback !== 'undefined') {
            tocIdleRef.current = requestIdleCallback(parse, { timeout: 500 });
        } else {
            parse();
        }
        return () => {
            if (typeof cancelIdleCallback !== 'undefined' && tocIdleRef.current) {
                cancelIdleCallback(tocIdleRef.current);
            }
        };
    }, [debouncedContent, showToc]);

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
            setTimeout(() => { clickLockedRef.current = false; }, 600);
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

        // 네이티브 scroll 이벤트는 초당 수십 회 발생할 수 있어, updateBtnPos와 동일하게
        // requestAnimationFrame으로 스로틀링해 프레임당 1회만 querySelectorAll/getBoundingClientRect를 실행한다.
        const throttled = createRafThrottle(handleScroll);

        editorEl.addEventListener('scroll', throttled, { passive: true });
        return () => {
            editorEl.removeEventListener('scroll', throttled);
            throttled.cancel();
        };
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
        // setFullContent(html)이 editor.innerHTML을 재대입하며 내부적으로 전체 서브트리를 다시
        // 생성하므로, 직전까지 selectedTableNode가 가리키던 라이브 DOM 노드는 detach된다.
        // 초기화하지 않으면 fillSeq/열 너비 균등화 등 연속 액션이 죽은 노드를 대상으로
        // 성공 토스트만 띄우고 조용히 아무것도 바꾸지 못하게 된다.
        setSelectedTableNode(null);
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
    const headingCandidatesRef = useLatestRef(headingCandidates);

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

    // 후보 엘리먼트를 heading으로 변환하고 되돌리기용 snapshot을 만든다
    // (handleCandidateConvert/handleCandidateConvertAll 공용)
    const convertCandidateElement = useCallback((el, level, id, candidateData) => {
        const levelClassMap = { h3: config.tit1Class, h4: config.tit2Class, h5: config.tit3Class };
        const li = el.tagName === 'LI' ? el : el.closest('li');
        const list = li ? li.closest('ul, ol') : null;

        const heading = document.createElement(level);
        if (levelClassMap[level]) heading.className = levelClassMap[level];
        heading.innerHTML = li ? li.innerHTML : el.innerHTML;
        heading.querySelectorAll('[data-hcand-id]').forEach(e => e.removeAttribute('data-hcand-id'));
        heading.setAttribute('data-hconv-id', id);

        const snapshot = {
            convId: id,
            originalTag: li ? 'li' : el.tagName.toLowerCase(),
            originalInner: li ? li.innerHTML : el.innerHTML,
            originalClass: li ? (li.className || '') : (el.className || ''),
            originalListClass: list?.className || '',
            candidateData
        };

        if (li) {
            replaceLiInList(li, heading);
        } else {
            el.replaceWith(heading);
        }
        return snapshot;
    }, [config.tit1Class, config.tit2Class, config.tit3Class]);

    // 개별 변환
    const handleCandidateConvert = useCallback((id, level) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
        if (!el) return;
        const candidateData = headingCandidatesRef.current.find(c => c.id === id);
        const snapshot = convertCandidateElement(el, level, id, candidateData);

        syncEditorHtml();
        setHeadingCandidates(prev => prev.filter(c => c.id !== id));
        setConversionHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), { items: [snapshot] }]);
        triggerToast('제목으로 변환했습니다.');
    }, [convertCandidateElement, syncEditorHtml, triggerToast]);

    // 개별 무시: li이면 제자리에서 p 태그로 추출, 아니면 마커만 제거
    const handleCandidateDismiss = useCallback((id) => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
        if (el) dismissCandidateElement(el);
        syncEditorHtml();
        setHeadingCandidates(prev => prev.filter(c => c.id !== id));
    }, [syncEditorHtml]);

    // 전체 변환
    const handleCandidateConvertAll = useCallback(() => {
        const candidates = headingCandidatesRef.current;
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !candidates.length) return;
        const snapshots = [];
        candidates.forEach((cand) => {
            const { id, suggestedLevel } = cand;
            const el = instance.editor.querySelector(`[data-hcand-id="${id}"]`);
            if (!el) return;
            snapshots.push(convertCandidateElement(el, suggestedLevel, id, cand));
        });
        syncEditorHtml();
        if (snapshots.length) setConversionHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), { items: snapshots }]);
        triggerToast(`${candidates.length}개를 제목으로 변환했습니다.`);
        setHeadingCandidates([]);
    }, [convertCandidateElement, syncEditorHtml, triggerToast]);

    // 전체 무시
    const handleCandidateDismissAll = useCallback(() => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        instance.editor.querySelectorAll('[data-hcand-id]').forEach(dismissCandidateElement);
        syncEditorHtml();
        setHeadingCandidates([]);
    }, [syncEditorHtml]);

    // 레벨 순환 변경 (H3 → H4 → H5 → H2)
    const handleCandidateLevelChange = useCallback((id) => {
        const CYCLE = ['h3', 'h4', 'h5'];
        setHeadingCandidates(prev => prev.map(c => {
            if (c.id !== id) return c;
            const next = (CYCLE.indexOf(c.suggestedLevel) + 1) % CYCLE.length;
            return { ...c, suggestedLevel: CYCLE[next] };
        }));
    }, []);

    // 마지막 변환 되돌리기
    const conversionHistoryRef = useLatestRef(conversionHistory);

    const handleConversionUndo = useCallback(() => {
        const history = conversionHistoryRef.current;
        const last = history[history.length - 1];
        if (!last) return;
        const instance = editorComponentRef.current?.getInstance();
        if (!instance) return;
        const restoredCandidates = [];
        last.items.forEach(({ convId, originalTag, originalInner, originalClass, originalListClass, candidateData }) => {
            const el = instance.editor.querySelector(`[data-hconv-id="${convId}"]`);
            if (!el) return;

            if (originalTag === 'li') {
                const li = document.createElement('li');
                if (originalClass) li.className = originalClass;
                li.innerHTML = originalInner;
                if (candidateData) {
                    li.setAttribute('data-hcand-id', convId);
                    restoredCandidates.push(candidateData);
                }
                // replaceLiInList이 목록을 분리했으므로 인접 목록을 다시 병합해 복원
                const prevSib = el.previousElementSibling;
                const nextSib = el.nextElementSibling;
                const prevList = (prevSib?.tagName === 'UL' || prevSib?.tagName === 'OL') ? prevSib : null;
                const nextList = (nextSib?.tagName === 'UL' || nextSib?.tagName === 'OL') ? nextSib : null;
                if (prevList || nextList) {
                    const tagName = (prevList || nextList).tagName.toLowerCase();
                    const mergedList = document.createElement(tagName);
                    if (originalListClass) mergedList.className = originalListClass;
                    if (prevList) Array.from(prevList.children).forEach(item => mergedList.appendChild(item));
                    mergedList.appendChild(li);
                    if (nextList) Array.from(nextList.children).forEach(item => mergedList.appendChild(item));
                    el.replaceWith(mergedList);
                    if (prevList) prevList.remove();
                    if (nextList) nextList.remove();
                } else {
                    const ul = document.createElement('ul');
                    if (originalListClass) ul.className = originalListClass;
                    ul.appendChild(li);
                    el.replaceWith(ul);
                }
            } else {
                const restored = document.createElement(originalTag);
                if (originalClass) restored.className = originalClass;
                restored.innerHTML = originalInner;
                if (candidateData) {
                    restored.setAttribute('data-hcand-id', convId);
                    restoredCandidates.push(candidateData);
                }
                el.replaceWith(restored);
            }
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

        const boxClass = (config.boxClassName && config.boxClassName.trim()) || 'box_st2';
        const newNode = document.createElement('div');
        // 이미지만 있는 셀(이 버튼은 canReplaceWithImageBox가 참일 때만 눌리므로 항상 이 경우)은
        // boxClass 없이 rsp_img ac만 적용한다. boxClass는 이미지+텍스트가 섞인 경우에만 붙는다.
        newNode.className = 'rsp_img ac';
        newNode.innerHTML = `\n    <img src="${PLACEHOLDER_IMAGE_SRC}" alt="">\n`;

        // 'tbl_st'는 실제 기본 wrapperClassName(TableConfigContext.jsx)과 일치해야 wrapper div를 찾을 수 있다.
        // 이전에는 'tbl-st'(하이픈)로 오타가 나 있어 정상 래핑된 표에서 항상 매칭에 실패했다.
        const wrapperDiv = selectedTableNode.closest(`div.tbl_st, div.${boxClass}`);
        (wrapperDiv || selectedTableNode).replaceWith(newNode);
        syncEditorHtml();
        setSelectedTableNode(null);
        if (tableBtnRef.current) tableBtnRef.current.style.display = 'none';
        triggerToast('이미지 박스로 치환되었습니다.');
    }, [config.boxClassName, selectedTableNode, syncEditorHtml, triggerToast]);

    // ===== [순번 채우기] =========================================================
    const handleFillSeq = useCallback(() => {
        const instance = editorComponentRef.current?.getInstance();
        if (!instance || !selectedTableNode) return;
        fillSeqInTable(selectedTableNode, 0);
        syncEditorHtml();
        triggerToast('순번이 채워졌습니다.');
    }, [selectedTableNode, syncEditorHtml, triggerToast]);

    // ===== [열 너비 균등 분할] ===================================================
    useEffect(() => {
        if (!selectedTableNode) { setIsEqualColWidths(false); return; }
        // :scope > colgroup 으로 자기 테이블의 colgroup만 확인 (중첩 테이블 colgroup 혼입 방지)
        const col = selectedTableNode.querySelector(':scope > colgroup > col[span]');
        setIsEqualColWidths(!!(col && col.style.width.includes('calc')));
    }, [selectedTableNode]);

    const handleEqualColWidths = useCallback(() => {
        if (!selectedTableNode) return;
        // applyColGroupHelper requires the actual <table> element
        const tableEl = selectedTableNode.tagName === 'TABLE'
            ? selectedTableNode
            : selectedTableNode.querySelector('table') || selectedTableNode;
        // storage node for data-local-colwidths mirrors handleExternalTableEdit logic
        let storageNode;
        if (selectedTableNode.tagName !== 'TABLE') {
            storageNode = selectedTableNode;
        } else {
            const parent = selectedTableNode.parentElement;
            storageNode = (parent?.tagName === 'DIV' &&
                (parent.className.includes('tbl') || parent.className.includes('scroll')))
                ? parent : selectedTableNode;
        }
        if (isEqualColWidths) {
            tableEl.querySelector('colgroup')?.remove();
            storageNode.removeAttribute('data-local-colwidths');
        } else {
            applyColGroupHelper(tableEl, 'auto-calc');
            storageNode.setAttribute('data-local-colwidths', JSON.stringify(['auto-calc']));
        }
        setIsEqualColWidths(prev => !prev);
        syncEditorHtml();
        triggerToast(isEqualColWidths ? '열 너비 설정이 해제됐습니다.' : '열 너비가 균등하게 적용됐습니다.');
    }, [selectedTableNode, isEqualColWidths, syncEditorHtml, triggerToast]);

    // ===== [onChange 콜백] ======================================================
    const onChangeRef = useLatestRef(onChange);

    useEffect(() => {
        if (!onChangeRef.current || !debouncedContent) return;
        const val = editorComponentRef.current?.getInstance()?.value || debouncedContent;
        const doc = getDOMParser().parseFromString(val, 'text/html');
        // 6개 속성 각각 querySelectorAll을 돌리는 대신, 결합 셀렉터로 한 번만 순회한다.
        // removeAttribute는 없는 속성에 대해 no-op이므로 매칭된 엘리먼트에 6개를 전부 제거해도 결과는 동일하다.
        doc.querySelectorAll(TEMP_ATTRS_SELECTOR).forEach(el => {
            TEMP_ATTRS.forEach(attr => el.removeAttribute(attr));
        });
        doc.querySelectorAll('td, th').forEach(cell => {
            if (cell.textContent.replace(RE_WHITESPACE, '') === '' &&
                cell.querySelectorAll('img, iframe, table').length === 0) {
                cell.innerHTML = '';
            }
        });
        let html = doc.body.innerHTML;
        if (html.includes('<br')) html = html.replace(/<\/table>\s*<br\s*\/?>/gi, '</table>');
        onChangeRef.current(html);
    }, [debouncedContent]);

    // 에디터 내용이 비워지면 제목 후보 초기화
    useEffect(() => {
        if (!debouncedContent) { setHeadingCandidates([]); return; }
        const text = debouncedContent.replace(/<[^>]*>/g, '').trim();
        if (!text) setHeadingCandidates([]);
    }, [debouncedContent]);

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
        const handleOutsideClick = (e) => {
            if (!selectedTableNodeRef.current) return;
            const editorInstance = editorComponentRef.current?.getInstance();
            if (!editorInstance) return;
            const isInsideEditor = editorInstance.container && editorInstance.container.contains(e.target);
            const isInsideBtn = e.target.closest(`.${layout.tableBtn}`);
            if (!isInsideEditor && !isInsideBtn) {
                setSelectedTableNode(null);
                if (tableBtnRef.current) tableBtnRef.current.style.display = 'none';
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    const updateBtnPos = useCallback(() => {
        const tableEl = selectedTableNodeRef.current;
        const btn = tableBtnRef.current;
        if (!tableEl || !editBoxRef.current || !btn) {
            if (btn) btn.style.display = 'none';
            return;
        }
        const tableRect = tableEl.getBoundingClientRect();
        const boxRect = editBoxRef.current.getBoundingClientRect();
        btn.style.top = `${Math.round(tableRect.top - boxRect.top) - 40}px`;
        btn.style.left = `${Math.round(tableRect.right - boxRect.left)}px`;
        btn.style.display = '';
    }, []);

    useEffect(() => { updateBtnPos(); }, [selectedTableNode, updateBtnPos]);

    useEffect(() => {
        if (!selectedTableNode) { if (tableBtnRef.current) tableBtnRef.current.style.display = 'none'; return; }
        const throttled = createRafThrottle(updateBtnPos);
        window.addEventListener('scroll', throttled, true);
        window.addEventListener('resize', throttled);
        return () => {
            window.removeEventListener('scroll', throttled, true);
            window.removeEventListener('resize', throttled);
            throttled.cancel();
        };
    // 선택된 테이블이 바뀔 때마다가 아니라, 선택 유무(있음↔없음)가 바뀔 때만 리스너를 다시 건다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!selectedTableNode, updateBtnPos]);

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
        const updatedHtml = updateStylesOnly(currentContent, config, formattedWidthString);
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
            const formattedWidth = formatColWidths(localColWidths);
            const tempParserDiv = document.createElement('div');
            tempParserDiv.innerHTML = tableEditModal.html;
            tempParserDiv.querySelectorAll('[data-local-config],[data-local-colwidths]').forEach(el => {
                el.removeAttribute('data-local-config');
                el.removeAttribute('data-local-colwidths');
            });
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
                targetNode.replaceWith(newTargetNode);
                // instance.value = html 호출 금지: Jodit value setter가 TD 안의 data-local-* 속성을 제거한다.
                // DOM을 직접 교체했으므로 Jodit editor.innerHTML이 이미 올바른 상태.
                setContent(instance.editor.innerHTML);
                setSelectedTableNode(newTargetNode);
                triggerToast('선택한 표의 설정이 개별 변경되었습니다.');
            }
        }
        closeTableEditModal();
    }, [tableEditModal, triggerToast, closeTableEditModal]);

    const handlePreviewOpen = useCallback(() => {
        toggleModal('preview', true);
    }, [toggleModal]);

    // PreviewModal/GuideModal은 React.memo인데, onClose를 인라인 화살표로 넘기면 매 렌더
    // 새 참조가 생겨 memo가 무력화된다. useCallback으로 고정해 memo가 실제로 동작하게 한다.
    const handlePreviewClose = useCallback(() => {
        toggleModal('preview', false);
    }, [toggleModal]);

    const handleGuideClose = useCallback(() => {
        toggleModal('guide', false);
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

    const handleEtcConfigApply = useCallback((newConfig) => {
        updateMultipleConfig(newConfig);
        toggleModal('etcConfig', false);
        triggerToast('기타 설정이 변경되었습니다.');
    }, [updateMultipleConfig, toggleModal, triggerToast]);

    // 이미지 박스 치환은 셀이 1개이고 그 안의 내용이 img 하나뿐인 표에서만 허용한다
    // (<td><img></td> 또는 <th><img></th>) — 텍스트나 다른 요소가 섞여 있으면 정보가 손실된다.
    const canReplaceWithImageBox = (() => {
        if (!selectedTableNode) return false;
        const cells = selectedTableNode.querySelectorAll('td, th');
        if (cells.length !== 1) return false;
        const cell = cells[0];
        return cell.querySelectorAll('img').length === 1 &&
            cell.querySelectorAll('*').length === 1 &&
            cell.textContent.replace(RE_WHITESPACE, '') === '';
    })();

    // 챗봇 "표 요약해줘" 요청 대상. 커서가 표 안에 있으면 그 표 하나만, 아니면 에디터 전체를 넘긴다.
    // content/selectedTableNode를 직접 넘기지 않고 ref로 최신값만 읽는 이유는, ChatBot이 매 렌더마다
    // 재생성되는 함수를 props로 받으면 React.memo가 무력화돼 타이핑할 때마다 재렌더되기 때문이다.
    const getSummaryTarget = useCallback(() => {
        const node = selectedTableNodeRef.current;
        if (node) {
            const tableEl = node.tagName === 'TABLE' ? node : node.querySelector('table');
            if (tableEl) return { scope: 'table', html: tableEl.outerHTML };
        }
        return { scope: 'document', html: contentRef.current || '' };
    }, [selectedTableNodeRef, contentRef]);

    return (
        <div className={layout.tableWrap} suppressHydrationWarning>
            <div className={layout.contBox}>
                <TableConfigToolbar
                    isGuideMode={isGuideMode}
                    setIsGuideMode={setIsGuideMode}
                    isChatBotVisible={isChatBotVisible}
                    setIsChatBotVisible={setIsChatBotVisible}
                    toggleModal={toggleModal}
                    modals={modals}
                    handleCopy={handleCopy}
                    handleClear={handleClear}
                    handleManualClean={handleManualCleanAndDetect}
                    stats={stats}
                    isAutoPasteEnabled={isAutoPasteEnabled}
                    toggleAutoPaste={toggleAutoPaste}
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
                    <div ref={editBoxRef} className={`${layout.editBox} ${isGuideMode ? `${layout.guideTarget} ${layout.guideCenter}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.editorConfig : undefined} >
                        <div ref={tableBtnRef} className={layout.tableBtn} style={{ display: 'none' }}>
                                <div className={layout.tableBtnGroup}>
                                    
                                    {/* 순번 채우기 */}
                                    <button type="button" onClick={handleFillSeq} className={layout.Btn} title="첫 번째 열에 순번(1,2,3…) 자동 입력">
                                        <i className="ri-list-ordered"></i>
                                    </button>
                                    {/* 열 너비 균등 분할 */}
                                    <button type="button" onClick={handleEqualColWidths} className={`${layout.Btn}${isEqualColWidths ? ` ${layout.BtnOn}` : ''}`} title={isEqualColWidths ? "열 너비 균등 분할 해제" : "열 너비 균등 분할"}>
                                        <i className="ri-layout-column-line"></i>
                                    </button>
                                    {/* 이미지 박스 치환: 셀 1개에 img만 있는 표일 때만 노출 (정보 손실 방지) */}
                                    {canReplaceWithImageBox && (
                                        <button type="button" onClick={handleReplaceWithImageBox} className={layout.Btn} title="표를 이미지 박스로 치환">
                                            <i className="ri-image-line"></i>
                                        </button>
                                    )}
                                    {/* 기존: 개별 표 설정 */}
                                    <button type="button" onClick={handleExternalTableEdit} className={`${layout.Btn} ${isGuideMode ? `${layout.guideTarget} ${layout.guideLeft}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.tableBtn : undefined} title="개별 표 설정">
                                        <i className="ri-settings-4-line"></i>
                                    </button>
                                </div>
                        </div>

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
                                onStatsChange={setStats}
                            />
                        </ErrorBoundary>
                    </div>

                    <TocPanel
                        layout={layout}
                        showToc={showToc} setShowToc={setShowToc}
                        tocItems={tocItems} filteredTocItems={filteredTocItems}
                        tocFilter={tocFilter} setTocFilter={setTocFilter}
                        headingCandidates={headingCandidates} conversionHistory={conversionHistory}
                        activeItemIndex={activeItemIndex}
                        editingTocIndex={editingTocIndex} editingTocLabel={editingTocLabel} setEditingTocLabel={setEditingTocLabel}
                        scrollToItem={scrollToItem} handleTocDoubleClick={handleTocDoubleClick}
                        handleTocLabelSave={handleTocLabelSave} handleTocLabelKeyDown={handleTocLabelKeyDown}
                        scrollToCandidate={scrollToCandidate} handleCandidateLevelChange={handleCandidateLevelChange}
                        handleCandidateConvert={handleCandidateConvert} handleCandidateDismiss={handleCandidateDismiss}
                        handleCandidateConvertAll={handleCandidateConvertAll} handleCandidateDismissAll={handleCandidateDismissAll}
                        handleConversionUndo={handleConversionUndo}
                    />
                </div>
            </div>

            {isGuideMode && <div className={layout.guideWrap}/>}
            <ChatBot visible={isChatBotVisible} onHide={handleHideChatBot} hasContent={!!content.trim()} getSummaryTarget={getSummaryTarget} />
            {toast.show && <div key={toast.id} className="toast-popup">{toast.message}</div>}
            {modals.preview && <PreviewModal content={content} config={config} widthString={formattedWidthString} onClose={handlePreviewClose} layout={layout} fadeStyle={getFadeStyle('preview')} />}
            {modals.guide && <GuideModal onClose={handleGuideClose} layout={layout} fadeStyle={getFadeStyle('guide')} />}

            {modals.tableEdit && (
                <TableEditModal
                    key={tableEditModal.tempId || 'table-edit'}
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
            {modals.etcConfig && (
                <EtcConfigModal
                    onClose={() => toggleModal('etcConfig', false)}
                    onApply={handleEtcConfigApply}
                    globalConfig={config}
                    layout={layout}
                    isGuideMode={isGuideMode}
                    setIsGuideMode={setIsGuideMode}
                    fadeStyle={getFadeStyle('etcConfig')}
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
            {isCleaning && <GlobalLoader />}
        </div>
    );
}

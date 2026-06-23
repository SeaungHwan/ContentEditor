/*
 * [JoditCustomEditor.jsx] Jodit WYSIWYG 에디터 래퍼
 *
 * 역할:
 *   - jodit-react를 Next.js dynamic import(ssr:false)로 감싸 브라우저 전용으로 로드한다.
 *   - React.memo + forwardRef 조합으로 부모 리렌더링 시 에디터 재마운트를 방지한다.
 *     (prevProps/nextProps 비교 함수: editorClasses의 tit1/tit2/tit3 클래스명이 바뀔 때만 재렌더)
 *
 * 외부 노출 API (useImperativeHandle):
 *   - clear()           : 에디터 내용 전체 삭제
 *   - setFullContent(html): 에디터 내용을 주어진 HTML로 교체
 *   - getInstance()     : Jodit 인스턴스 직접 접근 (커서 조작, value 읽기 등)
 *
 * Jodit 설정 핵심 옵션:
 *   - sourceEditor: 'area'   → 소스 모드를 <textarea> 방식으로 고정
 *   - cleanHTML.removeEmptyNodes: false → 빈 노드를 Jodit이 임의로 제거하지 않도록 차단
 *   - defaultActionOnPaste: 'insert_as_html' → 붙여넣기 시 원본 HTML 그대로 삽입
 *   - askBeforePasteHTML/FromWord: false → 붙여넣기 확인 다이얼로그 비활성화
 *
 * 커스텀 버튼:
 *   - toggleTh: 선택된 셀(TD/TH)을 서로 전환. Jodit 내부 선택 API로 선택 셀을 감지하며,
 *     감지 실패 시 style 태그의 jodit-table-container 선택자를 파싱해 폴백 처리.
 *
 * 이벤트 훅:
 *   - beforeInit  : paragraph 드롭다운 목록을 tit1/tit2/tit3 클래스명으로 초기화
 *   - blur        : 포커스 이탈 시 onChange 호출(content 동기화)
 *   - mouseup/keyup: 현재 커서가 위치한 table 요소를 onTableSelect로 전달
 *   - beforeSetMode: 소스 모드 전환 전 HTML을 js-beautify로 들여쓰기 포맷
 *   - afterInit   : Jodit 소스모드 mousedown/up/click 이벤트 버블링을 차단해
 *                   소스 textarea 조작 시 의도치 않은 synchro 트리거 방지
 */
"use client";

import React, { useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import Loading from '../loading/GlobalLoader';

const JoditEditor = dynamic(() => import('jodit-react'), {
    ssr: false,
    loading: () => <Loading />
});

const BEAUTIFY_OPTIONS = {
    indent_size: 2, preserve_newlines: false, max_preserve_newlines: 1, wrap_line_length: 0,
    unformatted: ['a', 'span', 'strong', 'em', 'code'],
};

const JoditCustomEditor = React.memo(forwardRef(({ initialData, onChange, onPreview, onTableSelect, editorClasses, triggerToast, onAutoPaste, onStatsChange }, ref) => {
    const editorRef = useRef(null);
    const handlersRef = useRef({ onChange, onPreview, onTableSelect, triggerToast, onAutoPaste, onStatsChange });
    const classesRef = useRef(editorClasses || { tit1: 'tit1', tit2: 'tit2', tit3: 'tit3', tit4: 'item' });
    const titObserverRef = useRef(null);
    const pendingAutoPasteRef = useRef(false);
    const statsDebounceRef = useRef(null);
    const tableSelectDebounceRef = useRef(null);
    const htmlBeautifyRef = useRef(null);

    useEffect(() => {
        import('js-beautify').then(mod => { htmlBeautifyRef.current = mod.html; });
    }, []);

    useEffect(() => {
        handlersRef.current = { onChange, onPreview, onTableSelect, triggerToast, onAutoPaste, onStatsChange };
    }, [onChange, onPreview, onTableSelect, triggerToast, onAutoPaste, onStatsChange]);

    useEffect(() => {
        const tmpl = document.getElementById('table-editor-data');
        const html = tmpl ? tmpl.innerHTML.trim() : (initialData || '');
        if (!html) return;
        const timer = setTimeout(() => {
            if (editorRef.current) editorRef.current.value = html;
        }, 300);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            titObserverRef.current?.disconnect();
            clearTimeout(statsDebounceRef.current);
            clearTimeout(tableSelectDebounceRef.current);
        };
    }, []);

    useEffect(() => {
        classesRef.current = editorClasses || { tit1: 'tit1', tit2: 'tit2', tit3: 'tit3', tit4: 'item' };
        if (editorRef.current && editorRef.current.options?.controls?.paragraph) {
            editorRef.current.options.controls.paragraph.list = {
                'h2': `${classesRef.current.tit1} (H2)`,
                'h3': `${classesRef.current.tit2} (H3)`,
                'h4': `${classesRef.current.tit3} (H4)`,
                'h5': `${classesRef.current.tit4} (H5)`,
            };
        }
    }, [editorClasses]);

    useImperativeHandle(ref, () => ({
        clear: () => {
            if (editorRef.current) editorRef.current.value = '';
        },
        setFullContent: (html) => {
            if (editorRef.current) editorRef.current.value = html;
        },
        getInstance: () => editorRef.current
    }));

    const config = useMemo(() => {
        const getTitClassMap = () => ({
            h2: `tit-st${classesRef.current.tit1 ? ` ${classesRef.current.tit1}` : ''}`,
            h3: `tit-st${classesRef.current.tit2 ? ` ${classesRef.current.tit2}` : ''}`,
            h4: `tit-st${classesRef.current.tit3 ? ` ${classesRef.current.tit3}` : ''}`,
            h5: `tit-st${classesRef.current.tit4 ? ` ${classesRef.current.tit4}` : ''}`,
        });
        return ({
        readonly: false,
        height: '100%',
        language: 'ko',
        theme: 'default',
        adaptive: false,
        toolbarAdaptive: false,
        useAceEditor: false,
        sourceEditor: 'area',
        allowResizeX: false,
        allowResizeY: false,
        cleanHTML: {
            fillEmptyParagraph: true,
            replaceOldTags: false,
            removeEmptyNodes: false,
            disableCleanFilter: new Set(['fillEmptyParagraph', 'removeEmptyTextNode', 'removeInvTextNodes', 'replaceOldTags', 'sanitizeAttributes', 'tryRemoveNode']),
        },
        
        buttons: ['source', '|','paragraph', 'table', '|', 'undo', 'redo'],
        extraButtons: [
            {
                name: 'toggleTh',
                icon: 'th',
                tooltip: 'TD/TH 전환',
               exec: (editor) => {
                    try {
                        // 에디터에 테이블이 없으면 즉시 안내 후 종료
                        if (!editor.editor.querySelector('table')) {
                            handlersRef.current.triggerToast?.('테이블 셀(TD/TH) 내부를 선택해주세요.');
                            return;
                        }

                        let selectedCells = [];
                        const doc = editor.editorDocument || document;
                        const styleTags = Array.from(doc.querySelectorAll('style'));

                        selectedCells = Array.from(editor.editor.querySelectorAll(
                            'td.jodit-selected-cell, th.jodit-selected-cell, td[data-jodit-selected-cell], th[data-jodit-selected-cell], td.jodit_selected_cell, th.jodit_selected_cell'
                        ));

                        if (selectedCells.length === 0) {
                            let selectors = [];
                            styleTags.forEach(style => {
                                const className = style.getAttribute('class') || '';
                                if (className.includes('jodit-table-container') && style.innerHTML.includes('{')) {
                                    const selectorPart = style.innerHTML.split('{')[0].trim();
                                    if (selectorPart) selectors.push(selectorPart);
                                }
                            });

                            if (selectors.length > 0) {
                                try {
                                    const fullSelector = selectors.join(', ');
                                    // 에디터 내부 셀만 필터링
                                    const elements = Array.from(editor.editor.querySelectorAll(fullSelector));
                                    selectedCells = elements.filter(el => el.tagName === 'TD' || el.tagName === 'TH');
                                } catch (e) {
                                    console.warn("선택자 파싱 오류:", e);
                                }
                            }
                        }

                        if (selectedCells.length === 0) {
                            const current = editor.s.current();
                            if (current) {
                                const target = current.nodeType === 3 ? current.parentElement : current;
                                const cell = target.closest('td, th');
                                // 에디터 영역 내부 셀인지 반드시 확인
                                if (cell && editor.editor.contains(cell)) selectedCells = [cell];
                            }
                        }

                        if (selectedCells.length === 0) {
                            handlersRef.current.triggerToast?.('테이블 셀(TD/TH) 내부를 선택해주세요.');
                            return;
                        }

                        let lastNewCell = null;
                        selectedCells.forEach(cell => {
                            const newTagName = cell.tagName.toLowerCase() === 'td' ? 'th' : 'td';
                            const newCell = editor.create.element(newTagName);
                            newCell.innerHTML = cell.innerHTML;

                            Array.from(cell.attributes).forEach(attr => {
                                newCell.setAttribute(attr.name, attr.value);
                            });

                            cell.replaceWith(newCell);
                            lastNewCell = newCell;
                        });

                        // setCursorIn 전에 노드가 에디터 내에 있는지 확인
                        if (lastNewCell && editor.editor.contains(lastNewCell)) {
                            editor.s.setCursorIn(lastNewCell);
                        }
                        if (handlersRef.current.onChange) handlersRef.current.onChange(editor.value);

                    } catch (e) {
                        console.error("TD/TH 전환 중 오류 발생:", e);
                    }
                }
            },
        ],
        showXPathInStatusbar: false,
        showCharsCounter: false,
        showWordsCounter: false,
        showPlaceholder: false,
        askBeforePasteHTML: false,
        askBeforePasteFromWord: false,
        defaultActionOnPaste: 'insert_as_html',

        events: {
            beforeInit: (editor) => {
                if (editor.options.controls.paragraph) {
                    editor.options.controls.paragraph.list = {
                        'h2': `${classesRef.current.tit1} (H2)`,
                        'h3': `${classesRef.current.tit2} (H3)`,
                        'h4': `${classesRef.current.tit3} (H4)`,
                        'h5': `${classesRef.current.tit4} (H5)`,
                    };
                }
            },

            blur: () => {
                if (editorRef.current && handlersRef.current.onChange) {
                    handlersRef.current.onChange(editorRef.current.value);
                }
            },
            
            mouseup: function (e) {
                if (this && typeof this.getMode === 'function' && this.getMode() !== 1) return;
                if (!handlersRef.current.onTableSelect) return;
                if (!e || !e.target || typeof e.target.closest !== 'function') return;
                clearTimeout(tableSelectDebounceRef.current);
                const target = e.target;
                tableSelectDebounceRef.current = setTimeout(() => {
                    try { handlersRef.current.onTableSelect(target.closest('table')); } catch (err) {}
                }, 50);
            },

            keyup: function (_e) {
                if (this && typeof this.getMode === 'function' && this.getMode() !== 1) return;
                if (!handlersRef.current.onTableSelect) return;
                clearTimeout(tableSelectDebounceRef.current);
                const jodit = this;
                tableSelectDebounceRef.current = setTimeout(() => {
                    try {
                        if (jodit && jodit.selection && typeof jodit.selection.current === 'function') {
                            const current = jodit.selection.current();
                            if (current && typeof current.closest === 'function') {
                                handlersRef.current.onTableSelect(current.closest('table'));
                                return;
                            }
                        }
                        handlersRef.current.onTableSelect(null);
                    } catch (err) {}
                }, 50);
            },
            
            afterPaste: function () {
                if (!pendingAutoPasteRef.current) return;
                pendingAutoPasteRef.current = false;
                handlersRef.current.onAutoPaste?.();
            },

            beforeSetMode: (instance) => {
                try {
                    if (htmlBeautifyRef.current) {
                        instance.value = htmlBeautifyRef.current(instance.value, BEAUTIFY_OPTIONS);
                    }
                } catch (e) {}
            },

            change: function() {
                clearTimeout(statsDebounceRef.current);
                statsDebounceRef.current = setTimeout(() => {
                    const dom = editorRef.current?.editor;
                    if (!dom || !handlersRef.current.onStatsChange) return;
                    const chars = (dom.textContent || '').replace(/\s/g, '').length;
                    const tables = dom.querySelectorAll('table').length;
                    const images = dom.querySelectorAll('img').length;
                    handlersRef.current.onStatsChange({ chars, tables, images });
                }, 50);
            },
            
            beforeExecCommand: function(command, _, value) {
                if (command !== 'formatBlock') return;
                const editor = this;
                const current = editor.s.current();
                if (!current) return;

                const node = current.nodeType === 3 ? current.parentElement : current;
                const tag = (value || 'p').toLowerCase();
                const titClassMap = getTitClassMap();
                if (!titClassMap[tag]) return;

                const cell = node?.closest?.('td, th');

                if (cell) {
                    // 셀 내부: 직접 요소 생성 후 클래스 즉시 적용
                    let blockEl = node;
                    while (blockEl && blockEl.parentElement !== cell) {
                        blockEl = blockEl.parentElement;
                    }
                    const newEl = editor.create.element(tag);
                    newEl.className = titClassMap[tag];
                    if (blockEl && blockEl !== cell && blockEl.tagName !== 'TD' && blockEl.tagName !== 'TH') {
                        newEl.innerHTML = blockEl.innerHTML;
                        blockEl.replaceWith(newEl);
                    } else {
                        newEl.innerHTML = cell.innerHTML;
                        cell.innerHTML = '';
                        cell.appendChild(newEl);
                    }
                    editor.s.setCursorIn(newEl);
                    handlersRef.current.onChange?.(editor.value);
                    return false;
                }

                // 일반 텍스트: Jodit 기본 formatBlock 실행
            },

            afterInit: (instance) => {
                editorRef.current = instance;

                const MSO_PATTERN = /mso-list|mso-level|MsoNormal|mso-para-margin|hancomword|hwpf|EditMark/i;
                const handleNativePaste = (e) => {
                    const rawHtml = e.clipboardData?.getData('text/html') || '';
                    if (!rawHtml) return;
                    const hasMso = MSO_PATTERN.test(rawHtml);
                    // 에디터 자체 출력물이 아닌 외부 테이블 감지
                    // (tbl-st / data-theme 이 없는 <table> = Word·HWP·Excel 등에서 온 테이블)
                    const hasExternalTable = rawHtml.includes('<table') &&
                        !rawHtml.includes('class="tbl-st"') &&
                        !rawHtml.includes('data-theme=');
                    if (hasMso || hasExternalTable) pendingAutoPasteRef.current = true;
                };
                if (instance.editor) {
                    instance.editor.addEventListener('paste', handleNativePaste, true);
                    // 브라우저 네이티브 contenteditable 자동 리스트 변환 차단
                    instance.editor.addEventListener('beforeinput', (e) => {
                        if (e.inputType === 'insertOrderedList' || e.inputType === 'insertUnorderedList') {
                            e.preventDefault();
                        }
                    }, true);
                }

                const HEADING_TAGS = new Set(['H2', 'H3', 'H4', 'H5']);
                const applyTitClasses = (mutations) => {
                    // 추가된 노드 중 heading이 없으면 조기 리턴 (키 입력 등 불필요한 실행 방지)
                    const hasHeadingAdded = mutations.some(m =>
                        Array.from(m.addedNodes).some(n =>
                            HEADING_TAGS.has(n.nodeName) ||
                            (n.nodeType === 1 && n.querySelector?.('h2,h3,h4,h5'))
                        )
                    );
                    if (!hasHeadingAdded || !instance.editor) return;

                    // 클래스 변경이 다시 observer를 트리거하지 않도록 일시 중단
                    titObserverRef.current.disconnect();

                    const titClassMap = getTitClassMap();
                    let applied = false;
                    ['h2', 'h3', 'h4', 'h5'].forEach(tag => {
                        instance.editor.querySelectorAll(tag).forEach(el => {
                            if (el.className !== titClassMap[tag]) {
                                el.className = titClassMap[tag];
                                applied = true;
                            }
                        });
                    });

                    titObserverRef.current.observe(instance.editor, { childList: true, subtree: true });
                    if (applied) handlersRef.current.onChange?.(instance.value);
                };

                titObserverRef.current = new MutationObserver(applyTitClasses);
                titObserverRef.current.observe(instance.editor, { childList: true, subtree: true });

                const blockJoditSyncBug = (e) => {
                    if (instance.getMode() === 2 && e.target && e.target.classList && e.target.classList.contains('jodit-source__mirror')) {
                        e.stopPropagation();
                    }
                };

                if (instance.container) {
                    instance.container.addEventListener('mousedown', blockJoditSyncBug, true);
                    instance.container.addEventListener('mouseup', blockJoditSyncBug, true);
                    instance.container.addEventListener('click', blockJoditSyncBug, true);
                }
            }
        }
        });
    }, []);

    return (
        <div className={`jodit-wrapper`}>
            <JoditEditor
                config={config}
            />
        </div>
    );
}), (prevProps, nextProps) => {
    return (
        prevProps.editorClasses.tit1 === nextProps.editorClasses.tit1 &&
        prevProps.editorClasses.tit2 === nextProps.editorClasses.tit2 &&
        prevProps.editorClasses.tit3 === nextProps.editorClasses.tit3 &&
        prevProps.editorClasses.tit4 === nextProps.editorClasses.tit4
    );
});

JoditCustomEditor.displayName = 'JoditCustomEditor';
export default JoditCustomEditor;


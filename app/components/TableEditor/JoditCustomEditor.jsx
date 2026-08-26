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
 *   - afterInit   : editorRef 확보 직후 initialHtmlRef(마운트 시 캡처한 초기 HTML)를 주입하고,
 *                   Jodit 소스모드 mousedown/up/click 이벤트 버블링을 차단해
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

const HEADING_TAGS = new Set(['H2', 'H3', 'H4', 'H5']);

// Jodit.atom()과 동일한 효과 — 중첩 옵션의 배열을 완전 대체로 표시해, ConfigProto 병합이
// 우리 배열 뒤에 Jodit 기본값 나머지를 이어붙이지 않게 한다.
const atom = (arr) => {
    Object.defineProperty(arr, 'isAtom', { value: true, enumerable: false, configurable: false });
    return arr;
};

// Jodit의 다중 셀 선택은 실제 DOM에 클래스를 남기지 않고, 선택된 셀들의 cssPath를
// 모아 동적 <style class="jodit jodit-table-container jodit-box"> 태그로만 표시한다
// (node_modules/jodit/esm/modules/table/table.js의 __recalculateStyles). toggleTh
// 버튼에서 이 두 단계로 실제 선택 셀을 찾아내는 방식이 검증됐으므로, 다중 셀에 걸친
// Backspace/Delete 처리에도 동일한 감지 로직을 재사용한다.
const getSelectedTableCells = (editor) => {
    let selectedCells = Array.from(editor.editor.querySelectorAll(
        'td.jodit-selected-cell, th.jodit-selected-cell, td[data-jodit-selected-cell], th[data-jodit-selected-cell], td.jodit_selected_cell, th.jodit_selected_cell'
    ));

    if (selectedCells.length === 0) {
        const doc = editor.editorDocument || document;
        const styleTags = Array.from(doc.querySelectorAll('style'));
        const selectors = [];
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
                const elements = Array.from(editor.editor.querySelectorAll(fullSelector));
                selectedCells = elements.filter(el => el.tagName === 'TD' || el.tagName === 'TH');
            } catch (e) {
                console.warn("선택자 파싱 오류:", e);
            }
        }
    }

    return selectedCells;
};

const JoditCustomEditor = React.memo(forwardRef(({ initialData, onChange, onPreview, onTableSelect, editorClasses, triggerToast, onAutoPaste, onStatsChange }, ref) => {
    const editorRef = useRef(null);
    const handlersRef = useRef({ onChange, onPreview, onTableSelect, triggerToast, onAutoPaste, onStatsChange });
    const classesRef = useRef(editorClasses || { tit1: 'tit1', tit2: 'tit2', tit3: 'tit3' });
    const titObserverRef = useRef(null);
    const pendingAutoPasteRef = useRef(false);
    const statsDebounceRef = useRef(null);
    const tableSelectDebounceRef = useRef(null);
    const htmlBeautifyRef = useRef(null);
    // afterInit에서 등록하는 리스너들 — 언마운트 시 정확히 짝을 맞춰 제거하기 위해 참조를 보관한다.
    const pasteHandlerRef = useRef(null);
    const beforeInputHandlerRef = useRef(null);
    const blockSyncHandlerRef = useRef(null);
    // 초기 콘텐츠를 고정 300ms 타이머로 주입하면, jodit-react의 동적 임포트/초기화(afterInit)가
    // 느린 기기·네트워크에서 300ms보다 늦게 끝날 때 editorRef.current가 아직 null이라 조용히
    // 씹혀버리는 경쟁 상태가 있었다. afterInit이 실제로 완료되는 시점에 값을 직접 읽어 쓰도록
    // ref에 저장해두고, 타이머 대신 afterInit 콜백에서 곧바로 소비한다.
    const initialHtmlRef = useRef('');

    useEffect(() => {
        import('js-beautify/js/src/html/index.js').then(mod => { htmlBeautifyRef.current = mod.default || mod; });
    }, []);

    useEffect(() => {
        handlersRef.current = { onChange, onPreview, onTableSelect, triggerToast, onAutoPaste, onStatsChange };
    }, [onChange, onPreview, onTableSelect, triggerToast, onAutoPaste, onStatsChange]);

    useEffect(() => {
        const tmpl = document.getElementById('table-editor-data');
        initialHtmlRef.current = (tmpl ? tmpl.innerHTML.trim() : (initialData || '')) || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            titObserverRef.current?.disconnect();
            clearTimeout(statsDebounceRef.current);
            clearTimeout(tableSelectDebounceRef.current);
            // afterInit에서 캡처 단계로 등록한 리스너들을 짝을 맞춰 제거한다.
            const instance = editorRef.current;
            if (instance?.editor) {
                if (pasteHandlerRef.current) instance.editor.removeEventListener('paste', pasteHandlerRef.current, true);
                if (beforeInputHandlerRef.current) instance.editor.removeEventListener('beforeinput', beforeInputHandlerRef.current, true);
            }
            if (instance?.container && blockSyncHandlerRef.current) {
                instance.container.removeEventListener('mousedown', blockSyncHandlerRef.current, true);
                instance.container.removeEventListener('mouseup', blockSyncHandlerRef.current, true);
                instance.container.removeEventListener('click', blockSyncHandlerRef.current, true);
            }
        };
    }, []);

    useEffect(() => {
        classesRef.current = editorClasses || { tit1: 'tit1', tit2: 'tit2', tit3: 'tit3' };
        if (editorRef.current && editorRef.current.options?.controls?.paragraph) {
            editorRef.current.options.controls.paragraph.list = {
                'h3': '대제목 (H3)',
                'h4': '중제목 (H4)',
                'h5': '소제목 (H5)',
            };
        }
    }, [editorClasses]);

    useImperativeHandle(ref, () => ({
        clear: () => {
            if (editorRef.current) editorRef.current.value = '';
        },
        setFullContent: (html) => {
            if (editorRef.current?.editor) {
                editorRef.current.editor.innerHTML = html;
            } else if (editorRef.current) {
                editorRef.current.value = html;
            }
        },
        getInstance: () => editorRef.current
    }));

    const config = useMemo(() => {
        const getTitClassMap = () => ({
            h3: classesRef.current.tit1 || '',
            h4: classesRef.current.tit2 || '',
            h5: classesRef.current.tit3 || '',
        });

        // 툴바(extraButtons)와 표 셀 팝업(popup.cells) 양쪽에서 재사용
        const toggleThButton = {
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

                    let selectedCells = getSelectedTableCells(editor);

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

                    const tableModule = editor.getInstance('Table', editor.o);

                    let lastNewCell = null;
                    selectedCells.forEach(cell => {
                        const newTagName = cell.tagName.toLowerCase() === 'td' ? 'th' : 'td';
                        const newCell = editor.create.element(newTagName);
                        newCell.innerHTML = cell.innerHTML;

                        Array.from(cell.attributes).forEach(attr => {
                            newCell.setAttribute(attr.name, attr.value);
                        });

                        // 정리(cleanup) 시 tbody 안 셀은 자동으로 td로 되돌리는 로직이 있어서(tableFormatters.js
                        // convertCellRole), 이 버튼으로 직접 th로 바꾼 셀은 표시를 남겨 그 로직이 건드리지 않게 한다.
                        if (newTagName === 'th') newCell.setAttribute('data-th-manual', '1');
                        else newCell.removeAttribute('data-th-manual');

                        // Jodit의 다중 셀 선택(Table.selected)이 교체로 사라질 옛 셀을
                        // 계속 들고 있으면, 팝업이 닫히며 그 상태를 정리하다가 초점이
                        // 엉뚱한 행으로 튀는 버그가 있었다. 교체 전에 미리 제거한다.
                        tableModule?.removeSelection?.(cell);

                        cell.replaceWith(newCell);
                        lastNewCell = newCell;
                    });

                    // setCursorIn 전에 노드가 에디터 내에 있는지 확인
                    if (lastNewCell && editor.editor.contains(lastNewCell)) {
                        editor.s.setCursorIn(lastNewCell);
                    }
                    if (handlersRef.current.onChange) handlersRef.current.onChange(editor.value);
                    editor.e.fire('hidePopup');

                } catch (e) {
                    console.error("TD/TH 전환 중 오류 발생:", e);
                }
            }
        };

        return ({
        readonly: false,
        height: '100%',
        language: 'ko',
        theme: 'default',
        adaptive: false,
        toolbarAdaptive: false,
        useAceEditor: false,
        sourceEditor: 'area',
        toolbarInlineForSelection: true,
        popup: {
            // Jodit의 옵션 병합(ConfigProto)은 중첩된 배열을 완전 대체하지 않고 "우리 배열 +
            // 남는 기본값 나머지"로 이어붙인다. atom()으로 표시해야 완전히 대체된다.
            selection: atom(['paragraph', 'bold', 'underline','fontsize', 'brush','\n','ul', 'ol', 'link', 'align', 'dots']),
            // popup.cells는 여기서 건드리지 않는다 — config 병합 단계에서 재정의하면 셀
            // 병합이 깨지고 i18n이 안 먹는 회귀가 있었다. 대신 afterInit에서 Jodit이
            // 이미 만들어둔 정상 배열의 valign 항목만 직접 교체한다.
        },
        allowResizeX: false,
        allowResizeY: false,
        cleanHTML: {
            fillEmptyParagraph: true,
            replaceOldTags: false,
            removeEmptyNodes: false,
            disableCleanFilter: new Set(['fillEmptyParagraph', 'removeEmptyTextNode', 'removeInvTextNodes', 'replaceOldTags', 'sanitizeAttributes', 'tryRemoveNode']),
        },
        
        buttons: ['source', '|','table', 'undo', 'redo'],
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
                        'h3': '대제목 (H3)',
                        'h4': '중제목 (H4)',
                        'h5': '소제목 (H5)',
                    };
                }
            },

            blur: () => {
                if (editorRef.current && handlersRef.current.onChange) {
                    handlersRef.current.onChange(editorRef.current.value);
                }
            },
            
            mouseup: function (e) {
                if (!handlersRef.current.onTableSelect) return;
                if (!e || !e.target || typeof e.target.closest !== 'function') return;
                clearTimeout(tableSelectDebounceRef.current);
                const target = e.target;
                tableSelectDebounceRef.current = setTimeout(() => {
                    try { handlersRef.current.onTableSelect(target.closest('table')); } catch (err) {}
                }, 50);
            },

            keyup: function (_e) {
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

            // 여러 테이블 셀에 걸친 선택을 Delete/Backspace로 지우면, Jodit의 기본
            // 삭제 로직(range.insertNode)이 Range 경계를 #document로 붕괴시켜
            // "insertNode ... #document" 에러를 던진다. getSelectedTableCells로
            // (toggleTh와 동일하게) 실제 선택된 셀을 판별해 2개 이상이면 각 셀 내용을
            // 직접 지워 이 경로를 우회한다.
            beforeCommand: function (command) {
                if (!/^(delete|backspace)(word|sentence)?button$/.test(command)) return;
                const jodit = editorRef.current;
                if (!jodit) return;
                const cells = getSelectedTableCells(jodit);
                if (cells.length < 2) return;
                cells.forEach(cell => {
                    cell.innerHTML = '';
                    cell.appendChild(jodit.createInside.element('br'));
                });
                jodit.s.setCursorIn(cells[0]);
                jodit.synchronizeValues();
                handlersRef.current.onChange?.(jodit.value);
                return false;
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
            
            afterInit: (instance) => {
                editorRef.current = instance;
                if (initialHtmlRef.current) {
                    instance.value = initialHtmlRef.current;
                }

                // 표 셀 팝업의 valign 버튼을 toggleTh로 교체. config.popup.cells를 직접
                // 재정의하면 병합 병합/i18n이 깨지는 회귀가 있어서, Jodit이 정상적으로
                // 만들어둔 배열을 그대로 두고 항목 하나만 바꿔치기한다.
                const cells = instance.options?.popup?.cells;
                if (Array.isArray(cells)) {
                    const getName = (item) => (typeof item === 'string' ? item : item?.name);
                    const valignIndex = cells.findIndex(item => getName(item) === 'valign');
                    if (valignIndex !== -1) {
                        cells.splice(valignIndex, 1, toggleThButton);
                    } else if (!cells.some(item => getName(item) === 'toggleTh')) {
                        cells.push(toggleThButton);
                    }

                    // 버튼 순서 재배치: 1행에 4개(TD/TH 전환·정렬·분할·병합), 2행에 4개
                    // (열삽입·행삽입·배경색 변경·삭제) — 배경색 변경은 삭제 버튼 바로 앞
                    const desiredOrder = ['toggleTh', 'align', 'splitv', 'merge', '\n', 'addcolumn', 'addrow', 'brushCell', 'delete'];
                    const byName = new Map(cells.map(item => [getName(item), item]));
                    const reordered = desiredOrder.map(name => byName.get(name)).filter(Boolean);
                    if (reordered.length === cells.length) {
                        cells.splice(0, cells.length, ...reordered);
                    }
                }

                const handleNativePaste = (e) => {
                    if (e.clipboardData?.getData('text/html')) {
                        pendingAutoPasteRef.current = true;
                    }
                };
                // 브라우저 네이티브 contenteditable 자동 리스트 변환 차단
                const handleBeforeInput = (e) => {
                    if (e.inputType === 'insertOrderedList' || e.inputType === 'insertUnorderedList') {
                        e.preventDefault();
                    }
                };
                pasteHandlerRef.current = handleNativePaste;
                beforeInputHandlerRef.current = handleBeforeInput;
                if (instance.editor) {
                    instance.editor.addEventListener('paste', handleNativePaste, true);
                    instance.editor.addEventListener('beforeinput', handleBeforeInput, true);
                }

                const applyTitClasses = (mutations) => {
                    // 대용량 문서에서 매번 에디터 전체를 재스캔하면 비용이 문서 크기에
                    // 비례해 커지므로, 이번에 실제로 추가된 노드들만 대상으로 한다
                    // (h2는 자신은 대상이 아니지만 내부에 h3~5를 포함할 수 있어 신호로만 사용).
                    const addedHeadingRoots = mutations
                        .flatMap(m => Array.from(m.addedNodes))
                        .filter(n =>
                            HEADING_TAGS.has(n.nodeName) ||
                            (n.nodeType === 1 && n.querySelector?.('h2,h3,h4,h5'))
                        );
                    if (!addedHeadingRoots.length || !instance.editor) return;

                    // 클래스 변경이 다시 observer를 트리거하지 않도록 일시 중단
                    titObserverRef.current.disconnect();

                    const titClassMap = getTitClassMap();
                    let applied = false;
                    addedHeadingRoots.forEach(node => {
                        const headings = ['H3', 'H4', 'H5'].includes(node.nodeName) ? [node] : [];
                        headings.push(...node.querySelectorAll('h3,h4,h5'));
                        headings.forEach(el => {
                            const tag = el.tagName.toLowerCase();
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
                blockSyncHandlerRef.current = blockJoditSyncBug;

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
        prevProps.editorClasses.tit3 === nextProps.editorClasses.tit3
    );
});

JoditCustomEditor.displayName = 'JoditCustomEditor';
export default JoditCustomEditor;


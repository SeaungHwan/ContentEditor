
/*
 * [cleanTableHtml.jsx] HTML 전체 구조 분리 및 재조립 오케스트레이터
 *
 * 역할:
 *   - 붙여넣은 원본 HTML(Word, HWP, 웹 등)을 받아 텍스트 블록과 테이블 블록으로 분리하고,
 *     각각을 정제 함수에 위임한 뒤 결합해 CMS 규격에 맞는 HTML로 반환한다.
 *
 * 주요 함수:
 *   cleanTableHtml(htmlString, config, colWidths)
 *     1. 노드 순회: 각 노드가 테이블 포함 여부에 따라 textGroup / tableGroup 버퍼에 누적
 *        - td/th 1개 이하인 테이블 → box_st2 div로 변환(단순 텍스트 박스 취급)
 *        - td/th 2개 이상 → tableGroup 버퍼에 축적 후 processTableOnly 일괄 처리
 *     2. flushTextGroup: 누적된 텍스트 블록을 processTextContent로 처리 후 결과에 병합
 *     3. flushTableGroup: 누적된 테이블 블록을 processTableOnly로 처리 후 결과에 병합
 *        - 처리 전 data-local-config / data-local-colwidths 속성을 미리 저장했다가 복원
 *     4. 리스트-테이블 재배치: 리스트(ul/ol) 사이에 끼인 테이블을 마지막 li 내부로 이동,
 *        분리된 다음 리스트 항목을 마커 타입 기반으로 올바른 계층에 병합
 *     5. 빈 요소 제거: p/div/span, li, td/th 내 빈 노드를 일괄 삭제
 *     6. _processLinks: plain text URL을 <a class="bu_link"> 링크로 변환,
 *        file:// · # 등 유효하지 않은 href 태그는 제거
 *     7. 원형 특수문자 변환: ol li > span.num 내 ①②③ → 아라비아 숫자로 변환
 *
 *   updateStylesOnly (styleUpdater.js에서 re-export)
 *     → 에디터 내용을 다시 파싱하지 않고 클래스/스타일만 빠르게 갱신할 때 사용
 *
 * 내부 헬퍼:
 *   _processLinks      : 링크 정규화 + 텍스트 URL 자동 링크 변환
 *   _detectMarkerType  : 텍스트에서 리스트 마커 패턴 감지
 *   _getDeepestOpenList: 리스트 트리에서 가장 깊은 열린 목록 탐색
 *   _findAncestorListByMarker: 마커 타입이 일치하는 조상 리스트 탐색
 */
"use client";

import { getDOMParser } from './utils/htmlCleaners';
import { processTextContentNormal, processTextContentColor } from './utils/textProcessor';
import { processTableOnlyNormal, processTableOnlyColor } from './utils/tableProcessor';
import { convertCircleToArabic, MARKER_TYPES, EXCLUDE_MARKER_REGEXES, RE_WHITESPACE } from './utils/constants';

export { updateStylesOnly } from './utils/styleUpdater';

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+|[a-zA-Z0-9.-]+\.(?:com|net|org|kr|io|info|biz|co|go|or|ac|re)(?:\/[^\s<]*)?/ig;

// <a> 태그 정규화 및 plain-text URL → 링크 변환
const _processLinks = (container) => {
    container.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        const text = a.textContent.trim();
        if (text === '' && a.querySelectorAll('img, table, iframe').length === 0) { a.remove(); return; }
        if (!href || href.startsWith('file://') || href.startsWith('#') || href.trim() === '') { a.replaceWith(...a.childNodes); return; }
        a.classList.add('bu_link');
        if (!a.hasAttribute('target')) a.setAttribute('target', '_blank');
    });

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodesToLink = [];
    let textNode;
    while ((textNode = walker.nextNode())) {
        if (textNode.parentNode?.closest && !textNode.parentNode.closest('a')) {
            textNodesToLink.push(textNode);
        }
    }
    textNodesToLink.forEach(node => {
        const text = node.nodeValue;
        URL_REGEX.lastIndex = 0;
        if (!URL_REGEX.test(text)) return;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        URL_REGEX.lastIndex = 0;
        let match;
        while ((match = URL_REGEX.exec(text)) !== null) {
            let rawUrl = match[0];
            const trailingPunctuation = rawUrl.match(/[.,:;"')\]]+$/);
            const actualUrl = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation[0].length) : rawUrl;
            const matchEndIndex = match.index + actualUrl.length;
            if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            const a = document.createElement('a');
            a.href = /^https?:\/\//i.test(actualUrl) ? actualUrl : `http://${actualUrl}`;
            a.className = 'bu_link';
            a.target = '_blank';
            a.textContent = actualUrl;
            fragment.appendChild(a);
            lastIndex = matchEndIndex;
            if (trailingPunctuation) URL_REGEX.lastIndex = matchEndIndex;
        }
        if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        node.parentNode.replaceChild(fragment, node);
    });
};

// 텍스트에서 마커 타입 감지 (processCellContent의 로직과 동일)
const _detectMarkerType = (text) => {
    const s = (text || '').trim();
    if (!s) return null;
    if (EXCLUDE_MARKER_REGEXES.some(r => r.test(s))) return null;
    for (const type in MARKER_TYPES) {
        const m = s.match(MARKER_TYPES[type]);
        if (m && s.substring(m[0].length).trim()) return type;
    }
    return null;
};

// listEl의 마지막 li path를 따라 최하위 열린 리스트를 반환
const _getDeepestOpenList = (listEl) => {
    let cur = listEl;
    while (true) {
        const lis = Array.from(cur.children).filter(c => c.tagName === 'LI');
        if (!lis.length) break;
        const nested = Array.from(lis[lis.length - 1].children).filter(c => c.tagName === 'UL' || c.tagName === 'OL');
        if (!nested.length) break;
        cur = nested[nested.length - 1];
    }
    return cur;
};

// startList에서 rootList 사이 조상 중 markerType이 일치하는 리스트를 탐색
const _findAncestorListByMarker = (startList, rootList, markerType) => {
    let el = startList.parentElement;
    while (el && el !== rootList) {
        if (el.tagName === 'LI') {
            const parent = el.parentElement;
            if (!parent || (parent.tagName !== 'UL' && parent.tagName !== 'OL')) break;
            const firstLi = Array.from(parent.children).find(c => c.tagName === 'LI');
            if (firstLi && _detectMarkerType(firstLi.textContent) === markerType) return parent;
            el = parent.parentElement;
        } else {
            el = el.parentElement;
        }
    }
    return null;
};

export const cleanTableHtml = (htmlString, config, colWidths = '') => {
    if (typeof window === 'undefined' || !document || !htmlString) return htmlString || '';

    const processText = config.isColorMode ? processTextContentColor : processTextContentNormal;
    const processTable = config.tableIsColorMode ? processTableOnlyColor : processTableOnlyNormal;

    const parser = getDOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const resultWrapper = document.createElement('div');
    let currentTextGroup = document.createElement('div');
    let currentTableGroup = document.createElement('div');

    const flushTextGroup = () => {
        if (currentTextGroup.childNodes.length > 0) {
            processText(currentTextGroup, config);
            while (currentTextGroup.firstChild) {
                resultWrapper.appendChild(currentTextGroup.firstChild);
            }
        }
    };

    const flushTableGroup = () => {
        if (currentTableGroup.childNodes.length > 0) {
            const tableConfigs = Array.from(currentTableGroup.children).map(el => ({
                lCfg: el.getAttribute('data-local-config'),
                lCw: el.getAttribute('data-local-colwidths'),
            }));

            // DOM 노드를 직접 전달해 innerHTML 직렬화 → parseFromString 왕복을 제거
            const processedDiv = processTable(currentTableGroup, config, colWidths);

            Array.from(processedDiv.children).forEach((child, i) => {
                const cfg = tableConfigs[i];
                if (cfg && cfg.lCfg) {
                    child.setAttribute('data-local-config', cfg.lCfg);
                    if (cfg.lCw) child.setAttribute('data-local-colwidths', cfg.lCw);
                }
            });

            Array.from(processedDiv.childNodes).forEach(child => {
                resultWrapper.appendChild(child);
            });
            currentTableGroup.innerHTML = '';
        }
    };

        const isMeaninglessNode = (n) => {
            const isEmpty = (t) => t.replace(RE_WHITESPACE, "") === "";
            if (n.nodeType === 3 && isEmpty(n.textContent)) return true;
            if (n.nodeType === 1) {
                if (n.tagName === 'BR') return true;
                if ((n.tagName === 'P' || n.tagName === 'DIV' || n.tagName === 'SPAN') && isEmpty(n.textContent) && n.querySelectorAll('img, iframe, table').length === 0) return true;
            }
            return false;
        };
        Array.from(doc.body.childNodes).forEach(node => {
            if (node.nodeType === 1 && (node.tagName === 'TABLE' || node.querySelector('table'))) {
                flushTextGroup();

                const tableEl = node.tagName === 'TABLE' ? node : node.querySelector('table');

                // 테이블이 node의 직접/1단계 자식인 단순 래퍼인지 확인
                // (예: <div class="tbl_st"><table> 또는 <table>)
                // 아닌 경우: <div><ul><li><div><table> 같은 복잡한 중첩 구조
                const isSimpleWrapper = node.tagName === 'TABLE' ||
                    tableEl.parentElement === node ||
                    (tableEl.parentElement?.tagName === 'DIV' && tableEl.parentElement?.parentElement === node);

                if (!isSimpleWrapper) {
                    // 복잡한 중첩 구조: 전체 노드를 그대로 table 그룹에 넣어
                    // processTableOnlyBase가 내부 모든 td/th에 traverseAndClean을 적용하게 함
                    // (style="text-align:left" → al 변환 포함, 두 번째 테이블도 보존)
                    currentTableGroup.appendChild(node.cloneNode(true));
                    return;
                }

                const lCfgFromNode = node.getAttribute?.('data-local-config') || null;
                const lCwFromNode = node.getAttribute?.('data-local-colwidths') || null;
                const tableParent = node.tagName === 'TABLE' ? null : tableEl.parentElement;
                const tablesToProcess = tableParent
                    ? Array.from(tableParent.children).filter(c => c.tagName === 'TABLE')
                    : [tableEl];

                tablesToProcess.forEach(t => {
                    const lCfg = lCfgFromNode || t.getAttribute('data-local-config');
                    const lCw = lCwFromNode || t.getAttribute('data-local-colwidths');
                    const tdCount = t.querySelectorAll('td, th').length;

                    if (tdCount <= 1) {
                        flushTableGroup();
                        const boxDiv = document.createElement('div');
                        boxDiv.className = 'box_st2';
                        const cell = t.querySelector('td, th');
                        if (cell) { while (cell.firstChild) boxDiv.appendChild(cell.firstChild); }
                        else { boxDiv.innerHTML = t.innerHTML; }
                        processText(boxDiv, config);
                        resultWrapper.appendChild(boxDiv);
                    } else {
                        const clonedTable = t.cloneNode(true);
                        if (lCfg) clonedTable.setAttribute('data-local-config', lCfg);
                        if (lCw) clonedTable.setAttribute('data-local-colwidths', lCw);
                        currentTableGroup.appendChild(clonedTable);
                    }
                });
            } else {
                if (isMeaninglessNode(node) && currentTableGroup.childNodes.length > 0 && !node.classList?.contains('box-st') && !node.classList?.contains('box_st2')) {
                    return;
                }
                
                flushTableGroup();

                if (node.nodeType === 1 && (node.classList?.contains('box-st') || node.classList?.contains('box_st2'))) {
                    flushTextGroup();
                    resultWrapper.appendChild(node.cloneNode(true));
                    return;
                }

                currentTextGroup.appendChild(node.cloneNode(true));
            }
        });

        flushTextGroup();
        flushTableGroup();

        // 리스트와 리스트 사이에 끼인 테이블을 올바른 li 위치로 이동하고,
        // 분리된 다음 리스트 항목들을 마커 타입 기반으로 올바른 계층에 병합
        (() => {
            let changed = true;
            let _iterations = 0;
            while (changed && _iterations < 20) {
                changed = false;
                _iterations++;
                const children = Array.from(resultWrapper.children);
                for (let i = 0; i < children.length; i++) {
                    const listA = children[i];
                    if (listA.tagName !== 'OL' && listA.tagName !== 'UL') continue;

                    // 다음 테이블 탐색 (의미없는 노드는 건너뜀)
                    let tableIdx = -1;
                    for (let j = i + 1; j < children.length; j++) {
                        const el = children[j];
                        if (el.tagName === 'TABLE' || (el.nodeType === 1 && el.querySelector && el.querySelector('table'))) {
                            tableIdx = j; break;
                        }
                        if (el.textContent.replace(RE_WHITESPACE, '') !== '') break;
                    }
                    if (tableIdx === -1) continue;

                    const tableEl = children[tableIdx];
                    const deepestList = _getDeepestOpenList(listA);
                    const deepLis = Array.from(deepestList.children).filter(c => c.tagName === 'LI');
                    const lastLi = deepLis[deepLis.length - 1];
                    if (!lastLi) continue;

                    lastLi.appendChild(tableEl); // 테이블을 마지막 li 내부로 이동

                    // 테이블 다음에 오는 리스트 처리 (tableIdx 위치가 당겨졌으므로 재조회)
                    const updated = Array.from(resultWrapper.children);
                    let afterIdx = tableIdx;
                    // bu_atte 등 비리스트·비테이블 요소는 lastLi로 이동해 컨텍스트를 연결
                    // 단, 법령 섹션 제목(제N조/장/편 등) 또는 heading 태그는 새 섹션 시작이므로 중단
                    while (afterIdx < updated.length) {
                        const el = updated[afterIdx];
                        if (!el || el.tagName === 'OL' || el.tagName === 'UL' || el.tagName === 'TABLE') break;
                        if (/^h[1-6]$/i.test(el.tagName)) break;
                        const elText = (el.textContent || '').replace(/[\s​-‍﻿\xA0]/g, '');
                        if (/^제\d+[장편조관절항호]/.test(elText)) break;
                        lastLi.appendChild(el);
                        afterIdx++;
                    }
                    const afterEl = updated[afterIdx];
                    if (afterEl && (afterEl.tagName === 'OL' || afterEl.tagName === 'UL')) {
                        const firstLiOfB = Array.from(afterEl.children).find(c => c.tagName === 'LI');
                        const bMarker = _detectMarkerType((firstLiOfB || {}).textContent || '');
                        const deepLastMarker = _detectMarkerType((deepLis[deepLis.length - 1] || {}).textContent || '');

                        let target = null;
                        if (bMarker && bMarker === deepLastMarker) {
                            target = deepestList; // 같은 마커 타입 → 최하위 리스트에 병합
                        } else if (bMarker) {
                            target = _findAncestorListByMarker(deepestList, listA, bMarker); // 조상 탐색
                        }
                        if (!target) target = listA; // fallback

                        Array.from(afterEl.children).forEach(li => target.appendChild(li));
                        afterEl.remove();
                    }

                    changed = true;
                    break;
                }
            }
        })();

        resultWrapper.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6').forEach(el => {
            if (el.classList?.contains('box-st') || el.classList?.contains('box_st2')) return;
            const text = el.textContent.replace(RE_WHITESPACE, '').trim();
            if (text === '' && el.querySelectorAll('img, table, iframe').length === 0) {
                el.remove();
            }
        });

        _processLinks(resultWrapper);

    // ul, ol, li 빈 공간 잔여물 처리
    resultWrapper.querySelectorAll('ul, ol').forEach(list => {
        let prev = list.previousSibling;
        while (prev) {
            if (prev.nodeType === 3 && prev.textContent.replace(RE_WHITESPACE, '') === '') {
                const toRemove = prev;
                prev = prev.previousSibling;
                toRemove.remove();
            } else if (prev.nodeType === 1 && prev.tagName === 'BR') {
                const toRemove = prev;
                prev = prev.previousSibling;
                toRemove.remove();
            } else {
                break;
            }
        }
    });

        resultWrapper.querySelectorAll('li').forEach(li => {
            let last = li.lastChild;
            while (last) {
                if (last.nodeType === 3 && last.textContent.replace(RE_WHITESPACE, '') === '') {
                    const toRemove = last;
                    last = last.previousSibling;
                    toRemove.remove();
                } else if (last.nodeType === 1 && last.tagName === 'BR') {
                    const toRemove = last;
                    last = last.previousSibling;
                    toRemove.remove();
                } else {
                    break;
                }
            }
        });

       resultWrapper.querySelectorAll('td, th').forEach(cell => {
            const text = cell.textContent.replace(RE_WHITESPACE, '');
            if (text === '' && cell.querySelectorAll('img, iframe, table').length === 0) {
                cell.innerHTML = '';
            }
        });
        const lastChild = resultWrapper.lastElementChild;
    if (lastChild && lastChild.tagName === 'P' && lastChild.innerHTML.replace(/\s/g, '') === '<br>') {
        lastChild.remove();
    }

    // ol li > span.num 내 원형 특수문자(① ② ③ 등)를 아라비아 숫자로 변환
    resultWrapper.querySelectorAll('ol li span.mrk').forEach(span => {
        const original = span.textContent.trim();
        const converted = convertCircleToArabic(original);
        if (converted !== original) span.textContent = converted;
    });

    return resultWrapper.innerHTML;
};


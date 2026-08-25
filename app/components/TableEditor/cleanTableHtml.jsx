
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
 *        - td/th 1개 이하인 테이블 → config.boxClassName(기본값 'box_st2') div로 변환(단순 텍스트 박스 취급)
 *        - td/th 2개 이상 → tableGroup 버퍼에 축적 후 processTableOnly 일괄 처리
 *     2. flushTextGroup: 누적된 텍스트 블록을 processTextContent로 처리 후 결과에 병합
 *     3. flushTableGroup: 누적된 테이블 블록을 processTableOnly로 처리 후 결과에 병합
 *        - 처리 전 data-local-config / data-local-colwidths 속성을 미리 저장했다가 복원
 *     4. 리스트-테이블 재배치: 리스트(ul/ol) 사이에 끼인 테이블을 마지막 li 내부로 이동,
 *        분리된 다음 리스트 항목을 마커 타입 기반으로 올바른 계층에 병합
 *     5. 빈 요소 제거: p/div/span, li, td/th 내 빈 노드를 일괄 삭제
 *     6. _processLinks: plain text URL을 <a class="{linkClassName}"> 링크로 변환,
 *        file:// · # 등 유효하지 않은 href 태그는 제거. linkClassName은 텍스트/표 공통 적용.
 *     7. 원형 특수문자 변환: ol li > span.{numClassName|tableNumClassName} 내 ①②③ → 아라비아 숫자로 변환
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
import { applyNestedClassesHelper } from './utils/listExtractors';
import { convertCircleToArabic, MARKER_TYPES, EXCLUDE_MARKER_REGEXES, RE_WHITESPACE, PLACEHOLDER_IMAGE_SRC } from './utils/constants';

export { updateStylesOnly } from './utils/styleUpdater';

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+|[a-zA-Z0-9.-]+\.(?:com|net|org|kr|io|info|biz|co|go|or|ac|re)(?:\/[^\s<]*)?/ig;

// 문장부호 없이 URL 뒤에 바로 붙는 한글이 "조사"인 경우만 잘라내기 위한 목록(완전한 조사
// 목록은 아니고 실무에서 자주 쓰이는 것 위주). 문장부호 없이 그냥 한글로 끝나는 URL(예:
// 네이버 블로그 슬러그처럼 실제 경로가 한글인 경우)과 구분하기 위해, 문장부호가 전혀
// 섞이지 않은 순수 한글 꼬리는 이 목록에 정확히 일치할 때만 잘라낸다.
const KOREAN_PARTICLE_RE = /^(?:이라고|하고|이며|처럼|같이|보다|부터|까지|마저|조차|밖에|대로|에서는|에게는|한테는|이라는|라는|에서|에게|한테|으로|께서|이나|와는|과는|에는|로는|와|과|은|는|이|가|을|를|도|만|로|의|에|나|며|고|께)$/;

// <a> 태그 정규화 및 plain-text URL → 링크 변환. linkClassName은 텍스트/표 공통 클래스다.
const _processLinks = (container, config) => {
    const linkClass = (config.linkClassName && config.linkClassName.trim()) || 'bu_link';

    container.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        const text = a.textContent.trim();
        if (text === '' && a.querySelectorAll('img, table, iframe').length === 0) { a.remove(); return; }
        if (!href || href.startsWith('file://') || href.startsWith('#') || href.trim() === '') { a.replaceWith(...a.childNodes); return; }
        a.classList.add(linkClass);
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

            // 1) 괄호/대괄호 균형 검사: "(https://example.com/a_(b))을" 처럼 URL 안에 정상적으로
            //    짝지어진 괄호는 보존하고, "(https://example.com)을"처럼 문장이 URL을 감싸느라
            //    생긴 짝 없는 닫는 괄호가 나오면 그 앞에서 잘라낸다.
            let openParen = 0, openBracket = 0, cutAt = -1;
            for (let ci = 0; ci < rawUrl.length; ci++) {
                const c = rawUrl[ci];
                if (c === '(') openParen++;
                else if (c === '[') openBracket++;
                else if (c === ')') { if (openParen > 0) openParen--; else { cutAt = ci; break; } }
                else if (c === ']') { if (openBracket > 0) openBracket--; else { cutAt = ci; break; } }
            }
            if (cutAt !== -1) rawUrl = rawUrl.slice(0, cutAt);

            // 2) 남은 꼬리의 문장부호(+그 뒤에 바로 붙는 한글)를 잘라낸다. 문장부호가 섞여 있으면
            //    문장이 URL을 감싸다 생긴 꼬리가 확실하므로 통째로 제거하고, 문장부호 없이 한글만
            //    남았다면 "실제 조사"일 때만 제거한다(네이버 블로그 슬러그처럼 경로 자체가 한글로
            //    끝나는 정상 URL과 구분하기 위함).
            let actualUrl = rawUrl;
            const trailingRun = rawUrl.match(/[.,:;"'가-힣ㄱ-ㅎㅏ-ㅣ]+$/);
            if (trailingRun) {
                const run = trailingRun[0];
                if (/[.,:;"']/.test(run) || KOREAN_PARTICLE_RE.test(run)) actualUrl = rawUrl.slice(0, -run.length);
            }

            // 괄호 정리 등으로 스킴/www.만 남고 실제 주소가 없어진 경우 깨진 링크를 만들지 않는다.
            if (!actualUrl || /^(?:https?:\/\/|www\.)$/i.test(actualUrl)) continue;

            const matchEndIndex = match.index + actualUrl.length;
            if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            const a = document.createElement('a');
            a.href = /^https?:\/\//i.test(actualUrl) ? actualUrl : `http://${actualUrl}`;
            a.className = linkClass;
            a.target = '_blank';
            a.textContent = actualUrl;
            fragment.appendChild(a);
            lastIndex = matchEndIndex;
            if (actualUrl.length < match[0].length) URL_REGEX.lastIndex = matchEndIndex;
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

// wrapperLis(번호 없는 래퍼 li들, 예: "행정안전부...") 안에 번호형 하위 리스트가 숨어 있으면
// 그 항목들을 promoteTarget이 찾아주는 리스트로 승격시키고, 남은 래퍼 li들은 새 하위 리스트로
// 감싸 anchorLi(예: 테이블이 있던 li) 안에 중첩시킨다. 표가 리스트 흐름을 끊어 마커 컨텍스트가
// 리셋되면서 "행정안전부"류 비번호 항목이 통째로 형제 li가 되어버리고, 그 안의 번호(2,3,4...)가
// 한 단계 깊이 갇히는 문제를 바로잡는다. 승격 대상이 없으면 false를 반환해 호출부가 기존 동작
// (그대로 두기)을 유지하게 한다.
const _extractPromotableAndNest = (wrapperLis, wrapperTagName, anchorLi, baseListClassName, promoteTarget) => {
    const toPromote = [];
    wrapperLis.forEach(li => {
        Array.from(li.children)
            .filter(c => c.tagName === 'OL' || c.tagName === 'UL')
            .forEach(sub => {
                const firstSubLi = Array.from(sub.children).find(c => c.tagName === 'LI');
                const subMarker = firstSubLi && _detectMarkerType(firstSubLi.textContent || '');
                if (!subMarker) return;
                const toExtract = Array.from(sub.children)
                    .filter(c => c.tagName === 'LI' && _detectMarkerType(c.textContent || '') === subMarker);
                if (!toExtract.length) return;
                toExtract.forEach(item => { sub.removeChild(item); toPromote.push({ item, subMarker }); });
                if (!sub.querySelector('li')) sub.remove();
            });
    });
    if (!toPromote.length) return false;

    // 래퍼 li들을 감쌀 새 하위 리스트 클래스: list_st1 → list_st2 (deepestList 기준 한 단계 아래)
    const cm = (baseListClassName || '').match(/^(.*?)(\d+)$/);
    const wrapClass = cm ? `${cm[1]}${parseInt(cm[2], 10) + 1}` : (baseListClassName || '');
    const wrapList = document.createElement(wrapperTagName);
    if (wrapClass) wrapList.className = wrapClass;
    wrapperLis.forEach(li => wrapList.appendChild(li));
    anchorLi.appendChild(wrapList);

    toPromote.forEach(({ item, subMarker }) => promoteTarget(subMarker).appendChild(item));
    return true;
};

const isMeaninglessNode = (n) => {
    const isEmpty = (t) => t.replace(RE_WHITESPACE, '') === '';
    if (n.nodeType === 3 && isEmpty(n.textContent)) return true;
    if (n.nodeType === 1) {
        if (n.tagName === 'BR') return true;
        if ((n.tagName === 'P' || n.tagName === 'DIV' || n.tagName === 'SPAN') && isEmpty(n.textContent) && n.querySelectorAll('img, iframe, table').length === 0) return true;
    }
    return false;
};

export const cleanTableHtml = (htmlString, config, colWidths = '') => {
    if (typeof window === 'undefined' || !document || !htmlString) return htmlString || '';
    const processText = config.isColorMode ? processTextContentColor : processTextContentNormal;
    const processTable = config.tableIsColorMode ? processTableOnlyColor : processTableOnlyNormal;
    // 셀 1개짜리 표를 텍스트 박스로 변환할 때 적용할 클래스 (기본값: 'box_st2')
    const boxClass = (config.boxClassName && config.boxClassName.trim()) || 'box_st2';

    const parser = getDOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 문서 전체가 래퍼 div 하나로만 감싸져 있으면(예: 원본 페이지의 <div id="content">에
    // 문서 전체(제목/여러 표/리스트 등)를 통째로 붙여넣은 경우), 아래 최상위 순회 루프는
    // doc.body의 자식이 이 래퍼 하나뿐이라고 인식한다. 그 래퍼 안에 표가 하나라도 있으면
    // "표 1개짜리 단순 wrapper"로 오인해, 래퍼 안의 나머지 모든 형제 콘텐츠(다른 제목/표/
    // 리스트)를 전부 누락시켜버리는 심각한 버그가 있었다. 래퍼가 실제로는 의미 있는 자식을
    // 2개 이상 담고 있다면(= 단순 표 wrapper가 아니라 문서 전체의 컨테이너라면), 그 자식들을
    // doc.body의 최상위로 끌어올려(펼쳐) 각각 원래 의도대로 독립적인 최상위 블록으로 분류되게 한다.
    while (doc.body.children.length === 1 && doc.body.children[0].tagName === 'DIV') {
        const onlyChild = doc.body.children[0];
        const meaningfulChildren = Array.from(onlyChild.children).filter(c => !isMeaninglessNode(c));
        if (meaningfulChildren.length <= 1) break;
        while (onlyChild.firstChild) doc.body.appendChild(onlyChild.firstChild);
        onlyChild.remove();
    }

    // 표가 사이에 끼면 아래 순회 루프가 텍스트를 표 단위로 끊어(flushTextGroup) 처리하므로,
    // "1. 제목" 뒤에 표가 바로 이어지는 문서에서는 processCellContent가 한 번에 보는 범위 안에
    // "2.", "3." 같은 형제를 절대 찾을 수 없다(항상 혼자인 것처럼 보임). 문서 전체(표로 끊긴
    // 절 제목 포함) 기준으로 decimal-dot 마커가 2개 이상이면 번호가 이어지는 시리즈로 보고,
    // 표에 끊긴 짧은 단독 제목도 다른 형제들과 동일하게 목록으로 변환되도록 신호를 내려보낸다.
    const decimalDotCount = Array.from(doc.body.childNodes).filter(node => {
        if (node.nodeType !== 1) return false;
        if (node.tagName === 'TABLE' || node.querySelector?.('table')) return false;
        return _detectMarkerType(node.textContent || '') === 'decimal-dot';
    }).length;
    if (decimalDotCount >= 2) config = { ...config, hasDecimalDotSeries: true };

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
                if (cfg) {
                    if (cfg.lCfg) child.setAttribute('data-local-config', cfg.lCfg);
                    if (cfg.lCw) child.setAttribute('data-local-colwidths', cfg.lCw);
                }
            });

            Array.from(processedDiv.childNodes).forEach(child => {
                resultWrapper.appendChild(child);
            });
            currentTableGroup.innerHTML = '';
        }
    };

        Array.from(doc.body.childNodes).forEach(node => {
            const isTableNode = node.nodeType === 1 && node.tagName === 'TABLE';
            // node.querySelector('table')를 아래에서 또 호출하지 않도록 한 번만 계산해 재사용한다.
            const nestedTable = (node.nodeType === 1 && !isTableNode) ? node.querySelector('table') : null;
            if (node.nodeType === 1 && (isTableNode || nestedTable)) {
                flushTextGroup();

                const tableEl = isTableNode ? node : nestedTable;

                // 테이블이 node의 직접/1단계 자식인 단순 래퍼인지 확인
                // (예: <div class="tbl_st"><table> 또는 <table>)
                // 아닌 경우: <div><ul><li><div><table> 같은 복잡한 중첩 구조,
                // 또는 표의 부모(혹은 그 조상인 node 자신) 안에 캡션 문단·제목 등 다른 요소가
                // 함께 있는 경우 (단순 래퍼로 취급하면 아래 tablesToProcess가 TABLE만 골라내
                // 그 외 요소가 소실되므로, 그런 경우는 복잡 구조 경로로 보내 node 전체를 보존한다)
                const tableParentForCheck = node.tagName === 'TABLE' ? null : tableEl.parentElement;
                const hasNonTableSibling = !!tableParentForCheck &&
                    Array.from(tableParentForCheck.children).some(c => c.tagName !== 'TABLE');
                const isDirectWrapper = tableEl.parentElement === node;
                // 이중 래퍼(<div><div class="tbl_st"><table></div></div>) 조건은 표의 부모→조부모
                // 관계만 확인하고, node 자신이 그 중간 래퍼 div 하나 말고 다른 형제(예: 두 번째 표,
                // 별도의 h4 제목)를 더 가지고 있는지는 확인하지 않았다. 그래서 box_st2처럼 여러
                // 표/제목을 담은 컨테이너가 재정리 시 "표 1개짜리 이중 래퍼"로 오인되어 나머지
                // 형제 전체가 사라지는 버그가 있었다 — node 자신도 자식이 1개(그 중간 래퍼)뿐일 때만
                // 이중 래퍼로 인정한다.
                const isDoubleWrapper = tableEl.parentElement?.tagName === 'DIV' &&
                    tableEl.parentElement?.parentElement === node &&
                    node.children.length === 1;
                const isSimpleWrapper = (node.tagName === 'TABLE' || isDirectWrapper || isDoubleWrapper) &&
                    !hasNonTableSibling;

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
                    const tdCells = t.querySelectorAll('td, th');

                    if (tdCells.length <= 1) {
                        flushTableGroup();
                        const cell = tdCells[0];
                        const hasImage = !!cell && cell.querySelectorAll('img').length >= 1;
                        // 셀이 정확히 1개고 그 안에 이미지 하나만 있는 표(텍스트/다른 요소 없음)는
                        // 순수 이미지 박스로 치환한다. 실제 경로는 나중에 수작업으로 채울 예정이라
                        // 더미(자리표시자) 이미지를 넣는다.
                        const isImageOnlyCell = hasImage && tdCells.length === 1 &&
                            cell.querySelectorAll('img').length === 1 &&
                            cell.querySelectorAll('*').length === 1 &&
                            cell.textContent.replace(RE_WHITESPACE, '') === '';
                        // 이미지와 텍스트(또는 다른 요소)가 함께 있으면 원본 이미지는 그대로 두되,
                        // <p class="rsp_img ac"><img></p>로 따로 감싸 맨 앞에 배치하고 나머지
                        // 내용(텍스트 등)은 그 뒤에 그대로 붙인다. 바깥 div는 boxClass만 유지.
                        const isImageWithOther = hasImage && !isImageOnlyCell;

                        if (isImageOnlyCell) {
                            const imgBoxDiv = document.createElement('div');
                            imgBoxDiv.className = 'rsp_img ac';
                            const img = document.createElement('img');
                            img.src = PLACEHOLDER_IMAGE_SRC;
                            img.alt = '';
                            imgBoxDiv.appendChild(img);
                            resultWrapper.appendChild(imgBoxDiv);
                        } else {
                            const boxDiv = document.createElement('div');
                            boxDiv.className = boxClass;
                            if (cell) {
                                if (isImageWithOther) {
                                    Array.from(cell.querySelectorAll('img')).forEach(img => {
                                        img.alt = '';
                                        const imgWrap = document.createElement('p');
                                        imgWrap.className = 'rsp_img ac';
                                        imgWrap.appendChild(img); // 원래 위치에서 옮겨져 이 p로 감싸짐
                                        boxDiv.appendChild(imgWrap);
                                    });
                                }
                                while (cell.firstChild) boxDiv.appendChild(cell.firstChild);
                            }
                            else { boxDiv.innerHTML = t.innerHTML; }
                            processText(boxDiv, config);
                            resultWrapper.appendChild(boxDiv);
                        }
                    } else {
                        const clonedTable = t.cloneNode(true);
                        if (lCfg) clonedTable.setAttribute('data-local-config', lCfg);
                        if (lCw) clonedTable.setAttribute('data-local-colwidths', lCw);
                        currentTableGroup.appendChild(clonedTable);
                    }
                });
            } else {
                if (isMeaninglessNode(node) && currentTableGroup.childNodes.length > 0 && !node.classList?.contains(boxClass)) {
                    return;
                }

                flushTableGroup();

                if (node.nodeType === 1 && node.classList?.contains(boxClass)) {
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
            let children = Array.from(resultWrapper.children);
            let _iterations = 0;
            while (_iterations < 20) {
                let changed = false;
                _iterations++;
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

                    // tableEl이 DOM에서 빠지면서 children[tableIdx+1]이 updated[tableIdx]와 동일해짐
                    // → updated 재조회 없이 stale children에서 afterIdx = tableIdx + 1로 접근
                    let afterIdx = tableIdx + 1;
                    // bu_atte 등 비리스트·비테이블 요소는 lastLi로 이동해 컨텍스트를 연결
                    // 단, 법령 섹션 제목(제N조/장/편 등) 또는 heading 태그는 새 섹션 시작이므로 중단
                    while (afterIdx < children.length) {
                        const el = children[afterIdx];
                        if (!el || el.tagName === 'OL' || el.tagName === 'UL' || el.tagName === 'TABLE') break;
                        if (/^h[1-6]$/i.test(el.tagName)) break;
                        const elText = (el.textContent || '').replace(/[\s​-‍﻿\xA0]/g, '');
                        if (/^제\d+[장편조관절항호]/.test(elText)) break;
                        lastLi.appendChild(el);
                        afterIdx++;
                    }
                    const afterEl = children[afterIdx];
                    if (afterEl && (afterEl.tagName === 'OL' || afterEl.tagName === 'UL')) {
                        const firstLiOfB = Array.from(afterEl.children).find(c => c.tagName === 'LI');
                        const bMarker = _detectMarkerType((firstLiOfB || {}).textContent || '');
                        const deepLastMarker = _detectMarkerType((deepLis[deepLis.length - 1] || {}).textContent || '');
                        const findPromoteTarget = (markerType) => (markerType === deepLastMarker
                            ? deepestList
                            : (_findAncestorListByMarker(deepestList, listA, markerType) || listA));

                        if (bMarker) {
                            // afterEl의 첫 li가 직접 번호형 마커 → 같은 타입이면 최하위 리스트에, 다르면 조상 탐색
                            const target = findPromoteTarget(bMarker);
                            Array.from(afterEl.children).forEach(li => target.appendChild(li));
                            afterEl.remove();
                        } else {
                            // afterEl의 첫 li가 번호 없는 래퍼(예: "행정안전부...")인 경우:
                            // 표 때문에 마커 컨텍스트가 끊겨 내부의 번호형 항목(2,3,4...)이 이 래퍼 밑에
                            // 갇혀버린 상태일 수 있으므로, 있으면 승격시키고 래퍼는 lastLi(표가 있던 li)
                            // 안에 중첩시킨다. 승격할 게 없으면(정말 단순한 비번호 항목) 그대로 둔다.
                            const bArr = Array.from(afterEl.children).filter(c => c.tagName === 'LI');
                            const promoted = _extractPromotableAndNest(bArr, afterEl.tagName, lastLi, listA.className, findPromoteTarget);
                            if (promoted) afterEl.remove();
                        }
                    }

                    children = Array.from(resultWrapper.children); // 변경 후 갱신
                    changed = true;
                    break;
                }
                if (!changed) break;
            }
        })();

        // 분리된 번호형 리스트 병합
        // 패턴: listA(번호형 li) + 중간 p 등 + listB(비번호 li가 번호형 sub-li를 포함)
        // → 중간 요소와 비번호 li를 listA 마지막 li 내부로 이동, 번호형 sub-li를 listA 레벨로 승격
        (() => {
            let children = Array.from(resultWrapper.children);
            let _iterations = 0;
            while (_iterations < 20) {
                let changed = false;
                _iterations++;
                for (let i = 0; i < children.length; i++) {
                    const listA = children[i];
                    if (listA.tagName !== 'OL' && listA.tagName !== 'UL') continue;
                    const lisA = Array.from(listA.children).filter(c => c.tagName === 'LI');
                    if (!lisA.length) continue;
                    const markerA = _detectMarkerType(lisA[0].textContent || '');
                    if (!markerA) continue;

                    // listA 이후 비리스트·비테이블 요소 수집 후 다음 리스트 탐색
                    // heading 태그나 법령 섹션 제목(제N조/장 등)은 새 섹션의 시작이므로 병합 대상에서 제외
                    const betweenEls = [];
                    let nextListIdx = -1;
                    for (let j = i + 1; j < children.length; j++) {
                        const el = children[j];
                        if (el.tagName === 'OL' || el.tagName === 'UL') { nextListIdx = j; break; }
                        if (el.tagName === 'TABLE' || (el.nodeType === 1 && el.querySelector?.('table'))) break;
                        if (/^h[1-6]$/i.test(el.tagName)) break;
                        const elText = (el.textContent || '').replace(RE_WHITESPACE, '');
                        if (/^제\d+[장편조관절항호]/.test(elText)) break;
                        betweenEls.push(el);
                    }
                    if (nextListIdx === -1 || betweenEls.length === 0) continue;

                    const listB = children[nextListIdx];
                    const lisBArr = Array.from(listB.children).filter(c => c.tagName === 'LI');
                    if (!lisBArr.length) continue;

                    // listB 내에 markerA와 같은 번호형 li(직접 또는 비번호 li의 sub-li)가 있는지 확인
                    const hasPromotable = lisBArr.some(li => {
                        if (_detectMarkerType(li.textContent || '') === markerA) return true;
                        return Array.from(li.children)
                            .filter(c => c.tagName === 'OL' || c.tagName === 'UL')
                            .some(sub => {
                                const firstLi = Array.from(sub.children).find(c => c.tagName === 'LI');
                                return firstLi && _detectMarkerType(firstLi.textContent || '') === markerA;
                            });
                    });
                    if (!hasPromotable) continue;

                    const lastLiA = lisA[lisA.length - 1];
                    // 중간 요소를 마지막 li로 이동
                    betweenEls.forEach(el => lastLiA.appendChild(el));

                    // sub-list 클래스 결정 (list_st1 → list_st2)
                    const cm = (listA.className || '').match(/^(.*?)(\d+)$/);
                    const subListClass = cm ? `${cm[1]}${parseInt(cm[2]) + 1}` : (listA.className || '');

                    const toPromote = [];
                    lisBArr.forEach(li => {
                        if (_detectMarkerType(li.textContent || '') === markerA) {
                            toPromote.push(li); return;
                        }
                        // 비번호 li: 내부 번호형 sub-li 추출 후 비번호 li는 sub-list로
                        Array.from(li.children)
                            .filter(c => c.tagName === 'OL' || c.tagName === 'UL')
                            .forEach(sub => {
                                const toExtract = Array.from(sub.children)
                                    .filter(c => c.tagName === 'LI' && _detectMarkerType(c.textContent || '') === markerA);
                                toExtract.forEach(item => { sub.removeChild(item); toPromote.push(item); });
                                if (!sub.querySelector('li')) sub.remove();
                            });
                        const subList = document.createElement(listA.tagName);
                        subList.className = subListClass;
                        subList.appendChild(li);
                        lastLiA.appendChild(subList);
                    });
                    toPromote.forEach(li => listA.appendChild(li));
                    listB.remove();
                    children = Array.from(resultWrapper.children); // 변경 후 갱신
                    changed = true;
                    break;
                }
                if (!changed) break;
            }
        })();

        // 위 두 재배치 패스가 리스트 항목을 다른 깊이로 옮긴 뒤에도, 옮겨진 li가 원래 속했던
        // (표 때문에 끊겼던) 처리 단위에서 계산된 list_stN 클래스를 그대로 들고 있을 수 있다.
        // 최종 구조를 기준으로 depth를 다시 계산해 resultWrapper 바로 아래 리스트들의
        // list_stN 클래스를 새로 매긴다(표 셀 내부 리스트는 resultWrapper의 직계 자식이 아니므로
        // 영향받지 않는다).
        if (Array.from(resultWrapper.children).some(c => c.tagName === 'UL' || c.tagName === 'OL')) {
            applyNestedClassesHelper(resultWrapper, config.ulClassName, config.listStartFrom2 ? 1 : 0, config.olClassName);
        }

        resultWrapper.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6').forEach(el => {
            if (el.classList?.contains(boxClass)) return;
            const text = el.textContent.replace(RE_WHITESPACE, '').trim();
            if (text === '' && el.querySelectorAll('img, table, iframe').length === 0) {
                el.remove();
            }
        });

        _processLinks(resultWrapper, config);

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

    // ol li > span.{numClass} 내 원형 특수문자(① ② ③ 등)를 아라비아 숫자로 변환
    // 텍스트 블록(numClassName)과 테이블 블록(tableNumClassName)이 서로 다른 클래스명을 쓸 수 있으므로 둘 다 조회한다.
    const numClasses = Array.from(new Set([
        (config.numClassName && config.numClassName.trim()) || 'num',
        (config.tableNumClassName && config.tableNumClassName.trim()) || 'num',
    ]));
    // numClasses는 사용자가 설정 모달에 자유 입력한 클래스명을 포함하므로, 따옴표 등이 섞이면
    // 셀렉터 문법 오류로 전체 정리 파이프라인이 중단될 수 있어 방어한다.
    let numClassSpans = [];
    try {
        numClassSpans = Array.from(resultWrapper.querySelectorAll(numClasses.map(c => `ol li span.${c}`).join(',')));
    } catch (e) {}
    numClassSpans.forEach(span => {
        const original = span.textContent.trim();
        const converted = convertCircleToArabic(original);
        if (converted !== original) span.textContent = converted;
    });

    return resultWrapper.innerHTML;
};


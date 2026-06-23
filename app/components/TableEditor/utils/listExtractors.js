/*
 * [listExtractors.js] 텍스트 마커 감지 및 ul/ol 구조 변환 유틸리티
 *
 * 역할:
 *   - 셀/텍스트 블록의 각 행에서 리스트 마커를 감지해 ul/ol/li HTML로 변환한다.
 *   - textProcessor.js와 tableProcessor.js에서 processCellContent가 공통으로 호출된다.
 *
 * 주요 함수:
 *
 *   checkTitleMatch(text, titConfig) → matchedMarker | false
 *     - 텍스트가 tit1/tit2/tit3 설정(커스텀 문자열 또는 패턴 타입)과 일치하는지 확인.
 *     - 일치하면 매칭된 마커 문자열, 불일치면 false 반환.
 *
 *   applyNestedClassesHelper(cell, baseUlClassName, levelOffset)
 *     - cell 내 ul/ol을 깊이(depth)에 따라 list_st1, list_st2 … 형태의 클래스로 지정.
 *     - ol은 항상 'list_ol1', 'list_ol2' … 사용 (olBaseName='list_ol' 고정).
 *     - levelOffset: GlobalTableConfigModal의 '리스트 시작 2' 옵션 적용 시 1 전달.
 *
 *   processCellContent(cell, keepMarker, isOuterText, tit1, tit2, tit3, olType, noUl)
 *     - cell의 childNodes를 순회하며 마커 패턴에 따라 ul/ol/li로 구조화한다.
 *     - 처리 우선순위:
 *       1. H1~H6 태그 → 그대로 유지, 스택 초기화
 *       2. 법령 형식(제n장/편/조) 또는 tit 매칭 → p 태그로 감싸 컨텍스트 차단
 *       3. ※ 또는 * 시작 → p.bu_atte 로 변환 (keepMarker=false이면 기호 제거)
 *       4. 마커 패턴 감지(getMarkerInfo):
 *          - olType에 포함된 마커 → ol li (span.num에 아라비아 숫자 삽입)
 *          - 그 외 → ul li
 *          - noUl=true이면 ul 변환 대상은 p 태그로 유지
 *          - contextStack으로 동일 마커는 같은 리스트에, 다른 마커는 중첩 리스트로 처리
 *       5. 마커 없는 일반 텍스트 → 이전 li가 있으면 li 내부에 <br>로 이어 붙임,
 *          없으면 p 태그로 감싸 rootNodes에 추가
 *     - HWP 깨짐 문자(HWP_CHAR_MAP)를 sanitizeSpecialChars로 사전 치환.
 *
 *   processMsoLists(container)
 *     - Word에서 붙여넣을 때 생기는 mso-list 스타일 요소를 일반 마커 텍스트로 변환.
 *     - Phase 1: listId × level별 Ignore span 마커 문자 수집
 *     - Phase 2: 같은 리스트 내 모든 레벨이 동일 비숫자 마커면 레벨별 기본 마커로 교체
 *       (- , ▶ , ◆  순환)
 *     - Phase 3: Ignore span 제거 후 앞에 마커 텍스트 삽입
 *     - Phase 4: 잔여 Ignore span unwrap
 */

import { MARKER_TYPES, EXCLUDE_MARKER_REGEXES, HWP_CHAR_MAP, HWP_CHAR_REGEX, UL_NONE_VALUE, convertCircleToArabic } from './constants';
import { removeLeadingCharsFromDOM } from './htmlCleaners';


export const checkTitleMatch = (text, titConfig) => {
    if (!titConfig) return false;
    const safeText = text.trim();
    
    if (typeof titConfig === 'string') {
        if (titConfig.trim() !== '' && safeText.startsWith(titConfig.trim())) return titConfig.trim();
        return false;
    }
    
    const { type, val } = titConfig;
    if (type === 'custom' && val && val.trim() !== '') {
        if (safeText.startsWith(val.trim())) return val.trim();
    }
    
    let match;
    if (type === 'number-dot' && (match = safeText.match(/^\d{1,2}\./))) return match[0];
    if (type === 'number-paren' && (match = safeText.match(/^\d{1,2}\)/))) return match[0];
    if (type === 'circle' && (match = safeText.match(/^[\u2460-\u2473\u3251-\u325F]/))) return match[0];
    if (type === 'hangul-dot' && (match = safeText.match(/^[가-힣ㄱ-ㅎ]\./))) return match[0];
    if (type === 'hangul-paren' && (match = safeText.match(/^[가-힣ㄱ-ㅎ]\)/))) return match[0];

    if (type === 'law-chapter' && (match = safeText.match(/^제\s*\d+\s*[장편관]/))) return match[0];
    if (type === 'law-article' && (match = safeText.match(/^제\s*\d+\s*조/))) return match[0];
    if (type === 'roman' && (match = safeText.match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]|[IVX]+)\./i))) return match[0];
    
    return false;
};

export const applyNestedClassesHelper = (cell, baseUlClassName, levelOffset = 0) => {
    if (!cell) return;
    const ulBaseName = (baseUlClassName && baseUlClassName !== UL_NONE_VALUE && baseUlClassName.trim()) ? baseUlClassName.trim() : '';
    const olBaseName = 'order-st';

    const processNode = (node) => {
        const tagName = node.tagName.toLowerCase();
        if (tagName !== 'ul' && tagName !== 'ol') return;
        let level = 1;
        let parent = node.parentElement;
        while (parent && parent !== cell) {
            if (parent.tagName.toLowerCase() === tagName) level++;
            parent = parent.parentElement;
        }
        const baseName = (tagName === 'ul') ? ulBaseName : olBaseName;
        const effectiveLevel = (tagName === 'ul') ? level + levelOffset : level;
        if (baseName) {
            node.className = tagName === 'ul' ? `list ${baseName}${effectiveLevel}` : `${baseName}${effectiveLevel}`;
        } else {
            node.removeAttribute('class');
        }
        Array.from(node.children).forEach(li => {
            if (li.tagName === 'LI') {
                Array.from(li.children).forEach(child => {
                    if (child.tagName === 'UL' || child.tagName === 'OL') processNode(child);
                });
            }
        });
    };
    const rootLists = Array.from(cell.childNodes).filter(n => n.tagName === 'UL' || n.tagName === 'OL');
    rootLists.forEach(list => processNode(list));
};

export const processCellContent = (cell, keepMarker, isOuterText = false, tit1 = null, tit2 = null, tit3 = null, tit4 = null, olType = [], noUl = false, noAtte = false) => {
    
    const sanitizeSpecialChars = (text) => {
        if (!text) return text;
        return text.replace(HWP_CHAR_REGEX, (match) => HWP_CHAR_MAP[match] || match);
    };

    const getMarkerInfo = (text) => {
        if (isOuterText && (checkTitleMatch(text, tit1) || checkTitleMatch(text, tit2) || checkTitleMatch(text, tit3) || checkTitleMatch(text, tit4))) {
            return null;
        }
        const safeText = sanitizeSpecialChars(text);
        if (EXCLUDE_MARKER_REGEXES.some(regex => regex.test(safeText))) return null;

        for (const type in MARKER_TYPES) {
            const match = safeText.match(MARKER_TYPES[type]);
            if (match) {
                if (!safeText.substring(match[0].length).trim()) continue;
                return { type, regex: MARKER_TYPES[type], char: match[0].trim(), rawMarker: match[0].replace(/[.\s()]/g, '') };
            }
        }
        return null;
    };

    const childNodes = Array.from(cell.childNodes);
    const rootNodes = [];
    const contextStack = [];
    let lastLi = null;
    let lastPara = null;
    let lastBuAtte = null; 

    let openParenCount = 0;
    let openBracketCount = 0;

    const flushLastPara = () => {
        if (lastPara) {
            if (lastPara.innerHTML.trim() !== '' || lastPara.children.length > 0) rootNodes.push(lastPara);
            lastPara = null;
        }
    };

    for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        if (node.nodeType === 3 && !node.textContent.trim()) continue;
        if (node.nodeType === 1 && node.tagName !== 'BR' && !node.textContent.trim() && node.children.length === 0) continue;
        
        if (node.nodeType === 1 && /^H[1-6]$/i.test(node.tagName)) {
            flushLastPara();
            rootNodes.push(node);
            contextStack.length = 0;
            lastLi = null;
            lastBuAtte = null;
            continue;
        }

        if (node.nodeType === 1 && node.tagName === 'P' && node.classList.contains('bu_atte')) {
            flushLastPara();
            lastLi = null;
            contextStack.length = 0;
            lastBuAtte = node;
            rootNodes.push(node);
            continue;
        }

        if (node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'DIV' || node.tagName === 'BR')) {
            openParenCount = 0;
            openBracketCount = 0;
        }

        if (node.nodeType === 3 && node.nodeValue) {
            node.nodeValue = sanitizeSpecialChars(node.nodeValue);
        }
        
        const rawText = node.textContent || '';
        const cleanTextForBreak = rawText.replace(/[\s\u200B-\u200D\uFEFF\xA0]/g, ''); 
        const isTitleMatch = isOuterText && (checkTitleMatch(rawText, tit1) || checkTitleMatch(rawText, tit2) || checkTitleMatch(rawText, tit3));
        
        if (/^(제\d+[장편조관])/.test(cleanTextForBreak) || isTitleMatch) {
            flushLastPara();
            lastLi = null; 
            contextStack.length = 0; 
            lastBuAtte = null;
            
            const p = document.createElement('p');
            if (node.nodeType === 3) p.textContent = node.textContent;
            else Array.from(node.childNodes).forEach(child => p.appendChild(child.cloneNode(true)));
            
            rootNodes.push(p);
            continue;
        }

        const isInsideParen = openParenCount > 0 || openBracketCount > 0;

        const openP = (rawText.match(/\(/g) || []).length;
        const closeP = (rawText.match(/\)/g) || []).length;
        openParenCount = Math.max(0, openParenCount + openP - closeP);

        const openB = (rawText.match(/\[/g) || []).length;
        const closeB = (rawText.match(/\]/g) || []).length;
        openBracketCount = Math.max(0, openBracketCount + openB - closeB);


        const isBuAtte = cleanTextForBreak.startsWith('※') || cleanTextForBreak.startsWith('*');

        if (isBuAtte && !isInsideParen) {
            flushLastPara();
            if (noAtte) {
                // bu_atte 변환 비활성화: 원본 기호 그대로 평범한 p 태그로 유지
                const p = document.createElement('p');
                if (node.nodeType === 3) p.textContent = node.textContent;
                else Array.from(node.childNodes).forEach(child => p.appendChild(child.cloneNode(true)));
                rootNodes.push(p);
                lastBuAtte = null;
                lastLi = null;
                contextStack.length = 0;
                continue;
            }
            const p = document.createElement('p');

            // 2. 클래스 부여는 기호 유지(keepMarker) 여부와 상관없이 항상 적용되도록 밖으로 뺍니다.
            p.className = 'bu_atte';

            if (!keepMarker) {
                if (node.nodeType === 3) {
                    p.textContent = rawText.replace(/^[\s\u200B-\u200D\uFEFF\xA0※*]+/, '');
                } else {
                    Array.from(node.childNodes).forEach(child => p.appendChild(child.cloneNode(true)));
                    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
                    let textNode;
                    while (textNode = walker.nextNode()) {
                        const val = textNode.textContent;
                        if (!val.replace(/[\s\u200B-\u200D\uFEFF\xA0]/g, '')) continue;
                        if (/^[\s\u200B-\u200D\uFEFF\xA0]*[※*]/.test(val)) {
                            textNode.textContent = val.replace(/^[\s\u200B-\u200D\uFEFF\xA0※*]+/, '');
                        }
                        break;
                    }
                }
            } else {
                // 기호를 유지할 때도 클래스는 이미 위에서 적용되었으므로 텍스트만 복사합니다.
                if (node.nodeType === 3) p.textContent = node.textContent;
                else Array.from(node.childNodes).forEach(child => p.appendChild(child.cloneNode(true)));
            }

            if (lastLi) {
                if (keepMarker) {
                    const lastC = lastLi.lastChild;
                    if (lastC && !(lastC.nodeType === 1 && (lastC.tagName === 'BR' || lastC.tagName === 'P'))) {
                        lastLi.appendChild(document.createElement('br'));
                    }
                }
                lastLi.appendChild(p);
                lastBuAtte = null;
            }
            else { 
                rootNodes.push(p); 
                lastLi = null; 
                contextStack.length = 0; 
                lastBuAtte = p; 
            }
            continue;
        }

        const isBlockElement = (node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'DIV'));
        const markerInfo = isInsideParen ? null : getMarkerInfo(rawText);

        const startsWithSpace = /^[\s\u200B-\u200D\uFEFF\xA0]+/.test(rawText);
        
        if (lastBuAtte && startsWithSpace && !markerInfo && !isInsideParen) {
            flushLastPara();
            lastBuAtte.appendChild(document.createElement('br')); // 줄바꿈 추가
            
            if (node.nodeType === 3) {
                lastBuAtte.appendChild(document.createTextNode(rawText.replace(/^[\s\u200B-\u200D\uFEFF\xA0]+/, '')));
            } else {
                const clone = node.cloneNode(true);
                const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
                let textNode;
                while ((textNode = walker.nextNode())) {
                    if (!textNode.textContent.replace(/[\s\u200B-\u200D\uFEFF\xA0]/g, '')) continue;
                    textNode.textContent = textNode.textContent.replace(/^[\s\u200B-\u200D\uFEFF\xA0]+/, '');
                    break;
                }
                Array.from(clone.childNodes).forEach(cn => lastBuAtte.appendChild(cn));
            }
            continue;
        }

        if (node.nodeType === 1 && (node.tagName === 'UL' || node.tagName === 'OL')) {
            flushLastPara();
            if (noUl && node.tagName === 'UL') {
                // noUl: 기존 ul/li를 p 태그로 풀어냄 (원본 내용 그대로 유지)
                Array.from(node.children).forEach(liNode => {
                    if (liNode.tagName !== 'LI') return;
                    const p = document.createElement('p');
                    while (liNode.firstChild) p.appendChild(liNode.firstChild);
                    if (p.innerHTML.trim()) rootNodes.push(p);
                });
            } else {
                const newList = document.createElement(node.tagName.toLowerCase());
                Array.from(node.children).forEach(liNode => {
                    if (liNode.tagName !== 'LI') return;
                    const newLi = document.createElement('li');
                    while (liNode.firstChild) newLi.appendChild(liNode.firstChild);
                    newList.appendChild(newLi);
                });
                rootNodes.push(newList);
            }
            contextStack.length = 0;
            lastLi = null;
            lastBuAtte = null;
            continue;
        }
        
        if (markerInfo) {
            flushLastPara();
            lastBuAtte = null;

            const { type: markerType, regex: markerRegex } = markerInfo;

            // 외부 텍스트에서 decimal-dot(1. 내용)이 짧을 때:
            // - 같은 블록에 다른 decimal-dot 항목(길이 무관)이 있으면 → 연속 목록의 일부
            // - 없으면 → 제목 후보로 보존 (<p>)
            if (markerType === 'decimal-dot' && isOuterText && rawText.trim().length <= 15) {
                const hasAnyOtherDecimalDot = childNodes.some((n, j) => {
                    if (j === i) return false;
                    return /^\d{1,2}\.\s+\S/.test((n.textContent || '').trim());
                });
                if (!hasAnyOtherDecimalDot) {
                    lastLi = null;
                    contextStack.length = 0;
                    const p = document.createElement('p');
                    if (node.nodeType === 3) p.textContent = node.textContent;
                    else Array.from(node.childNodes).forEach(cn => p.appendChild(cn.cloneNode(true)));
                    if (p.innerHTML.trim()) rootNodes.push(p);
                    continue;
                }
            }

            const isSelectedOl = Array.isArray(olType) && olType.includes(markerType);
            const targetTagName = isSelectedOl ? 'ol' : 'ul';

            // noUl: ul로 변환될 항목은 p 태그로 유지 (마커 문자 그대로 보존)
            if (noUl && targetTagName === 'ul') {
                const p = document.createElement('p');
                const childrenToMove = isBlockElement ? node.childNodes : [node];
                Array.from(childrenToMove).forEach(cn => p.appendChild(cn));
                if (p.innerHTML.trim()) rootNodes.push(p);
                lastLi = null;
                contextStack.length = 0;
                continue;
            }

            const safeNodeText = sanitizeSpecialChars(rawText);
            const match = safeNodeText.match(markerRegex);

            if (match) {
                const charsToRemove = keepMarker ? 0 : match[0].length;
                if (node.nodeType === 3) {
                    const len = node.textContent.length;
                    if (len <= charsToRemove) { node.textContent = ''; }
                    else { node.textContent = node.textContent.substring(charsToRemove); }
                } else {
                    removeLeadingCharsFromDOM(node, charsToRemove, { preprocessFn: sanitizeSpecialChars });
                }
            }
            const li = document.createElement('li');
            
            if (!keepMarker) {
            if (targetTagName === 'ol') {
                const spanNum = document.createElement('span');
                spanNum.className = 'mrk';
                const rawChar = markerInfo.rawMarker || markerInfo.char.replace(/\s+/g, '');
                spanNum.textContent = convertCircleToArabic(rawChar);
                li.appendChild(spanNum);
                li.appendChild(document.createTextNode(' '));
            } else {
                if (markerType !== 'bullet' && markerType !== 'special') {
                    li.appendChild(document.createTextNode(markerInfo.char + ' '));
                }
            }
        }
            
            const childrenToMove = isBlockElement ? node.childNodes : [node];
            Array.from(childrenToMove).forEach(cn => li.appendChild(cn));

            let currentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
            const isSameLevel = currentContext && currentContext.markerType === markerType && currentContext.ul.tagName.toLowerCase() === targetTagName && (markerType !== 'bullet' || currentContext.markerChar === markerInfo.char);
            if (isSameLevel) { currentContext.ul.appendChild(li); } else {
                let foundParentIndex = -1;
                for (let j = contextStack.length - 2; j >= 0; j--) {
                    if (contextStack[j].markerType === markerType && contextStack[j].ul.tagName.toLowerCase() === targetTagName && (markerType !== 'bullet' || contextStack[j].markerChar === markerInfo.char)) {
                        foundParentIndex = j; break;
                    }
                }
                if (foundParentIndex !== -1) {
                    while (contextStack.length - 1 > foundParentIndex) contextStack.pop();
                    contextStack[contextStack.length - 1].ul.appendChild(li);
                } else {
                    const newList = document.createElement(targetTagName);
                    newList.appendChild(li);
                    if (lastLi) lastLi.appendChild(newList);
                    else if (currentContext) currentContext.ul.appendChild(newList);
                    else rootNodes.push(newList);
                    contextStack.push({ ul: newList, markerType: markerType, markerChar: markerInfo.char });
                }
            }
            lastLi = li;
        } else {
            if (cleanTextForBreak) lastBuAtte = null; // 일반 텍스트가 나오면 연결을 끊습니다.
            
            if (lastLi) {
                flushLastPara(); 
                lastLi.appendChild(document.createElement('br'));
                const childrenToMove = isBlockElement ? node.childNodes : [node];
                Array.from(childrenToMove).forEach(cn => lastLi.appendChild(cn));
            } else {
                if (isBlockElement) {
                    flushLastPara();
                    const p = document.createElement('p');
                    while (node.firstChild) p.appendChild(node.firstChild);
                    if (p.innerHTML.trim()) rootNodes.push(p);
                } else {
                    if (!lastPara) lastPara = document.createElement('p');
                    lastPara.appendChild(node);
                }
                contextStack.length = 0;
            }
        }
    }
    
    flushLastPara(); 
    cell.innerHTML = '';
    rootNodes.forEach(node => cell.appendChild(node));
};

const MSO_LEVEL_MARKERS = ['• ', '- ', '▶ ', '◆ ', '○ '];
const RE_MSO_MARKED = /^[•\-*※○●■▶◆➢→✔✓☑☐★☆❖⦁·]|\d+[.)]/;
const _isNumberedOrCircle = (char) =>
    /\d/.test(char) || /[IVXivx]/.test(char) || /[①-⓿㉐-㉟㊱-㊿]/.test(char);

export const processMsoLists = (container) => {
    const elements = Array.from(container.querySelectorAll('[style*="mso-list"]'));
    if (elements.length === 0) return;

    // Phase 1: Build listId → level → markerChar map by reading Ignore spans
    // matchCache: 정규식 결과를 캐싱해 Phase 3에서 재실행하지 않는다
    // ignoreSpanCache: querySelector 결과를 캐싱해 Phase 3에서 중복 쿼리를 제거한다
    const matchCache = new Map();
    const ignoreSpanCache = new Map();
    const listMap = new Map();
    elements.forEach(el => {
        const styleStr = el.getAttribute('style') || '';
        const m = styleStr.match(/mso-list:\s*l(\w+)\s+level(\d+)/i);
        if (!m) return;
        matchCache.set(el, m);
        const [, listId, lvStr] = m;
        const level = parseInt(lvStr, 10);
        const ignoreSpan = el.querySelector('[style*="mso-list:Ignore"]');
        ignoreSpanCache.set(el, ignoreSpan || null);
        const rawChar = ignoreSpan
            ? ignoreSpan.textContent.replace(HWP_CHAR_REGEX, c => HWP_CHAR_MAP[c] || c).replace(/\s/g, '')
            : '';
        if (!listMap.has(listId)) listMap.set(listId, new Map());
        if (!listMap.get(listId).has(level)) listMap.get(listId).set(level, rawChar);
    });

    // Phase 2: If all levels in a list share the same non-numbered bullet,
    // override with distinct level markers so processCellContent nests correctly.
    const overrideMap = new Map();
    listMap.forEach((levelMap, listId) => {
        const chars = Array.from(levelMap.values()).filter(Boolean);
        const unique = new Set(chars);
        if (unique.size === 1 && !_isNumberedOrCircle(Array.from(unique)[0])) {
            const oMap = new Map();
            levelMap.forEach((_, lvl) => oMap.set(lvl, MSO_LEVEL_MARKERS[(lvl - 1) % MSO_LEVEL_MARKERS.length]));
            overrideMap.set(listId, oMap);
        }
    });

    // Phase 3: Remove Ignore spans and insert normalized markers
    elements.forEach(el => {
        const m = matchCache.get(el);
        if (!m) return;
        const [, listId, lvStr] = m;
        const level = parseInt(lvStr, 10);

        const ignoreSpan = ignoreSpanCache.get(el) || null;
        let extractedChar = '';
        if (ignoreSpan) {
            extractedChar = ignoreSpan.textContent
                .replace(HWP_CHAR_REGEX, c => HWP_CHAR_MAP[c] || c)
                .replace(/\s/g, '');
            ignoreSpan.remove();
        }

        let marker;
        if (overrideMap.has(listId)) {
            marker = overrideMap.get(listId).get(level) ?? MSO_LEVEL_MARKERS[(level - 1) % MSO_LEVEL_MARKERS.length];
        } else if (extractedChar) {
            marker = extractedChar + ' ';
        } else {
            marker = MSO_LEVEL_MARKERS[(level - 1) % MSO_LEVEL_MARKERS.length];
        }

        const text = el.textContent.trim();
        if (text && !RE_MSO_MARKED.test(text)) {
            el.insertBefore(document.createTextNode(marker), el.firstChild);
        }
    });

};
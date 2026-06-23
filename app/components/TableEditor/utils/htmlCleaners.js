/*
 * [htmlCleaners.js] 개별 HTML 요소 정제 유틸리티
 *
 * 역할:
 *   - DOM 트리를 순회하며 각 노드를 CMS 규격에 맞게 세부 정제하는 저수준 도구.
 *   - cleanTableHtml.jsx 및 tableProcessor.js에서 호출되어 실제 태그/속성/스타일을 처리한다.
 *
 * 주요 함수:
 *
 *   getDOMParser()
 *     - DOMParser 인스턴스를 싱글톤으로 관리해 불필요한 객체 생성을 줄인다.
 *     - 서버 환경(window undefined)에서는 null 반환.
 *
 *   traverseAndClean(element, isColorMode, isColorClassMode)
 *     - element 하위 전체 DOM 트리를 역순(자식→부모) 순회하며 정제.
 *     - 처리 내용:
 *       · 주석 노드(nodeType 8) → 삭제
 *       · 이메일 텍스트(abc@xyz.com) → <a class="bu_mail" href="mailto:..."> 로 변환
 *       · <font color="" face=""> → <span style="color/fontFamily"> 로 변환
 *       · Word/Office 전용 태그(v:, w:, o:) → 삭제
 *       · ALLOWED_TAGS에 없는 태그 → 태그 제거(내용 유지, unwrap)
 *       · bgcolor/align/valign → style 속성으로 이전 후 제거
 *       · ALLOWED_ATTRIBUTES 외 모든 속성 제거 (xl숫자, oa숫자 등 Excel 클래스 정리)
 *       · style 속성 전체 제거 후 필요한 color/backgroundColor만 재적용:
 *           isColorMode + isColorClassMode → mapColorToClass로 pc_xxx 클래스 부여
 *           isColorMode만 → style="color:..." 인라인 유지
 *       · td/th의 text-align → al/ar CSS 클래스로 변환(center는 기본이므로 제거)
 *       · class/style 없는 빈 <span> → unwrap
 *
 *   performCleanup(container)
 *     - traverseAndClean 이후 구조적 찌꺼기를 최종 정리.
 *     - 처리 내용:
 *       · td/th 내부 <p> → <br>로 변환 (줄바꿈 보존, bu_atte 클래스 p는 제외)
 *       · <b><b>, <span><span> 등 동일 태그 중첩 제거
 *       · 동일 class/style을 가진 인접 span/b/i/u/strong/em 병합
 *       · 빈 b/i/u/strong/em 삭제
 *       · 연속 <br> 압축, 깨진 따옴표 복원, <br><div> → <div> 변환,
 *         리스트 앞뒤 불필요한 <br> 제거
 */

import { ALLOWED_TAGS, ALLOWED_ATTRIBUTES, CLEANUP_REGEX } from './constants';
import { mapColorToClass } from './colorUtils';

let sharedDOMParser = null;
export const getDOMParser = () => {
    if (typeof window === 'undefined') return null;
    if (!sharedDOMParser) sharedDOMParser = new DOMParser();
    return sharedDOMParser;
};


export const traverseAndClean = (element, isColorMode, isColorClassMode = true, _depth = 0) => {
    if (_depth > 200) return;
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
        const node = element.childNodes[i];
        if (node.nodeType === 8) { node.remove(); continue; }
        if (node.nodeType === 3) {
            const parentTag = element.tagName ? element.tagName.toLowerCase() : '';
            if (parentTag !== 'a') {
                const EMAIL_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
                const text = node.textContent;
                if (EMAIL_RE.test(text)) {
                    EMAIL_RE.lastIndex = 0;
                    const frag = document.createDocumentFragment();
                    let last = 0, m;
                    while ((m = EMAIL_RE.exec(text)) !== null) {
                        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                        const a = document.createElement('a');
                        a.href = `mailto:${m[1]}`;
                        a.className = 'bu_mail';
                        a.textContent = m[1];
                        frag.appendChild(a);
                        last = m.index + m[0].length;
                    }
                    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
                    node.replaceWith(frag);
                }
            }
            continue;
        }
        if (node.nodeType === 1) traverseAndClean(node, isColorMode, isColorClassMode, _depth + 1);
    }

    if (element.nodeType !== 1) return;
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'font') {
        const color = element.getAttribute('color');
        const face = element.getAttribute('face');
        const span = document.createElement('span');
        if (color) span.style.color = color;
        if (face) span.style.fontFamily = face;
        while (element.firstChild) span.appendChild(element.firstChild);
        element.replaceWith(span);
        traverseAndClean(span, isColorMode, isColorClassMode, _depth + 1);
        return; 
    }

    if (['v', 'w', 'o'].includes(tagName.split(':')[0])) { element.remove(); return; }

    const isHeading = /^h[1-6]$/.test(tagName);
    const isLink = tagName === 'a';

    if (!ALLOWED_TAGS.has(tagName) && !isHeading && !isLink) { 
        element.replaceWith(...element.childNodes); 
        return; 
    }
    
    if (tagName === 'table') element.removeAttribute('class');
    if (isLink) {
        const href = element.getAttribute('href') || '';
        if (!href || href.startsWith('file://') || href.startsWith('#') || href.trim() === '') {
            element.replaceWith(...element.childNodes);
            return;
        }
        element.classList.add('bu_link');
    }

    const attributes = Array.from(element.attributes);
    attributes.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        
        if (isLink && (attrName === 'href' || attrName === 'target' || attrName === 'title')) return; 
        if (attrName === 'data-local-config' || attrName === 'data-local-colwidths') return;

        if (attrName === 'bgcolor' && !element.style.backgroundColor) element.style.backgroundColor = attr.value;
        if (attrName === 'align' && !element.style.textAlign) element.style.textAlign = attr.value;
        if (attrName === 'valign' && !element.style.verticalAlign) element.style.verticalAlign = attr.value;

        if (!ALLOWED_ATTRIBUTES.has(attrName)) { element.removeAttribute(attrName); return; }
        
        if (attrName === 'class') {
            const currentClasses = element.getAttribute('class').split(/\s+/);
            const cleanClasses = currentClasses.filter(cls => !/^xl\d+$/.test(cls) && !/^oa\d+$/.test(cls) && !/^\d+$/.test(cls));
            if (cleanClasses.length > 0) element.setAttribute('class', cleanClasses.join(' '));
            else element.removeAttribute('class');
        }
    });

    if (element.hasAttribute('style')) {
        const originalColor = element.style.color;
        const originalBg = element.style.backgroundColor || element.style.background;
        const originalTextAlign = element.style.textAlign;

        element.style.cssText = ''; 
        element.removeAttribute('style'); 

        let fallbackStyle = ''; 

        if (isColorMode) {
            if (originalColor) {

                if (isColorClassMode) {
                    const colorClass = mapColorToClass(originalColor, 'pc_');
                    if (colorClass) {

                        element.classList.add(colorClass);
                    } else {

                        fallbackStyle += `color: ${originalColor}; `;
                    }
                } else {

                    fallbackStyle += `color: ${originalColor}; `;
                }
            }
            if (originalBg) {
                fallbackStyle += `background-color: ${originalBg}; `;
            }
        }

        if (originalTextAlign && (tagName === 'td' || tagName === 'th')) {
            const alignMap = { 'left': 'al', 'right': 'ar', 'center': '', 'justify': 'al' }; 
            const alignClass = alignMap[originalTextAlign.toLowerCase()];
            element.classList.remove('al', 'ac', 'ar');
            if (alignClass) element.classList.add(alignClass);
        }
        

        if (fallbackStyle.trim()) {
            element.setAttribute('style', fallbackStyle.trim());
        }
    }

    if (tagName === 'span' && !element.hasAttribute('class') && !element.hasAttribute('style')) {
         element.replaceWith(...element.childNodes); 
    }
};

export const performCleanup = (container) => {

    if (container.tagName === 'TD' || container.tagName === 'TH') {
        const pList = Array.from(container.querySelectorAll('p')).filter(p => !p.classList.contains('bu_atte'));
        if (pList.length > 0) {
            pList.forEach((p, idx) => { if (idx < pList.length - 1) p.after(document.createElement('br')); });
            pList.forEach(p => p.replaceWith(...p.childNodes));
        }
    }
    



    // Pass 1: 중첩 동일 태그 제거 (5회 → 1회 querySelectorAll)
    Array.from(container.querySelectorAll('b, i, u, strong, em')).forEach(node => {
        const tag = node.tagName.toLowerCase();
        if (node.parentNode && node.parentNode.tagName && node.parentNode.tagName.toLowerCase() === tag) {
            while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
            node.remove();
        }
    });

    // Pass 2: 인접 동일 class/style 태그 병합 (6회 → 1회 querySelectorAll)
    Array.from(container.querySelectorAll('span, b, i, u, strong, em')).forEach(el => {
        if (!el.parentNode) return;
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'span' && el.classList.contains('mrk')) return;

        const elClass = el.getAttribute('class') || '';
        const elStyle = el.getAttribute('style') || '';

        if (tagName === 'span' && !elClass && !elStyle) return;

        let next = el.nextSibling;
        while (next) {
            if (next.nodeType === 3 && /^\s*$/.test(next.textContent)) {
                let nextNext = next.nextSibling;
                if (nextNext && nextNext.nodeType === 1 && nextNext.tagName.toLowerCase() === tagName) {
                    const nnClass = nextNext.getAttribute('class') || '';
                    const nnStyle = nextNext.getAttribute('style') || '';
                    if (elClass === nnClass && elStyle === nnStyle) {
                        el.appendChild(next);
                        while (nextNext.firstChild) el.appendChild(nextNext.firstChild);
                        const toRemove = nextNext;
                        next = nextNext.nextSibling;
                        toRemove.remove();
                    } else { break; }
                } else { break; }
            } else if (next.nodeType === 1 && next.tagName.toLowerCase() === tagName) {
                const nClass = next.getAttribute('class') || '';
                const nStyle = next.getAttribute('style') || '';
                if (elClass === nClass && elStyle === nStyle) {
                    while (next.firstChild) el.appendChild(next.firstChild);
                    const toRemove = next;
                    next = next.nextSibling;
                    toRemove.remove();
                } else { break; }
            } else { break; }
        }
    });

    // Pass 3: 빈 인라인 태그 제거 (5회 → 1회 querySelectorAll)
    Array.from(container.querySelectorAll('b, i, u, strong, em')).forEach(node => {
        if (node.textContent.trim() === '' && node.children.length === 0) node.remove();
    });

    container.innerHTML = container.innerHTML
        .replace(CLEANUP_REGEX.multipleBrs, '<br>')
        .replace(CLEANUP_REGEX.brokenQuotes1, '"')
        .replace(CLEANUP_REGEX.brokenQuotes2, '"')
        .replace(CLEANUP_REGEX.brToDiv, '<div')
        .replace(CLEANUP_REGEX.listBr, '')
        .replace(CLEANUP_REGEX.startBr, '')
        .replace(CLEANUP_REGEX.endBr, '');
};

// element 앞에서 count 글자를 TreeWalker로 순서대로 제거한다.
// preprocessFn: 각 텍스트 노드에 적용할 전처리 함수 (내용을 변경하며 길이에 영향을 줌)
// skipLeadingWhitespace: true이면 각 텍스트 노드의 선두 공백은 보존하고 계산에서 제외
export const removeLeadingCharsFromDOM = (element, count, { preprocessFn = null, skipLeadingWhitespace = false } = {}) => {
    let charsToRemove = count;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode;
    while (charsToRemove > 0 && (textNode = walker.nextNode())) {
        if (preprocessFn) textNode.textContent = preprocessFn(textNode.textContent);
        const text = textNode.textContent;
        let startIdx = 0;
        if (skipLeadingWhitespace) {
            const spaceMatch = text.match(/^[\s​-‍﻿\xA0]+/);
            startIdx = spaceMatch ? spaceMatch[0].length : 0;
        }
        const effective = text.substring(startIdx);
        if (effective.length === 0) continue;
        if (effective.length <= charsToRemove) {
            textNode.textContent = text.substring(0, startIdx);
            charsToRemove -= effective.length;
        } else {
            textNode.textContent = text.substring(0, startIdx) + effective.substring(charsToRemove);
            charsToRemove = 0;
        }
    }
};

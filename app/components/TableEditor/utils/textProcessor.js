/*
 * [textProcessor.js] 일반 텍스트 블록 처리 파이프라인
 *
 * 역할:
 *   - 테이블이 없는 순수 텍스트 블록(p, div, ul, ol 등)을 받아 CMS 규격에 맞게 변환한다.
 *   - cleanTableHtml.jsx의 flushTextGroup에서 호출된다.
 *
 * 주요 함수:
 *
 *   processTextContentNormal / processTextContentColor
 *     - 각각 색상 모드 off/on 래퍼. 내부적으로 processTextContentBase를 호출한다.
 *
 *   processTextContentBase(containerDOM, config, isColorMode, isColorClassMode)
 *     처리 파이프라인 순서:
 *       1. processMsoLists:
 *          Word의 mso-list 스타일 요소를 일반 마커 텍스트로 정규화한다.
 *       2. processCellContent:
 *          마커 패턴(1., 가., ①, -, • 등)을 감지해 ul/ol/li 구조로 변환한다.
 *          isOuterText=true이므로 tit1/tit2/tit3 설정에 매칭되는 텍스트는 리스트 변환 대상에서 제외.
 *       3. applyNestedClassesHelper:
 *          ul/ol에 list_st1, list_st2 등 depth 기반 클래스 적용.
 *       4. performCleanup: 구조적 찌꺼기 제거(태그 중첩, 빈 요소, 연속 br 등).
 *       5. 제목 태그 처리 (h3/h4/h5):
 *          - 이미 h3~h5인 요소: tit1Class~tit3Class를 className으로 적용
 *          - p/div 요소: checkTitleMatch로 tit1/tit2/tit3 설정과 비교,
 *            매칭 시 h3/h4/h5로 변환하고 (keepMarker=false이면) 마커 문자 제거.
 *            단, 제n장/편/조, 로마숫자(Ⅰ.) 형태는 마커 제거에서 제외(isPreservedMarker).
 *       6. traverseAndClean: 허용 태그/속성 최종 정제 및 색상 클래스 변환.
 */

import { traverseAndClean, performCleanup, removeLeadingCharsFromDOM } from './htmlCleaners';
import { applyNestedClassesHelper, processCellContent, checkTitleMatch, processMsoLists } from './listExtractors';
import { UL_NONE_VALUE } from './constants';


const processTextContentBase = (containerDOM, config, isColorMode, isColorClassMode) => {
    if (!containerDOM || !config) return;

    const { keepMarker, useAtteMarker, ulClassName: ulClass, olType, tit1, tit2, tit3, tit4, tit1Class, tit2Class, tit3Class, tit4Class, listStartFrom2 } = config;
    const noUl = ulClass === UL_NONE_VALUE;
    const noAtte = useAtteMarker === false;

    // 1. 셀 내용 처리 및 클래스 적용
    processMsoLists(containerDOM);
    processCellContent(containerDOM, keepMarker, true, tit1, tit2, tit3, tit4, olType, noUl, noAtte);
    applyNestedClassesHelper(containerDOM, ulClass, listStartFrom2 ? 1 : 0);
    performCleanup(containerDOM);

    // 2. 제목 태그(H3, H4, H5) 및 텍스트 마커 정리 로직
     Array.from(containerDOM.children).forEach(child => {
            const tagName = child.tagName.toLowerCase();
            

            if (tagName === 'h2') { child.className = tit1Class ? `tit-st ${tit1Class}` : 'tit-st'; }
            else if (tagName === 'h3') { child.className = tit2Class ? `tit-st ${tit2Class}` : 'tit-st'; }
            else if (tagName === 'h4') { child.className = tit3Class ? `tit-st ${tit3Class}` : 'tit-st'; }
            else if (tagName === 'h5') { child.className = tit4Class ? `tit-st ${tit4Class}` : 'tit-st'; }
            else if (tagName === 'p' || tagName === 'div') {

                const rawText = child.textContent.trim();
                const match1 = checkTitleMatch(rawText, tit1);
                const match2 = checkTitleMatch(rawText, tit2);
                const match3 = checkTitleMatch(rawText, tit3);
                const match4 = checkTitleMatch(rawText, tit4);
                
                const removeTitleMarker = (element, markerStr) => {
                    if (keepMarker) return;
                    removeLeadingCharsFromDOM(element, markerStr.length, { skipLeadingWhitespace: true });
                    const trimWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                    let firstText;
                    while ((firstText = trimWalker.nextNode())) {
                        if (firstText.textContent.trim() === '') continue;
                        firstText.textContent = firstText.textContent.replace(/^[\s\u200B-\u200D\uFEFF\xA0]+/, '');
                        break;
                    }
                };
                const isPreservedMarker = (markerText) => {
                    if (!markerText) return false;
                    const safeStr = markerText.replace(/[\s\u200B-\u200D\uFEFF\xA0]/g, '');
                    // 제n장, 제n편, 제n조, 제n관 및 로마숫자(Ⅰ., II. 등)
                    return /^제\d+[장편조관]/.test(safeStr) || /^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]|[IVX]+)\./i.test(safeStr);
                };
                if (match1) {
                    const h2 = document.createElement('h2');
                    h2.className = tit1Class ? `tit-st ${tit1Class}` : 'tit-st';
                    h2.innerHTML = child.innerHTML;

                    if (!isPreservedMarker(match1)) {
                        removeTitleMarker(h2, match1);
                    }

                    child.replaceWith(h2);

                } else if (match2) {
                    const h3 = document.createElement('h3');
                    h3.className = tit2Class ? `tit-st ${tit2Class}` : 'tit-st';
                    h3.innerHTML = child.innerHTML;

                    if (!isPreservedMarker(match2)) {
                        removeTitleMarker(h3, match2);
                    }

                    child.replaceWith(h3);

                } else if (match3) {
                    const h4 = document.createElement('h4');
                    h4.className = tit3Class ? `tit-st ${tit3Class}` : 'tit-st';
                    h4.innerHTML = child.innerHTML;

                    if (!isPreservedMarker(match3)) {
                        removeTitleMarker(h4, match3);
                    }

                    child.replaceWith(h4);

                } else if (match4) {
                    const h5 = document.createElement('h5');
                    h5.className = tit4Class ? `tit-st ${tit4Class}` : 'tit-st';
                    h5.innerHTML = child.innerHTML;

                    if (!isPreservedMarker(match4)) {
                        removeTitleMarker(h5, match4);
                    }

                    child.replaceWith(h5);

                }
            }
        });

    // 3. 최종 클린업
    traverseAndClean(containerDOM, isColorMode, isColorClassMode);
};

export const processTextContentNormal = (containerDOM, config) => {
    processTextContentBase(containerDOM, config, false, false);
};

export const processTextContentColor = (containerDOM, config) => {
    processTextContentBase(containerDOM, config, true, config.isColorClassMode);
};   
/*
 * [tableProcessor.js] 테이블 HTML 처리 파이프라인
 *
 * 역할:
 *   - 테이블 블록 HTML을 받아 각 td/th 내부 내용을 정제하고,
 *     테이블 시맨틱 구조(thead/tbody 분리, colgroup, th scope)를 완성한다.
 *   - cleanTableHtml.jsx의 flushTableGroup에서 호출된다.
 *
 * 주요 함수:
 *
 *   processTableOnlyNormal / processTableOnlyColor
 *     - 각각 색상 모드 off/on 래퍼. 내부적으로 processTableOnlyBase를 호출한다.
 *
 *   processTableOnlyBase(tableDocHtml, config, colWidths, isColorMode, isColorClassMode)
 *     처리 파이프라인 순서:
 *       1. restoreOriginHtml  : data-origin-html 속성에 저장된 원본 HTML 복원
 *          (applyVerticalHeaders가 가로 모드로 복원할 때 사용)
 *       2. processMsoLists    : Word mso-list 스타일을 일반 마커 텍스트로 정규화
 *       3. splitParagraphsWithBr : <p> 내부 <br>을 기준으로 <p>를 분리
 *          (예: <p>줄1<br>줄2</p> → <p>줄1</p><p>줄2</p>)
 *       4. traverseAndClean   : 허용되지 않는 태그/속성 제거, 색상 → 클래스 변환
 *       5. applyTableFormats  : 테이블별 시맨틱 처리 (아래 상세)
 *       6. removeHwpArtifacts : .hwp_editor_board_content 빈 노드 제거
 *
 *   applyTableFormats (내부)
 *     - 모든 테이블을 역순(중첩 안쪽부터) 처리:
 *       · data-local-config/colwidths로 테이블별 개별 설정 적용
 *       · applyTableSemantics: isWrapDiv / wrapperClassName / thead-tbody 분리 / caption 자동 생성
 *       · processCellContent: 각 td/th 내부 리스트 변환 (마커 감지 → ul/ol/li 구조화)
 *       · applyNestedClassesHelper: ul/ol에 list_st1, list_st2 등 depth 클래스 적용
 *       · applyVerticalHeaders: th 세로 방향 변환
 *       · performCleanup / traverseAndClean: 최종 정제
 *
 *   mergeAdjacentTable(baseTableEl, nextTableEl) → boolean
 *     - 두 테이블의 열 수가 같을 때 nextTable의 tbody 행을 baseTable에 병합한다.
 *     - 열 수 불일치 시 false 반환 (TableEditor.jsx에서 toast 오류 메시지 표시).
 */

import { traverseAndClean, performCleanup } from './htmlCleaners';
import { applyTableSemantics, applyVerticalHeaders } from './tableFormatters';
import { applyNestedClassesHelper, processCellContent, processMsoLists } from './listExtractors';
import { UL_NONE_VALUE, RE_NUMERIC } from './constants';


// sourceEl: DOM 노드를 직접 받아 처리 후 tempDiv(DOM)를 반환한다.
// flushTableGroup에서 innerHTML 직렬화 → parseFromString 왕복을 제거하기 위해 DOM 기반으로 변경.
const processTableOnlyBase = (sourceEl, config, colWidths, isColorMode, isColorClassMode) => {
    if (typeof window === 'undefined' || !document || !sourceEl) return document.createElement('div');

    const tempDiv = document.createElement('div');
    Array.from(sourceEl.childNodes).forEach(node => tempDiv.appendChild(node.cloneNode(true)));

    restoreOriginHtml(tempDiv);
    processMsoLists(tempDiv);
    splitParagraphsWithBr(tempDiv);
    traverseAndClean(tempDiv, isColorMode, isColorClassMode);
    applyTableFormats(tempDiv, { ...config, isColorMode, isColorClassMode }, colWidths);
    removeHwpArtifacts(tempDiv);
    return tempDiv;
};

export const processTableOnlyNormal = (sourceEl, config, colWidths) => {
    return processTableOnlyBase(sourceEl, config, colWidths, false, false);
};

export const processTableOnlyColor = (sourceEl, config, colWidths) => {
    return processTableOnlyBase(sourceEl, config, colWidths, true, config.tableIsColorClassMode);
};


// ==========================================
// 🛠️ 세부 도우미 함수들 (Helper Functions)
// ==========================================

const restoreOriginHtml = (container) => {
    container.querySelectorAll('[data-origin-html]').forEach(el => {
        el.innerHTML = el.getAttribute('data-origin-html');
        el.removeAttribute('data-origin-html');
    });
};

const splitParagraphsWithBr = (container) => {
    const blocks = Array.from(container.querySelectorAll('p'));
    blocks.forEach(block => {
        if (block.querySelector('br')) {
            const tagName = block.tagName.toLowerCase();
            let attrs = '';
            for (let i = 0; i < block.attributes.length; i++) {
                const attr = block.attributes[i];
                attrs += ` ${attr.name}="${attr.value}"`;
            }
            const openTag = `<${tagName}${attrs}>`;
            const closeTag = `</${tagName}>`;
            const newInner = block.innerHTML.replace(/<br\s*\/?>/gi, `${closeTag}${openTag}`);
            
            const temp = document.createElement('div');
            temp.innerHTML = `${openTag}${newInner}${closeTag}`;
            block.replaceWith(...temp.childNodes);
        }
    });
};

const applyTableFormats = (container, config, colWidths) => {
    const {
    wrapperClassName: wrapperClass,
    tableUlClassName: ulClass,
    tableOlType: olType,
    tableKeepMarker: keepMarker,
    tableUseAtteMarker,
    tableType, isWrapDiv, isVerticalHeader, headerRows, headerCols, isColorMode, isColorClassMode, tableListStartFrom2
} = config;

    const allTables = Array.from(container.querySelectorAll('table')).reverse();
    allTables.forEach(table => {
        if (!table.parentNode) return;
        
        if (table.parentElement === container) {
            const safeWrapper = document.createElement('div');
            container.insertBefore(safeWrapper, table);
            safeWrapper.appendChild(table);
        }
        const isNested = !!table.parentElement.closest('table');
        
        let curWClass = wrapperClass;
        let curType = isNested ? 'default' : tableType;
        let curWrapDiv = isWrapDiv;
        let curHeaderRows = headerRows;
        let curHeaderCols = headerCols;
        let curColWidths = colWidths;
        let curIsVertical = isVerticalHeader;
        let curUseAtteMarker = tableUseAtteMarker;

        let searchNode = table;
        if (table.parentElement && table.parentElement.hasAttribute('data-local-config')) {
            searchNode = table.parentElement;
        } else if (table.hasAttribute('data-local-config')) {
            searchNode = table;
        }

        const localCfgStr = searchNode.getAttribute('data-local-config');
        if (localCfgStr) {
            try {
                const lCfg = JSON.parse(localCfgStr);
                curWClass = lCfg.wrapperClassName;
                curType = lCfg.tableType;
                curWrapDiv = lCfg.isWrapDiv;
                curHeaderRows = lCfg.headerRows;
                curHeaderCols = lCfg.headerCols;
                curIsVertical = lCfg.isVerticalHeader;
                if (lCfg.tableUseAtteMarker !== undefined) curUseAtteMarker = lCfg.tableUseAtteMarker;
            } catch(e) {}
        }
        const localCwStr = searchNode.getAttribute('data-local-colwidths');
        if (localCwStr) {
            try {
                const lCw = JSON.parse(localCwStr);
                curColWidths = lCw.map(w => RE_NUMERIC.test(w.trim()) ? w.trim() + '%' : w).join(',');
            } catch(e) {}
        }
        searchNode.removeAttribute('data-local-config');
        searchNode.removeAttribute('data-local-colwidths');

        applyTableSemantics(table, curWClass, curType, isNested, curWrapDiv, curHeaderRows, curHeaderCols, curColWidths);

        Array.from(table.rows).forEach(row => {
            Array.from(row.cells).forEach(cell => {
                if (!cell.closest('thead') && (cell.tagName === 'TD' || cell.tagName === 'TH')) {
                    
                    const noUl = ulClass === UL_NONE_VALUE;
                    const noAtte = curUseAtteMarker === false;
                    processCellContent(cell, keepMarker, false, null, null, null, null, olType, noUl, noAtte);
                    applyNestedClassesHelper(cell, ulClass, tableListStartFrom2 ? 1 : 0);
                }
                if (!cell.querySelector('table') && !cell.textContent.trim()) cell.innerHTML = '';
                
                performCleanup(cell);
                traverseAndClean(cell, isColorMode, isColorClassMode);
                
            const hasUl = (ulClass && ulClass.trim()) ? cell.querySelector(`ul[class*="${ulClass.trim()}"]`) : false;
            const hasOl = cell.querySelector('ol[class*="order-st"]');
            const hasAtte = cell.querySelector('.bu_atte');

            if (hasUl || hasOl || hasAtte) {
                cell.classList.remove('ac', 'ar');
                cell.classList.add('al');
            }
            });
        });
        applyVerticalHeaders(table, curIsVertical);
    });
};

const removeHwpArtifacts = (container) => {
    const hwpArtifacts = container.querySelectorAll('.hwp_editor_board_content');
    hwpArtifacts.forEach(el => el.innerHTML.trim() === '' ? el.remove() : el.replaceWith(...el.childNodes));
};

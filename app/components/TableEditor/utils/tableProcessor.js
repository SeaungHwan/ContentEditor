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
 *       · processCellContent: 각 td 내부 리스트 변환 (마커 감지 → ul/ol/li 구조화)
 *       · flattenHeaderCell: th는 리스트/bu_atte 구조를 만들지 않고 순수 텍스트로 평탄화
 *       · applyNestedClassesHelper: ul/ol에 list_st1, list_st2 등 depth 클래스 적용
 *       · applyVerticalHeaders: th 세로 방향 변환
 *       · performCleanup / traverseAndClean: 최종 정제
 *         (traverseAndClean에는 config.linkClassName/mailClassName을 전달 — 텍스트/표 공통 클래스)
 *
 *   mergeAdjacentTable(baseTableEl, nextTableEl) → boolean
 *     - 두 테이블의 열 수가 같을 때 nextTable의 tbody 행을 baseTable에 병합한다.
 *     - 열 수 불일치 시 false 반환 (TableEditor.jsx에서 toast 오류 메시지 표시).
 */

import { traverseAndClean, performCleanup, mergeAdjacentColorSpans } from './htmlCleaners';
import { applyTableSemantics, applyVerticalHeaders } from './tableFormatters';
import { applyNestedClassesHelper, processCellContent, processMsoLists, flattenHeaderCell } from './listExtractors';
import { UL_NONE_VALUE, formatColWidths } from './constants';


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
    tableOlClassName: olClassName,
    tableNumClassName: numClassName,
    tableKeepMarker: keepMarker,
    tableUseAtteMarker,
    linkClassName,
    mailClassName,
    boxClassName,
    tableType, isWrapDiv, isVerticalHeader, headerRows, headerCols, isColorMode, isColorClassMode, tableListStartFrom2
} = config;
    const boxClass = (boxClassName && boxClassName.trim()) || 'box_st2';
    // 링크/이메일 클래스는 텍스트 블록과 표가 공통으로 쓰는 전역 설정이라 표별 오버라이드가 없다.
    const linkClass = (linkClassName && linkClassName.trim()) || 'bu_link';
    const mailClass = (mailClassName && mailClassName.trim()) || 'bu_mail';

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
        // 개별 표 설정(TableEditModal)에서 편집 가능한 리스트 관련 필드 — data-local-config에
        // 저장은 되지만 그동안 이 함수가 다시 읽어들이지 않아 항상 전역값이 쓰이던 부분(버그 수정).
        let curUlClass = ulClass;
        let curOlType = olType;
        let curOlClassName = olClassName;
        let curNumClassName = numClassName;
        let curKeepMarker = keepMarker;
        let curListStartFrom2 = tableListStartFrom2;

        let searchNode = table;
        if (table.parentElement && (
            table.parentElement.hasAttribute('data-local-config') ||
            table.parentElement.hasAttribute('data-local-colwidths')
        )) {
            searchNode = table.parentElement;
        } else if (table.hasAttribute('data-local-config') || table.hasAttribute('data-local-colwidths')) {
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
                // 예전에 저장된 data-local-config(이 필드들이 추가되기 전)에는 값이 없을 수 있으므로
                // undefined일 때는 전역값을 그대로 유지한다.
                if (lCfg.tableUlClassName !== undefined) curUlClass = lCfg.tableUlClassName;
                if (lCfg.tableOlType !== undefined) curOlType = lCfg.tableOlType;
                if (lCfg.tableOlClassName !== undefined) curOlClassName = lCfg.tableOlClassName;
                if (lCfg.tableNumClassName !== undefined) curNumClassName = lCfg.tableNumClassName;
                if (lCfg.tableKeepMarker !== undefined) curKeepMarker = lCfg.tableKeepMarker;
                if (lCfg.tableListStartFrom2 !== undefined) curListStartFrom2 = lCfg.tableListStartFrom2;
            } catch(e) {}
        }
        const localCwStr = searchNode.getAttribute('data-local-colwidths');
        if (localCwStr) {
            try {
                const lCw = JSON.parse(localCwStr);
                curColWidths = formatColWidths(lCw);
            } catch(e) {}
        }
        searchNode.removeAttribute('data-local-config');
        searchNode.removeAttribute('data-local-colwidths');

        const curNumClass = (curNumClassName && curNumClassName.trim()) ? curNumClassName.trim() : 'num';

        applyTableSemantics(table, curWClass, curType, isNested, curWrapDiv, curHeaderRows, curHeaderCols, curColWidths, boxClass);

        // al(왼쪽 정렬) 판정용 셀렉터 — ul/ol/bu_atte 중 하나라도 있으면 al 클래스 적용.
        // 셋을 하나의 결합 셀렉터로 합쳐 querySelector 호출 1회로 판정한다.
        const alSelector = [
            (curUlClass && curUlClass.trim()) ? `ul[class*="${curUlClass.trim()}"]` : null,
            (curOlClassName && curOlClassName.trim()) ? `ol[class*="${curOlClassName.trim()}"]` : null,
            '.bu_atte',
        ].filter(Boolean).join(',');

        Array.from(table.rows).forEach(row => {
            // 같은 행의 모든 셀은 조상 체인이 동일하므로 thead 소속 여부는 행 단위로 한 번만 계산한다.
            const inThead = !!row.closest('thead');
            Array.from(row.cells).forEach(cell => {
                if (cell.tagName === 'TH') {
                    flattenHeaderCell(cell, curNumClass);
                } else if (!inThead && cell.tagName === 'TD') {
                    const noUl = curUlClass === UL_NONE_VALUE;
                    const noAtte = curUseAtteMarker === false;
                    processCellContent(cell, curKeepMarker, false, null, null, null, curOlType, noUl, noAtte, curNumClass);
                    applyNestedClassesHelper(cell, curUlClass, curListStartFrom2 ? 1 : 0, curOlClassName);
                }
                if (!cell.querySelector('table') && !cell.textContent.trim()) cell.innerHTML = '';

                performCleanup(cell, curNumClass);
                traverseAndClean(cell, isColorMode, isColorClassMode, linkClass, mailClass);
                if (isColorMode) mergeAdjacentColorSpans(cell, curNumClass);

                if (cell.querySelector(alSelector)) {
                    cell.classList.remove('ac', 'ar');
                    cell.classList.add('al');
                }
            });
        });
        applyVerticalHeaders(table, curIsVertical);

        // 중첩 테이블의 data-local-config는 flushTableGroup이 복원하지 않으므로
        // applyTableSemantics 이후 래퍼 div 또는 테이블 자체에 직접 복원한다.
        if (isNested && (localCfgStr || localCwStr)) {
            const wrapper = table.parentElement;
            const target = (wrapper && wrapper.tagName === 'DIV' && wrapper !== container)
                ? wrapper : table;
            if (localCfgStr) target.setAttribute('data-local-config', localCfgStr);
            if (localCwStr) target.setAttribute('data-local-colwidths', localCwStr);
            if (target !== table) {
                if (localCwStr) table.setAttribute('data-local-colwidths', localCwStr);
                if (localCfgStr) table.setAttribute('data-local-config', localCfgStr);
            }
        }
    });
};

const removeHwpArtifacts = (container) => {
    const hwpArtifacts = container.querySelectorAll('.hwp_editor_board_content');
    hwpArtifacts.forEach(el => el.innerHTML.trim() === '' ? el.remove() : el.replaceWith(...el.childNodes));
};

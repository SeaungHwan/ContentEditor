/*
 * [styleUpdater.js] 에디터 내용의 클래스/스타일 라이브 갱신 유틸리티
 *
 * 역할:
 *   - 에디터를 재마운트하거나 HTML 전체를 재파싱하지 않고,
 *     설정(config)이 바뀔 때 테이블 관련 클래스와 colgroup만 빠르게 갱신한다.
 *   - TableEditor.jsx에서 config/colWidths가 변경될 때마다 호출되며,
 *     커서 위치를 보존한 채로 에디터 DOM을 업데이트하는 데 사용된다.
 *
 * 주요 함수:
 *
 *   updateStylesOnly(htmlString, config, colWidths) → string
 *     - 전체 HTML을 파싱 후 모든 <table> 요소를 대상으로:
 *       1. data-local-config / data-local-colwidths 속성이 있으면 로컬 설정 우선 적용
 *          (wrapperClassName/isWrapDiv/isVerticalHeader뿐 아니라 tableUlClassName/
 *           tableOlClassName/tableListStartFrom2도 개별 표 설정값이 있으면 우선한다)
 *       2. isWrapDiv에 따라 table을 div로 감싸거나 제거하고 wrapperClassName 적용
 *          (부모 div가 박스인지 판별할 때 config.boxClassName을 사용 — applyWrapDiv 참고)
 *       3. applyColGroupHelper로 <colgroup> 재생성 (열 너비 변경 반영)
 *       4. applyNestedClassesHelper로 td/th 내 ul/ol 클래스 재적용
 *       5. applyVerticalHeaders로 th 세로 방향 여부 재적용
 *     - cleanTableHtml과 달리 리스트 변환, 태그 정제 등 무거운 처리는 하지 않는다.
 */


"use client";

import { getDOMParser } from './htmlCleaners';
import { applyColGroupHelper, applyVerticalHeaders, applyWrapDiv } from './tableFormatters';
import { applyNestedClassesHelper } from './listExtractors';
import { formatColWidths } from './constants';

export const updateStylesOnly = (htmlString, config, colWidths) => {
    if (typeof window === 'undefined' || !document || !htmlString) return htmlString || '';

    const {
        wrapperClassName: wrapperClass,
        tableUlClassName: ulClass,
        tableOlClassName: olClassName,
        tableListStartFrom2,
        boxClassName,
        isWrapDiv = true,
        isVerticalHeader = false
    } = config;
    const boxClass = (boxClassName && boxClassName.trim()) || 'box_st2';

    try {
        const parser = getDOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const tempDiv = document.createElement('div');
        Array.from(doc.body.childNodes).forEach(node => tempDiv.appendChild(node));

        const allTables = Array.from(tempDiv.querySelectorAll('table'));
        allTables.forEach(table => {
            let searchNode = table;
            const tableParent = table.parentElement;
            if (tableParent && (tableParent.hasAttribute('data-local-config') || tableParent.hasAttribute('data-local-colwidths'))) {
                searchNode = tableParent;
            } else if (table.hasAttribute('data-local-config') || table.hasAttribute('data-local-colwidths')) {
                searchNode = table;
            }

            let curWClass = wrapperClass;
            let curWrapDiv = isWrapDiv;
            let curColWidths = colWidths;
            let curIsVertical = isVerticalHeader;
            // 개별 표 설정(TableEditModal)에서 편집 가능한 ul/ol 클래스명 — data-local-config에
            // 저장은 되지만 그동안 이 함수가 다시 읽어들이지 않아 항상 전역값이 쓰이던 부분(버그 수정).
            let curUlClass = ulClass;
            let curOlClassName = olClassName;
            let curListStartFrom2 = tableListStartFrom2;

            const localCfgStr = searchNode.getAttribute('data-local-config');
            if (localCfgStr) {
                try {
                    const lCfg = JSON.parse(localCfgStr);
                    curWClass = lCfg.wrapperClassName;
                    curWrapDiv = lCfg.isWrapDiv;
                    curIsVertical = lCfg.isVerticalHeader;
                    // 예전에 저장된 data-local-config(이 필드들이 추가되기 전)에는 값이 없을 수 있으므로
                    // undefined일 때는 전역값을 그대로 유지한다.
                    if (lCfg.tableUlClassName !== undefined) curUlClass = lCfg.tableUlClassName;
                    if (lCfg.tableOlClassName !== undefined) curOlClassName = lCfg.tableOlClassName;
                    if (lCfg.tableListStartFrom2 !== undefined) curListStartFrom2 = lCfg.tableListStartFrom2;
                } catch (e) {}
            }
            const localCwStr = searchNode.getAttribute('data-local-colwidths');
            if (localCwStr) {
                try {
                    const lCw = JSON.parse(localCwStr);
                    curColWidths = formatColWidths(lCw);
                } catch (e) {}
            }

            applyWrapDiv(table, curWClass, curWrapDiv, tempDiv, boxClass);

            // applyWrapDiv가 기존 래퍼 div를 교체하면 data-local-config가 소실될 수 있으므로
            // 처리 후 올바른 요소(래퍼 div 또는 table)에 복원한다.
            if (localCfgStr || localCwStr) {
                const wr = table.parentElement;
                const tgt = (wr && wr.tagName === 'DIV' && wr !== tempDiv) ? wr : table;
                if (localCfgStr && !tgt.hasAttribute('data-local-config')) tgt.setAttribute('data-local-config', localCfgStr);
                if (localCwStr && !tgt.hasAttribute('data-local-colwidths')) tgt.setAttribute('data-local-colwidths', localCwStr);
            }

            applyColGroupHelper(table, curColWidths);
            const allCells = table.querySelectorAll('td, th');
            allCells.forEach(cell => applyNestedClassesHelper(cell, curUlClass, curListStartFrom2 ? 1 : 0, curOlClassName));
            applyVerticalHeaders(table, curIsVertical);
        });

        return tempDiv.innerHTML;
    } catch (e) { return htmlString; }
};

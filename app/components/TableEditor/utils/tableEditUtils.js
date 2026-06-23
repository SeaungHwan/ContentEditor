"use client";
import { getDOMParser } from './htmlCleaners';

// 빈 행 제거: 모든 td/th가 비어있는 행 삭제
// 빈 열 제거: 특정 열의 모든 셀이 비어있는 경우 삭제 (병합 셀 있으면 열 제거 스킵)
export function removeEmptyRowsColsFromHtml(htmlString) {
    const doc = getDOMParser().parseFromString(htmlString, 'text/html');
    let rowsRemoved = 0, colsRemoved = 0;

    const isCellEmpty = (cell) =>
        cell.textContent.replace(/[\s ​　]/g, '') === '' &&
        cell.querySelectorAll('img, iframe, table').length === 0;

    doc.querySelectorAll('table').forEach(table => {
        // 빈 행 제거 — 내용 있는 행이 하나라도 있을 때만 실행
        const allTrs = Array.from(table.querySelectorAll('tr'));
        const hasContentRow = allTrs.some(row =>
            Array.from(row.querySelectorAll('td, th')).some(c => !isCellEmpty(c))
        );
        if (hasContentRow) {
            allTrs.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                if (cells.length > 0 && cells.every(isCellEmpty)) {
                    row.remove();
                    rowsRemoved++;
                }
            });
        }

        // 빈 열 제거 (병합 셀 있으면 스킵 - 열 인덱스 계산이 깨짐)
        const allRows = Array.from(table.querySelectorAll('tr'));
        if (!allRows.length || table.querySelector('[colspan],[rowspan]')) return;

        const colCount = Math.max(...allRows.map(r => r.querySelectorAll('td, th').length));
        const hasContentCol = Array.from({ length: colCount }, (_, ci) =>
            allRows.some(row => { const c = row.querySelectorAll('td, th')[ci]; return c && !isCellEmpty(c); })
        ).some(Boolean);
        if (!hasContentCol) return;

        // Word &nbsp; 등으로 인해 빈 열이 생긴 경우, 제거 후 2개 미만이 되면 구조 보존
        const emptyColCount = Array.from({ length: colCount }, (_, ci) =>
            allRows.every(row => { const c = row.querySelectorAll('td, th')[ci]; return !c || isCellEmpty(c); })
        ).filter(Boolean).length;
        if (colCount - emptyColCount < 2) return;

        for (let ci = colCount - 1; ci >= 0; ci--) {
            const colEmpty = allRows.every(row => {
                const cell = row.querySelectorAll('td, th')[ci];
                return !cell || isCellEmpty(cell);
            });
            if (colEmpty) {
                allRows.forEach(row => {
                    const cell = row.querySelectorAll('td, th')[ci];
                    if (cell) cell.remove();
                });
                const col = table.querySelectorAll('colgroup col')[ci];
                if (col) col.remove();
                colsRemoved++;
            }
        }
    });

    return { html: doc.body.innerHTML, rowsRemoved, colsRemoved };
}

// 특정 표의 지정 열(0-based)에 1부터 순번 채우기 (thead 제외, tbody td만)
export function fillSeqInTable(tableEl, colIndex = 0) {
    const bodyRows = tableEl.querySelector('tbody')
        ? Array.from(tableEl.querySelector('tbody').querySelectorAll(':scope > tr'))
        : Array.from(tableEl.querySelectorAll('tr')).filter(r => r.querySelector('td'));
    let seq = 1;
    bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[colIndex]) cells[colIndex].textContent = String(seq++);
    });
}

// 특정 표의 지정 열 기준 데이터 행(tbody) 정렬
export function sortTableByCol(tableEl, colIndex, direction = 'asc') {
    const tbody = tableEl.querySelector('tbody') || tableEl;
    const dataRows = Array.from(tbody.querySelectorAll(':scope > tr')).filter(r => r.querySelector('td'));
    dataRows.sort((a, b) => {
        const ca = a.querySelectorAll('td, th')[colIndex];
        const cb = b.querySelectorAll('td, th')[colIndex];
        const ta = ca ? ca.textContent.trim() : '';
        const tb = cb ? cb.textContent.trim() : '';
        const na = parseFloat(ta.replace(/[^\d.-]/g, ''));
        const nb = parseFloat(tb.replace(/[^\d.-]/g, ''));
        const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : ta.localeCompare(tb, 'ko');
        return direction === 'asc' ? cmp : -cmp;
    });
    dataRows.forEach(r => tbody.appendChild(r));
}

// 표 헤더 열 정보 추출 (정렬 UI용)
export function getColHeaders(tableEl) {
    const headerRow = tableEl.querySelector('thead tr') || tableEl.querySelector('tr');
    if (!headerRow) return [];
    return Array.from(headerRow.querySelectorAll('th, td')).map((cell, i) => ({
        index: i,
        label: cell.textContent.trim().slice(0, 8) || `${i + 1}열`,
    }));
}

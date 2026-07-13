"use client";

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

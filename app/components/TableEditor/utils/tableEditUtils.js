"use client";

// requestAnimationFrame으로 프레임당 1회만 fn을 실행하도록 스로틀링한다(scroll/resize 등
// 고빈도 이벤트에 그대로 붙이면 리렌더/재계산이 폭주하므로). throttled.cancel()은 예약된
// rAF를 취소한다 — useEffect cleanup에서 리스너 해제와 함께 호출한다.
export function createRafThrottle(fn) {
    let rafId = null;
    const throttled = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => { rafId = null; fn(); });
    };
    throttled.cancel = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    };
    return throttled;
}

// data-local-config/data-local-colwidths(표별 개별 설정)는 부모가 래퍼 div면 부모에,
// 아니면 표 자체에 저장된다 — styleUpdater.js와 tableProcessor.js가 동일한 규칙으로 찾는다.
export function resolveLocalConfigNode(table) {
    const parent = table.parentElement;
    if (parent && (parent.hasAttribute('data-local-config') || parent.hasAttribute('data-local-colwidths'))) {
        return parent;
    }
    return table;
}

// JSON.parse를 시도하고 실패(손상된 값 등)하면 value=null을 반환해 파이프라인이 멈추지 않게 한다.
export function parseJsonAttr(node, attrName) {
    const str = node.getAttribute(attrName);
    if (!str) return { str: null, value: null };
    try {
        return { str, value: JSON.parse(str) };
    } catch (e) {
        return { str, value: null };
    }
}

// 특정 표의 지정 열(0-based, td 기준)에 1부터 순번 채우기 (thead 제외, tbody td만)
export function fillSeqInTable(tableEl, colIndex = 0) {
    const tbody = tableEl.querySelector('tbody');
    const bodyRows = tbody
        ? Array.from(tbody.querySelectorAll(':scope > tr'))
        : Array.from(tableEl.querySelectorAll('tr')).filter(r => r.querySelector('td'));

    // td 셀만을 대상으로 시각적 열 위치를 추적한다(좌측 헤더 th 열은 기존과 동일하게 열 계산에서 제외).
    // rowspan으로 앞 행의 td가 이 행까지 덮고 있으면 그 칸을 건너뛰어, colIndex가 "물리적으로 몇 번째
    // td인지"가 아니라 "시각적으로 몇 번째 td 열인지"를 가리키도록 한다. 그렇지 않으면 rowspan이 있는
    // 행 이후로 순번이 엉뚱한 열에 들어가거나 행이 통째로 건너뛰어진다.
    const tdGrid = [];
    let seq = 1;
    bodyRows.forEach((row, rowIdx) => {
        tdGrid[rowIdx] = tdGrid[rowIdx] || [];
        let col = 0;
        Array.from(row.querySelectorAll('td')).forEach(cell => {
            while (tdGrid[rowIdx][col]) col++;
            const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
            const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
            if (col === colIndex) cell.textContent = String(seq++);
            for (let r = 0; r < rowspan; r++) {
                for (let c = 0; c < colspan; c++) {
                    if (!tdGrid[rowIdx + r]) tdGrid[rowIdx + r] = [];
                    tdGrid[rowIdx + r][col + c] = true;
                }
            }
            col += colspan;
        });
    });
}

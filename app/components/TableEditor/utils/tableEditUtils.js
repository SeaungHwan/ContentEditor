"use client";

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

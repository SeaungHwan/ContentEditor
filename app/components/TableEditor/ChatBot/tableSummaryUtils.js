/*
 * [tableSummaryUtils.js] "표 요약해줘" 챗봇 응답에 쓰이는 HTML -> 텍스트 그리드 변환/요약 유틸.
 *
 * - 데이터가 작을 때만 LLM에 보내고(자연스러운 문장 요약), 클 때는 로컬에서 구조만 계산해
 *   무료 LLM 호출 한도를 아낀다(TABLE_SUMMARY_LLM_CHAR_LIMIT 기준).
 * - 표는 중첩 표를 포함할 수 있어(listExtractors.js의 nested-table 처리와 동일한 이유),
 *   직계 자식 tr/td만 골라 안쪽 표 내용이 바깥 표 그리드에 섞여 들어가지 않게 한다.
 */

export const TABLE_SUMMARY_LLM_CHAR_LIMIT = 1200;

const directRows = (tableEl) =>
    Array.from(tableEl.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'));

const parseTableGrid = (tableEl) =>
    directRows(tableEl)
        .map((tr) =>
            Array.from(tr.children)
                .filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH')
                .map((cell) => cell.textContent.replace(/\s+/g, ' ').trim())
        )
        .filter((row) => row.length > 0);

// scope: 'table'(커서가 있던 표 하나) | 'document'(에디터 전체, 중첩되지 않은 최상위 표만)
export function extractSummaryTables(html, scope) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');

    if (scope === 'table') {
        const tableEl = doc.querySelector('table');
        const grid = tableEl ? parseTableGrid(tableEl) : [];
        return grid.length ? [grid] : [];
    }

    const topLevelTables = Array.from(doc.querySelectorAll('table')).filter((t) => !t.parentElement.closest('table'));
    return topLevelTables.map(parseTableGrid).filter((grid) => grid.length > 0);
}

export function estimateGridsChars(tables) {
    return tables.reduce(
        (sum, grid) => sum + grid.reduce((rowSum, row) => rowSum + row.reduce((cellSum, cell) => cellSum + cell.length, 0), 0),
        0
    );
}

export function gridsToText(tables, maxRowsPerTable = 40, maxColsPerRow = 12) {
    return tables
        .map((grid, i) => {
            const prefix = tables.length > 1 ? `[표 ${i + 1}]\n` : '';
            const rows = grid.slice(0, maxRowsPerTable);
            const body = rows.map((row) => row.slice(0, maxColsPerRow).join(' | ')).join('\n');
            const truncatedNote = grid.length > maxRowsPerTable ? `\n(총 ${grid.length}행 중 ${maxRowsPerTable}행만 표시)` : '';
            return prefix + body + truncatedNote;
        })
        .join('\n\n');
}

const describeTable = (grid) => {
    const rowCount = grid.length;
    const colCount = grid.length ? Math.max(...grid.map((row) => row.length)) : 0;
    const header = (grid[0] || []).filter(Boolean);
    return { rowCount, colCount, header };
};

export function buildLocalSummary(tables) {
    if (tables.length === 1) {
        const { rowCount, colCount, header } = describeTable(tables[0]);
        const headerText = header.length ? ` 헤더는 ${header.join(', ')}이에요.` : '';
        return `이 표는 총 ${rowCount}행 ${colCount}열이에요.${headerText} 표 크기가 커서 무료 AI 호출 없이 구조만 알려드려요 — 자세한 내용 요약이 필요하면 표를 나눠서 다시 물어봐주세요.`;
    }

    const MAX_LIST = 5;
    const lines = tables.slice(0, MAX_LIST).map((grid, i) => {
        const { rowCount, colCount, header } = describeTable(grid);
        return `${i + 1}번 표: ${rowCount}행 ${colCount}열${header.length ? ` (헤더: ${header.join(', ')})` : ''}`;
    });
    const more = tables.length > MAX_LIST ? `\n...외 ${tables.length - MAX_LIST}개 표는 생략했어요.` : '';
    return `에디터에 표가 총 ${tables.length}개 있어요.\n${lines.join('\n')}${more}`;
}

export function isTableSummaryRequest(text) {
    return /요약/.test(text);
}

/*
 * [tableFormatters.js] 테이블 시맨틱 구조 생성 유틸리티
 *
 * 역할:
 *   - table 요소 자체의 시맨틱 구조(thead/tbody 분리, th scope, colgroup, caption)를 완성한다.
 *   - tableProcessor.js와 styleUpdater.js에서 호출된다.
 *
 * 주요 함수:
 *
 *   applyColGroupHelper(table, colWidths)
 *     - 기존 colgroup 제거 후 새로 생성.
 *     - 'auto-calc' 모드: 각 행 중 최대 열 수를 계산해 span 속성 + calc(100%/N) 너비 적용.
 *     - 수동 모드: colWidths 배열의 각 값을 width로 설정 (숫자면 % 단위 자동 추가).
 *     - 유효한 너비 값이 없으면 colgroup 자체를 생성하지 않는다.
 *
 *   applyVerticalHeaders(table, isVerticalHeader)
 *     - isVerticalHeader=true: th 내용을 한 글자씩 분리해 사이에 <br class="vt-br"> 삽입.
 *       변환 전 원본 HTML을 data-origin-html 속성에 저장해 복원 가능하게 한다.
 *       colspan이 1보다 큰 th는 세로 변환 대상에서 건너뜀(병합된 헤더는 분할하지 않음).
 *     - isVerticalHeader=false: data-origin-html이 있으면 복원, 없으면 vt-br 클래스 br 제거.
 *       colspan 여부와 무관하게 항상 시도한다 — 세로 변환 후 셀이 병합되어 colspan>1이 되어도
 *       흔적(vt-br/data-origin-html)이 영구히 남지 않도록 복원 경로는 건너뛰지 않는다.
 *
 *   applyTableSemantics(table, wClass, type, isNested, isWrapDiv, headerRows, headerCols, colWidths, boxClass)
 *     - isWrapDiv에 따라 table을 div로 감싸거나 기존 div를 제거하고 wrapperClassName 적용.
 *     - type='row' (좌측 헤더) 모드:
 *       · 논리 열 인덱스(colspan 고려)를 그리드 배열로 계산.
 *       · headerCols에 해당하는 열의 td → <th scope="row"> 변환,
 *         나머지 th → td 변환.
 *     - type='default' (상단 헤더) 모드:
 *       · headerRows에 해당하는 행의 td → <th scope="col"> 변환 후 thead로 이동,
 *         나머지 행은 tbody로 이동.
 *     - 중첩 테이블(isNested=true)은 항상 headerRows/Cols=1로 강제.
 *     - caption 자동 생성: th 텍스트를 모아 "A, B의 정보를 포함한 표입니다." 형식으로 생성.
 *     - 마지막에 applyColGroupHelper 호출해 colgroup 적용.
 */

import { RE_NUMERIC } from './constants';

export const applyColGroupHelper = (table, colWidths) => {
    const oldColgroup = table.querySelector('colgroup');
    if (oldColgroup) oldColgroup.remove();

    const colGroup = document.createElement('colgroup');
    const widthArray = colWidths ? colWidths.split(',').map(w => w.trim()) : [];

    if (widthArray.length === 1 && widthArray[0] === 'auto-calc') {
        let maxCols = 0;
        Array.from(table.rows).forEach(row => {
            let currentCols = 0;
            Array.from(row.cells).forEach(cell => {
                if (cell.style.display === 'none') return;
                currentCols += parseInt(cell.getAttribute('colspan') || '1', 10);
            });
            if (currentCols > maxCols) maxCols = currentCols;
        });

        if (maxCols > 0) {
            const col = document.createElement('col');
            col.setAttribute('span', maxCols);
            col.style.width = `calc(100% / ${maxCols})`;
            colGroup.appendChild(col);
        }
    } else {
        const hasValidWidth = widthArray.some(w => w !== '');
        if (hasValidWidth) {
            widthArray.forEach(width => {
                const col = document.createElement('col');
                if (width) { col.style.width = RE_NUMERIC.test(width) ? `${width}%` : width; }
                colGroup.appendChild(col);
            });
        }
    }

    if (colGroup.hasChildNodes()) {
        const caption = table.querySelector('caption');
        if (caption) { caption.after(colGroup); } else { table.prepend(colGroup); }
    }
};


export const applyVerticalHeaders = (table, isVerticalHeader) => {
    table.querySelectorAll('th').forEach(th => {
        const colspan = parseInt(th.getAttribute('colspan') || '1', 10);

        if (isVerticalHeader) {
            // 병합된(colspan>1) 헤더는 세로 변환 대상에서만 제외한다. 복원(else) 쪽까지 건너뛰면,
            // 세로 변환 후 셀 병합이 일어난 th는 원복할 방법이 없어 vt-br/data-origin-html이 영구히 남는다.
            if (colspan > 1) return;
            if (!th.hasAttribute('data-origin-html')) th.setAttribute('data-origin-html', th.innerHTML);
            th.innerHTML = th.getAttribute('data-origin-html');
            th.querySelectorAll('br').forEach(br => br.remove());
            const walker = document.createTreeWalker(th, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            let n;
            while (n = walker.nextNode()) {
                if (n.nodeValue.replace(/\s+/g, '').length > 0) textNodes.push(n);
            }
            for (let i = 0; i < textNodes.length; i++) {
                const txtNode = textNodes[i];
                const chars = txtNode.nodeValue.replace(/\s+/g, '').split('');
                const frag = document.createDocumentFragment();
                chars.forEach((char, idx) => {
                    frag.appendChild(document.createTextNode(char));
                    if (idx < chars.length - 1 || i < textNodes.length - 1) {
                        const br = document.createElement('br');
                        br.className = 'vt-br';
                        frag.appendChild(br);
                    }
                });
                txtNode.replaceWith(frag);
            }
        } else {
            if (th.hasAttribute('data-origin-html')) {
                th.innerHTML = th.getAttribute('data-origin-html');
                th.removeAttribute('data-origin-html');
            } else {
                th.querySelectorAll('br.vt-br').forEach(br => br.remove());
            }
        }
    });
};

// rootContainer: 루트 div와의 비교가 필요한 경우(styleUpdater) 전달. null이면 체크 생략.
// boxClass: config.boxClassName(콘텐츠 설정에서 변경 가능, 기본값 'box_st2') — 표를 감싼 부모 div가
// "박스"(단일 셀 표 변환 결과)인지 판별할 때 쓴다.
export const applyWrapDiv = (table, wClass, isWrapDiv, rootContainer = null, boxClass = 'box_st2') => {
    if (isWrapDiv) {
        table.removeAttribute('class');
        const parent = table.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'div'
            && !parent.classList.contains(boxClass)
            && parent !== rootContainer) {
            if (wClass) parent.className = wClass;
            else parent.removeAttribute('class');
        } else {
            const wrapperDiv = document.createElement('div');
            if (wClass) wrapperDiv.className = wClass;
            table.parentNode.insertBefore(wrapperDiv, table);
            wrapperDiv.appendChild(table);
        }
    } else {
        if (wClass) table.className = wClass;
        else table.removeAttribute('class');
        const parent = table.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'div'
            && !parent.classList.contains(boxClass)
            && parent !== rootContainer) {
            parent.replaceWith(table);
        }
    }
};

// cell을 th(scope=scopeValue)로 승격하거나 td로 강등한다. td->th 변환 시 원본 셀에 이미 scope
// 속성이 있어도(예: 이전 부분 변환, 수기 편집 HTML) attrs 복사에서 걸러내고 scopeValue로 마지막에
// 지정해 덮어써지지 않게 한다(반대 방향은 기존에도 scope를 걸러내고 있었음 — 방향 간 비대칭 수정).
const convertCellRole = (cell, scopeValue) => {
    if (scopeValue) {
        if (cell.tagName.toLowerCase() === 'td') {
            const th = document.createElement('th');
            while (cell.firstChild) th.appendChild(cell.firstChild);
            for (const attr of cell.attributes) {
                if (attr.name.toLowerCase() !== 'scope') th.setAttribute(attr.name, attr.value);
            }
            th.setAttribute('scope', scopeValue);
            cell.replaceWith(th);
        } else {
            cell.setAttribute('scope', scopeValue);
        }
    } else {
        if (cell.tagName.toLowerCase() === 'th') {
            const td = document.createElement('td');
            while (cell.firstChild) td.appendChild(cell.firstChild);
            for (const attr of cell.attributes) {
                if (attr.name.toLowerCase() !== 'scope') td.setAttribute(attr.name, attr.value);
            }
            cell.replaceWith(td);
        } else {
            cell.removeAttribute('scope');
        }
    }
};

export const applyTableSemantics = (table, wClass, type, isNested, isWrapDiv, headerRows, headerCols, colWidths, boxClass = 'box_st2') => {
    applyWrapDiv(table, wClass, isWrapDiv, null, boxClass);

    const newThead = document.createElement('thead');
    const newTbody = document.createElement('tbody');
    const allRows = Array.from(table.rows);

    if (type === 'row') {
        const grid = [];
        allRows.forEach((row, rowIndex) => {
            grid[rowIndex] = grid[rowIndex] || [];
            let colIndex = 0;
            Array.from(row.cells).forEach(cell => {
                while (grid[rowIndex][colIndex]) colIndex++;
                const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
                const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                for (let r = 0; r < rowspan; r++) {
                    for (let c = 0; c < colspan; c++) {
                        if (!grid[rowIndex + r]) grid[rowIndex + r] = [];
                        grid[rowIndex + r][colIndex + c] = true;
                    }
                }
                cell._logicalCol = colIndex;
                colIndex += colspan;
            });
        });

        let currentHeaderCols = isNested ? 1 : parseInt(headerCols, 10);
        if (isNaN(currentHeaderCols) || currentHeaderCols < 0) currentHeaderCols = 1;

        let finalLeftHeaderCols = 0;
        if (currentHeaderCols > 0) {
            let currentColIndex = 0; 
            for (let step = 0; step < currentHeaderCols; step++) {
                let maxSpan = 1;
                let foundCell = false;
                allRows.forEach(row => {
                    Array.from(row.cells).forEach(cell => {
                        if (cell._logicalCol === currentColIndex) {
                            foundCell = true;
                            const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                            if (colspan > maxSpan) maxSpan = colspan;
                        }
                    });
                });
                if (!foundCell) break; 
                currentColIndex += maxSpan; 
            }
            finalLeftHeaderCols = currentColIndex;
        }

        allRows.forEach((row) => {
            const cells = Array.from(row.cells);
            cells.forEach((cell) => {
                convertCellRole(cell, cell._logicalCol < finalLeftHeaderCols ? 'row' : null);
                delete cell._logicalCol;
            });
            newTbody.appendChild(row);
        });
    } else {
        let currentHeaderRows = isNested ? 1 : parseInt(headerRows, 10);
        if (isNaN(currentHeaderRows) || currentHeaderRows < 0) currentHeaderRows = 1;

        let finalHeaderRowCount = 0;
        if (currentHeaderRows > 0) {
            let currentRowIndex = 0; 
            for (let step = 0; step < currentHeaderRows; step++) {
                if (currentRowIndex >= allRows.length) break; 
                let maxSpan = 1;
                if (allRows[currentRowIndex]) {
                    // cells가 0개(빈 <tr>)면 Math.max(...[])가 -Infinity를 반환해 currentRowIndex가 NaN으로
                    // 오염되고 이후 헤더 감지 전체가 무력화되므로, 빈 행이면 기본값 1을 그대로 사용한다.
                    const spans = Array.from(allRows[currentRowIndex].cells).map(c => parseInt(c.getAttribute('rowspan')) || 1);
                    if (spans.length > 0) maxSpan = Math.max(...spans);
                }
                currentRowIndex += maxSpan;
            }
            finalHeaderRowCount = Math.min(currentRowIndex, allRows.length);
        }

        allRows.forEach((row, index) => {
            const target = index < finalHeaderRowCount ? newThead : newTbody;
            Array.from(row.cells).forEach(cell => {
                convertCellRole(cell, index < finalHeaderRowCount ? 'col' : null);
            });
            target.appendChild(row);
        });
    }

    const existingCaption = table.querySelector('caption');
    if (existingCaption) {
        existingCaption.innerHTML = existingCaption.innerHTML
            .replace(/&nbsp;/gi, ' ')  // HTML 문자열 형태의 &nbsp; 치환
            .replace(/\u00A0/g, ' ');  // 자바스크립트 텍스트 형태의 띄어쓰기 치환
    }
    table.innerHTML = '';
    if (existingCaption) table.appendChild(existingCaption);
    else {
        if (newThead.hasChildNodes() || type === 'row') {
            const headers = type === 'row' ? newTbody.querySelectorAll('th') : newThead.querySelectorAll('th');

            const headerTexts = Array.from(headers).map(th => th.textContent.replace(/\u00A0/g, ' ').trim()) .filter(Boolean);
            if (headerTexts.length > 0) {
                const caption = document.createElement('caption');
                caption.textContent = `${headerTexts.join(', ')}의 정보를 포함한 표입니다.`;
                table.appendChild(caption);
            }
        }
    }
    
    if (newThead.hasChildNodes()) table.appendChild(newThead);
    table.appendChild(newTbody);
    applyColGroupHelper(table, colWidths);
};
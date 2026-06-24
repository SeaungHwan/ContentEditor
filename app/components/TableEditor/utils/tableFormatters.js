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
 *       colspan이 1보다 큰 th는 건너뜀.
 *     - isVerticalHeader=false: data-origin-html이 있으면 복원, 없으면 vt-br 클래스 br 제거.
 *
 *   applyTableSemantics(table, wClass, type, isNested, isWrapDiv, headerRows, headerCols, colWidths)
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
        if (colspan > 1) return; 

        if (isVerticalHeader) {
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

export const applyTableSemantics = (table, wClass, type, isNested, isWrapDiv, headerRows, headerCols, colWidths) => {
    if (isWrapDiv) {
        table.removeAttribute('class');
        const parent = table.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'div' && !parent.classList.contains('box-st') && !parent.classList.contains('box_st2')) { 
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
        if (parent && parent.tagName.toLowerCase() === 'div' && !parent.classList.contains('box-st') && !parent.classList.contains('box_st2')) {
            parent.replaceWith(table);
        }
    }

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
                if (cell._logicalCol < finalLeftHeaderCols) {
                    if (cell.tagName.toLowerCase() === 'td') {
                        const th = document.createElement('th');
                        th.setAttribute('scope', 'row');
                        while (cell.firstChild) th.appendChild(cell.firstChild);
                        for (const attr of cell.attributes) th.setAttribute(attr.name, attr.value);
                        cell.replaceWith(th);
                    } else {
                        cell.setAttribute('scope', 'row');
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
                    maxSpan = Math.max(...Array.from(allRows[currentRowIndex].cells).map(c => parseInt(c.getAttribute('rowspan')) || 1));
                }
                currentRowIndex += maxSpan; 
            }
            finalHeaderRowCount = Math.min(currentRowIndex, allRows.length);
        }

        allRows.forEach((row, index) => {
            const target = index < finalHeaderRowCount ? newThead : newTbody;
            Array.from(row.cells).forEach(cell => {
                if (index < finalHeaderRowCount) {
                    if (cell.tagName.toLowerCase() === 'td') {
                        const th = document.createElement('th');
                        th.setAttribute('scope', 'col');
                        while (cell.firstChild) th.appendChild(cell.firstChild);
                        for (const attr of cell.attributes) th.setAttribute(attr.name, attr.value);
                        cell.replaceWith(th);
                    } else {
                        cell.setAttribute('scope', 'col');
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
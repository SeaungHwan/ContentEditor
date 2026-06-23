"use client";
import React, { useEffect } from 'react';

const TEMPLATES = [
    {
        id: 'basic2',
        name: '2열 기본표',
        desc: '구분 / 내용',
        rows: [['구분', '내용'], ['', ''], ['', ''], ['', '']],
        isHeader: [true],
    },
    {
        id: 'basic3',
        name: '3열 기본표',
        desc: '번호 / 항목 / 내용',
        rows: [['번호', '항목', '내용'], ['1', '', ''], ['2', '', ''], ['3', '', '']],
        isHeader: [true],
    },
    {
        id: 'roster',
        name: '학생 명단',
        desc: '번호 / 이름 / 역할 / 비고',
        rows: [
            ['번호', '이름', '역할', '비고'],
            ['1', '', '', ''], ['2', '', '', ''], ['3', '', '', ''],
            ['4', '', '', ''], ['5', '', '', ''],
        ],
        isHeader: [true],
    },
    {
        id: 'schedule',
        name: '주간 일정표',
        desc: '교시 × 요일 (월~금)',
        rows: [
            ['교시\\요일', '월', '화', '수', '목', '금'],
            ['1교시', '', '', '', '', ''],
            ['2교시', '', '', '', '', ''],
            ['3교시', '', '', '', '', ''],
            ['4교시', '', '', '', '', ''],
            ['5교시', '', '', '', '', ''],
        ],
        isHeader: [true],
        rowHeader: true,
    },
    {
        id: 'score',
        name: '평가 점수표',
        desc: '항목 / 배점 / 점수 / 비고',
        rows: [
            ['평가항목', '배점', '점수', '비고'],
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['합계', '100', '', ''],
        ],
        isHeader: [true],
    },
];

function buildTemplateHtml(tpl) {
    const headerIndexes = new Set(tpl.isHeader || []);
    let html = '<table>\n';
    tpl.rows.forEach((row, ri) => {
        if (ri === 0 && headerIndexes.has(0)) {
            html += '  <thead><tr>';
            row.forEach(cell => { html += `<th>${cell}</th>`; });
            html += '</tr></thead>\n  <tbody>\n';
        } else if (ri === tpl.rows.length - 1 && !headerIndexes.has(0)) {
            html += '  <tr>';
            row.forEach((cell, ci) => {
                if (tpl.rowHeader && ci === 0) html += `<th>${cell}</th>`;
                else html += `<td>${cell}</td>`;
            });
            html += '</tr>\n</tbody>\n';
        } else {
            html += '  <tr>';
            row.forEach((cell, ci) => {
                if (tpl.rowHeader && ci === 0) html += `<th>${cell}</th>`;
                else html += `<td>${cell || '&nbsp;'}</td>`;
            });
            if (ri === tpl.rows.length - 1) html += '</tr>\n</tbody>\n';
            else html += '</tr>\n';
        }
    });
    if (!html.includes('</tbody>')) html += '</tbody>\n';
    html += '</table>';
    return html;
}

const TemplateModal = React.memo(({ onClose, onInsert, layout, fadeStyle, config = {} }) => {
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);

    const colorOverrideStyle = {};
    if (config.primaryColor)   colorOverrideStyle['--color-primary']   = config.primaryColor;
    if (config.secondaryColor) colorOverrideStyle['--color-secondary'] = config.secondaryColor;
    if (config.tertiaryColor)  colorOverrideStyle['--color-tertiary']  = config.tertiaryColor;
    if (config.accentColor)    colorOverrideStyle['--color-accent']    = config.accentColor;

    const cellStyle = { padding: '0.2rem', fontSize: '0.6rem' };

    return (
        <div className={layout.modalPopWrap} style={fadeStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`${layout.modalPop} ${layout.templateModalPop}`}>
                <div className={layout.titWrap}>
                    <h4 className={`tit-st contents ${layout.modalTitH4}`}>템플릿</h4>
                    <button type="button" onClick={onClose} className={layout.modalCloseBtn}>
                        <i className="ri-close-line" />
                    </button>
                </div>
                <p className={layout.modalSubText}>
                    원하는 템플릿을 클릭하면 현재 커서 위치에 표가 삽입됩니다.
                </p>
                <div className={layout.templateGrid}>
                    {TEMPLATES.map(tpl => (
                        <button
                            key={tpl.id}
                            type="button"
                            className={layout.templateCard}
                            onClick={() => onInsert(buildTemplateHtml(tpl))}
                        >
                            <div className={layout.tplName}>{tpl.name}</div>
                            <div className={layout.tplDesc}>{tpl.desc}</div>
                            <div className={layout.tplPreview}>
                                <div data-theme={config.theme} style={colorOverrideStyle}>
                                    <div className="tbl-st">
                                        <table>
                                            <thead>
                                                <tr>
                                                    {tpl.rows[0].slice(0, 4).map((cell, ci) => (
                                                        <th key={ci} style={cellStyle}>{cell}</th>
                                                    ))}
                                                    {tpl.rows[0].length > 4 && <th style={cellStyle}>…</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tpl.rows.slice(1, 3).map((row, ri) => (
                                                    <tr key={ri}>
                                                        {row.slice(0, 4).map((cell, ci) => (
                                                            <td key={ci} style={cellStyle}>{cell || '·'}</td>
                                                        ))}
                                                        {row.length > 4 && <td style={cellStyle}>…</td>}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="ar mgt20">
                    <button type="button" onClick={onClose} className="btn-st gray">닫기</button>
                </div>
            </div>
        </div>
    );
});

TemplateModal.displayName = 'TemplateModal';
export default TemplateModal;

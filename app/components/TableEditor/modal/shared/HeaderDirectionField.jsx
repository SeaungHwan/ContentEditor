/*
 * [HeaderDirectionField.jsx] 표 헤더 방향(Col/Row) 라디오 + 기준 행(시작) 입력
 *
 * TableEditModal / GlobalTableConfigModal에서 동일하던 UI를 공통 추출.
 * guide* 프롭이 없으면(undefined) 가이드 하이라이트 없이 렌더링된다.
 */
"use client";
import React from 'react';

export default function HeaderDirectionField({
    layout, tableType, headerRows, headerCols, onTableTypeChange, onHeaderNumChange,
    colGuide, rowGuide, numGuide,
}) {
    const headerValue = tableType === 'default' ? headerRows : headerCols;
    return (
        <>
            <div className={`${layout.flexRow} ${layout.gap02}`}>
                <span className={layout.modalLabelSpan}>방향</span>
                <div className={`${layout.flexCol} ${layout.gap06}`}>
                    <label className={`${layout.radioItem} ${colGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={colGuide || undefined}>
                        <input type="radio" checked={tableType === 'default'} onChange={() => onTableTypeChange('default')} />
                        <span className={layout.modalLabelSpan}>Col</span>
                    </label>
                    <label className={`${layout.radioItem} ${rowGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={rowGuide || undefined}>
                        <input type="radio" checked={tableType === 'row'} onChange={() => onTableTypeChange('row')} />
                        <span className={layout.modalLabelSpan}>Row</span>
                    </label>
                </div>
            </div>
            <div className={`${layout.flexRow} ${layout.gap02}`}>
                <span className={layout.modalLabelSpan}>기준 행(시작)</span>
                <div className={`${layout.relative} ${layout.gap02} ${numGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={numGuide || undefined}>
                    <input type="number" min="0" max="10" className={`${layout.Inp} ${layout.numInp}`}
                        value={headerValue}
                        onChange={(e) => onHeaderNumChange(e.target.value === '' ? '' : parseInt(e.target.value))}
                    />
                </div>
            </div>
        </>
    );
}

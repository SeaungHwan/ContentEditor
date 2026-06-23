/*
 * [TableEditModal.jsx] 개별 테이블 설정 모달
 *
 * 역할:
 *   - 에디터 내 특정 테이블의 설정을 전역 설정과 독립적으로 변경한다.
 *   - 설정 적용 시 해당 테이블에만 data-local-config / data-local-colwidths 속성이 저장되어
 *     이후 updateStylesOnly와 cleanTableHtml에서 전역 설정보다 우선 적용된다.
 *
 * 설정 가능 항목:
 *   - 테이블 클래스(wrapperClassName), DIV 감싸기(isWrapDiv)
 *   - 헤더 방향(tableType: row/default), 헤더 행/열 수(headerRows/headerCols)
 *   - TH 세로 방향(isVerticalHeader)
 *   - 색상 모드(tableIsColorMode, tableIsColorClassMode)
 *   - 표 내부 ul 클래스, ol 타입, 마커 유지 여부
 *   - 열 너비(ColWidthControl 컴포넌트)
 *   - 다음 인접 테이블 병합(isMergeTables)
 *
 * 초기값:
 *   - existingConfig가 있으면 해당 테이블의 기존 설정으로, 없으면 globalConfig로 초기화.
 *
 * UI:
 *   - useModalDrag으로 드래그 이동 가능.
 *   - fadeStyle(opacity transition)으로 페이드 인/아웃.
 */


"use client";
import React, { useState, useEffect } from 'react';
import ColWidthControl from '../ColWidthControl';
import { TABLE_CLASS_SUGGESTIONS, UL_CLASS_SUGGESTIONS, OL_OPTIONS, UL_NONE_VALUE } from '../utils/constants';
import { useModalDrag } from '../hooks/useModalDrag';
import { useClickOutsideDropdown } from '../hooks/useClickOutsideDropdown';

export default function TableEditModal({ onClose, onApply, globalConfig, layout, existingConfig, existingColWidths, fadeStyle }) {
    const [localConfig, setLocalConfig] = useState(existingConfig || { ...globalConfig });
    const [colWidths, setColWidths] = useState(existingColWidths || ['auto']);
    const [activeDropdown, setActiveDropdown] = useClickOutsideDropdown();
    const { dragStyle, handleDragStart } = useModalDrag();

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateLocalConfig = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));

    const handleApply = () => onApply(localConfig, colWidths);

    const handleTableOlToggle = (e, optValue) => {
        e.preventDefault();
        const current = Array.isArray(localConfig.tableOlType) ? localConfig.tableOlType : [];
        const next = current.includes(optValue) ? current.filter(v => v !== optValue) : [...current, optValue];
        updateLocalConfig('tableOlType', next);
    };

    return (
        <div className={layout.modalContentBox} style={{ ...dragStyle, ...fadeStyle }}>
                <h2 className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>테이블 설정<em>ㅣ 테이블 개별 옵션 변경</em></span>
                </h2>

                <div className={layout.modalBody}>
                    <div className={layout.configSection}>
                        <span className={layout.configLabel}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/>헤더</span>
                        <div className={`${layout.flexCol} ${layout.gap15}`}>
                            <div className={`${layout.flexRow} ${layout.gap02}`}>
                                <span className={layout.modalLabelSpan} title="이 표에만 적용할 스타일입니다.">클래스</span>
                                <div className={layout.relative} data-dropdown="true">
                                    {(() => {
                                        const wVal = localConfig.wrapperClassName || '';
                                        const matchedW = TABLE_CLASS_SUGGESTIONS.find(opt => opt.value === wVal);
                                        return (
                                            <input className={`${layout.Inp} ${layout.selectInp} ${layout.tbl}`} type="text"
                                                value={matchedW ? matchedW.label : wVal}
                                                readOnly={!!matchedW}
                                                onChange={(e) => updateLocalConfig('wrapperClassName', e.target.value)}
                                                onClick={() => setActiveDropdown('tableClass')}
                                                onKeyDown={(e) => {if (e.key === 'Enter') {setActiveDropdown(null);e.target.blur();}}}
                                            />
                                        );
                                    })()}
                                    <i className={activeDropdown === 'tableClass' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}  onClick={() => setActiveDropdown(activeDropdown === 'tableClass' ? null : 'tableClass')}></i>
                                    {activeDropdown === 'tableClass' && (
                                        <ul className={layout.dropdownStyle}>
                                            {TABLE_CLASS_SUGGESTIONS.map((cls, idx) => (
                                                <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateLocalConfig('wrapperClassName', cls.value); setActiveDropdown(null); }}>
                                                    {cls.label}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className={`${layout.flexRow} ${layout.gap02}`}>
                                <span className={layout.modalLabelSpan}>방향</span>
                                <div className={`${layout.flexCol} ${layout.gap06}`}>
                                    <label className={layout.radioItem}>
                                        <input type="radio" checked={localConfig.tableType === 'default'}
                                            onChange={() => { updateLocalConfig('tableType', 'default'); updateLocalConfig('headerRows', 1); updateLocalConfig('headerCols', 1); }} />
                                        <span className={layout.modalLabelSpan}>Col</span>
                                    </label>
                                    <label className={layout.radioItem}>
                                        <input type="radio" checked={localConfig.tableType === 'row'}
                                            onChange={() => { updateLocalConfig('tableType', 'row'); updateLocalConfig('headerRows', 1); updateLocalConfig('headerCols', 1); }} />
                                        <span className={layout.modalLabelSpan}>Row</span>
                                    </label>
                                </div>
                            </div>
                            <div className={`${layout.flexRow} ${layout.gap02}`}>
                                <span className={layout.modalLabelSpan}>기준 행(시작)</span>
                                <div className={`${layout.relative} ${layout.gap02}`}>
                                <input type="number" min="0" max="10" className={`${layout.Inp} ${layout.numInp}`}
                                    value={localConfig.tableType === 'default' ? localConfig.headerRows : localConfig.headerCols}
                                    onChange={(e) => updateLocalConfig(localConfig.tableType === 'default' ? 'headerRows' : 'headerCols', e.target.value === '' ? '' : parseInt(e.target.value))}
                                />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={layout.configSection}>
                        <span className={layout.configLabel}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 리스트</span>
                        <div className={layout.flexCol}>
                            <div className={`${layout.flexCol} ${layout.gap06}`}>
                                <span className={layout.modalLabelSpan} title="이 표 내부 목록 항목(ul)에 적용할 스타일입니다.">ul</span>
                                <div className={layout.relative} data-dropdown="true">
                                    {(() => {
                                        const ulVal = localConfig.tableUlClassName;
                                        const matchedUl = UL_CLASS_SUGGESTIONS.find(opt => opt.value === ulVal);
                                        return (
                                            <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                                                value={ulVal === UL_NONE_VALUE ? '' : (matchedUl ? matchedUl.label : (ulVal || ''))}
                                                placeholder={ulVal === UL_NONE_VALUE ? '선택 안함' : '스타일 선택'}
                                                readOnly={!!matchedUl || ulVal === UL_NONE_VALUE}
                                                onChange={(e) => updateLocalConfig('tableUlClassName', e.target.value)}
                                                onClick={() => setActiveDropdown('tableUl')}
                                                onKeyDown={(e) => {if (e.key === 'Enter') {setActiveDropdown(null);e.target.blur();}}}
                                            />
                                        );
                                    })()}
                                    <i className={activeDropdown === 'tableUl' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}  onClick={() => setActiveDropdown(activeDropdown === 'tableUl' ? null : 'tableUl')}></i>
                                    {activeDropdown === 'tableUl' && (
                                        <ul className={layout.dropdownStyle}>
                                            <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateLocalConfig('tableUlClassName', UL_NONE_VALUE); setActiveDropdown(null); }}>
                                                선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                            </li>
                                            {UL_CLASS_SUGGESTIONS.map((cls, idx) => (
                                                <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateLocalConfig('tableUlClassName', cls.value); setActiveDropdown(null); }}>
                                                    {cls.label}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className={`${layout.flexCol} ${layout.gap06}`}>
                                <span className={layout.modalLabelSpan}>ol</span>
                                <div className={layout.relative} data-dropdown="true">
                                    <input className={`${layout.Inp} ${layout.selectInp}`} type="text" readOnly
                                        value={Array.isArray(localConfig.tableOlType) && localConfig.tableOlType.length > 0 ? localConfig.tableOlType.map(val => OL_OPTIONS.find(opt => opt.value === val)?.label).filter(Boolean).join(', ') : ''}
                                        placeholder="선택 안함"
                                        onClick={() => setActiveDropdown('tableOlType')}
                                    />
                                    <i className={activeDropdown === 'tableOlType' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}  onClick={() => setActiveDropdown(activeDropdown === 'tableOlType' ? null : 'tableOlType')}></i>
                                    {activeDropdown === 'tableOlType' && (
                                        <ul className={layout.dropdownStyle}>
                                            <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateLocalConfig('tableOlType', []); setActiveDropdown(null); }}>
                                                선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                            </li>
                                            {OL_OPTIONS.map((opt, index) => (
                                                <li key={index} className={layout.listItemStyle} onMouseDown={(e) => handleTableOlToggle(e, opt.value)}>
                                                    {opt.label} {Array.isArray(localConfig.tableOlType) && localConfig.tableOlType.includes(opt.value) && <i className={`ri-check-line ${layout.checkIcon}`}></i>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className={`${layout.flexCol} ${layout.gap06} ${layout.mglN05}`}>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.tableUseAtteMarker !== false} onChange={(e) => updateLocalConfig('tableUseAtteMarker', e.target.checked)} />
                                <span>※ 변환</span>
                            </label>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.tableKeepMarker || false} onChange={(e) => updateLocalConfig('tableKeepMarker', e.target.checked)} />
                                <span>기호 유지</span>
                            </label>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.tableListStartFrom2 || false} onChange={(e) => updateLocalConfig('tableListStartFrom2', e.target.checked)} />
                                <span>시작(리스트2)</span>
                            </label>
                            {localConfig.isColorMode && (
                                <label className={layout.checkItem}>
                                    <input type="checkbox" checked={localConfig.isColorClassMode || false} onChange={(e) => updateLocalConfig('isColorClassMode', e.target.checked)} />
                                    <span>색상 클래스</span>
                                </label>
                            )}
                            </div>
                        </div>
                    </div>

                    <div className={layout.configSection}>
                        <span className={layout.configLabel}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 옵션</span>
                        <div className={`${layout.flexCol} ${layout.gap06}`}>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.isWrapDiv || false} onChange={(e) => updateLocalConfig('isWrapDiv', e.target.checked)} />
                                <span>DIV 감싸기</span>
                            </label>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.isVerticalHeader || false} onChange={(e) => updateLocalConfig('isVerticalHeader', e.target.checked)} />
                                <span>헤더 수직 정렬</span>
                            </label>
                        </div>
                        <ColWidthControl colWidths={colWidths} setColWidths={setColWidths} layout={layout} isGuideMode={false} />
                    </div>
                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose}>취소</button>
                    <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleApply}>저장 및 적용하기</button>
                </div>
            </div>
    );
}

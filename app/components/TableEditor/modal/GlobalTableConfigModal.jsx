/*
 * [GlobalTableConfigModal.jsx] 테이블 전역 설정 모달
 *
 * 역할:
 *   - 에디터 내 모든 테이블에 공통 적용되는 설정을 변경한다.
 *   - 적용 시 TableConfigContext의 config를 업데이트하며, 개별 설정(data-local-config)이
 *     있는 테이블은 해당 설정이 우선 적용되므로 영향받지 않는다.
 *
 * 설정 가능 항목 (TableEditModal과 동일 구조):
 *   - 테이블 클래스, DIV 감싸기, 헤더 방향/범위, TH 세로 방향
 *   - 색상 모드 및 클래스 변환 여부
 *   - 표 내부 ul/ol 설정, 열 너비(ColWidthControl)
 *
 * 가이드 모드:
 *   - isGuideMode=true이면 각 설정 항목에 data-guide 말풍선 표시.
 *   - 모달 내부에서 가이드 모드를 토글할 수 있는 버튼 포함.
 */

"use client";
import React, { useState, useEffect } from 'react';
import ColWidthControl from '../ColWidthControl';
import { TABLE_CLASS_SUGGESTIONS, TABLE_SCROLL_SUGGESTIONS, SCROLL_CLASSES, UL_CLASS_SUGGESTIONS, OL_OPTIONS, UL_NONE_VALUE, GUIDE_MESSAGES } from '../utils/constants';
import { useModalDrag } from '../hooks/useModalDrag';
import { useClickOutsideDropdown } from '../hooks/useClickOutsideDropdown';

export default function GlobalTableConfigModal({ onClose, onApply, globalConfig, colWidths, layout, isGuideMode, setIsGuideMode, fadeStyle }) {
    const [localConfig, setLocalConfig] = useState({ ...globalConfig });
    const [localColWidths, setLocalColWidths] = useState([...colWidths]);
    const [activeDropdown, setActiveDropdown] = useClickOutsideDropdown();
    const { dragStyle, handleDragStart } = useModalDrag();

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateConfig = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));
    const handleApply = () => onApply(localConfig, localColWidths);

    const handleTableOlToggle = (e, optValue) => {
        e.preventDefault();
        const current = Array.isArray(localConfig.tableOlType) ? localConfig.tableOlType : [];
        const next = current.includes(optValue) ? current.filter(v => v !== optValue) : [...current, optValue];
        updateConfig('tableOlType', next);
    };

    return (
        <div className={`${layout.modalContentBox}`} style={{ ...dragStyle, ...fadeStyle }}>
                <h2 className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>테이블 설정<em>ㅣ 테이블 맞춤 옵션 변경</em></span>

                    <div className={layout.swichBtnWrap}>
                        <span className={layout.colTit}>색상모드</span>
                           <div className={layout.swichBtnGroup}>
                            <button type="button"
                                title="테이블 색상 모드 전환"
                                className={`${layout.toggleSwitch} ${localConfig.tableIsColorMode ? layout.active : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`}
                                onClick={() => updateConfig('tableIsColorMode', !localConfig.tableIsColorMode)}
                                data-guide={isGuideMode ? GUIDE_MESSAGES.modeSelect : undefined}
                            >
                                <span className={layout.toggleKnob}></span>
                            </button>
                            </div>
                        </div>
                    <button type="button" data-guide-toggle="true" className={layout.guideBtn} onClick={() => setIsGuideMode(!isGuideMode)} title={isGuideMode ? '가이드를 종료합니다.' : '가이드'}>
                    <div className={`${layout.guide} ${isGuideMode ? `${layout.guideClose}` : ''}`}>
                        <img src='/00_common/images/sub_com/guide.svg' alt="아이콘"/>
                    </div>
                    </button>
                </h2>
                
                <div className={layout.modalBody}>
                    <div className={layout.configSection}>
                        <span className={layout.configLabel} title="모든 표에 공통 적용되는 스타일과 헤더 방향을 설정합니다."><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/>헤더</span>
                        <div className={`${layout.flexCol} ${layout.gap15}`}>
<div className={`${layout.flexRow} ${layout.gap02}`}>
                        <span className={layout.modalLabelSpan} title="표 외곽을 감싸는 div에 적용할 스타일입니다.">클래스</span>
                        <div className={`${layout.relative} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.classTableConfig : undefined} data-dropdown="true">
                            {(() => {
                                const wVal = localConfig.wrapperClassName || '';
                                const activeScroll = SCROLL_CLASSES.find(sc => wVal.split(' ').includes(sc));
                                const matchedBase = TABLE_CLASS_SUGGESTIONS.find(opt => opt.value === wVal);
                                const matchedScroll = activeScroll ? TABLE_SCROLL_SUGGESTIONS.find(s => s.scrollClass === activeScroll) : null;
                                const displayLabel = matchedBase ? matchedBase.label : matchedScroll ? matchedScroll.label : wVal;
                                return (
                                    <input className={`${layout.Inp} ${layout.selectInp} ${layout.tbl}`} type="text"
                                        value={displayLabel}
                                        readOnly={!!(matchedBase || matchedScroll)}
                                        onChange={(e) => updateConfig('wrapperClassName', e.target.value)}
                                        onClick={() => setActiveDropdown('tableClass')}
                                        onKeyDown={(e) => {if (e.key === 'Enter') {setActiveDropdown(null);e.target.blur();}}}
                                    />
                                );
                            })()}
                            <i className={activeDropdown === 'tableClass' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}  onClick={() => setActiveDropdown(activeDropdown === 'tableClass' ? null : 'tableClass')}></i>
                            {activeDropdown === 'tableClass' && (
                                <ul className={`${layout.dropdownStyle}`}>
                                    {TABLE_CLASS_SUGGESTIONS.map((cls, idx) => (
                                        <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('wrapperClassName', cls.value); setActiveDropdown(null); }}>
                                            {cls.label}
                                        </li>
                                    ))}
                                    {TABLE_SCROLL_SUGGESTIONS.map((scroll, idx) => {
                                        const wVal = localConfig.wrapperClassName || '';
                                        const base = wVal.split(' ').filter(c => !SCROLL_CLASSES.includes(c)).join(' ').trim();
                                        const newVal = base ? `${base} ${scroll.scrollClass}` : scroll.scrollClass;
                                        return (
                                            <li key={`scroll-${idx}`} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('wrapperClassName', newVal); setActiveDropdown(null); }}>
                                                {scroll.label}
                                            </li>
                                        );
                                    })}
                                    <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('wrapperClassName', ''); setActiveDropdown(null); }}>
                                        직접 입력 <i className="ri-edit-line"></i>
                                    </li>
                                </ul>
                            )}
                        </div>
                        </div>
                            <div className={`${layout.flexRow} ${layout.gap02}`}>
                            <span className={layout.modalLabelSpan}>방향</span>
                            <div className={`${layout.flexCol} ${layout.gap06}`}>
                            <label className={`${layout.radioItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.HeaderTop : undefined}>
                                <input type="radio" checked={localConfig.tableType === 'default'} 
                                    onChange={() => { updateConfig('tableType', 'default'); updateConfig('headerRows', 1); updateConfig('headerCols', 1); }} /> 
                                <span className={layout.modalLabelSpan}>Col</span>
                            </label>
                            <label className={`${layout.radioItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.HeaderLeft : undefined}>
                                <input type="radio" checked={localConfig.tableType === 'row'} 
                                    onChange={() => { updateConfig('tableType', 'row'); updateConfig('headerRows', 1); updateConfig('headerCols', 1); }} /> 
                                <span className={layout.modalLabelSpan}>Row</span>
                            </label>
                            </div>
                            </div>
                             <div className={`${layout.flexRow} ${layout.gap02}`} >
                            <span className={layout.modalLabelSpan}>기준 행(시작)</span>
                            <div className={`${layout.relative} ${layout.gap02} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.HeaderConfig : undefined}>
                            <input type="number" min="0" max="10" className={`${layout.Inp} ${layout.numInp}`}
                                value={localConfig.tableType === 'default' ? localConfig.headerRows : localConfig.headerCols} 
                                onChange={(e) => updateConfig(localConfig.tableType === 'default' ? 'headerRows' : 'headerCols', e.target.value === '' ? '' : parseInt(e.target.value))} 
                            />
                            </div>
                        </div>
                        </div>
                       
                    </div>
                    <div className={layout.configSection}>
                        <span className={layout.configLabel} title="표 내부 목록(ul/ol) 변환 방식을 설정합니다."><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 리스트</span>
                        <div className={layout.flexCol}>
                            <div className={`${layout.flexCol} ${layout.gap06}`}>
                                <span className={layout.modalLabelSpan} title="표 내부 목록 항목(ul)에 적용할 스타일입니다.">ul</span>
                                <div className={`${layout.relative} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.classUlConfig : undefined} data-dropdown="true">
                                    {(() => {
                                        const ulVal = localConfig.tableUlClassName;
                                        const matchedUl = UL_CLASS_SUGGESTIONS.find(opt => opt.value === ulVal);
                                        return (
                                            <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                                                value={ulVal === UL_NONE_VALUE ? '' : (matchedUl ? matchedUl.label : (ulVal || ''))}
                                                placeholder={ulVal === UL_NONE_VALUE ? '선택 안함' : '스타일 선택'}
                                                readOnly={!!matchedUl || ulVal === UL_NONE_VALUE}
                                                onChange={(e) => updateConfig('tableUlClassName', e.target.value)}
                                                onClick={() => setActiveDropdown('tableUl')}
                                                onKeyDown={(e) => {if (e.key === 'Enter') {setActiveDropdown(null);e.target.blur();}}}
                                            />
                                        );
                                    })()}
                                    <i className={activeDropdown === 'tableUl' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === 'tableUl' ? null : 'tableUl')}></i>
                                    {activeDropdown === 'tableUl' && (
                                        <ul className={`${layout.dropdownStyle}`}>
                                            <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('tableUlClassName', UL_NONE_VALUE); setActiveDropdown(null); }}>
                                                선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                            </li>
                                            {UL_CLASS_SUGGESTIONS.map((cls, idx) => (
                                                <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('tableUlClassName', cls.value); setActiveDropdown(null); }}>
                                                    {cls.label}
                                                </li>
                                            ))}
                                            <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('tableUlClassName', ''); setActiveDropdown(null); }}>
                                                직접 입력 <i className="ri-edit-line"></i>
                                            </li>
                                        </ul>
                                    )}
                                </div>

                            </div>

                            <div className={`${layout.flexCol} ${layout.gap06}`}>
                                <span className={layout.modalLabelSpan}>ol</span>
                                <div className={`${layout.relative} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.classOlConfig : undefined} data-dropdown="true">
                                    <input className={`${layout.Inp} ${layout.selectInp}`} type="text" readOnly
                                        value={Array.isArray(localConfig.tableOlType) && localConfig.tableOlType.length > 0 ? localConfig.tableOlType.map(val => OL_OPTIONS.find(opt => opt.value === val)?.label).filter(Boolean).join(', ') : ''}
                                        placeholder="선택 안함"
                                        onClick={() => setActiveDropdown('tableOlType')}
                                    />
                                    <i className={activeDropdown === 'tableOlType' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === 'tableOlType' ? null : 'tableOlType')}></i>

                                    {activeDropdown === 'tableOlType' && (
                                        <ul className={`${layout.dropdownStyle}`}>
                                            <li className={`${layout.listItemStyle}`} onMouseDown={(e) => { e.preventDefault(); updateConfig('tableOlType', []); setActiveDropdown(null); }}>
                                                 선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                            </li>
                                            {OL_OPTIONS.map((opt, index) => (
                                                <li key={index} className={`${layout.listItemStyle}`} onMouseDown={(e) => handleTableOlToggle(e, opt.value)}>
                                                    {opt.label} {Array.isArray(localConfig.tableOlType) && localConfig.tableOlType.includes(opt.value) && <i className={`ri-check-line ${layout.checkIcon}`}></i>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                             <div className={`${layout.flexCol} ${layout.gap06} ${layout.mglN05}`}>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.atteMarker : undefined}>
                                <input type="checkbox" checked={localConfig.tableUseAtteMarker !== false} onChange={(e) => updateConfig('tableUseAtteMarker', e.target.checked)} />
                                <span>※ 변환</span>
                            </label>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.noList : undefined} data-dropdown="true">
                                <input type="checkbox" checked={localConfig.tableKeepMarker || false} onChange={(e) => updateConfig('tableKeepMarker', e.target.checked)} />
                                <span>기호 유지</span>
                            </label>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.List2 : undefined} data-dropdown="true">
                                <input type="checkbox" checked={localConfig.tableListStartFrom2 || false} onChange={(e) => updateConfig('tableListStartFrom2', e.target.checked)} />
                                <span>시작(리스트2)</span>
                            </label>
                            {localConfig.tableIsColorMode && (
                                <label className={layout.checkItem}>
                                    <input
                                        type="checkbox"
                                        checked={localConfig.tableIsColorClassMode || false}
                                        onChange={(e) => updateConfig('tableIsColorClassMode', e.target.checked)}
                                    />
                                    <span>색상 클래스</span>
                                </label>
                            )}
                            </div>
                        </div>
                    </div>

                    <div className={layout.configSection}>
                        <span className={layout.configLabel}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 옵션</span>
                        <div className={`${layout.flexCol} ${layout.gap06}`}>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.divType : undefined} data-dropdown="true"><input type="checkbox" checked={localConfig.isWrapDiv || false} onChange={(e) => updateConfig('isWrapDiv', e.target.checked)} /> <span>DIV 감싸기</span></label>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.verticalHeader : undefined} data-dropdown="true"><input type="checkbox" checked={localConfig.isVerticalHeader || false} onChange={(e) => updateConfig('isVerticalHeader', e.target.checked)} /> <span>헤더 수직 정렬</span></label>
                        </div>
                        <ColWidthControl colWidths={localColWidths} setColWidths={setLocalColWidths} layout={layout} isGuideMode={isGuideMode} guideMessage={GUIDE_MESSAGES.colWidth}/>
                    </div>
                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose} title="변경사항 취소 후 닫기">취소</button>
                    <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleApply} title="테이블 설정 저장 및 적용">저장 및 적용하기</button>
                </div>
            </div>
    );
}
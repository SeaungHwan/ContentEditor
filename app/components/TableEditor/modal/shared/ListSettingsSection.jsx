/*
 * [ListSettingsSection.jsx] "리스트" 설정 섹션 (ul 드롭다운 + ol 드롭다운 + 옵션 체크박스)
 *
 * TableEditModal(표 내부), GlobalTableConfigModal(표 내부), ContentConfigModal(본문 텍스트)에서
 * 필드 키 접두사만 다르고 구조가 동일하던 UI를 공통 추출한 것.
 * guide* 프롭이 없으면(undefined) 가이드 하이라이트 없이 렌더링된다(TableEditModal은 가이드 자체 없음).
 */
"use client";
import React from 'react';
import { UL_CLASS_SUGGESTIONS, OL_OPTIONS, UL_NONE_VALUE } from '../../utils/constants';

export default function ListSettingsSection({
    layout,
    sectionHintTitle,
    ulHintTitle, ulValue, onUlChange, ulDropdownKey, ulGuide,
    olDropdownKey, olValue, onOlChange, olGuide,
    atteChecked, onAtteChange, atteGuide, atteDataDropdown,
    keepChecked, onKeepChange, noListGuide, keepDataDropdown,
    startFrom2Checked, onStartFrom2Change, list2Guide, list2DataDropdown,
    showColorToggle, colorChecked, onColorChange, colorGuide, colorDataDropdown,
    activeDropdown, setActiveDropdown,
}) {
    const matchedUl = UL_CLASS_SUGGESTIONS.find(opt => opt.value === ulValue);
    const olArray = Array.isArray(olValue) ? olValue : [];

    const toggleOl = (e, optValue) => {
        e.preventDefault();
        const next = olArray.includes(optValue) ? olArray.filter(v => v !== optValue) : [...olArray, optValue];
        onOlChange(next);
    };

    return (
        <div className={layout.configSection}>
            <span className={layout.configLabel} title={sectionHintTitle}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 리스트</span>
            <div className={layout.flexCol}>
                <div className={`${layout.flexCol} ${layout.gap06}`}>
                    <span className={layout.modalLabelSpan} title={ulHintTitle}>ul</span>
                    <div className={`${layout.relative} ${ulGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={ulGuide || undefined} data-dropdown="true">
                        <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                            value={ulValue === UL_NONE_VALUE ? '' : (matchedUl ? matchedUl.label : (ulValue || ''))}
                            placeholder={ulValue === UL_NONE_VALUE ? '선택 안함' : '스타일 선택'}
                            readOnly={!!matchedUl || ulValue === UL_NONE_VALUE}
                            onChange={(e) => onUlChange(e.target.value)}
                            onClick={() => setActiveDropdown(ulDropdownKey)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { setActiveDropdown(null); e.target.blur(); } }}
                        />
                        <i className={activeDropdown === ulDropdownKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === ulDropdownKey ? null : ulDropdownKey)}></i>
                        {activeDropdown === ulDropdownKey && (
                            <ul className={layout.dropdownStyle}>
                                <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); onUlChange(UL_NONE_VALUE); setActiveDropdown(null); }}>
                                    선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                </li>
                                {UL_CLASS_SUGGESTIONS.map((cls, idx) => (
                                    <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); onUlChange(cls.value); setActiveDropdown(null); }}>
                                        {cls.label}
                                    </li>
                                ))}
                                <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); onUlChange(''); setActiveDropdown(null); }}>
                                    직접 입력 <i className="ri-edit-line"></i>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>

                <div className={`${layout.flexCol} ${layout.gap06}`}>
                    <span className={layout.modalLabelSpan}>ol</span>
                    <div className={`${layout.relative} ${olGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={olGuide || undefined} data-dropdown="true">
                        <input className={`${layout.Inp} ${layout.selectInp}`} type="text" readOnly
                            value={olArray.length > 0 ? olArray.map(val => OL_OPTIONS.find(opt => opt.value === val)?.label).filter(Boolean).join(', ') : ''}
                            placeholder="선택 안함"
                            onClick={() => setActiveDropdown(olDropdownKey)}
                        />
                        <i className={activeDropdown === olDropdownKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === olDropdownKey ? null : olDropdownKey)}></i>
                        {activeDropdown === olDropdownKey && (
                            <ul className={layout.dropdownStyle}>
                                <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); onOlChange([]); setActiveDropdown(null); }}>
                                    선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                </li>
                                {OL_OPTIONS.map((opt, index) => (
                                    <li key={index} className={layout.listItemStyle} onMouseDown={(e) => toggleOl(e, opt.value)}>
                                        {opt.label} {olArray.includes(opt.value) && <i className={`ri-check-line ${layout.checkIcon}`}></i>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className={`${layout.flexCol} ${layout.gap06} ${layout.mglN05}`}>
                    <label className={`${layout.checkItem} ${atteGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={atteGuide || undefined} data-dropdown={atteDataDropdown ? "true" : undefined}>
                        <input type="checkbox" checked={atteChecked !== false} onChange={(e) => onAtteChange(e.target.checked)} />
                        <span>※ 변환</span>
                    </label>
                    <label className={`${layout.checkItem} ${noListGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={noListGuide || undefined} data-dropdown={keepDataDropdown ? "true" : undefined}>
                        <input type="checkbox" checked={keepChecked || false} onChange={(e) => onKeepChange(e.target.checked)} />
                        <span>기호 유지</span>
                    </label>
                    <label className={`${layout.checkItem} ${list2Guide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={list2Guide || undefined} data-dropdown={list2DataDropdown ? "true" : undefined}>
                        <input type="checkbox" checked={startFrom2Checked || false} onChange={(e) => onStartFrom2Change(e.target.checked)} />
                        <span>시작(리스트2)</span>
                    </label>
                    {showColorToggle && (
                        <label className={`${layout.checkItem} ${colorGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={colorGuide || undefined} data-dropdown={colorDataDropdown ? "true" : undefined}>
                            <input type="checkbox" checked={colorChecked || false} onChange={(e) => onColorChange(e.target.checked)} />
                            <span>색상 클래스</span>
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
}

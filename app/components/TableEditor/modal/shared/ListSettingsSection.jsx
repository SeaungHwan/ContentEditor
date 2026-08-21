/*
 * [ListSettingsSection.jsx] "리스트" 설정 섹션 (ul 드롭다운 + ol 드롭다운 + ol 스타일 드롭다운 + 옵션 체크박스)
 *
 * TableEditModal(표 내부), GlobalTableConfigModal(표 내부), ContentConfigModal(본문 텍스트)에서
 * 필드 키 접두사만 다르고 구조가 동일하던 UI를 공통 추출한 것.
 * guide* 프롭이 없으면(undefined) 가이드 하이라이트 없이 렌더링된다(TableEditModal은 가이드 자체 없음).
 * onOlClassChange/onNumClassChange가 둘 다 전달되지 않으면 "ol 스타일" 필드는 렌더링되지 않는다.
 * ol 클래스명 + 번호 span 클래스명은 실사용 조합(list_ol/num, order-st/mrk) 중 하나를 고르는
 * 단일 드롭다운(OL_STYLE_PRESETS)으로 제공한다 — 두 값이 항상 짝으로 바뀌므로 자유 입력은 두지 않는다.
 */
"use client";
import React from 'react';
import { UL_CLASS_SUGGESTIONS, OL_STYLE_PRESETS, OL_OPTIONS, UL_NONE_VALUE } from '../../utils/constants';
import ManualInputOption from './ManualInputOption';

export default function ListSettingsSection({
    layout,
    sectionHintTitle,
    ulHintTitle, ulValue, onUlChange, ulDropdownKey, ulGuide,
    olDropdownKey, olValue, onOlChange, olGuide,
    olStyleHintTitle, olClassValue, onOlClassChange, numClassValue, onNumClassChange, olStyleDropdownKey, olStyleGuide,
    atteChecked, onAtteChange, atteGuide,
    keepChecked, onKeepChange, noListGuide, keepDataDropdown,
    startFrom2Checked, onStartFrom2Change, list2Guide, list2DataDropdown,
    showColorToggle, colorChecked, onColorChange, colorGuide, colorHintTitle,
    activeDropdown, setActiveDropdown,
}) {
    const matchedUl = UL_CLASS_SUGGESTIONS.find(opt => opt.value === ulValue);
    const olArray = Array.isArray(olValue) ? olValue : [];
    // 드롭다운에서 직접 선택했을 때만 잠금(읽기 전용 라벨) 처리 - 타이핑 중 값이 우연히 프리셋과 같아져도 잠기지 않도록 별도 추적
    const [isUlLocked, setIsUlLocked] = React.useState(!!matchedUl);
    const selectUlPreset = (newVal) => { setIsUlLocked(true); onUlChange(newVal); setActiveDropdown(null); };

    const toggleOl = (e, optValue) => {
        e.preventDefault();
        const next = olArray.includes(optValue) ? olArray.filter(v => v !== optValue) : [...olArray, optValue];
        onOlChange(next);
    };

    // ol 클래스명 + 번호 span 클래스명은 항상 짝으로 쓰이므로(list_ol/num 또는 order-st/mrk),
    // 자유 입력 대신 실사용 조합 중 하나를 고르는 단일 드롭다운으로 제공한다.
    const matchedOlStyle = OL_STYLE_PRESETS.find(p => p.olClass === olClassValue && p.numClass === numClassValue);
    const selectOlStyle = (preset) => { onOlClassChange(preset.olClass); onNumClassChange(preset.numClass); setActiveDropdown(null); };

    return (
        <div className={layout.configSection}>
            <span className={layout.configLabel} title={sectionHintTitle}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 리스트</span>
            <div className={layout.flexCol}>
                <div className={`${layout.flexCol} ${layout.gap06}`}>
                    <span className={layout.modalLabelSpan} title={ulHintTitle}>ul</span>
                    <div className={`${layout.relative} ${ulGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={ulGuide || undefined} data-dropdown="true">
                        <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                            value={ulValue === UL_NONE_VALUE ? '' : (isUlLocked && matchedUl ? matchedUl.label : (ulValue || ''))}
                            placeholder={ulValue === UL_NONE_VALUE ? '선택 안함' : '스타일 선택'}
                            readOnly={isUlLocked || ulValue === UL_NONE_VALUE}
                            onChange={(e) => { setIsUlLocked(false); onUlChange(e.target.value); }}
                            onClick={() => setActiveDropdown(ulDropdownKey)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { setActiveDropdown(null); e.target.blur(); } }}
                        />
                        <i className={activeDropdown === ulDropdownKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === ulDropdownKey ? null : ulDropdownKey)}></i>
                        {activeDropdown === ulDropdownKey && (
                            <ul className={layout.dropdownStyle}>
                                <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectUlPreset(UL_NONE_VALUE); }}>
                                    선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                </li>
                                {UL_CLASS_SUGGESTIONS.map((cls, idx) => (
                                    <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectUlPreset(cls.value); }}>
                                        {cls.label}
                                    </li>
                                ))}
                                <ManualInputOption layout={layout} onSelect={() => { setIsUlLocked(false); onUlChange(''); setActiveDropdown(null); }} />
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

                    {onOlClassChange && onNumClassChange && (
                        <>
                            <div className={`${layout.relative} ${olStyleGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={olStyleGuide || undefined} data-dropdown="true">
                                <input className={`${layout.Inp} ${layout.selectInp} ${layout.olList}`} type="text" readOnly
                                    title={olStyleHintTitle}
                                    value={matchedOlStyle ? matchedOlStyle.label : `${olClassValue || ''} / ${numClassValue || ''}`}
                                    onClick={() => setActiveDropdown(olStyleDropdownKey)}
                                />
                                <i className={activeDropdown === olStyleDropdownKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === olStyleDropdownKey ? null : olStyleDropdownKey)}></i>
                                {activeDropdown === olStyleDropdownKey && (
                                    <ul className={layout.dropdownStyle}>
                                        {OL_STYLE_PRESETS.map((preset, idx) => (
                                            <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectOlStyle(preset); }}>
                                                {preset.label} {matchedOlStyle === preset && <i className={`ri-check-line ${layout.checkIcon}`}></i>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className={`${layout.flexCol} ${layout.gap06}`}>
                    <label className={`${layout.checkItem} ${atteGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={atteGuide || undefined}>
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
                        <label className={`${layout.checkItem} ${colorGuide ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} title={colorHintTitle} data-guide={colorGuide || undefined}>
                            <input type="checkbox" checked={colorChecked || false} onChange={(e) => onColorChange(e.target.checked)} />
                            <span>색상 클래스</span>
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
}

/*
 * [TableClassField.jsx] 표 외곽 wrapperClassName 클래스 드롭다운
 *
 * TableEditModal / GlobalTableConfigModal에서 동일하게 쓰이던 "클래스" 입력+드롭다운 UI를
 * 공통으로 추출한 것. guideMessage가 없으면(undefined) 가이드 하이라이트를 렌더링하지 않는다
 * (TableEditModal은 가이드 모드 자체가 없음).
 */
"use client";
import React from 'react';
import { TABLE_CLASS_SUGGESTIONS, TABLE_SCROLL_SUGGESTIONS, SCROLL_CLASSES } from '../../utils/constants';

export default function TableClassField({ layout, value, onChange, activeDropdown, setActiveDropdown, hintTitle, guideMessage }) {
    const wVal = value || '';
    const activeScroll = SCROLL_CLASSES.find(sc => wVal.split(' ').includes(sc));
    const matchedBase = TABLE_CLASS_SUGGESTIONS.find(opt => opt.value === wVal);
    const matchedScroll = activeScroll ? TABLE_SCROLL_SUGGESTIONS.find(s => s.scrollClass === activeScroll) : null;
    // 드롭다운에서 직접 선택했을 때만 잠금(읽기 전용 라벨) 처리 - 타이핑 중 값이 우연히 프리셋과 같아져도 잠기지 않도록 별도 추적
    const [isLocked, setIsLocked] = React.useState(!!(matchedBase || matchedScroll));
    const displayLabel = isLocked ? (matchedBase ? matchedBase.label : matchedScroll ? matchedScroll.label : wVal) : wVal;

    const selectPreset = (newVal) => { setIsLocked(true); onChange(newVal); setActiveDropdown(null); };

    return (
        <div className={`${layout.flexRow} ${layout.gap02}`}>
            <span className={layout.modalLabelSpan} title={hintTitle}>클래스</span>
            <div className={`${layout.relative} ${guideMessage ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={guideMessage || undefined} data-dropdown="true">
                <input className={`${layout.Inp} ${layout.selectInp} ${layout.tbl}`} type="text"
                    value={displayLabel}
                    readOnly={isLocked}
                    onChange={(e) => { setIsLocked(false); onChange(e.target.value); }}
                    onClick={() => setActiveDropdown('tableClass')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setActiveDropdown(null); e.target.blur(); } }}
                />
                <i className={activeDropdown === 'tableClass' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === 'tableClass' ? null : 'tableClass')}></i>
                {activeDropdown === 'tableClass' && (
                    <ul className={layout.dropdownStyle}>
                        {TABLE_CLASS_SUGGESTIONS.map((cls, idx) => (
                            <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectPreset(cls.value); }}>
                                {cls.label}
                            </li>
                        ))}
                        {TABLE_SCROLL_SUGGESTIONS.map((scroll, idx) => {
                            const base = wVal.split(' ').filter(c => !SCROLL_CLASSES.includes(c)).join(' ').trim();
                            const newVal = base ? `${base} ${scroll.scrollClass}` : scroll.scrollClass;
                            return (
                                <li key={`scroll-${idx}`} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectPreset(newVal); }}>
                                    {scroll.label}
                                </li>
                            );
                        })}
                        <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); setIsLocked(false); onChange(''); setActiveDropdown(null); }}>
                            직접 입력 <i className="ri-edit-line"></i>
                        </li>
                    </ul>
                )}
            </div>
        </div>
    );
}

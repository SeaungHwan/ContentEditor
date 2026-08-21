/*
 * [ClassNameField.jsx] 단일 클래스명 입력+드롭다운 공용 필드
 *
 * EtcConfigModal에서 쓰이는 "라벨 + 클래스명 입력 + 후보 드롭다운 + 직접 입력" UI를 공통으로 추출한 것.
 * ListSettingsSection의 ul 필드, TableClassField와 같은 패턴이나 스크롤 클래스 같은 특수 옵션이
 * 없는 단순 단일 클래스명 전용이라 별도 컴포넌트로 분리했다.
 * guideMessage가 없으면(undefined) 가이드 하이라이트를 렌더링하지 않는다.
 */
"use client";
import React from 'react';
import ManualInputOption from './ManualInputOption';

export default function ClassNameField({ layout, label, value, onChange, suggestions, dropdownKey, activeDropdown, setActiveDropdown, hintTitle, guideMessage }) {
    const val = value || '';
    const matched = suggestions.find(opt => opt.value === val);
    // 드롭다운에서 직접 선택했을 때만 잠금(읽기 전용 라벨) 처리 - 타이핑 중 값이 우연히 프리셋과 같아져도 잠기지 않도록 별도 추적
    const [isLocked, setIsLocked] = React.useState(!!matched);
    const displayLabel = isLocked && matched ? matched.label : val;

    const selectPreset = (newVal) => { setIsLocked(true); onChange(newVal); setActiveDropdown(null); };

    return (
        <div className={`${layout.flexRow} ${layout.gap02}`}>
            <span className={layout.modalLabelSpan} title={hintTitle}>{label}</span>
            <div className={`${layout.relative} ${guideMessage ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={guideMessage || undefined} data-dropdown="true">
                <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                    value={displayLabel}
                    readOnly={isLocked}
                    onChange={(e) => { setIsLocked(false); onChange(e.target.value); }}
                    onClick={() => setActiveDropdown(dropdownKey)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setActiveDropdown(null); e.target.blur(); } }}
                    placeholder="클래스명 입력"
                />
                <i className={activeDropdown === dropdownKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === dropdownKey ? null : dropdownKey)}></i>
                {activeDropdown === dropdownKey && (
                    <ul className={layout.dropdownStyle}>
                        {suggestions.map((cls, idx) => (
                            <li key={idx} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectPreset(cls.value); }}>
                                {cls.label}
                            </li>
                        ))}
                        <ManualInputOption layout={layout} onSelect={() => { setIsLocked(false); onChange(''); setActiveDropdown(null); }} />
                    </ul>
                )}
            </div>
        </div>
    );
}

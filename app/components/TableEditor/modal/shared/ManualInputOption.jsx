/*
 * [ManualInputOption.jsx] 클래스명 드롭다운의 "직접 입력" 리셋 항목
 *
 * ClassNameField / TableClassField / ListSettingsSection(ul) / ContentConfigModal(타이틀 클래스)에서
 * 값과 잠금 상태를 초기화해 자유 입력 모드로 되돌리는 동일한 목록 항목으로 공통 추출한 것.
 */
"use client";
import React from 'react';

export default function ManualInputOption({ layout, onSelect }) {
    return (
        <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); onSelect(); }}>
            직접 입력 <i className="ri-edit-line"></i>
        </li>
    );
}

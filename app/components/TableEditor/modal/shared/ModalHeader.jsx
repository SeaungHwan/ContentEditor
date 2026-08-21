/*
 * [ModalHeader.jsx] 설정 모달 상단 타이틀 바 (드래그 핸들 + 색상모드 토글 + 가이드 버튼)
 *
 * ContentConfigModal / GlobalTableConfigModal / EtcConfigModal에서 거의 동일하게 반복되던
 * "제목 + (선택적) 색상모드 토글 스위치 + 가이드 토글 버튼" 구조를 공통으로 추출한 것.
 * colorMode를 넘기지 않으면(EtcConfigModal) 토글 스위치를 렌더링하지 않는다.
 */
"use client";
import React from 'react';
import { GUIDE_MESSAGES } from '../../utils/constants';

export default function ModalHeader({ layout, onDragStart, title, subtitle, isGuideMode, setIsGuideMode, colorMode }) {
    return (
        <h2 className={layout.modalTitle} onMouseDown={onDragStart}>
            <span>{title}<em>{subtitle}</em></span>
            {colorMode && (
                <div className={layout.swichBtnWrap}>
                    <span className={layout.colTit}>색상모드</span>
                    <div className={layout.swichBtnGroup}>
                        <button type="button"
                            title={colorMode.title}
                            className={`${layout.toggleSwitch} ${colorMode.checked ? layout.active : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`}
                            onClick={colorMode.onToggle}
                            data-guide={isGuideMode ? GUIDE_MESSAGES.modeSelect : undefined}
                        >
                            <span className={layout.toggleKnob}></span>
                        </button>
                    </div>
                </div>
            )}
            <button type="button" data-guide-toggle="true" className={layout.guideBtn} onClick={() => setIsGuideMode(!isGuideMode)} title={isGuideMode ? '가이드를 종료합니다.' : '가이드'}>
                <div className={`${layout.guide} ${isGuideMode ? `${layout.guideClose}` : ''}`}>
                    <img src='/00_common/images/sub_com/guide.svg' alt="아이콘"/>
                </div>
            </button>
        </h2>
    );
}

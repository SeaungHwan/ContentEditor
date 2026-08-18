/*
 * [EtcConfigModal.jsx] 기타(박스/링크/메일) 전역 설정 모달
 *
 * 역할:
 *   - 텍스트 블록과 표 내부에서 공통으로 쓰이는 클래스명 설정을 변경한다.
 *   - 적용 시 TableConfigContext의 config를 업데이트한다.
 *
 * 설정 가능 항목:
 *   - boxClassName  : 셀 1개짜리 표를 텍스트 박스로 변환할 때 적용할 클래스
 *   - linkClassName : 링크(a)에 적용할 클래스
 *   - mailClassName : 이메일 링크(a)에 적용할 클래스
 *
 * ContentConfigModal/GlobalTableConfigModal/TableEditModal과의 차이:
 *   - 링크/메일은 텍스트와 표에서 항상 같은 클래스를 쓰므로(표별 오버라이드 없음),
 *     콘텐츠·테이블 모달이 아닌 이 모달 하나에서만 관리한다.
 */

"use client";
import React, { useState, useEffect } from 'react';
import ClassNameField from './shared/ClassNameField';
import { GUIDE_MESSAGES, BOX_CLASS_SUGGESTIONS, LINK_CLASS_SUGGESTIONS, MAIL_CLASS_SUGGESTIONS } from '../utils/constants';
import { useModalDrag } from '../hooks/useModalDrag';
import { useClickOutsideDropdown } from '../hooks/useClickOutsideDropdown';

export default function EtcConfigModal({ onClose, onApply, globalConfig, layout, isGuideMode, setIsGuideMode, fadeStyle }) {
    const [localConfig, setLocalConfig] = useState(() => globalConfig ? { ...globalConfig } : {});
    const [activeDropdown, setActiveDropdown] = useClickOutsideDropdown();
    const { dragStyle, handleDragStart, modalRef } = useModalDrag();

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateConfig = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));

    const handleApply = () => {
        if (!localConfig) return;
        onApply(localConfig);
    };

    return (
        <div ref={modalRef} className={`${layout.modalContentBox}`} style={{ ...dragStyle, ...fadeStyle }}>
                <h2 className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>기타 설정<em>ㅣ박스·링크·메일 클래스 변경</em></span>
                    <button type="button" data-guide-toggle="true" className={layout.guideBtn} onClick={() => setIsGuideMode(!isGuideMode)} title={isGuideMode ? '가이드를 종료합니다.' : '가이드'}>
                    <div className={`${layout.guide} ${isGuideMode ? `${layout.guideClose}` : ''}`}>
                        <img src='/00_common/images/sub_com/guide.svg' alt="아이콘"/>
                    </div>
                    </button>
                </h2>

                <div className={layout.modalBody}>

                    <div className={layout.configSection}>
                        <span className={layout.configLabel} title="단일 셀 표(박스), 링크, 이메일 링크에 적용할 클래스명을 설정합니다."><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/>박스/링크</span>
                        <div className={`${layout.flexCol} ${layout.gap06}`}>
                            <ClassNameField
                                layout={layout}
                                label="박스"
                                hintTitle="셀이 1개뿐인 표를 텍스트 박스로 변환할 때 적용할 클래스명입니다."
                                value={localConfig.boxClassName}
                                onChange={(v) => updateConfig('boxClassName', v)}
                                suggestions={BOX_CLASS_SUGGESTIONS}
                                dropdownKey="boxClass"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                guideMessage={isGuideMode ? GUIDE_MESSAGES.classBoxConfig : undefined}
                            />
                            <ClassNameField
                                layout={layout}
                                label="링크"
                                hintTitle="일반 링크(a) 및 URL 자동 변환 링크에 적용할 클래스명입니다. (텍스트/표 공통)"
                                value={localConfig.linkClassName}
                                onChange={(v) => updateConfig('linkClassName', v)}
                                suggestions={LINK_CLASS_SUGGESTIONS}
                                dropdownKey="linkClass"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                guideMessage={isGuideMode ? GUIDE_MESSAGES.classLinkConfig : undefined}
                            />
                            <ClassNameField
                                layout={layout}
                                label="메일"
                                hintTitle="이메일 주소를 링크로 자동 변환할 때 적용할 클래스명입니다. (텍스트/표 공통)"
                                value={localConfig.mailClassName}
                                onChange={(v) => updateConfig('mailClassName', v)}
                                suggestions={MAIL_CLASS_SUGGESTIONS}
                                dropdownKey="mailClass"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                guideMessage={isGuideMode ? GUIDE_MESSAGES.classMailConfig : undefined}
                            />
                        </div>
                    </div>

                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose} title="변경사항 취소 후 닫기">취소</button>
                    <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleApply} title="설정 저장 및 적용">저장 및 적용하기</button>
                </div>
            </div>
    );
}

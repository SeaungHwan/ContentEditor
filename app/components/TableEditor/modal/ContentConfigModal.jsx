/*
 * [ContentConfigModal.jsx] 컨텐츠(텍스트 영역) 전역 설정 모달
 *
 * 역할:
 *   - 테이블 외부 텍스트 블록(일반 컨텐츠)에 적용되는 변환 설정을 변경한다.
 *   - 적용 시 TableConfigContext의 config를 업데이트한다.
 *
 * 설정 가능 항목:
 *   - 타이틀 설정 (tit1/tit2/tit3): 패턴 타입 + 직접 입력값 + 클래스명
 *   - 리스트 ul 클래스, ol 변환 타입, ol/번호(span) 클래스명, 마커 유지 여부
 *   - 텍스트 색상 모드(isColorMode, isColorClassMode)
 *
 * GlobalTableConfigModal과의 차이:
 *   - 테이블 내부가 아닌 텍스트 블록 전용 설정(ulClassName, olType, keepMarker, tit1~tit3).
 *   - 열 너비(ColWidthControl) 설정 없음.
 *   - 리스트 설정(ul/ol/체크박스) UI는 GlobalTableConfigModal·TableEditModal과 구조가 같아
 *     modal/shared/ListSettingsSection을 함께 사용한다.
 *
 * 박스(boxClassName)/링크(linkClassName)/메일(mailClassName) 클래스명은 텍스트/표 공통 설정이라
 * 이 모달이 아닌 EtcConfigModal(기타 설정)에서 관리한다.
 */


"use client";
import React, { useState, useEffect } from 'react';
import ListSettingsSection from './shared/ListSettingsSection';
import { GUIDE_MESSAGES, TIT_OPTIONS, TIT_CLASS_SUGGESTIONS } from '../utils/constants';
import { useModalDrag } from '../hooks/useModalDrag';
import { useClickOutsideDropdown } from '../hooks/useClickOutsideDropdown';


export default function ContentConfigModal({ onClose, onApply, globalConfig, layout, isGuideMode, setIsGuideMode, fadeStyle }) {
    const [localConfig, setLocalConfig] = useState(() => globalConfig ? { ...globalConfig } : {});
    const [activeDropdown, setActiveDropdown] = useClickOutsideDropdown();
    const { dragStyle, handleDragStart, modalRef } = useModalDrag();
    // 드롭다운에서 직접 선택했을 때만 잠금(읽기 전용 라벨) 처리 - 타이핑 중 값이 우연히 프리셋과 같아져도 잠기지 않도록 별도 추적
    const [lockedTitClass, setLockedTitClass] = useState(() => (
        ['tit1', 'tit2', 'tit3'].reduce((acc, titKey) => {
            const val = globalConfig?.[`${titKey}Class`] || '';
            acc[titKey] = TIT_CLASS_SUGGESTIONS.some(opt => opt.value === val);
            return acc;
        }, {})
    ));

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateConfig = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));

    const handleTitleCustomChange = (e, titKey) => updateConfig(titKey, { ...(localConfig[titKey] || {}), type: 'custom', val: e.target.value });

    const handleTitleOptionSelect = (e, titKey, optValue) => {
        e.preventDefault();
        updateConfig(titKey, { ...(localConfig[titKey] || { val: '' }), type: optValue });
        setActiveDropdown(null);
    };

    const handleApply = () => {
        if (!localConfig) return;
        onApply(localConfig);
    };

    return (
        <div ref={modalRef} className={`${layout.modalContentBox}`} style={{ ...dragStyle, ...fadeStyle }}>
                <h2 className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>컨텐츠 설정<em>ㅣ스타일 가이드 맞춤 변경</em></span>
                    <div className={layout.swichBtnWrap}>
                            <span className={layout.colTit}>색상모드</span>
                            <div className={layout.swichBtnGroup}>
                                <button type="button"
                                title="색상 모드 전환"
                                className={`${layout.toggleSwitch} ${localConfig.isColorMode ? layout.active : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`}
                                onClick={() => updateConfig('isColorMode', !localConfig.isColorMode)}
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
                        <span className={layout.configLabel} title="H3~H5 제목 태그에 적용할 스타일과 감지 패턴을 설정합니다."><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/>타이틀</span>
                        <div className={`${layout.flexCol}`}>
                            {['tit1', 'tit2', 'tit3'].map((titKey, idx) => {
                                const currentType = localConfig[titKey]?.type || 'custom';
                                const isCustom = currentType === 'custom';
                                const currentLabel = TIT_OPTIONS.find(opt => opt.value === currentType)?.label || '직접 입력';
                                const currentClassKey = `${titKey}Class`;
                                const currentClassValue = localConfig[currentClassKey] || '';
                                const matchedClassOpt = TIT_CLASS_SUGGESTIONS.find(opt => opt.value === currentClassValue);
                                const titClassDdKey = `${currentClassKey}Dd`;
                                const isClassLocked = !!lockedTitClass[titKey];
                                const selectTitClassPreset = (optValue) => {
                                    setLockedTitClass(prev => ({ ...prev, [titKey]: true }));
                                    updateConfig(currentClassKey, optValue);
                                    setActiveDropdown(null);
                                };

                                return (
                                    <div key={titKey} className={`${layout.flexRow} ${layout.gap02}`}>
                                        <span className={layout.modalLabelSpanSm}>H{idx + 3}</span>
                                        <div className={`${layout.flexCol} ${layout.gap035} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES[titKey] : undefined} data-dropdown="true">
                                            <div className={layout.relative} title="제목 태그에 적용할 스타일을 선택하세요.">
                                                <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                                                    value={isClassLocked && matchedClassOpt ? matchedClassOpt.label : currentClassValue}
                                                    readOnly={isClassLocked}
                                                    onChange={(e) => { setLockedTitClass(prev => ({ ...prev, [titKey]: false })); updateConfig(currentClassKey, e.target.value); }}
                                                    onClick={() => setActiveDropdown(titClassDdKey)}
                                                    placeholder="스타일 선택"
                                                />
                                                <i className={activeDropdown === titClassDdKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === titClassDdKey ? null : titClassDdKey)}></i>
                                                {activeDropdown === titClassDdKey && (
                                                    <ul className={`${layout.dropdownStyle}`}>
                                                        {TIT_CLASS_SUGGESTIONS.map((opt, i) => (
                                                            <li key={i} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); selectTitClassPreset(opt.value); }}>
                                                                {opt.label}
                                                            </li>
                                                        ))}
                                                        <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); setLockedTitClass(prev => ({ ...prev, [titKey]: false })); updateConfig(currentClassKey, ''); setActiveDropdown(null); }}>
                                                            직접 입력 <i className="ri-edit-line"></i>
                                                        </li>
                                                    </ul>
                                                )}
                                            </div>
                                            <div className={layout.relative}>
                                                <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                                                    value={isCustom ? (localConfig[titKey]?.val || '') : currentLabel}
                                                    onChange={(e) => isCustom && handleTitleCustomChange(e, titKey)}
                                                    readOnly={!isCustom} onClick={() => setActiveDropdown(titKey)} placeholder="유형 선택"
                                                    onKeyDown={(e) => {if (e.key === 'Enter') {setActiveDropdown(null);e.target.blur();}}}
                                                />
                                                <i className={activeDropdown === titKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === titKey ? null : titKey)}></i>
                                                {activeDropdown === titKey && (
                                                    <ul className={`${layout.dropdownStyle}`}>
                                                        {TIT_OPTIONS.map((opt, index) => (
                                                            <li key={index} className={layout.listItemStyle} onMouseDown={(e) => handleTitleOptionSelect(e, titKey, opt.value)}>
                                                                {opt.label}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <ListSettingsSection
                        layout={layout}
                        sectionHintTitle="본문 텍스트에서 목록(ul/ol) 변환 방식을 설정합니다."
                        ulHintTitle="목록 항목(ul)에 적용할 스타일입니다."
                        ulValue={localConfig.ulClassName}
                        onUlChange={(v) => updateConfig('ulClassName', v)}
                        ulDropdownKey="ul"
                        ulGuide={isGuideMode ? GUIDE_MESSAGES.classUlConfig : undefined}
                        olDropdownKey="olType"
                        olValue={localConfig.olType}
                        onOlChange={(v) => updateConfig('olType', v)}
                        olGuide={isGuideMode ? GUIDE_MESSAGES.classOlConfig : undefined}
                        olStyleHintTitle="숫자 목록(ol)과 번호(span)에 적용할 클래스명 조합입니다."
                        olClassValue={localConfig.olClassName}
                        onOlClassChange={(v) => updateConfig('olClassName', v)}
                        numClassValue={localConfig.numClassName}
                        onNumClassChange={(v) => updateConfig('numClassName', v)}
                        olStyleDropdownKey="olStyle"
                        olStyleGuide={isGuideMode ? GUIDE_MESSAGES.classOlStyleConfig : undefined}
                        atteChecked={localConfig.useAtteMarker}
                        onAtteChange={(v) => updateConfig('useAtteMarker', v)}
                        atteGuide={isGuideMode ? GUIDE_MESSAGES.atteMarker : undefined}
                        keepChecked={localConfig.keepMarker}
                        onKeepChange={(v) => updateConfig('keepMarker', v)}
                        noListGuide={isGuideMode ? GUIDE_MESSAGES.noList : undefined}
                        startFrom2Checked={localConfig.listStartFrom2}
                        onStartFrom2Change={(v) => updateConfig('listStartFrom2', v)}
                        list2Guide={isGuideMode ? GUIDE_MESSAGES.List2 : undefined}
                        list2DataDropdown
                        showColorToggle={localConfig.isColorMode}
                        colorChecked={localConfig.isColorClassMode}
                        onColorChange={(v) => updateConfig('isColorClassMode', v)}
                        colorGuide={isGuideMode ? GUIDE_MESSAGES.color : undefined}
                        colorHintTitle="텍스트 색상을 클래스(pc_색상)로 저장할지, style 속성으로 저장할지 결정합니다."
                        activeDropdown={activeDropdown}
                        setActiveDropdown={setActiveDropdown}
                    />

                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose} title="변경사항 취소 후 닫기">취소</button>
                    <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleApply} title="설정 저장 및 적용">저장 및 적용하기</button>
                </div>
            </div>
    );
}

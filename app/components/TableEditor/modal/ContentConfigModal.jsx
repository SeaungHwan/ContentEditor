/*
 * [ContentConfigModal.jsx] 컨텐츠(텍스트 영역) 전역 설정 모달
 *
 * 역할:
 *   - 테이블 외부 텍스트 블록(일반 컨텐츠)에 적용되는 변환 설정을 변경한다.
 *   - 적용 시 TableConfigContext의 config를 업데이트한다.
 *
 * 설정 가능 항목:
 *   - 타이틀 설정 (tit1/tit2/tit3): 패턴 타입 + 직접 입력값 + 클래스명
 *   - 리스트 ul 클래스, ol 변환 타입, 마커 유지 여부
 *   - 텍스트 색상 모드(isColorMode, isColorClassMode)
 *
 * GlobalTableConfigModal과의 차이:
 *   - 테이블 내부가 아닌 텍스트 블록 전용 설정(ulClassName, olType, keepMarker, tit1~tit3).
 *   - 열 너비(ColWidthControl) 설정 없음.
 */


"use client";
import React, { useState, useEffect } from 'react';
import { OL_OPTIONS, UL_CLASS_SUGGESTIONS, UL_NONE_VALUE, GUIDE_MESSAGES, TIT_OPTIONS, TIT_CLASS_SUGGESTIONS } from '../utils/constants';
import { useModalDrag } from '../hooks/useModalDrag';
import { useClickOutsideDropdown } from '../hooks/useClickOutsideDropdown';


export default function ContentConfigModal({ onClose, onApply, globalConfig, layout, isGuideMode, setIsGuideMode, fadeStyle }) {
    const [localConfig, setLocalConfig] = useState(globalConfig ? { ...globalConfig } : {});
    const [activeDropdown, setActiveDropdown] = useClickOutsideDropdown();
    const { dragStyle, handleDragStart } = useModalDrag();

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

    const handleOlToggle = (e, optValue) => {
        e.preventDefault();
        const current = Array.isArray(localConfig.olType) ? localConfig.olType : [];
        const next = current.includes(optValue) ? current.filter(v => v !== optValue) : [...current, optValue];
        updateConfig('olType', next);
    };

    const handleApply = () => {
        if (!localConfig) return;
        onApply(localConfig);
    };

    return (
        <div className={`${layout.modalContentBox}`} style={{ ...dragStyle, ...fadeStyle }}>
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

                                return (
                                    <div key={titKey} className={`${layout.flexRow} ${layout.gap02}`}>
                                        <span className={layout.modalLabelSpanSm}>H{idx + 3}</span>
                                        <div className={`${layout.flexCol} ${layout.gap035} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES[titKey] : undefined} data-dropdown="true">
                                            <div className={layout.relative} title="제목 태그에 적용할 스타일을 선택하세요.">
                                                <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                                                    value={matchedClassOpt ? matchedClassOpt.label : currentClassValue}
                                                    readOnly={!!matchedClassOpt}
                                                    onChange={(e) => updateConfig(currentClassKey, e.target.value)}
                                                    onClick={() => setActiveDropdown(titClassDdKey)}
                                                    placeholder="스타일 선택"
                                                />
                                                <i className={activeDropdown === titClassDdKey ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === titClassDdKey ? null : titClassDdKey)}></i>
                                                {activeDropdown === titClassDdKey && (
                                                    <ul className={`${layout.dropdownStyle}`}>
                                                        {TIT_CLASS_SUGGESTIONS.map((opt, i) => (
                                                            <li key={i} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig(currentClassKey, opt.value); setActiveDropdown(null); }}>
                                                                {opt.label}
                                                            </li>
                                                        ))}
                                                        <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig(currentClassKey, ''); setActiveDropdown(null); }}>
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

                    <div className={layout.configSection}>
                        <span className={layout.configLabel} title="본문 텍스트에서 목록(ul/ol) 변환 방식을 설정합니다."><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/>리스트</span>
                        <div className={layout.flexCol}>

                            <div className={`${layout.flexCol} ${layout.gap06}`}>
                                <span className={layout.modalLabelSpan} title="목록 항목(ul)에 적용할 스타일입니다.">ul</span>
                                <div className={`${layout.relative} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.classUlConfig : undefined} data-dropdown="true">
                                    {(() => {
                                        const ulVal = localConfig.ulClassName;
                                        const matchedUl = UL_CLASS_SUGGESTIONS.find(opt => opt.value === ulVal);
                                        return (
                                            <input className={`${layout.Inp} ${layout.selectInp}`} type="text"
                                                value={ulVal === UL_NONE_VALUE ? '' : (matchedUl ? matchedUl.label : (ulVal || ''))}
                                                placeholder={ulVal === UL_NONE_VALUE ? '선택 안함' : '스타일 선택'}
                                                readOnly={!!matchedUl || ulVal === UL_NONE_VALUE}
                                                onChange={(e) => updateConfig('ulClassName', e.target.value)}
                                                onClick={() => setActiveDropdown('ul')}
                                                onKeyDown={(e) => {if (e.key === 'Enter') {setActiveDropdown(null);e.target.blur();}}}
                                            />
                                        );
                                    })()}
                                    <i className={activeDropdown === 'ul' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === 'ul' ? null : 'ul')}></i>
                                    {activeDropdown === 'ul' && (
                                        <ul className={`${layout.dropdownStyle}`}>
                                            <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('ulClassName', UL_NONE_VALUE); setActiveDropdown(null); }}>
                                                선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                            </li>
                                            {UL_CLASS_SUGGESTIONS.map((cls, index) => (
                                                <li key={index} className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('ulClassName', cls.value); setActiveDropdown(null); }}>
                                                    {cls.label}
                                                </li>
                                            ))}
                                            <li className={layout.listItemStyle} onMouseDown={(e) => { e.preventDefault(); updateConfig('ulClassName', ''); setActiveDropdown(null); }}>
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
                                        value={Array.isArray(localConfig.olType) && localConfig.olType.length > 0 ? localConfig.olType.map(val => OL_OPTIONS.find(opt => opt.value === val)?.label).filter(Boolean).join(', ') : ''}
                                        placeholder="선택 안함"
                                        onClick={() => setActiveDropdown('olType')}
                                    />
                                    <i className={activeDropdown === 'olType' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} onClick={() => setActiveDropdown(activeDropdown === 'olType' ? null : 'olType')}></i>
                                    {activeDropdown === 'olType' && (
                                        <ul className={`${layout.dropdownStyle} `}>
                                            <li className={`${layout.listItemStyle}`} onMouseDown={(e) => { e.preventDefault(); updateConfig('olType', []); setActiveDropdown(null); }}>
                                                선택 안함 <i className="ri-close-circle-line pc_red"></i>
                                            </li>
                                            {OL_OPTIONS.map((opt, index) => (
                                                <li key={index} className={`${layout.listItemStyle}`} onMouseDown={(e) => handleOlToggle(e, opt.value)}>
                                                    {opt.label} {Array.isArray(localConfig.olType) && localConfig.olType.includes(opt.value) && <i className={`ri-check-line ${layout.checkIcon}`}></i>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className={`${layout.flexCol} ${layout.gap06} ${layout.mglN05}`}>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.atteMarker : undefined}>
                                <input type="checkbox" checked={localConfig.useAtteMarker !== false} onChange={(e) => updateConfig('useAtteMarker', e.target.checked)} />
                                <span>※ 변환</span>
                            </label>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.noList : undefined}>
                                <input type="checkbox" checked={localConfig.keepMarker || false} onChange={(e) => updateConfig('keepMarker', e.target.checked)} />
                                <span>기호 유지</span>
                            </label>
                            <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.List2 : undefined} data-dropdown="true">
                                <input type="checkbox" checked={localConfig.listStartFrom2 || false} onChange={(e) => updateConfig('listStartFrom2', e.target.checked)} />
                                <span>시작(리스트2)</span>
                            </label>
                            {localConfig.isColorMode && (
                                <label className={`${layout.checkItem} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.color : undefined}>
                                    <input type="checkbox" checked={localConfig.isColorClassMode || false} onChange={(e) => updateConfig('isColorClassMode', e.target.checked)} /> 
                                    <span>색상 클래스</span>
                                </label>
                            )}
</div>
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
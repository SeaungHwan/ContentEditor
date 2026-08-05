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
 *
 * 클래스 드롭다운/헤더 방향/리스트 설정 UI는 TableEditModal과 공통이라
 * modal/shared의 서브컴포넌트를 함께 사용한다.
 */

"use client";
import React, { useState, useEffect } from 'react';
import ColWidthControl from '../ColWidthControl';
import TableClassField from './shared/TableClassField';
import HeaderDirectionField from './shared/HeaderDirectionField';
import ListSettingsSection from './shared/ListSettingsSection';
import { GUIDE_MESSAGES } from '../utils/constants';
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

    const handleTableTypeChange = (type) => {
        updateConfig('tableType', type);
        updateConfig('headerRows', 1);
        updateConfig('headerCols', 1);
    };

    const handleHeaderNumChange = (value) => {
        updateConfig(localConfig.tableType === 'default' ? 'headerRows' : 'headerCols', value);
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
                            <TableClassField
                                layout={layout}
                                value={localConfig.wrapperClassName}
                                onChange={(v) => updateConfig('wrapperClassName', v)}
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                hintTitle="표 외곽을 감싸는 div에 적용할 스타일입니다."
                                guideMessage={isGuideMode ? GUIDE_MESSAGES.classTableConfig : undefined}
                            />
                            <HeaderDirectionField
                                layout={layout}
                                tableType={localConfig.tableType}
                                headerRows={localConfig.headerRows}
                                headerCols={localConfig.headerCols}
                                onTableTypeChange={handleTableTypeChange}
                                onHeaderNumChange={handleHeaderNumChange}
                                colGuide={isGuideMode ? GUIDE_MESSAGES.HeaderTop : undefined}
                                rowGuide={isGuideMode ? GUIDE_MESSAGES.HeaderLeft : undefined}
                                numGuide={isGuideMode ? GUIDE_MESSAGES.HeaderConfig : undefined}
                            />
                        </div>
                    </div>

                    <ListSettingsSection
                        layout={layout}
                        sectionHintTitle="표 내부 목록(ul/ol) 변환 방식을 설정합니다."
                        ulHintTitle="표 내부 목록 항목(ul)에 적용할 스타일입니다."
                        ulValue={localConfig.tableUlClassName}
                        onUlChange={(v) => updateConfig('tableUlClassName', v)}
                        ulDropdownKey="tableUl"
                        ulGuide={isGuideMode ? GUIDE_MESSAGES.classUlConfig : undefined}
                        olDropdownKey="tableOlType"
                        olValue={localConfig.tableOlType}
                        onOlChange={(v) => updateConfig('tableOlType', v)}
                        olGuide={isGuideMode ? GUIDE_MESSAGES.classOlConfig : undefined}
                        olStyleHintTitle="표 내부 숫자 목록(ol)과 번호(span)에 적용할 클래스명 조합입니다."
                        olClassValue={localConfig.tableOlClassName}
                        onOlClassChange={(v) => updateConfig('tableOlClassName', v)}
                        numClassValue={localConfig.tableNumClassName}
                        onNumClassChange={(v) => updateConfig('tableNumClassName', v)}
                        olStyleDropdownKey="tableOlStyle"
                        olStyleGuide={isGuideMode ? GUIDE_MESSAGES.classOlStyleConfig : undefined}
                        atteChecked={localConfig.tableUseAtteMarker}
                        onAtteChange={(v) => updateConfig('tableUseAtteMarker', v)}
                        atteGuide={isGuideMode ? GUIDE_MESSAGES.atteMarker : undefined}
                        keepChecked={localConfig.tableKeepMarker}
                        onKeepChange={(v) => updateConfig('tableKeepMarker', v)}
                        noListGuide={isGuideMode ? GUIDE_MESSAGES.noList : undefined}
                        keepDataDropdown
                        startFrom2Checked={localConfig.tableListStartFrom2}
                        onStartFrom2Change={(v) => updateConfig('tableListStartFrom2', v)}
                        list2Guide={isGuideMode ? GUIDE_MESSAGES.List2 : undefined}
                        list2DataDropdown
                        showColorToggle={localConfig.tableIsColorMode}
                        colorChecked={localConfig.tableIsColorClassMode}
                        onColorChange={(v) => updateConfig('tableIsColorClassMode', v)}
                        colorGuide={isGuideMode ? GUIDE_MESSAGES.color : undefined}
                        colorHintTitle="표 내부 색상을 클래스(pc_색상)로 저장할지, style 속성으로 저장할지 결정합니다."
                        activeDropdown={activeDropdown}
                        setActiveDropdown={setActiveDropdown}
                    />

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

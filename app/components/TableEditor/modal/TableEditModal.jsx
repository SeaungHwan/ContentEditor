/*
 * [TableEditModal.jsx] 개별 테이블 설정 모달
 *
 * 역할:
 *   - 에디터 내 특정 테이블의 설정을 전역 설정과 독립적으로 변경한다.
 *   - 설정 적용 시 해당 테이블에만 data-local-config / data-local-colwidths 속성이 저장되어
 *     이후 updateStylesOnly와 cleanTableHtml에서 전역 설정보다 우선 적용된다.
 *
 * 설정 가능 항목:
 *   - 테이블 클래스(wrapperClassName), DIV 감싸기(isWrapDiv)
 *   - 헤더 방향(tableType: row/default), 헤더 행/열 수(headerRows/headerCols)
 *   - TH 세로 방향(isVerticalHeader)
 *   - 색상 모드(tableIsColorMode, tableIsColorClassMode)
 *   - 표 내부 ul 클래스, ol 타입, 마커 유지 여부
 *   - 열 너비(ColWidthControl 컴포넌트)
 *   - 다음 인접 테이블 병합(isMergeTables)
 *
 * 초기값:
 *   - existingConfig가 있으면 해당 테이블의 기존 설정으로, 없으면 globalConfig로 초기화.
 *
 * UI:
 *   - useModalDrag으로 드래그 이동 가능.
 *   - fadeStyle(opacity transition)으로 페이드 인/아웃.
 *   - 클래스 드롭다운/헤더 방향/리스트 설정 UI는 GlobalTableConfigModal과 공통이라
 *     modal/shared의 서브컴포넌트를 함께 사용한다(가이드 모드 관련 prop은 없음).
 */


"use client";
import React, { useState, useEffect } from 'react';
import ColWidthControl from '../ColWidthControl';
import TableClassField from './shared/TableClassField';
import HeaderDirectionField from './shared/HeaderDirectionField';
import ListSettingsSection from './shared/ListSettingsSection';
import { useModalDrag } from '../hooks/useModalDrag';
import { useClickOutsideDropdown } from '../hooks/useClickOutsideDropdown';

export default function TableEditModal({ onClose, onApply, globalConfig, layout, existingConfig, existingColWidths, fadeStyle }) {
    const [localConfig, setLocalConfig] = useState(existingConfig || { ...globalConfig });
    const [colWidths, setColWidths] = useState(existingColWidths || ['auto']);
    const [activeDropdown, setActiveDropdown] = useClickOutsideDropdown();
    const { dragStyle, handleDragStart } = useModalDrag();

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const updateLocalConfig = (key, value) => setLocalConfig(prev => ({ ...prev, [key]: value }));

    const handleApply = () => onApply(localConfig, colWidths);

    const handleTableTypeChange = (type) => {
        updateLocalConfig('tableType', type);
        updateLocalConfig('headerRows', 1);
        updateLocalConfig('headerCols', 1);
    };

    const handleHeaderNumChange = (value) => {
        updateLocalConfig(localConfig.tableType === 'default' ? 'headerRows' : 'headerCols', value);
    };

    return (
        <div className={layout.modalContentBox} style={{ ...dragStyle, ...fadeStyle }}>
                <h2 className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>테이블 설정<em>ㅣ 테이블 개별 옵션 변경</em></span>
                </h2>

                <div className={layout.modalBody}>
                    <div className={layout.configSection}>
                        <span className={layout.configLabel}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/>헤더</span>
                        <div className={`${layout.flexCol} ${layout.gap15}`}>
                            <TableClassField
                                layout={layout}
                                value={localConfig.wrapperClassName}
                                onChange={(v) => updateLocalConfig('wrapperClassName', v)}
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                hintTitle="이 표에만 적용할 스타일입니다."
                            />
                            <HeaderDirectionField
                                layout={layout}
                                tableType={localConfig.tableType}
                                headerRows={localConfig.headerRows}
                                headerCols={localConfig.headerCols}
                                onTableTypeChange={handleTableTypeChange}
                                onHeaderNumChange={handleHeaderNumChange}
                            />
                        </div>
                    </div>

                    <ListSettingsSection
                        layout={layout}
                        ulHintTitle="이 표 내부 목록 항목(ul)에 적용할 스타일입니다."
                        ulValue={localConfig.tableUlClassName}
                        onUlChange={(v) => updateLocalConfig('tableUlClassName', v)}
                        ulDropdownKey="tableUl"
                        olDropdownKey="tableOlType"
                        olValue={localConfig.tableOlType}
                        onOlChange={(v) => updateLocalConfig('tableOlType', v)}
                        atteChecked={localConfig.tableUseAtteMarker}
                        onAtteChange={(v) => updateLocalConfig('tableUseAtteMarker', v)}
                        keepChecked={localConfig.tableKeepMarker}
                        onKeepChange={(v) => updateLocalConfig('tableKeepMarker', v)}
                        startFrom2Checked={localConfig.tableListStartFrom2}
                        onStartFrom2Change={(v) => updateLocalConfig('tableListStartFrom2', v)}
                        showColorToggle={localConfig.tableIsColorMode}
                        colorChecked={localConfig.tableIsColorClassMode}
                        onColorChange={(v) => updateLocalConfig('tableIsColorClassMode', v)}
                        colorHintTitle="표 내부 색상을 클래스(pc_색상)로 저장할지, style 속성으로 저장할지 결정합니다."
                        activeDropdown={activeDropdown}
                        setActiveDropdown={setActiveDropdown}
                    />

                    <div className={layout.configSection}>
                        <span className={layout.configLabel}><img src='/00_common/images/sub_com/modal_tit.svg' alt="아이콘"/> 옵션</span>
                        <div className={`${layout.flexCol} ${layout.gap06}`}>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.isWrapDiv || false} onChange={(e) => updateLocalConfig('isWrapDiv', e.target.checked)} />
                                <span>DIV 감싸기</span>
                            </label>
                            <label className={layout.checkItem}>
                                <input type="checkbox" checked={localConfig.isVerticalHeader || false} onChange={(e) => updateLocalConfig('isVerticalHeader', e.target.checked)} />
                                <span>헤더 수직 정렬</span>
                            </label>
                        </div>
                        <ColWidthControl colWidths={colWidths} setColWidths={setColWidths} layout={layout} isGuideMode={false} />
                    </div>
                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose} title="변경사항 취소 후 닫기">취소</button>
                    <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleApply} title="표 설정 저장 및 적용">저장 및 적용하기</button>
                </div>
            </div>
    );
}

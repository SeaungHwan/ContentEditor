/*
 * [TableConfigToolbar.jsx] 상단/사이드 툴바 UI 컴포넌트
 */
"use client";
import React from 'react';
import layout from "../../layout.module.css";
import { GUIDE_MESSAGES } from './utils/constants';
const TableConfigToolbar = React.memo(({
    isGuideMode, setIsGuideMode, toggleModal, modals,
    handleCopy, handleClear, handleManualClean,
    stats,
}) => {
    return (
        <div className={layout.tableBtnWrap}>
            <div className={layout.sidebarWrapper}>
                <div className={layout.menuWrap}>
                    <div className={layout.btnBox}>
                        <button type="button" onClick={() => toggleModal('contentConfig', true)} className={`${modals?.contentConfig ?  layout.pri : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.contBtn : undefined} title='콘텐츠 설정'>
                            <p className={layout.ico}><img src='/00_common/images/sub_com/menuBtn1.svg' alt='아이콘'/></p><span>콘텐츠</span>
                        </button>
                        <button type="button" onClick={() => toggleModal('globalTableConfig', true)} className={`${modals?.globalTableConfig ? layout.pri : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.allTableBtn : undefined} title='테이블 설정'>
                            <p className={layout.ico}><img src='/00_common/images/sub_com/menuBtn2.svg' alt='아이콘'/></p><span>테이블</span>
                        </button>
                        <button type="button" onClick={() => toggleModal('preview', true)} className={`${modals?.preview ? layout.pri : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.preview : undefined} title='미리보기 (Ctrl+Shift+P)'>
                            <p className={layout.ico}><img src='/00_common/images/sub_com/menuBtn4.svg' alt='아이콘'/></p><span>미리보기</span>
                        </button>
                        <button type="button" onClick={handleManualClean} className={`${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.cleanBtn : undefined} title='코드 정리 (Ctrl+Shift+K)'>
                            <img src='/00_common/images/sub_com/btn_ico01.svg' alt='코드 정리'/><span>코드 정리</span>
                        </button>
                        <button type="button" onClick={handleCopy} className={`${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.copyBtn : undefined} title='코드 복사 (Ctrl+Shift+C)'>
                            <img src='/00_common/images/sub_com/btn_ico02.svg' alt='코드 복사'/><span>코드 복사</span>
                        </button>
                        <button type="button" onClick={handleClear} className={`${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.removeBtn : undefined} title='전체 삭제'>
                            <img src='/00_common/images/sub_com/btn_ico04.svg' alt='전체 삭제'/><span>전체 삭제</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => toggleModal('presets', true)}
                            className={`${modals?.presets ? layout.pri : ''} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ''}`}
                            data-guide={isGuideMode ? GUIDE_MESSAGES.presetsBtn : undefined}
                            title="설정 프리셋"
                        >
                            <i className="ri-bookmark-line" /><span>프리셋</span>
                        </button>
                    </div>

                    <div className={layout.homeWrap}>
                        <button type="button" className={`${layout.guideBtn} ${isGuideMode ? `${layout.guideTarget} ${layout.guideLeft}` : ''}`} data-guide={isGuideMode ? GUIDE_MESSAGES.guideNotice : undefined} onClick={() => toggleModal('guide', true)} title='주의점'>
                            <div className={layout.guide}><img src='/00_common/images/sub_com/menuBtn6.svg' alt='아이콘'/></div>
                        </button>
                        <button type="button" data-guide-toggle="true" className={layout.guideBtn} onClick={() => setIsGuideMode(!isGuideMode)} title={isGuideMode ? '가이드를 종료합니다.' : '가이드'}>
                            <div className={`${layout.guide} ${isGuideMode ? `${layout.guideClose}` : ''}`}>
                                <img src='/00_common/images/sub_com/menuBtn8.svg' alt='아이콘'/>
                            </div>
                        </button>
                    </div>
                </div>

                {/* 통계 바 */}
                {stats && (
                    <div className={layout.statsBar}>
                        <span className={layout.statItem}>
                            <i className="ri-text" />
                            글자 <strong>{stats.chars.toLocaleString()}</strong>자
                        </span>
                        <span className={layout.statItem}>
                            <i className="ri-table-line" />
                            표 <strong>{stats.tables}</strong>개
                        </span>
                        {stats.images > 0 && (
                            <span className={layout.statItem}>
                                <i className="ri-image-line" />
                                이미지 <strong>{stats.images}</strong>개
                            </span>
                        )}
                        <span className={`${layout.statItem} ${layout.statHint}`}>
                            단축키: Ctrl+Shift+C 복사 · K 정리 · P 미리보기
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

TableConfigToolbar.displayName = "TableConfigToolbar";
export default TableConfigToolbar;

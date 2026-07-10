/*
 * [TocPanel.jsx] 문서 아웃라인 목차 패널
 *
 * 역할:
 *   - 편집 중인 문서의 제목/표/목록 항목을 목차로 보여주고, 제목 후보 변환/되돌리기 UI를 제공한다.
 *   - TableEditor에서 분리한 이유: content(에디터 내용) state가 편집할 때마다 갱신되어
 *     TableEditor 전체가 리렌더링되는데, 이 패널은 content와 무관하므로 React.memo로
 *     감싸 목차 관련 state/props가 실제로 바뀔 때만 리렌더링되도록 한다.
 */
"use client";
import React from 'react';

const TocPanel = React.memo(({
    layout,
    showToc, setShowToc,
    tocItems, filteredTocItems, tocFilter, setTocFilter,
    headingCandidates, conversionHistory,
    activeItemIndex,
    editingTocIndex, editingTocLabel, setEditingTocLabel,
    scrollToItem, handleTocDoubleClick, handleTocLabelSave, handleTocLabelKeyDown,
    scrollToCandidate, handleCandidateLevelChange, handleCandidateConvert, handleCandidateDismiss,
    handleCandidateConvertAll, handleCandidateDismissAll, handleConversionUndo,
}) => {
    const hasAnyItem = tocItems.length >= 1 || headingCandidates.length > 0 || conversionHistory.length > 0;
    const showTocPanel = showToc && hasAnyItem;

    if (!showTocPanel) {
        if (!hasAnyItem) return null;
        return (
            <button
                type="button"
                className={layout.tocToggleBtn}
                onClick={() => setShowToc(true)}
                title="문서 목차 열기"
            >
                <i className="ri-list-check" />
                <span>목차</span>
                {headingCandidates.length > 0 && (
                    <span className={layout.tocToggleBadge}>{headingCandidates.length}</span>
                )}
            </button>
        );
    }

    return (
        <div className={layout.tocPanel}>
            <div className={layout.tocHeader}>
                <span>문서 목차 ({tocItems.length})</span>
                <div className={layout.tocFilters}>
                    <button type="button" title="제목 항목" className={tocFilter.heading ? layout.tocFilterOn : layout.tocFilterOff} onClick={() => setTocFilter(p => ({ ...p, heading: !p.heading }))}>
                        <i className="ri-heading" />
                    </button>
                    <button type="button" title="표 항목" className={tocFilter.table ? layout.tocFilterOn : layout.tocFilterOff} onClick={() => setTocFilter(p => ({ ...p, table: !p.table }))}>
                        <i className="ri-table-2" />
                    </button>
                    <button type="button" title="목록 항목" className={tocFilter.list ? layout.tocFilterOn : layout.tocFilterOff} onClick={() => setTocFilter(p => ({ ...p, list: !p.list }))}>
                        <i className="ri-list-unordered" />
                    </button>
                </div>
                <button type="button" onClick={() => setShowToc(false)} title="패널 닫기">
                    <i className="ri-close-line" />
                </button>
            </div>

            {/* 제목 후보 + 되돌리기 섹션 */}
            {(headingCandidates.length > 0 || conversionHistory.length > 0) && (
                <div className={layout.tocCandSection}>
                    {conversionHistory.length > 0 && (
                        <div className={layout.tocCandUndo}>
                            <button type="button" onClick={handleConversionUndo} title={`마지막 변환 되돌리기 (${conversionHistory.length}단계 가능)`}>
                                <i className="ri-arrow-go-back-line" />
                                <span>되돌리기 ({conversionHistory.length})</span>
                            </button>
                        </div>
                    )}
                    {headingCandidates.length > 0 && (<>
                    <div className={layout.tocCandHeader}>
                        <span>후보 {headingCandidates.length}개</span>
                        <div className={layout.tocCandHeaderBtns}>
                            <button type="button" onClick={handleCandidateConvertAll} title="전체 변환">전체 변환</button>
                            <button type="button" onClick={handleCandidateDismissAll} title="취소">취소</button>
                        </div>
                    </div>
                    {headingCandidates.map(({ id, text, fullText, suggestedLevel, confidence, pattern }) => (
                        <div key={id} className={`${layout.tocCandItem}${confidence === 'medium' ? ` ${layout.tocCandMedium}` : ''}`}>
                            <button
                                type="button"
                                className={layout.tocCandText}
                                onClick={() => scrollToCandidate(id)}
                                title={confidence === 'medium' ? `${fullText}\n[${pattern} 패턴 — 직접 확인 권장]` : fullText}
                            >
                                {text}
                            </button>
                            <div className={layout.tocCandActions}>
                                <button type="button" className={layout.tocCandLevel} onClick={() => handleCandidateLevelChange(id)} title="클릭으로 레벨 변경">
                                    {suggestedLevel.toUpperCase()}{confidence === 'medium' ? '?' : ''}
                                </button>
                                <button type="button" className={layout.tocCandConvert} onClick={() => handleCandidateConvert(id, suggestedLevel)} title="제목으로 변환">
                                    변환
                                </button>
                                <button type="button" className={layout.tocCandDismiss} onClick={() => handleCandidateDismiss(id)} title="무시">
                                    <i className="ri-close-line" />
                                </button>
                            </div>
                        </div>
                    ))}
                    </>)}
                </div>
            )}

            <div className={layout.tocList}>
                {filteredTocItems.map(({ domIndex, tag, type, label, fullLabel, indent }) => (
                    editingTocIndex === domIndex ? (
                        <div key={domIndex} className={`${layout.tocItem} ${layout.tocItemEditing}`}>
                            <span className={`${layout.tocIndex} ${layout.tocBadgeT}`}>표</span>
                            <input
                                className={layout.tocEditInput}
                                autoFocus
                                value={editingTocLabel}
                                onChange={e => setEditingTocLabel(e.target.value)}
                                onBlur={() => handleTocLabelSave(domIndex)}
                                onKeyDown={e => handleTocLabelKeyDown(e, domIndex)}
                            />
                        </div>
                    ) : (
                        <button
                            key={domIndex}
                            type="button"
                            className={`${layout.tocItem}${activeItemIndex === domIndex ? ` ${layout.tocItemActive}` : ''}`}
                            style={type === 'heading' ? { paddingLeft: `${0.75 + indent * 0.65}rem` } : undefined}
                            onClick={() => scrollToItem(domIndex)}
                            onDoubleClick={() => type === 'table' ? handleTocDoubleClick(domIndex, fullLabel) : undefined}
                            title={type === 'table' ? `${fullLabel}\n(더블클릭으로 라벨 편집)` : fullLabel}
                        >
                            <span className={`${layout.tocIndex} ${type === 'heading' ? layout.tocBadgeH : type === 'table' ? layout.tocBadgeT : layout.tocBadgeL}`}>
                                {type === 'heading' ? tag.toUpperCase() : type === 'table' ? '표' : '목'}
                            </span>
                            {label}
                        </button>
                    )
                ))}
            </div>
        </div>
    );
});

TocPanel.displayName = "TocPanel";
export default TocPanel;

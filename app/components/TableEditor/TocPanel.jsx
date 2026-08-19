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
    const [panelWidth, setPanelWidth] = React.useState(190);
    const [showOnboarding, setShowOnboarding] = React.useState(false);

    React.useEffect(() => {
        const savedWidth = Number(window.localStorage.getItem('tocPanelWidth'));
        if (savedWidth) setPanelWidth(savedWidth);
        if (!window.localStorage.getItem('tocOnboardingSeen')) setShowOnboarding(true);
    }, []);

    const dismissOnboarding = () => {
        setShowOnboarding(false);
        window.localStorage.setItem('tocOnboardingSeen', '1');
    };

    const startResize = e => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = panelWidth;
        let latestWidth = startWidth;
        const onMove = moveEvent => {
            latestWidth = Math.min(320, Math.max(165, startWidth - (moveEvent.clientX - startX)));
            setPanelWidth(latestWidth);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.localStorage.setItem('tocPanelWidth', String(latestWidth));
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

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
        <div className={layout.tocPanel} style={{ width: `${panelWidth}px` }}>
            <div className={layout.tocResizeHandle} onMouseDown={startResize} title="드래그하여 너비 조절" />
            <div className={layout.tocHeader}>
                <span className={layout.tocHeaderTitle}>
                    목차
                    <span className={layout.tocHeaderCount}>{tocItems.length}</span>
                </span>
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
                <button type="button" className={layout.tocCloseBtn} onClick={() => setShowToc(false)} title="패널 닫기">
                    <i className="ri-close-line" />
                </button>
            </div>

            {/* 배지 범례: 처음 사용자를 위한 기호 설명 */}
            <div className={layout.tocLegend}>
                <span className={layout.tocLegendItem}><i className={`${layout.tocLegendDot} ${layout.tocBadgeH}`} />제목</span>
                <span className={layout.tocLegendItem}><i className={`${layout.tocLegendDot} ${layout.tocBadgeT}`} />표</span>
                <span className={layout.tocLegendItem}><i className={`${layout.tocLegendDot} ${layout.tocBadgeL}`} />목록</span>
            </div>

            {/* 최초 사용자 온보딩 안내 (1회만 노출) */}
            {showOnboarding && (
                <div className={layout.tocOnboarding}>
                    <div className={layout.tocOnboardingText}>
                        <b>목차 패널 사용법</b><br />
                        항목을 클릭하면 해당 위치로 이동합니다. 표 항목은 연필 아이콘(또는 더블클릭)으로 이름을 바꿀 수 있고,
                        상단 <i className="ri-heading" />/<i className="ri-table-2" />/<i className="ri-list-unordered" /> 필터로 원하는 항목만 볼 수 있어요.
                        패널 왼쪽 가장자리를 드래그하면 너비도 조절됩니다.
                    </div>
                    <button type="button" className={layout.tocOnboardingClose} onClick={dismissOnboarding} title="닫기">
                        <i className="ri-close-line" />
                    </button>
                </div>
            )}

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
                    <div className={layout.tocCandHint}>
                        자동 감지된 제목 후보입니다. 레벨(H1~H6)을 클릭해 바꾸고, <b>변환</b>을 누르면 실제 제목으로 바뀝니다. 노란색 항목은 <b>직접 확인이 필요</b>합니다.
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
                        <div
                            key={domIndex}
                            role="button"
                            tabIndex={0}
                            className={`${layout.tocItem} ${layout.tocItemRow} ${type === 'heading' ? layout.tocItemH : type === 'table' ? layout.tocItemT : layout.tocItemL}${activeItemIndex === domIndex ? ` ${layout.tocItemActive}` : ''}`}
                            style={type === 'heading' ? { paddingLeft: `${0.75 + indent * 0.65}rem` } : undefined}
                            onClick={() => scrollToItem(domIndex)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToItem(domIndex); } }}
                            onDoubleClick={() => type === 'table' ? handleTocDoubleClick(domIndex, fullLabel) : undefined}
                            title={type === 'table' ? `${fullLabel}\n(연필 아이콘 또는 더블클릭으로 라벨 편집)` : fullLabel}
                        >
                            <span className={`${layout.tocIndex} ${type === 'heading' ? layout.tocBadgeH : type === 'table' ? layout.tocBadgeT : layout.tocBadgeL}`}>
                                {type === 'heading' ? tag.toUpperCase() : type === 'table' ? '표' : '목'}
                            </span>
                            <span className={layout.tocItemLabel}>{label}</span>
                            {type === 'table' && (
                                <button
                                    type="button"
                                    className={layout.tocItemEditBtn}
                                    onClick={e => { e.stopPropagation(); handleTocDoubleClick(domIndex, fullLabel); }}
                                    title="라벨 편집"
                                >
                                    <i className="ri-pencil-line" />
                                </button>
                            )}
                        </div>
                    )
                ))}
            </div>
        </div>
    );
});

TocPanel.displayName = "TocPanel";
export default TocPanel;

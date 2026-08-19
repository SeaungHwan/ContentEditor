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

const WIDTH_KEY = 'tocPanelWidth';
const ONBOARDING_KEY = 'tocOnboardingSeen';
const MIN_WIDTH = 165;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 190;
const clampWidth = w => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));

const readStoredWidth = () => {
    try {
        const saved = Number(window.localStorage.getItem(WIDTH_KEY));
        return saved ? clampWidth(saved) : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
};
const readOnboardingSeen = () => {
    try { return !!window.localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
};

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
    const [panelWidth, setPanelWidth] = React.useState(readStoredWidth);
    const [showOnboarding, setShowOnboarding] = React.useState(() => !readOnboardingSeen());
    const latestWidthRef = React.useRef(panelWidth);
    const isDraggingRef = React.useRef(false);
    const dragStartRef = React.useRef({ mouseX: 0, width: 0 });

    // 마운트 중 한 번만 붙는 영구 리스너(useModalDrag.js와 동일한 패턴). 드래그 제스처마다
    // addEventListener/removeEventListener를 반복하면, mouseup이 Jodit 에디터 iframe 위에서
    // 발생해 document까지 전달되지 않는 경우 리스너가 정리되지 않고 계속 쌓여 다음 드래그부터
    // setPanelWidth가 이중으로 호출되며 리사이즈가 튀는 문제가 있었다.
    React.useEffect(() => {
        let rafId = null;
        let latestClientX = null;
        const flush = () => {
            rafId = null;
            if (latestClientX === null) return;
            const next = clampWidth(dragStartRef.current.width - (latestClientX - dragStartRef.current.mouseX));
            latestWidthRef.current = next;
            setPanelWidth(next);
        };
        const onMove = e => {
            if (!isDraggingRef.current) return;
            latestClientX = e.clientX;
            if (rafId === null) rafId = requestAnimationFrame(flush);
        };
        const onUp = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            try { window.localStorage.setItem(WIDTH_KEY, String(latestWidthRef.current)); } catch { /* 무시 */ }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);

    const dismissOnboarding = () => {
        setShowOnboarding(false);
        try { window.localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* 무시 */ }
    };

    const startResize = e => {
        e.preventDefault();
        isDraggingRef.current = true;
        dragStartRef.current = { mouseX: e.clientX, width: panelWidth };
    };

    const hasAnyItem = tocItems.length >= 1 || headingCandidates.length > 0 || conversionHistory.length > 0;

    // showToc가 꺼져 있을 때만 완전히 숨기거나 재오픈 버튼을 보여준다. showToc가 켜진 뒤에는
    // hasAnyItem이 false여도(예: 방금 열었는데 유휴시간 재파싱 결과 항목이 0개인 경우) 패널을
    // 통째로 숨기지 않는다 — 그러면 열자마자 깜빡이며 사라지고 재오픈 버튼까지 없어져 다시
    // 열 방법이 사라지는 문제가 있었다. 대신 아래 본문에서 "표시할 항목 없음" 상태를 보여준다.
    if (!showToc) {
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

            {!hasAnyItem ? (
                <div className={layout.tocEmpty}>표시할 제목·표·목록이 없습니다.</div>
            ) : (<>
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
            </>)}
        </div>
    );
});

TocPanel.displayName = "TocPanel";
export default TocPanel;

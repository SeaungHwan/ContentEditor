/*
 * [PreviewModal.jsx] HTML 미리보기 모달
 *
 * 역할:
 *   - 정제된 HTML을 실제 브라우저 렌더링으로 미리볼 수 있는 모달.
 *   - PC / 모바일 탭으로 뷰포트를 전환해 반응형 확인 가능.
 *   - updateStylesOnly로 현재 설정을 반영한 HTML을 dangerouslySetInnerHTML로 표시한다.
 */

import React, { useEffect, useState } from 'react';
import { updateStylesOnly } from '../cleanTableHtml';

const PreviewModal = React.memo(({ content, config, widthString, onClose, layout, fadeStyle }) => {
    const [viewMode, setViewMode] = useState('pc');

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const overrideStyle = {};
    if (config.primaryColor)   overrideStyle['--color-primary']   = config.primaryColor;
    if (config.secondaryColor) overrideStyle['--color-secondary'] = config.secondaryColor;
    if (config.tertiaryColor)  overrideStyle['--color-tertiary']  = config.tertiaryColor;
    if (config.accentColor)    overrideStyle['--color-accent']    = config.accentColor;

    const previewHtml = updateStylesOnly(content, config, widthString);

    return (
        <div className={layout.modalPopWrap} style={fadeStyle}>
            <div className={layout.modalPop}>
                <div className={layout.titWrap}>
                    <h4 className={`tit-st contents ${layout.modalTitH4}`}>미리보기</h4>
                    <div className={layout.previewTabBar}>
                        <button
                            type="button"
                            className={`${layout.previewTab}${viewMode === 'pc' ? ` ${layout.tabActive}` : ''}`}
                            onClick={() => setViewMode('pc')}
                        >
                            <i className={`ri-computer-line ${layout.tabIcon}`} />PC
                        </button>
                        <button
                            type="button"
                            className={`${layout.previewTab}${viewMode === 'mobile' ? ` ${layout.tabActive}` : ''}`}
                            onClick={() => setViewMode('mobile')}
                        >
                            <i className={`ri-smartphone-line ${layout.tabIcon}`} />모바일
                        </button>
                    </div>
                </div>
                <div className={layout.previewScrollBody}>
                    {viewMode === 'mobile' ? (
                        <div className={layout.mobileFrame}>
                            <div data-theme={config.theme} style={overrideStyle}>
                                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                            </div>
                        </div>
                    ) : (
                        <div data-theme={config.theme} style={overrideStyle}>
                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    )}
                </div>
                <div className='ar mgt20'><button type="button" onClick={onClose} className="btn-st gray">닫기</button></div>
            </div>
        </div>
    );
});

PreviewModal.displayName = "PreviewModal";
export default PreviewModal;

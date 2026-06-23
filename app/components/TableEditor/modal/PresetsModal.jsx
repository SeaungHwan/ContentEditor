"use client";
import React, { useState, useEffect } from 'react';
import { useModalDrag } from '../hooks/useModalDrag';

function buildSummary(cfg) {
    if (!cfg) return '';
    const parts = [];
    if (cfg.theme) parts.push(`테마 ${cfg.theme}`);
    if (cfg.wrapperClassName) parts.push(`래퍼 ${cfg.wrapperClassName}`);
    const tits = [cfg.tit1Class, cfg.tit2Class, cfg.tit3Class].filter(Boolean);
    if (tits.length) parts.push(`제목 ${tits.join('·')}`);
    if (cfg.isColorMode || cfg.tableIsColorMode) parts.push('색상모드');
    return parts.join(' / ');
}

export default function PresetsModal({ onClose, onApply, onSave, onDelete, presets, layout, fadeStyle }) {
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');
    const { dragStyle, handleDragStart } = useModalDrag();

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSave = () => {
        const name = newName.trim();
        if (!name) { setError('이름을 입력해주세요.'); return; }
        if (presets.some(p => p.name === name)) { setError('이미 존재하는 이름입니다.'); return; }
        onSave(name);
        setNewName('');
        setError('');
    };

    return (
        <div className={layout.modalPopWrap} style={fadeStyle}>
            <div className={layout.modalContentBox} style={dragStyle}>
                <div className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>프리셋<em>ㅣ 컨텐츠·테이블 설정을 저장하고 불러올 수 있습니다</em></span>
                    <button type="button" onClick={onClose} className={layout.guideBtn}>
                        <i className="ri-close-line" />
                    </button>
                </div>

                <div className={layout.modalBody}>
                    <div className={layout.configSection}>
                        <span className={layout.configLabel}>현재 설정 저장</span>
                        <div className={`${layout.flexCol} ${layout.gap035}`}>
                            <input
                                type="text"
                                className={`Inp ${layout.presetInput}`}
                                placeholder="프리셋 이름"
                                value={newName}
                                onChange={e => { setNewName(e.target.value); setError(''); }}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                            />
                            <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleSave}>
                                저장
                            </button>
                        </div>
                        {error && <span className={layout.presetError}>{error}</span>}
                        <span className={layout.presetSaveHint}>
                            컨텐츠 설정·테이블 설정·테마·색상·열 너비가 함께 저장됩니다.
                        </span>
                    </div>

                    <div className={layout.configSection}>
                        <span className={layout.configLabel}>저장된 프리셋 ({presets.length}개)</span>
                        {presets.length === 0 ? (
                            <span className={layout.presetEmpty}>저장된 프리셋이 없습니다.</span>
                        ) : (
                            <div className={layout.presetList}>
                                {presets.map(p => (
                                    <div key={p.name} className={layout.presetRow}>
                                        <div className={layout.presetInfo}>
                                            <span className={layout.presetName}>{p.name}</span>
                                            <span className={layout.presetSummary}>{buildSummary(p.config)}</span>
                                        </div>
                                        <div className={layout.presetActions}>
                                            <button type="button" className={`${layout.applyBtn} ${layout.blue} ${layout.presetSmBtn}`} onClick={() => { onApply(p.config); onClose(); }}>
                                                적용
                                            </button>
                                            <button type="button" className={`${layout.cancelBtn} ${layout.presetDelBtn}`} onClick={() => onDelete(p.name)}>
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
}

"use client";
import React, { useState, useEffect } from 'react';
import { useModalDrag } from '../hooks/useModalDrag';

export default function PresetsModal({ onClose, onApply, onSave, onDelete, presets, layout, fadeStyle }) {
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');
    const [selectedName, setSelectedName] = useState(null);
    const { dragStyle, handleDragStart, modalRef } = useModalDrag();

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

    const handleSelect = (name) => {
        setSelectedName(prev => prev === name ? null : name);
    };

    const handleApply = () => {
        const selected = presets.find(p => p.name === selectedName);
        if (!selected) return;
        onApply(selected.config);
        onClose();
    };

    return (
        <div className={layout.modalPopWrap} style={fadeStyle}>
            <div ref={modalRef} className={layout.modalContentBox} style={dragStyle}>
                <h2 className={layout.modalTitle} onMouseDown={handleDragStart}>
                    <span>프리셋</span>
                </h2>

                <div className={layout.modalBody}>
                    {presets.length === 0 ? (
                        <span className={layout.presetEmpty}>저장된 프리셋이 없습니다.</span>
                    ) : (
                        <div className={layout.presetList}>
                            {presets.map(p => (
                                <div
                                    key={p.name}
                                    className={`${layout.presetRow} ${p.name === selectedName ? layout.presetRowActive : ''}`}
                                    onClick={() => handleSelect(p.name)}
                                >
                                    <span className={layout.presetName}>
                                        {p.locked && <i className={`ri-lock-fill ${layout.presetLockIcon}`} />}
                                        {p.name}
                                    </span>
                                    <div className={layout.presetActions}>
                                        {!p.locked && (
                                            <button
                                                type="button"
                                                className={layout.presetDelBtn}
                                                onClick={(e) => { e.stopPropagation(); onDelete(p.name); }}
                                                title="삭제"
                                            >
                                                <i className="ri-delete-bin-6-line" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={layout.presetSaveSection}>
                        <span className={layout.modalLabelSpan}>현재 설정을 새 프리셋으로 저장</span>
                        <div className={layout.presetSaveRow}>
                            <input
                                type="text"
                                className={layout.presetInput}
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
                    </div>
                </div>

                <div className={layout.modalFooter}>
                    <button type="button" className={layout.cancelBtn} onClick={onClose} title="닫기">닫기</button>
                    <button type="button" className={`${layout.applyBtn} ${layout.blue}`} onClick={handleApply} disabled={!selectedName} title="선택한 프리셋 적용">적용</button>
                </div>
            </div>
        </div>
    );
}

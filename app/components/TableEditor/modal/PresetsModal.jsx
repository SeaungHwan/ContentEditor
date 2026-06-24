"use client";
import React, { useState, useEffect } from 'react';
import { useModalDrag } from '../hooks/useModalDrag';

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
                    <span>프리셋</span>
                    <button type="button" onClick={onClose} className={layout.guideBtn}>
                        <i className="ri-close-line" />
                    </button>
                </div>

                <div className={layout.modalBody}>
                    <div className={layout.presetSaveRow}>
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

                    {presets.length === 0 ? (
                        <span className={layout.presetEmpty}>저장된 프리셋이 없습니다.</span>
                    ) : (
                        <div className={layout.presetList}>
                            {presets.map(p => (
                                <div key={p.name} className={layout.presetRow}>
                                    <span className={layout.presetName}>
                                        {p.locked && <i className="ri-lock-fill" style={{ fontSize: '0.65rem', color: '#f59e0b', marginRight: '0.25rem' }} />}
                                        {p.name}
                                    </span>
                                    <div className={layout.presetActions}>
                                        <button type="button" className={`${layout.applyBtn} ${layout.blue} ${layout.presetSmBtn}`} onClick={() => { onApply(p.config); onClose(); }}>
                                            적용
                                        </button>
                                        {!p.locked && (
                                            <button type="button" className={`${layout.cancelBtn} ${layout.presetDelBtn}`} onClick={() => onDelete(p.name)}>
                                                삭제
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

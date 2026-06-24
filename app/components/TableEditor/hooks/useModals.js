/*
 * [useModals.js] 모달 열림/닫힘 상태 및 페이드 애니메이션 관리 훅
 *
 * 역할:
 *   - TableEditor에서 사용하는 모든 모달(Preview, Guide, GlobalTableConfig,
 *     ContentConfig, TableEdit)의 표시 상태를 중앙 관리한다.
 *
 * 핵심 동작:
 *   - modals: 실제 DOM 마운트 여부 (true이면 컴포넌트 렌더링)
 *   - visibleModals: CSS opacity 제어 여부 (10ms 딜레이 후 true → fade-in 트리거)
 *   - 닫힐 때: visibleModals=false → 300ms(FADE_DURATION) 후 modals=false (fade-out 완료 후 언마운트)
 *
 *   toggleModal(name, show)
 *     - show=true: 배타적(EXCLUSIVE) 그룹 모달이면 다른 열린 모달을 즉시 닫고 열기
 *     - show=false: fade-out 애니메이션 후 언마운트
 *     - 중복 타이머 방지를 위해 timersRef로 기존 타이머를 clearTimeout 후 재설정
 *
 *   getFadeStyle(name) → { opacity, transition, pointerEvents }
 *     - 모달 컴포넌트에 직접 style로 전달해 CSS 트랜지션 기반 페이드 구현
 *
 *   openTableEditModal / closeTableEditModal
 *     - TableEditModal 전용: html, tempId, existingConfig, existingColWidths 데이터를 함께 관리
 *     - 닫을 때 fade-out 완료 후 데이터도 초기화해 잔여 상태 방지
 *
 * EXCLUSIVE_MODALS:
 *   globalTableConfig, contentConfig, HwpModal, PsdModal, tableEdit 는 동시에 하나만 열릴 수 있다.
 */
"use client";
import { useState, useCallback, useRef, useEffect } from 'react';

const FADE_DURATION = 300;

const INITIAL_MODALS = {
    preview: false, guide: false,
    globalTableConfig: false, contentConfig: false,
    tableEdit: false, presets: false,
};

// 동시에 하나만 열릴 수 있는 모달 그룹
const EXCLUSIVE_MODALS = ['globalTableConfig', 'contentConfig', 'tableEdit', 'preview', 'presets'];

const INITIAL_TABLE_EDIT_DATA = { html: '', tempId: '', existingConfig: null, existingColWidths: null };

export default function useModals() {
    const [modals, setModals] = useState(INITIAL_MODALS);
    const [visibleModals, setVisibleModals] = useState(INITIAL_MODALS);
    const [isGuideMode, setIsGuideMode] = useState(false);
    const [tableEditData, setTableEditData] = useState(INITIAL_TABLE_EDIT_DATA);

    const timersRef = useRef({});

    const toggleModal = useCallback((name, show) => {
        if (timersRef.current[name]) {
            clearTimeout(timersRef.current[name]);
            delete timersRef.current[name];
        }
        if (show) {
            // 배타적 그룹 내 다른 모달이 열려 있으면 즉시 닫기
            if (EXCLUSIVE_MODALS.includes(name)) {
                EXCLUSIVE_MODALS.forEach(key => {
                    if (key === name) return;
                    if (timersRef.current[key]) {
                        clearTimeout(timersRef.current[key]);
                        delete timersRef.current[key];
                    }
                });
                const closeUpdate = Object.fromEntries(
                    EXCLUSIVE_MODALS.filter(k => k !== name).map(k => [k, false])
                );
                setModals(prev => ({ ...prev, ...closeUpdate }));
                setVisibleModals(prev => ({ ...prev, ...closeUpdate }));
            }
            setModals(prev => ({ ...prev, [name]: true }));
            timersRef.current[name] = setTimeout(() => {
                setVisibleModals(prev => ({ ...prev, [name]: true }));
                delete timersRef.current[name];
            }, 10);
        } else {
            setVisibleModals(prev => ({ ...prev, [name]: false }));
            timersRef.current[name] = setTimeout(() => {
                setModals(prev => ({ ...prev, [name]: false }));
                delete timersRef.current[name];
            }, FADE_DURATION);
        }
    }, []);

    useEffect(() => {
        return () => {
            Object.values(timersRef.current).forEach(clearTimeout);
            timersRef.current = {};
        };
    }, []);

    const getFadeStyle = useCallback((name) => ({
        opacity: visibleModals[name] ? 1 : 0,
        transition: `opacity ${FADE_DURATION}ms`,
        pointerEvents: visibleModals[name] ? 'auto' : 'none',
    }), [visibleModals]);

    const openTableEditModal = useCallback((html, tempId, existingConfig, existingColWidths) => {
        setTableEditData({ html, tempId, existingConfig, existingColWidths });
        toggleModal('tableEdit', true);
    }, [toggleModal]);

    const closeTableEditModal = useCallback(() => {
        toggleModal('tableEdit', false);
        // fade-out 완료 후 데이터 정리
        setTimeout(() => setTableEditData(INITIAL_TABLE_EDIT_DATA), FADE_DURATION);
    }, [toggleModal]);

    return {
        modals,
        visibleModals,
        getFadeStyle,
        toggleModal,
        isGuideMode,
        setIsGuideMode,
        tableEditModal: { show: modals.tableEdit, ...tableEditData },
        openTableEditModal,
        closeTableEditModal,
    };
}

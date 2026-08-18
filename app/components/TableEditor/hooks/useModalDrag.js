
/*
 * [useModalDrag.js] 모달 드래그 이동 훅
 *
 * 역할:
 *   - 모달 창의 헤더(타이틀 영역)를 마우스로 드래그해 위치를 이동할 수 있게 한다.
 *   - TableEditModal, GlobalTableConfigModal, ContentConfigModal, EtcConfigModal,
 *     PresetsModal에서 사용한다.
 *
 * 동작 원리:
 *   - handleDragStart: 마우스 좌클릭 시 현재 마우스 좌표와 모달 위치를 dragStart에 기록.
 *     modalRef가 실제 모달 DOM에 연결돼 있으면, 그 시점의 위치/크기를 기준으로 이번
 *     드래그 동안 허용되는 이동량(dx/dy) 범위를 미리 계산해둔다(clampBoundsRef).
 *   - mousemove 이벤트: isDragging이 true일 때 delta(현재-시작)를 clampBoundsRef 범위로
 *     제한한 뒤 dragPos에 반영 — 모달이 화면 밖으로 완전히 나가 다시 잡을 수 없게 되는
 *     것을 방지한다. modalRef를 연결하지 않은 호출부는 기존과 동일하게 무제한으로 동작한다.
 *   - mouseup 이벤트: isDragging을 false로 리셋
 *   - dragStyle: transform: translate(calc(-50% + Xpx), calc(-50% + Ypx)) 형태로 반환
 *     (모달이 화면 중앙 기준으로 열리므로 -50% 기본 오프셋에 드래그 delta를 더함)
 */

import { useState, useRef, useEffect } from 'react';

// 드래그가 끝난 뒤에도 모달을 다시 잡을 수 있도록, 화면 안에 최소한 이만큼은 남겨둔다.
const MIN_VISIBLE_PX = 40;

export function useModalDrag() {
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
    const modalRef = useRef(null);
    // 이번 드래그 동안 dx/dy가 허용되는 범위. modalRef가 없거나 측정에 실패하면 null(무제한).
    const clampBoundsRef = useRef(null);

    useEffect(() => {
        // mousemove마다 바로 setState하면 고빈도 리렌더가 발생하므로, 프레임당 최신 좌표
        // 하나만 반영되도록 requestAnimationFrame으로 묶는다 (최종 위치 값은 동일).
        let rafId = null;
        let latestEvent = null;

        const flush = () => {
            rafId = null;
            if (!latestEvent) return;
            const e = latestEvent;
            let dx = e.clientX - dragStart.current.mouseX;
            let dy = e.clientY - dragStart.current.mouseY;
            const bounds = clampBoundsRef.current;
            if (bounds) {
                dx = Math.min(Math.max(dx, bounds.minDx), bounds.maxDx);
                dy = Math.min(Math.max(dy, bounds.minDy), bounds.maxDy);
            }
            setDragPos({
                x: dragStart.current.posX + dx,
                y: dragStart.current.posY + dy,
            });
        };

        const handleMouseMove = (e) => {
            if (!isDragging.current) return;
            latestEvent = e;
            if (rafId === null) rafId = requestAnimationFrame(flush);
        };
        const handleMouseUp = () => { isDragging.current = false; };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);

    const handleDragStart = (e) => {
        if (e.button !== 0) return;
        isDragging.current = true;
        dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: dragPos.x, posY: dragPos.y };

        // 드래그 시작 시점의 모달 위치/크기를 기준으로 이번 드래그의 dx/dy 허용 범위를 계산한다.
        clampBoundsRef.current = null;
        if (modalRef.current) {
            const rect = modalRef.current.getBoundingClientRect();
            clampBoundsRef.current = {
                minDx: MIN_VISIBLE_PX - rect.right,
                maxDx: window.innerWidth - MIN_VISIBLE_PX - rect.left,
                minDy: MIN_VISIBLE_PX - rect.bottom,
                maxDy: window.innerHeight - MIN_VISIBLE_PX - rect.top,
            };
        }
        e.preventDefault();
    };

    const dragStyle = {transform: `translate(calc(-50% + ${dragPos.x}px), calc(-50% + ${dragPos.y}px))`,};

    return { dragStyle, handleDragStart, modalRef };
}

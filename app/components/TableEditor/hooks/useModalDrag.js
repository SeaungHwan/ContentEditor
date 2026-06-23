
/*
 * [useModalDrag.js] 모달 드래그 이동 훅
 *
 * 역할:
 *   - 모달 창의 헤더(타이틀 영역)를 마우스로 드래그해 위치를 이동할 수 있게 한다.
 *   - TableEditModal, GlobalTableConfigModal, ContentConfigModal에서 사용한다.
 *
 * 동작 원리:
 *   - handleDragStart: 마우스 좌클릭 시 현재 마우스 좌표와 모달 위치를 dragStart에 기록
 *   - mousemove 이벤트: isDragging이 true일 때 delta(현재-시작) 만큼 dragPos 업데이트
 *   - mouseup 이벤트: isDragging을 false로 리셋
 *   - dragStyle: transform: translate(calc(-50% + Xpx), calc(-50% + Ypx)) 형태로 반환
 *     (모달이 화면 중앙 기준으로 열리므로 -50% 기본 오프셋에 드래그 delta를 더함)
 */

import { useState, useRef, useEffect } from 'react';

export function useModalDrag() {
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging.current) return;
            setDragPos({
                x: dragStart.current.posX + e.clientX - dragStart.current.mouseX,
                y: dragStart.current.posY + e.clientY - dragStart.current.mouseY,
            });
        };
        const handleMouseUp = () => { isDragging.current = false; };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleDragStart = (e) => {
        if (e.button !== 0) return;
        isDragging.current = true;
        dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: dragPos.x, posY: dragPos.y };
        e.preventDefault();
    };

    const dragStyle = {transform: `translate(calc(-50% + ${dragPos.x}px), calc(-50% + ${dragPos.y}px))`,};

    return { dragStyle, handleDragStart };
}

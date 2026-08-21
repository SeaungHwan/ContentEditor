/*
 * [useRafDragListener.js] 마운트 중 한 번만 붙는 영구 mousemove/mouseup 드래그 리스너
 *
 * 역할:
 *   - useModalDrag.js(모달 이동)와 TocPanel.jsx(패널 리사이즈)에 각각 있던 동일한
 *     "rAF로 프레임당 1회 배치 + isDraggingRef가 true일 때만 반응" 패턴을 공통 추출한 것.
 *   - 드래그 제스처마다 addEventListener/removeEventListener를 반복하면, mouseup이
 *     리스너가 없는 다른 문서(Jodit 에디터 iframe 등) 위에서 발생해 document까지
 *     전달되지 않는 경우 리스너가 정리되지 않고 계속 쌓이는 문제가 있어, 마운트 시
 *     한 번만 붙이고 isDraggingRef로 활성 여부만 확인한다.
 *
 * onMove(e)/onUp()는 매 렌더마다 최신 함수를 ref로 갱신해 호출하므로, effect 자체는
 * 마운트 시 한 번만 리스너를 붙인다(의존성 배열에 넣지 않음).
 */
import { useEffect, useRef } from 'react';

export function useRafDragListener(isDraggingRef, onMove, onUp) {
    const onMoveRef = useRef(onMove);
    const onUpRef = useRef(onUp);
    onMoveRef.current = onMove;
    onUpRef.current = onUp;

    useEffect(() => {
        let rafId = null;
        let latestEvent = null;

        const flush = () => {
            rafId = null;
            if (latestEvent) onMoveRef.current(latestEvent);
        };
        const handleMouseMove = (e) => {
            if (!isDraggingRef.current) return;
            latestEvent = e;
            if (rafId === null) rafId = requestAnimationFrame(flush);
        };
        const handleMouseUp = () => {
            if (!isDraggingRef.current) return;
            onUpRef.current();
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDraggingRef]);
}

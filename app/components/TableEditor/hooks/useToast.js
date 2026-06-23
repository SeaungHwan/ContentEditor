/*
 * [useToast.js] 상단 토스트 알림 관리 훅
 *
 * 역할:
 *   - 버튼 클릭 결과(복사 완료, 정리 완료, 오류 등)를 화면 상단에 2초간 표시한다.
 *
 * 제공 값:
 *   toast         : { show: boolean, message: string, type: string, id: number }
 *   triggerToast(message, type?)
 *     - 토스트를 즉시 표시하고 2000ms 후 자동으로 숨긴다.
 *     - 연속 호출 시 이전 타이머를 clearTimeout 후 새로 시작해 메시지가 중첩되지 않는다.
 *     - id에 Date.now()를 사용해 같은 메시지가 연속으로 올 때도 React가 변경을 감지할 수 있다.
 */

"use client";
import { useState, useCallback, useRef, useEffect } from 'react';

export default function useToast() {
    const [toast, setToast] = useState({ show: false, message: '', id: 0 });
    const toastTimer = useRef(null);

    useEffect(() => {
        return () => { 
            if (toastTimer.current) clearTimeout(toastTimer.current); 
        };
    }, []);

    const triggerToast = useCallback((message, type = 'info') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ show: true, message, type, id: Date.now() });
        toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2000);
    }, []);

    return { toast, triggerToast };
}
/*
 * [ErrorBoundary.jsx] 에디터 렌더링 에러 격리 컴포넌트
 *
 * 역할:
 *   - JoditCustomEditor를 감싸 런타임 렌더링 오류가 발생해도 앱 전체가 중단되지 않도록
 *     React의 클래스형 ErrorBoundary 패턴으로 에러를 격리한다.
 *   - 에러 발생 시 에디터 영역에 간단한 에러 메시지와 새로고침 버튼을 표시한다.
 *   - TableEditor.jsx에서 key="editor-boundary"로 사용해 에디터가 교체될 때 재마운트된다.
 */

"use client";
import React from 'react';
import layout from '../../../layout.module.css'

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Editor Error Caught by Boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className={layout.errorBox}>
                    <p>에디터를 렌더링하는 중 오류가 발생했습니다.</p>
                    <button type="button" 
                        onClick={() => this.setState({ hasError: false })} 
                        className={layout.errorBtn}
                    >
                        다시 시도
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
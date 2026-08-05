/*
 * [ErrorBoundary.jsx] 에디터 렌더링 에러 격리 컴포넌트
 *
 * 역할:
 *   - JoditCustomEditor를 감싸 런타임 렌더링 오류가 발생해도 앱 전체가 중단되지 않도록
 *     React의 클래스형 ErrorBoundary 패턴으로 에러를 격리한다.
 *   - 에러 발생 시 에디터 영역에 간단한 에러 메시지와 새로고침 버튼을 표시한다.
 *
 * "다시 시도" 동작:
 *   - hasError만 되돌리면 자식이 동일한 props로 그대로 다시 그려지므로, props에 의해
 *     결정적으로 발생하는 크래시는 즉시 재발해 탈출구가 없다.
 *   - resetKey를 증가시켜 자식 서브트리 전체를 완전히 새로 마운트한다. props 자체가
 *     원인인 크래시까지 고칠 수는 없지만, 일시적/경쟁 상태로 인한 크래시라면 실제로
 *     복구될 기회를 준다.
 */

"use client";
import React from 'react';
import layout from '../../../layout.module.css'

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, resetKey: 0 };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Editor Error Caught by Boundary:", error, errorInfo);
    }

    handleRetry = () => {
        this.setState(prev => ({ hasError: false, resetKey: prev.resetKey + 1 }));
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className={layout.errorBox}>
                    <p>에디터를 렌더링하는 중 오류가 발생했습니다.</p>
                    <button type="button"
                        onClick={this.handleRetry}
                        className={layout.errorBtn}
                    >
                        다시 시도
                    </button>
                </div>
            );
        }
        return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }
}
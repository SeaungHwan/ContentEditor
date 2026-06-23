/*
 * [ColWidthControl.jsx] 테이블 열(colgroup) 너비 입력 컨트롤
 *
 * 역할:
 *   - 테이블의 각 열 너비를 수동으로 입력하거나 자동 균등 분할(auto-calc)로 설정한다.
 *   - 입력값은 숫자(%)나 CSS 값(예: "20", "100px")을 허용하며,
 *     부모(GlobalTableConfigModal, TableEditModal)로 colWidths 배열을 전달한다.
 *
 * 두 가지 모드:
 *   - 자동 모드(auto-calc): colWidths = ['auto-calc']로 저장.
 *     applyColGroupHelper에서 열 수를 계산해 `calc(100% / N)` 으로 균등 분할.
 *   - 수동 모드: 입력 필드 배열로 열마다 너비를 개별 지정.
 *
 * UX 세부 동작:
 *   - localWidths: 타이핑 중 즉시 반영되는 로컬 상태 (onBlur 시에만 부모에 전달)
 *   - Enter 키: 새 입력 필드 추가 후 포커스 이동
 *   - Backspace (빈 필드): 이전 필드로 포커스 이동 후 현재 필드 삭제
 *   - 추가 버튼: 마지막 입력 필드 추가 후 포커스
 *   - 초기화 버튼: 모든 입력값을 ['']로 리셋
 *   - 자동/수동 토글: 슬라이더 UI로 두 모드를 전환
 */
import React, { useState, useRef, useEffect } from 'react';

const ColWidthControl = React.memo(({ colWidths, setColWidths, layout, isGuideMode, guideMessage }) => {
    const inputRefs = useRef([]);
    const [localWidths, setLocalWidths] = useState(colWidths);
    
    useEffect(() => {
        setLocalWidths(colWidths);
    }, [colWidths]);

    const handleBlur = (idx) => {
        if (localWidths[idx] !== colWidths[idx]) {
            const next = [...colWidths];
            next[idx] = localWidths[idx];
            setColWidths(next);
        }
    };

    const handleChange = (idx, val) => {
        const next = [...localWidths];
        next[idx] = val;
        setLocalWidths(next);
    };

    const handleAdd = () => {
        const current = (localWidths.length === 1 && localWidths[0] === 'auto-calc') ? [] : localWidths;
        const next = [...current, ''];
        setLocalWidths(next);
        setColWidths(next);
        setTimeout(() => {
            inputRefs.current[next.length - 1]?.focus();
        }, 0);
    };

    const handleRemove = (idx) => {
        const next = localWidths.filter((_, i) => i !== idx);
        const final = next.length ? next : [''];
        setLocalWidths(final);
        setColWidths(final);
    };

    const handleClearAll = () => {
        setLocalWidths(['']);
        setColWidths(['']);
    };

    const isAutoMode = localWidths.length === 1 && localWidths[0] === 'auto-calc';

    const handleAutoCalcToggle = () => {
        if (isAutoMode) {
            setLocalWidths(['']);
            setColWidths(['']);
        } else {
            setLocalWidths(['auto-calc']);
            setColWidths(['auto-calc']);
        }
    };

    const displayWidths = isAutoMode ? [''] : localWidths;

    return (
      <div
        className={`${layout.colWrap} ${isGuideMode ? `${layout.guideTarget} ${layout.guideBottom}` : ""}`}
        data-guide={isGuideMode ? guideMessage : undefined}
      >
        <div className={`${layout.flexCol} ${layout.gap06}`}>
            <label>
              <span className={layout.tit}>열 너비</span>
            </label>
            <div className={layout.toggleWrap}>
              <div
                className={layout.toggleSlider}
                style={{
                  transform: isAutoMode ? "translateX(0%)" : "translateX(100%)",
                }}
              />
              <button type="button"
                className={`${layout.toggleBtn} ${isAutoMode ? layout.toggleActive : ""}`}
                onClick={handleAutoCalcToggle}
              >
                자동
              </button>
              <button type="button"
                className={`${layout.toggleBtn} ${!isAutoMode ? layout.toggleActive : ""}`}
                onClick={handleAutoCalcToggle}
              >
                수동
              </button>
            </div>
        </div>
        {!isAutoMode && (
          <div className={`${layout.flexCol} ${layout.gap02} ${layout.colWidth}`}>
            <div className={layout.colBox}>
              {displayWidths.map((width, index) => (
                <div key={index} className={layout.colItem}>
                  <input
                    className={`${layout.Inp} ${layout.colInp}`}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    maxLength={10}
                    value={isAutoMode ? "" : width}
                    placeholder="예) 20"
                    disabled={isAutoMode}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onBlur={() => handleBlur(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd();
                      }
                      if (e.key === "Backspace" && width === "" && index > 0) {
                        e.preventDefault();
                        inputRefs.current[index - 1]?.focus();
                        handleRemove(index);
                      }
                    }}
                  />

                  <button type="button"
                    onClick={() => handleRemove(index)}
                    className={layout.removeBtn}
                    title="삭제"
                  >
                    <i className="ri-close-fill"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className={layout.colBtn}>
              <button type="button"
                onClick={handleAdd}
                className={`${layout.autoBtn}`}
              >
                <span>추가</span>
              </button>
              <button type="button" onClick={handleClearAll} className={layout.allDeleteBtn}>
                <span>초기화</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
});

ColWidthControl.displayName = "ColWidthControl";
export default ColWidthControl;
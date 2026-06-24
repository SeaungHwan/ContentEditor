/*
 * [GuideModal.jsx] 사용 주의사항 안내 모달
 *
 * 역할:
 *   - 에디터 최초 접속 시 자동으로 열려 사용 시 주의사항을 안내한다.
 *   - sessionStorage에 'guideClosed' 키가 없을 때만 자동 표시되며,
 *     닫기 버튼 클릭 시 sessionStorage에 저장해 이후 재방문 시 자동 열림을 차단한다.
 *   - 툴바의 주의점(?) 버튼으로 언제든지 다시 열 수 있다.
 */

import React, { useEffect } from 'react';

const GuideModal = React.memo(({ onClose, layout, fadeStyle }) => {
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
    <div className={layout.modalPopWrap2} style={fadeStyle}>
        <div className={layout.modalPop2}>
            <div className={layout.titWrap2}>
                <h4 className={`titT1`}>주의점</h4>
               
            </div>
            <div className={layout.modalCont}>
                <ul className="list_st2">
                    <li><span className="f_weightB">기본 사용법</span>은 가이드 <i className="ri-chat-unread-line"></i>을 눌러주세요</li>
                    <li>상단의 <span className="f_weightB">앱</span>을 설치하시면 더 편리하게 사용할 수 있습니다.</li>
                   
                    <li>한글 문서에서 표를 올바른 서식으로 작성하지 않으면 깨지는 경우가 있습니다.</li>
                    <li>한글 전용 <span className='f_weightB'>Wingdings</span> 폰트는 웹에서 지원하지 않아 글자가 깨질 수 있습니다.</li>
                </ul>

                <h4 className={`tit3`}>리스트 &lt;ul&gt; 및 &lt;ol&gt; 적용 기준</h4>
                <ul className="list_st2">
                    <li>텍스트 앞에 기호(예: -, • 등)가 있는 경우 자동으로 리스트(ul)로 인식됩니다.<br />
                    <span className="bg_red">(일부 기호는 인식되지 않을 수 있습니다.)</span></li>
                    <li><span className="pc_red f_weightB">글자겹치기</span>로 만든 경우 인식 안됩니다.<span className='bg_red'>(정말 특수한 경우)</span></li>
                    <li>기본 기호 외 다른 기호를 사용하면 단계에 따라 클래스가 자동 적용됩니다.</li>
                    <li>ul, ol 리스트가 표 안에 있을 경우, 해당 칸은 자동으로 왼쪽 정렬(al)됩니다.</li>
                    <li>단, (내용)이나 -처럼 괄호 안 숫자/문자만 단독으로 있는 경우에는 리스트로 변환되지 않습니다.</li>
                    <li>※,* 기호는 자동으로 bu_atte클래스로 변경됩니다.</li>
                </ul>
                 <div className='ar'><button type="button" onClick={onClose} className="btn_gr">닫기</button></div>
            </div>
            
        </div>
    </div>
    );
});

GuideModal.displayName = "GuideModal";
export default GuideModal;
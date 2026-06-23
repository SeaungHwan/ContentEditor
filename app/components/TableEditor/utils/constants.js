/*
 * [constants.js] 프로젝트 전역 상수 및 정규식 모음
 *
 * 역할:
 *   - 여러 유틸리티에서 공통으로 사용하는 상수, 정규식, 변환 함수를 한 곳에 모아 관리한다.
 *
 * 주요 항목:
 *
 *   ALLOWED_TAGS         : 정제 후 허용할 HTML 태그 집합 (Set)
 *   ALLOWED_ATTRIBUTES   : 정제 후 허용할 HTML 속성 집합 (Set)
 *   RE_NUMERIC           : 숫자(정수/소수)만 포함된 문자열 검사용 정규식 (.test() 전용)
 *   RE_WHITESPACE        : 공백·제로폭 문자 제거용 정규식 (.replace() 전용)
 *
 *   convertCircleToArabic(str)
 *     - ①~⑳, ㉑~㉟, ➀~➉, ❶~❿, ➊~➓, ⓫~⓴ 등 7가지 종류의 원형 숫자 문자를
 *       아라비아 숫자 문자열로 변환한다.
 *
 *   MARKER_TYPES         : 리스트 마커 패턴 정규식 맵 (multi-level, roman-dot, decimal-dot,
 *                          hangul-dot, paren-decimal-*, paren-hangul-*, bullet 등 12종)
 *   EXCLUDE_MARKER_REGEXES: 마커로 오인할 수 있는 날짜·범위·비율·전화번호 등 제외 패턴 목록
 *
 *   CLEANUP_REGEX        : performCleanup에서 사용하는 HTML 문자열 정규식 모음
 *                          (연속 br 압축, 깨진 따옴표, br→div 치환, 리스트 앞뒤 br 제거 등)
 *
 *   HWP_CHAR_MAP / HWP_CHAR_REGEX
 *     - 한글(HWP) 및 Wingdings 깨짐 문자를 올바른 유니코드 특수문자로 변환하는 사전과 정규식.
 *
 *   UI 상수:
 *     UL_NONE_VALUE            : ul 클래스 "선택 안함" 구분 값 ('__no_ul__')
 *     TABLE_CLASS_SUGGESTIONS  : 테이블 클래스명 자동완성 후보 목록
 *     UL_CLASS_SUGGESTIONS     : ul 클래스명 자동완성 후보 목록
 *     OL_OPTIONS               : ol 형식 선택 옵션 목록 (숫자, 한글, 원형 등)
 *     TIT_OPTIONS              : 제목(h3~h5) 감지 패턴 선택 옵션 목록
 *     TARGET_COLORS            : color → pc_xxx 클래스 매핑용 기준 색상 목록 (RGB)
 *     GUIDE_MESSAGES           : 가이드 모드에서 각 버튼/영역에 표시할 안내 문자열 맵
 */

export const ALLOWED_TAGS = new Set(['div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'a', 'br', 'p', 'ul', 'ol', 'li', 'span', 'strong', 'u', 'em', 'img']);

// 숫자(정수/소수)만 포함된 문자열 검사 — .test() 전용 (g 플래그 없음)
export const RE_NUMERIC = /^[\d.]+$/;

// 공백·제로폭 문자 제거 — .replace()와 함께 사용 (.test()에 사용 금지)
export const RE_WHITESPACE = /[\s\u00A0\u200B-\u200D\uFEFF]/g;

// ① ② ③ … ⑳ (U+2460–U+2473) 및 ㉑ … ㉟ (U+3251–U+325F) → 아라비아 숫자
// 다양한 종류의 원문자 1~50 → 아라비아 숫자로 변환
export const convertCircleToArabic = (str) => {
    if (!str) return str;
    return str
        // 1. 일반 얇은 원문자 1~20 (①~⑳)
        .replace(/[①-⑳]/g, c => String(c.codePointAt(0) - 0x2460 + 1))
        
        // 2. 일반 얇은 원문자 21~35 (㉑~㉟)
        .replace(/[㉑-㉟]/g, c => String(c.codePointAt(0) - 0x3251 + 21))
        
        // 3. 일반 얇은 원문자 36~50 (㊱~㊿)
        .replace(/[㊱-㊿]/g, c => String(c.codePointAt(0) - 0x32B1 + 36))
        
        // 4. Sans-serif 굵은 원문자 1~10 (➀~➉)
        .replace(/[➀-➉]/g, c => String(c.codePointAt(0) - 0x2780 + 1))
        
        // 5. 검은 배경 원문자 1~10 (❶~❿)
        .replace(/[❶-❿]/g, c => String(c.codePointAt(0) - 0x2776 + 1))
        
        // 6. 검은 배경 Sans-serif 원문자 1~10 (➊~➓)
        .replace(/[➊-➓]/g, c => String(c.codePointAt(0) - 0x278A + 1))
        
        // 7. 검은 배경 원문자 11~20 (⓫~⓴)
        .replace(/[⓫-⓴]/g, c => String(c.codePointAt(0) - 0x24EB + 11));
};
export const ALLOWED_ATTRIBUTES = new Set(['rowspan', 'colspan', 'href', 'scope', 'class', 'src', 'alt', 'style']);

// 리스트화 특수문자
export const MARKER_TYPES = {
    'multi-level': /^\s*(?:\d+[.])+\d+[.]?\s*/,
    'roman-dot': /^\s*(?:[IVXivx]+)[.]\s*/,
    'decimal-dot': /^\s*\d{1,2}[.]\s*(?!\d|%)/,
    'hangul-dot': /^\s*(?:[가나다라마바사아자차카타파하]|[ㄱ-ㅎ])[.]\s*/,
    'paren-decimal-single': /^\s*\d{1,2}[)]\s*/,
    'paren-decimal-double': /^\s*\(\d{1,2}\)\s*/,
    'paren-hangul-single': /^\s*(?:[가나다라마바사아자차카타파하]|[ㄱ-ㅎ])[)]\s*/,
    'paren-hangul-double': /^\s*\((?:[가나다라마바사아자차카타파하]|[ㄱ-ㅎ])\)\s*/,
    'paren-english': /^\s*(?:[a-zA-Z][)]|\([a-zA-Z]\))\s*/,
    'square-bracket': /^\s*\[(?:\d{1,2}|[가나다라마바사아자차카타파하]|[ㄱ-ㅎ]|[a-zA-Z])\]\s*/,
    'circle-char': /^\s*[\u2460-\u24FF\u3250-\u325F\u32B1-\u32BF\u3200-\u321E\u249C-\u24E9\u2776-\u2793]\s*/,
    'bullet': /^\s*(?![%!@#$%^&+=~`|\\?])(?:[-*•⦁·ㆍ∙∘–—➢➔➜→≫✔✓☑☐■∎￭□◆◇○●◎▲△▼▽▶▷◀◁◈▣★☆☞☜・❖✦✧]|\s*[\u2022\u00B7\u2023\u2043\u2219\u25AA\u25CF\u25CB\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2B00-\u2BFF\u2190-\u21FF\u2010-\u2015\u30FB])[.]?\s*/,
    'special': /^\s*(?:[㉠-㉭㈎-㈛㉮-㉻\u2460-\u24FF\u2776-\u2793])\s*/,
};

// 제외 정리
export const CLEANUP_REGEX = {
    multipleBrs: /(?:<br\s*\/?>\s*(?:&nbsp;|\u00A0|\s)*){2,}/gi,
    emptyP: /<p>\s*<\/p>/gi,
    brokenQuotes1: /󰡐/g,
    brokenQuotes2: /󰡑/g,
    brToDiv: /<br\s*\/?>\s*<div/gi,
    listBr: /(?:<br\s*\/?>\s*)+(?=<\/?(?:ul|ol|li|p)[^>]*>)/gi,
    startBr: /^\s*<br\s*\/?>/gi,
    endBr: /(?:<br\s*\/?>\s*)+$/gi
};


// 제외 리스트
export const EXCLUDE_MARKER_REGEXES = [
    /^\s*[\d.]+\s*[~∼\-]/,    
    /^\s*(?:19|20)\d{2}[.]/,  
    /^\s*\d+\.\d+\s*$/,        
    /^\s*\(\d+\)\s*$/,          
    /^\s*\d+(?:\.\d+)+\s*[%％]/,    
    /^\s*[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s]+\s*\d+\s*$/,
    /^\s*\d{1,2}\.\s*\d{1,2}\.?\s*\([월화수목금토일]\)/,
    /^\s*[○●]{2,}/,
    /^\s*㈜/,
    /^\s*\d{2,3}\)\s*\d{3,4}[-\s]\d{4}/
];
// 한글(HWP) 및 Wingdings 깨짐 문자 변환 사전
export const HWP_CHAR_MAP = {
    // 1. 따옴표 및 체크류
    '󰡐': '"', 
    '󰡑': '"',
    '': '✓',

    // 2. 사각형 류
    '': '■',  // 꽉 찬 사각형
    '': '□',  // 빈 사각형 (구분!)

    // 3. 마름모 류
    '': '◆',  // 꽉 찬 마름모
    '❖': '◇',  // 빈 마름모 (구분!)
    '\uF076': '◈', // 마름모 안 원형 (구분!)

    // 4. 화살표 / 삼각형 류
    '': '▶',  // 꽉 찬 우측 삼각형
    '➢': '▷',  // 빈 우측 삼각형 (구분!)
    '\uF0D8': '➔', // 우측 화살표 (구분!)
    '󰋻': '▸',

    // 5. 원형 류
    '\uF0B7': '●', // 꽉 찬 원
    '\uF0A7': '○', // 빈 원 (구분!)
    '': '◎',   // 겹 원 (구분!)

    // 6. 선 및 점 류
    '󰋮': '-',   // 하이픈
    '󰋯': '·',    // 가운뎃점
    '' : '·',
    '' : '•'
};
export const HWP_CHAR_REGEX = new RegExp(Object.keys(HWP_CHAR_MAP).join('|'), 'g');
// 모달 공용 UI 상수
export const UL_NONE_VALUE = '__no_ul__';
export const TABLE_CLASS_SUGGESTIONS = [
    { label: '기본형', value: 'tbl-st' },
    { label: '모바일 스크롤', value: 'tbl-st scroll-m' },
    { label: '웹 스크롤', value: 'tbl-st scroll-wrap' },
];
export const UL_CLASS_SUGGESTIONS = [
    { label: '기본 리스트', value: 'bu-st' },
];
export const TIT_CLASS_SUGGESTIONS = [
    { label: '대제목', value: 'section' },
    { label: '중제목', value: 'contents' },
    { label: '소제목', value: 'unit' },
    { label: '제목', value: 'item' },
];
export const OL_OPTIONS = [
    { value: 'decimal-dot', label: '숫자: 1.' },
    { value: 'hangul-dot', label: '한글: 가.' },
    { value: 'paren-decimal-single', label: '숫자: 1)' },
    { value: 'paren-hangul-single', label: '한글: 가)' },
    { value: 'circle-char', label: '원형: ①' },
    { value: 'roman-dot', label: '로마자: Ⅰ.' },
];
export const TIT_OPTIONS = [
    { value: 'custom', label: '직접 입력' },
    { value: 'number-dot', label: '숫자: 1.' },
    { value: 'number-paren', label: '숫자: 1)' },
    { value: 'circle', label: '원형: ①' },
    { value: 'hangul-dot', label: '한글: 가.' },
    { value: 'hangul-paren', label: '한글: 가)' },
    { value: 'roman', label: '로마자: Ⅰ.' },
    { value: 'law-chapter', label: '제n장/편/관' },
    { value: 'law-article', label: '제n조' },
];

// 색상 pc_
export const TARGET_COLORS = [
    { name: 'gray', rgb: [128, 128, 128] },    
    { name: 'black', rgb: [0, 0, 0] },         
    { name: 'blue', rgb: [0, 0, 255] },        
    { name: 'red', rgb: [255, 0, 0] },         
    { name: 'navy', rgb: [0, 0, 128] },        
    { name: 'org', rgb: [255, 165, 0] },       
    { name: 'green', rgb: [0, 128, 0] },       
    { name: 'yellow', rgb: [255, 255, 0] },     
    { name: 'pur', rgb: [128, 0, 128] },       
    { name: 'sky', rgb: [135, 206, 235] },     
    { name: 'pink', rgb: [255, 192, 203] }     
];

// 가이드 메세지
export const GUIDE_MESSAGES = {
    // 공통
    modeSelect: `[색상 모드]\n 활성화 시 컨텐츠 내의 색상 데이터를 가져옵니다.`,
    classUlConfig: `[리스트 클래스 설정]\n리스트(ul)에 적용할 클래스명을 지정합니다.\n선택 안함으로 설정시 p태그로 반환됩니다.`,
    classOlConfig: `[숫자 리스트 형식 설정]\n숫자 리스트(ol)에 적용할 형식을 지정합니다.\n숫자, 한글 형식등 (다중선택 가능)`,
    noList: `[기호 유지]\nul/li로 변환 시 원본 특수문자나 번호를\n지우지 않고 그대로 유지합니다.`,
    List2: `[리스트 시작]\n리스트 클래스 2부터 시작\n예:(list_st2)`,
    // 툴바 / 에디터
    editorConfig: `[에디터]\n한글(HWP), 엑셀, 워드 등에 있는 표를 복사하여\n아래 빈 화면에 붙여 넣습니다.\n'</>' 아이콘을 눌러 코드를 직접 수정할 수 있습니다.`,
    contBtn: `[컨텐츠 설정]\n컨텐츠의 타이틀, 리스트를 설정 합니다.`,
    allTableBtn: `[테이블 전역 설정]\n테이블 전역 설정을 합니다.`,
    preview: `[미리보기]\n컨텐츠 내용을 미리 볼 수 있습니다.`,
    copyBtn: `완성된 HTML 코드를\n클립보드에 복사합니다.`,
    removeBtn: `에디터 안의 내용을\n모두 지웁니다.`,
    cleanBtn: `불필요한 태그를 정리하고\n표준 HTML로 변환합니다.`,
    tableBtn: `선택한 테이블의\n 세부 설정을\n할 수 있습니다.`,
    // 테이블설정
    HeaderTop: `[헤더 방향]\n표의 기준 헤더 방향을 정합니다.(상단)`,
    HeaderLeft: `[헤더 방향]\n표의 기준 헤더 방향을 정합니다.(좌측)`,
    HeaderConfig: `[테이블 행열 설정]\n표의 기준 헤더 범위를 정합니다.\n(0 = tbody만 출력, 기본값 : 1)\ncol,rowspan까지 포함한 범위입니다.`,
    classTableConfig: `[클래스 설정]\n표(table)에 적용할 클래스명을 지정합니다.`,
    divType: `[테이블 기본 설정]\n테이블을 DIV로 감쌀지 선택합니다.\n해제시 table태그만 나옵니다.`,
    verticalHeader: `[테이블 기본 설정]\n제목(TH) 칸의 글자를\n세로로 한 줄씩 출력합니다.`,
    colWidth: `[열 너비 제어]\n각 칸의 너비를 직접 지정하거나,\n[자동 계산]으로 균등 분할합니다.\n기본값 : auto`,
    // 컨텐츠설정
    tit1: `[제목]\n타이틀1(h2)의 범위 및 클래스명을 지정합니다.`,
    tit2: `[제목]\n타이틀2(h3)의 범위 및 클래스명을 지정합니다.`,
    tit3: `[제목]\n타이틀3(h4)의 범위 및 클래스명을 지정합니다.`,
    tit4: `[제목]\n타이틀4(h5)의 범위 및 클래스명을 지정합니다.`,
    color: `[색상모드]\n체크시 = 클래스 pc_색상\n해제시 = style ="color:색상"\n범위 값에 없는 색상은 전부 style처리`,
};

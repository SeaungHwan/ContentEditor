/*
 * [ChatBot.jsx] 에디터 사용법 안내 챗봇
 *
 * 역할:
 *   - chatBot/ 폴더의 정적 데모(HTML/CSS/vanilla JS)를 React 컴포넌트로 포팅.
 *   - 실제 상담 응답 대신 GUIDE_MESSAGES 기반 규칙형 FAQ로 동작한다.
 *   - 기존 GuideModal(주의점 모달)·isGuideMode(호버 가이드)와 독립적으로 동작하며 서로 대체하지 않는다.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './ChatBot.module.css';
import { CATEGORIES, ALL_TOPICS, QUICK_TOPIC_KEYS, getTopicAnswer } from './chatBotTopics';
import { searchTopics } from './fuzzyMatch';

// LLM에 함께 보낼 최근 대화 턴 수(사용자+봇 합산 메시지 개수, 토큰 사용량을 억제하기 위한 상한)
const HISTORY_LIMIT = 6;

const TYPING_DELAY = 700;
const WORD_REVEAL_INTERVAL = 45;
// 사용자 말풍선이 뜨는 즉시 봇 말풍선(타이핑 표시)이 같이 뜨면 부자연스러워 보여, 이 시간만큼 늦춰서 띄운다.
const BOT_BUBBLE_DELAY = 500;
const QUICK_TOPICS = QUICK_TOPIC_KEYS.map((key) => ALL_TOPICS.find((topic) => topic.key === key)).filter(Boolean);

// 테마: 색상은 ChatBot.module.css의 --cb-* 변수로 전환된다. swatch1/2는 모달의 미리보기 원형용(실제 CSS
// 변수와 같은 색을 그대로 복사해둔 것 — 테마를 적용하지 않고도 인라인 style로 미리 보여줘야 해서 중복 보관).
// 테마별 이미지(chatbot_{key}.png 1개)는 /public/chatbot/에 직접 추가해서 사용한다. 런처 버튼과 아바타에
// 같은 이미지를 그대로 재사용한다(예전엔 chatbot_btn_{key}.png를 따로 뒀지만 결국 같은 이미지라 통합).
const THEME_STORAGE_KEY = 'table-editor-chatbot-theme';
const THEMES = {
    default: { className: '', label: '기본', image: '/chatbot/chatbot.png', swatch1: '#257FB8', swatch2: '#244FAF' },
    yadon: { className: 'themeYadon', label: '야돈', image: '/chatbot/chatbot_yadon.png', swatch1: '#FFB8B8', swatch2: '#E88890' },
    pikachu: { className: 'themePikachu', label: '피카츄', image: '/chatbot/chatbot_pikachu.png', swatch1: '#FFE64D', swatch2: '#FFD800' },
    psyduck: { className: 'themePsyduck', label: '고라파덕', image: '/chatbot/chatbot_psyduck.png', swatch1: '#F8D8A0', swatch2: '#DDA84A' },
};

function readTheme() {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return THEMES[stored] ? stored : 'default';
    } catch { return 'default'; }
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// "선택해주세요 피카"처럼 존댓말 표현 뒤에 애교스러운 말버릇을 붙이면, 격식(존댓말)과 애교가
// 충돌해서 오히려 더 어색해진다("선택해주세요 피카." 자체가 부자연스러움). 그래서 피카츄/고라파덕은
// 먼저 존댓말(-해주세요/-하세요/-입니다 등)을 반말(-해줘/-해/-이야)로 낮춘 뒤에 말버릇을 붙인다.
// 야돈의 "~양"은 존댓말에 그대로 붙여도 자연스러운 별개의 어미 방식이라 이 변환이 필요 없다.
function toCasualImperative(text) {
    return text
        .replace(/안녕하세요([.!?]?)/g, '안녕$1')
        .replace(/해\s?주세요([.!?]?)/g, '해줘$1')
        .replace(/보세요([.!?]?)/g, '봐$1')
        .replace(/하세요([.!?]?)/g, '해$1')
        .replace(/입니다([.!?]?)/g, '이야$1');
}

// 문장 끝(마침표/느낌표/물음표)마다 캐릭터 특유의 짧은 말버릇을 끼워 넣는다. 문장 끝에 통째로
// "\n\n피카피카!"를 새로 외치면 문맥과 안 어울려서, 문장 부호 바로 앞에 자연스럽게 붙인다.
function attachSentenceTic(text, tic) {
    if (/[.!?]/.test(text)) return text.replace(/([.!?])/g, ` ${tic}$1`);
    return `${text} ${tic}`;
}

// 테마별 말투 — 원본 답변 텍스트는 그대로 두고(LLM 대화 이력에 캐릭터 말투가 섞이면 안 되므로),
// 화면에 보여줄 때만 렌더링 시점에 씌운다.
function applyThemeSpeech(text, themeKey) {
    if (themeKey === 'yadon') return text.replace(/(다|요|죠)(?=[.!?~]|\s|$)/g, '$1~양');
    if (themeKey === 'pikachu') return attachSentenceTic(toCasualImperative(text), '피카');
    if (themeKey === 'psyduck') return attachSentenceTic(toCasualImperative(text), '파덕');
    return text;
}

// 최초 인사말도 답변과 동일한 말투 규칙을 타야 하는데, 원문에 <strong>도움말 챗봇</strong> 굵은 글씨가
// 문장 중간에 끼어 있어 순수 문자열이 아니다. 굵은 부분을 자리표시자로 남겨 문장 전체를 하나로 취급해
// 말투를 입힌 뒤, 그 자리표시자를 기준으로 다시 잘라 굵은 태그를 끼워 넣는다(굵은 부분 앞뒤로 나눠서
// 각각 말투를 입히면 "안녕하세요"만 따로 떼어져 독립된 문장처럼 처리돼 문장이 끊겨 보인다).
const GREETING_BOLD_PLACEHOLDER = "@@BOLD@@";
const GREETING_TEMPLATE = `안녕하세요 ${GREETING_BOLD_PLACEHOLDER}입니다.\n아래 메뉴를 이용하거나 궁금한 내용을 직접 입력해보세요!`;

function renderThemedGreeting(themeKey) {
    const [before, after] = applyThemeSpeech(GREETING_TEMPLATE, themeKey).split(GREETING_BOLD_PLACEHOLDER);
    return <>{before}<strong>도움말 챗봇</strong>{after}</>;
}

// 봇 답변을 한 번에 보여주지 않고 단어 단위로 순차 노출한다.
// 토큰을 "단어+뒤따르는 공백/줄바꿈"으로 묶어야 join했을 때 원문의 띄어쓰기·줄바꿈이 그대로 보존된다.
// React.memo: 부모(ChatBot)가 입력창 타이핑 등으로 자주 리렌더될 때, 이미 다 노출된 과거 메시지까지
// 매번 다시 마운트(=애니메이션 재시작)되지 않도록 text/onReveal/onComplete가 그대로면 건너뛴다.
const AnimatedBotText = React.memo(function AnimatedBotText({ text, onReveal, onComplete }) {
    const tokens = useMemo(() => text.match(/\S+\s*|\s+/g) || [text], [text]);
    const [count, setCount] = useState(0);

    useEffect(() => {
        setCount(0);
        if (tokens.length === 0) { onComplete?.(); return; }
        let i = 0;
        const timer = setInterval(() => {
            i += 1;
            setCount(i);
            onReveal?.();
            if (i >= tokens.length) {
                clearInterval(timer);
                onComplete?.();
            }
        }, WORD_REVEAL_INTERVAL);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens]);

    return tokens.slice(0, count).join('');
});

// 봇 메시지 한 줄(타이핑 표시/답변/옵션). React.memo로 감싸서, 부모가 입력창 타이핑·isResponding
// 토글 등으로 리렌더될 때 이 메시지의 props(message/theme/isResponding 등)가 실제로 바뀌지 않았다면
// applyThemeSpeech(정규식 여러 번) · AnimatedBotText의 단어 분해를 다시 계산하지 않고 건너뛴다.
const BotMessage = React.memo(function BotMessage({ message, theme, themeImage, isResponding, onReveal, onRevealComplete, onAskAnswer }) {
    return (
        <div className={styles.chatRow}>
            <div className={styles.botAvatar}>
                <img src={themeImage} alt="챗봇" />
            </div>
            <div className={styles.chatContent}>
                {message.kind === 'typing' && (
                    <div className={`${styles.botBubble} ${styles.typingBubble}`}>
                        <div className={styles.typingDots}><span /><span /><span /></div>
                    </div>
                )}
                {message.kind === 'text' && (
                    <div className={styles.botBubble}>
                        {message.isAI && (
                            <span className={styles.aiTag}><i className="ri-sparkling-2-fill" /> AI 답변</span>
                        )}
                        <p className={styles.bubbleText}><AnimatedBotText text={applyThemeSpeech(message.text, theme)} onReveal={onReveal} onComplete={onRevealComplete} /></p>
                    </div>
                )}
                {message.kind === 'options' && (
                    <div className={styles.botBubble}>
                        <p className={styles.bubbleText}>{applyThemeSpeech(message.text, theme)}</p>
                        <div className={styles.optionList}>
                            {message.options.map((topic) => (
                                <button
                                    key={topic.key}
                                    className={styles.optionBtn}
                                    type="button"
                                    disabled={isResponding}
                                    onClick={() => onAskAnswer(topic)}
                                >
                                    {topic.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

function highlightMatch(text, query) {
    if (!query) return text;
    const safeQuery = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
    );
}

let messageSeq = 0;
function nextId() {
    messageSeq += 1;
    return messageSeq;
}

const ChatBot = React.memo(({ visible = true, onHide }) => {
    // mounted: display:none 해제 여부 / open: 실제 열림 애니메이션(opacity·transform) 트리거
    // 두 상태를 분리해야, "보이기 시작"과 "열림 애니메이션 시작" 사이에 브라우저가 한 프레임을
    // 그려줘서 트랜지션이 재생된다(같은 렌더에서 한꺼번에 켜면 트랜지션 없이 바로 열린 것처럼 보임).
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useState(readTheme);
    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    // 답변이 오는 중(타이핑 표시 ~ 완성된 답변) 새 질문을 못 보내게 막는 잠금. 이게 없으면
    // 버튼을 연타했을 때 respondWith가 각자 독립된 타이머로 동시에 여러 개 돌면서
    // 봇 답변이 한꺼번에 쏟아져 나온다.
    const [isResponding, setIsResponding] = useState(false);

    const bodyRef = useRef(null);
    const pageRef = useRef(null);
    const dragState = useRef({ startX: 0, scrollStart: 0, dragged: false });

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        });
    }, []);

    const closeSuggestions = useCallback(() => {
        setSuggestions([]);
        setSelectedIndex(-1);
    }, []);

    // 닫을 때마다 대화 내역을 비워, 다음에 열었을 때 항상 최초 화면(카테고리 그리드)부터 시작하게 한다.
    const resetConversation = useCallback(() => {
        setMessages([]);
        setInputValue('');
        closeSuggestions();
    }, [closeSuggestions]);

    const respondWith = useCallback((builder) => {
        const typingId = nextId();
        setIsResponding(true);
        setTimeout(() => {
            setMessages((prev) => [...prev, { id: typingId, from: 'bot', kind: 'typing' }]);
            scrollToBottom();

            setTimeout(() => {
                const result = builder();
                setMessages((prev) => prev.map((m) => (m.id === typingId ? { ...result, id: typingId, from: 'bot' } : m)));
                scrollToBottom();
                // text는 AnimatedBotText가 단어 단위로 계속 노출 중이므로, 그 노출이 끝날 때(onComplete)
                // 잠금을 풀어야 한다. text가 아닌 종류(options 등)는 애니메이션이 없으니 바로 푼다.
                if (result.kind !== 'text') setIsResponding(false);
            }, TYPING_DELAY);
        }, BOT_BUBBLE_DELAY);
    }, [scrollToBottom]);

    // 규칙 기반 매칭이 실패했을 때만 쓰는 비동기 응답 경로 (LLM 폴백, /api/chat 호출)
    const respondWithAsync = useCallback((asyncBuilder) => {
        const typingId = nextId();
        setIsResponding(true);
        setTimeout(() => {
            setMessages((prev) => [...prev, { id: typingId, from: 'bot', kind: 'typing' }]);
            scrollToBottom();

            asyncBuilder().then((result) => {
                setMessages((prev) => prev.map((m) => (m.id === typingId ? { ...result, id: typingId, from: 'bot' } : m)));
                scrollToBottom();
                if (result.kind !== 'text') setIsResponding(false);
            });
        }, BOT_BUBBLE_DELAY);
    }, [scrollToBottom]);

    const askAI = useCallback(async (text, history) => {
        let res;
        try {
            res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history }),
            });
        } catch {
            // fetch 자체가 실패 = 네트워크 단절(오프라인, DNS 실패 등)
            return { kind: 'text', text: '인터넷 연결을 확인해주세요.\n연결이 복구되면 다시 질문해주세요.' };
        }

        if (res.ok) {
            const data = await res.json();
            return { kind: 'text', text: data.reply, isAI: true };
        }

        const errorBody = await res.json().catch(() => ({}));
        const errorMessages = {
            rate_limited: '질문이 너무 많아요. 잠시 후에 다시 시도해주세요.',
            timeout: '응답이 너무 오래 걸려서 중단했어요. 다시 한 번 물어봐주시겠어요?',
            invalid_message: '질문이 너무 길어요. 조금 더 짧게 입력해주세요.',
        };
        const fallback = '죄송해요, 지금은 답변을 가져올 수 없어요.\n아래 카테고리나 빠른 답변에서 찾아보시겠어요?';
        return { kind: 'text', text: errorMessages[errorBody.error] || fallback };
    }, []);

    const askAnswer = useCallback((topic) => {
        if (isResponding) return;
        setMessages((prev) => [...prev, { id: nextId(), from: 'user', kind: 'text', text: topic.label }]);
        scrollToBottom();
        respondWith(() => ({ kind: 'text', text: getTopicAnswer(topic.key) }));
    }, [isResponding, respondWith, scrollToBottom]);

    const handleCategoryClick = useCallback((category) => {
        if (isResponding) return;
        setMessages((prev) => [...prev, { id: nextId(), from: 'user', kind: 'text', text: category.label }]);
        scrollToBottom();
        respondWith(() => ({
            kind: 'options',
            text: `${category.label} 중 궁금하신 항목을 선택해주세요.`,
            options: category.topics,
        }));
    }, [isResponding, respondWith, scrollToBottom]);

    const handleSend = useCallback(() => {
        if (isResponding) return;
        const text = inputValue.trim();
        if (!text) return;

        // 다음 LLM 호출에 실어보낼 대화 맥락(현재 입력을 push하기 전 상태 기준, 최근 N개로 제한).
        const history = messages
            .filter((m) => m.kind === 'text')
            .slice(-HISTORY_LIMIT)
            .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));

        closeSuggestions();
        setMessages((prev) => [...prev, { id: nextId(), from: 'user', kind: 'text', text }]);
        setInputValue('');
        scrollToBottom();

        // 라벨(짧은 항목명)만 대상으로 매칭한다. 답변 본문까지 포함하면 문단이 길어진 지금은
        // "설정", "표"처럼 흔한 단어가 거의 모든 답변에 우연히 등장해 엉뚱한 항목들이
        // 무더기로 걸리고, 정작 AI에게 물어봐야 할 자유 질문이 AI까지 가지 못하게 된다.
        // 정규화된 부분 문자열 매칭이 실패하면 편집거리 기반으로 오타도 흡수해본다.
        const matches = searchTopics(text, ALL_TOPICS);

        if (matches.length === 1) {
            respondWith(() => ({ kind: 'text', text: matches[0].answer }));
            return;
        }
        if (matches.length > 1) {
            respondWith(() => ({
                kind: 'options',
                text: '관련된 항목을 찾았어요. 아래에서 선택해주세요.',
                options: matches,
            }));
            return;
        }

        // 가이드에 없는 질문 -> 서버(/api/chat)를 거쳐 LLM(Groq -> Gemini 폴백)에게 물어본다.
        respondWithAsync(() => askAI(text, history));
    }, [isResponding, inputValue, messages, closeSuggestions, respondWith, respondWithAsync, askAI, scrollToBottom]);

    const handleInputChange = useCallback((e) => {
        const value = e.target.value;
        setInputValue(value);

        const query = value.trim();
        if (!query) {
            closeSuggestions();
            return;
        }
        const filtered = searchTopics(query, ALL_TOPICS, 7);
        setSuggestions(filtered);
        setSelectedIndex(-1);
    }, [closeSuggestions]);

    const handleSuggestionPick = useCallback((topic) => {
        setInputValue(topic.label);
        closeSuggestions();
    }, [closeSuggestions]);

    const handleInputKeyDown = useCallback((e) => {
        const dropdownOpen = suggestions.length > 0;

        if (dropdownOpen && e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
            return;
        }
        if (dropdownOpen && e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (dropdownOpen && e.key === 'Escape') {
            e.preventDefault();
            closeSuggestions();
            return;
        }
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (dropdownOpen && selectedIndex >= 0) {
                setInputValue(suggestions[selectedIndex].label);
                closeSuggestions();
                return;
            }
            handleSend();
        }
    }, [suggestions, selectedIndex, closeSuggestions, handleSend]);

    const handleInputBlur = useCallback(() => {
        setTimeout(closeSuggestions, 150);
    }, [closeSuggestions]);

    // PC에서 스크롤바 없이 마우스 드래그로 빠른 답변을 좌우 스크롤한다.
    const handleQuickTopicsMouseDown = useCallback((e) => {
        dragState.current.startX = e.pageX;
        dragState.current.scrollStart = e.currentTarget.scrollLeft;
        dragState.current.dragged = false;
        setIsDragging(true);
    }, []);

    const handleQuickTopicsMouseMove = useCallback((e) => {
        if (!isDragging) return;
        e.preventDefault();
        const delta = e.pageX - dragState.current.startX;
        if (Math.abs(delta) > 5) dragState.current.dragged = true;
        e.currentTarget.scrollLeft = dragState.current.scrollStart - delta;
    }, [isDragging]);

    const endDrag = useCallback(() => setIsDragging(false), []);

    // AnimatedBotText의 onComplete로 넘기는 안정된 참조. 인라인 화살표(() => setIsResponding(false))를
    // 그대로 넘기면 매 렌더 새 함수가 생겨 BotMessage의 React.memo가 무력화된다.
    const handleRevealComplete = useCallback(() => setIsResponding(false), []);

    const handleQuickTopicClick = useCallback((topic) => {
        if (dragState.current.dragged) {
            dragState.current.dragged = false;
            return;
        }
        askAnswer(topic);
    }, [askAnswer]);

    const openThemeModal = useCallback(() => setIsThemeModalOpen(true), []);
    const closeThemeModal = useCallback(() => setIsThemeModalOpen(false), []);

    const selectTheme = useCallback((key) => {
        setTheme(key);
        try { localStorage.setItem(THEME_STORAGE_KEY, key); } catch { /* 저장 실패해도 이번 세션 표시는 정상 동작 */ }
        setIsThemeModalOpen(false);
    }, []);

    // 열기: 먼저 보이게(mounted) 한 뒤, 두 프레임 뒤에 open을 켜서 닫힌 상태 -> 열린 상태로
    // 트랜지션이 재생되게 한다(reflow 없이 같은 프레임에서 켜면 애니메이션 없이 바로 열려버린다).
    const openChat = useCallback(() => {
        setMounted(true);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setOpen(true));
        });
        scrollToBottom();
    }, [scrollToBottom]);

    // 닫기: opacity/transform을 먼저 닫힌 상태로 트랜지션시키고,
    // 트랜지션이 끝난 뒤(handlePageTransitionEnd) display:none 상태로 되돌린다.
    const closeChat = useCallback(() => setOpen(false), []);

    const toggleChat = useCallback(() => {
        if (open) {
            closeChat();
        } else {
            openChat();
        }
    }, [open, closeChat, openChat]);

    const handlePageTransitionEnd = useCallback((e) => {
        if (e.target !== pageRef.current) return;
        if (!open) {
            setMounted(false);
            resetConversation();
        }
    }, [open, resetConversation]);

    // 툴바 토글이나 아이콘 숨김 배지로 위젯 전체가 숨겨질 때는 닫힘 트랜지션이 재생되지 않으므로
    // (visible=false가 되는 즉시 렌더가 null을 반환), transitionend를 기다리지 않고 즉시 초기화한다.
    useEffect(() => {
        if (!visible) {
            setOpen(false);
            setMounted(false);
            resetConversation();
        }
    }, [visible, resetConversation]);

    if (!visible) return null;

    const themeInfo = THEMES[theme];

    return (
        <div className={`${styles.chatbot} ${styles[themeInfo.className] || ''}`}>
            <div className={`${styles.chatBotWrap} ${open ? styles.isOpen : ''}`}>
                <button className={styles.chatBotClose} type="button" aria-label="챗봇 아이콘 숨기기" onClick={onHide}>
                    <i className="ri-close-fill" />
                </button>
                <button className={styles.chatBotBtn} type="button" aria-label="AI 챗봇 열기" onClick={toggleChat}>
                    <img src={themeInfo.image} alt="" />
                    <span>AI 챗봇</span>
                </button>
            </div>

            <div
                ref={pageRef}
                className={`${styles.chatbotPage} ${mounted ? styles.isVisible : ''} ${open ? styles.isOpen : ''}`}
                onTransitionEnd={handlePageTransitionEnd}
            >
                <div className={styles.chatbotContainer}>
                    <div className={styles.chatbotHeader}>
                        <div className={styles.chatbotHeaderLeft}>
                            <div className={styles.chatBotIcon}>
                                <img src={themeInfo.image} alt="" />
                            </div>
                            <div className={styles.headerTit}>
                                <h3>컨텐츠 에디터</h3>
                                <span className={styles.chatbotTitle}>도움말 챗봇</span>
                            </div>
                        </div>
                        <div className={styles.chatbotHeaderRight}>
                            <button className={styles.themeToggleBtn} type="button" onClick={openThemeModal} aria-label={`테마 선택 (현재: ${themeInfo.label})`} title={`테마: ${themeInfo.label} (클릭해서 변경)`}>
                                <i className="ri-palette-line" />
                            </button>
                            <button className={styles.chatBotClose2} type="button" onClick={closeChat} aria-label="챗봇 닫기">
                                <i className="ri-close-line" />
                            </button>
                        </div>
                    </div>

                    {isThemeModalOpen && (
                        <div className={styles.themeModalOverlay} onClick={closeThemeModal}>
                            <div className={styles.themeModal} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.themeModalHeader}>
                                    <span>테마 선택</span>
                                    <button type="button" className={styles.themeModalClose} onClick={closeThemeModal} aria-label="닫기">
                                        <i className="ri-close-line" />
                                    </button>
                                </div>
                                <div className={styles.themeModalGrid}>
                                    {Object.entries(THEMES).map(([key, info]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            className={`${styles.themeOption} ${theme === key ? styles.themeOptionActive : ''}`}
                                            onClick={() => selectTheme(key)}
                                        >
                                            <span className={styles.themeSwatchWrap}>
                                                <span className={styles.themeSwatch} style={{ background: `linear-gradient(135deg, ${info.swatch1}, ${info.swatch2})` }}>
                                                    <img src={info.image} alt="" />
                                                </span>
                                                {theme === key && <i className={`ri-check-line ${styles.themeCheck}`} />}
                                            </span>
                                            <span>{info.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.chatbotBody} ref={bodyRef}>
                        <div className={`${styles.chatRow} ${styles.staticRow}`}>
                            <div className={styles.botAvatar}>
                                <img src={themeInfo.image} alt="챗봇" />
                            </div>
                            <div className={styles.chatContent}>
                                <div className={styles.botBubble}>
                                    <p className={styles.bubbleText}>
                                        {renderThemedGreeting(theme)}
                                    </p>
                                </div>
                                <div className={styles.categoryGrid}>
                                    {CATEGORIES.map((category) => (
                                        <button
                                            key={category.key}
                                            className={styles.categoryItem}
                                            type="button"
                                            disabled={isResponding}
                                            onClick={() => handleCategoryClick(category)}
                                        >
                                            <i className={category.icon} />
                                            <span>{category.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {messages.map((message) => {
                            if (message.from === 'user') {
                                return (
                                    <div key={message.id} className={`${styles.chatRow} ${styles.user}`}>
                                        <div className={styles.userBubble}>{message.text}</div>
                                    </div>
                                );
                            }

                            return (
                                <BotMessage
                                    key={message.id}
                                    message={message}
                                    theme={theme}
                                    themeImage={themeInfo.image}
                                    isResponding={isResponding}
                                    onReveal={scrollToBottom}
                                    onRevealComplete={handleRevealComplete}
                                    onAskAnswer={askAnswer}
                                />
                            );
                        })}
                    </div>

                    <div
                        className={`${styles.quickTopics} ${isDragging ? styles.isDragging : ''}`}
                        onMouseDown={handleQuickTopicsMouseDown}
                        onMouseMove={handleQuickTopicsMouseMove}
                        onMouseUp={endDrag}
                        onMouseLeave={endDrag}
                    >
                        {QUICK_TOPICS.map((topic) => (
                            <button
                                key={topic.key}
                                className={styles.quickTopicBtn}
                                type="button"
                                disabled={isResponding}
                                onClick={() => handleQuickTopicClick(topic)}
                            >
                                <i className="ri-question-line" />
                                <span>{topic.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className={styles.chatbotFooter}>
                        <div className={`${styles.autocompleteDropdown} ${suggestions.length > 0 ? styles.isOpen : ''}`}>
                            <ul className={styles.autocompleteList}>
                                {suggestions.map((topic, i) => (
                                    <li
                                        key={topic.key}
                                        className={`${styles.autocompleteItem} ${i === selectedIndex ? styles.isSelected : ''}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSuggestionPick(topic);
                                        }}
                                    >
                                        {highlightMatch(topic.label, inputValue.trim())}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className={styles.inputWrap}>
                            <input
                                type="text"
                                className={styles.chatInput}
                                placeholder="무엇을 도와드릴까요?"
                                maxLength={200}
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                                onBlur={handleInputBlur}
                            />
                            <button className={styles.sendBtn} type="button" disabled={isResponding} onClick={handleSend} aria-label="메시지 전송">
                                <i className="ri-arrow-right-line" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

ChatBot.displayName = 'ChatBot';
export default ChatBot;

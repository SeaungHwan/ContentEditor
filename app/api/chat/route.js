/*
 * [app/api/chat/route.js] 챗봇 자유 질문 응답 (LLM 폴백)
 *
 * 역할:
 *   - 프론트(ChatBot.jsx)의 규칙 기반 매칭이 실패했을 때만 호출된다.
 *   - GUIDE_MESSAGES 전체를 시스템 프롬프트에 포함시켜, 에디터와 무관한 얘기로
 *     새지 않고 실제 가이드 내용에 근거해서만 답하도록 근거를 제공한다(RAG 없이 컨텍스트 주입).
 *   - Groq를 1순위로 시도하고, 실패 시 Gemini로 폴백한다. 두 키 모두 서버에서만 사용한다.
 */

import { ALL_TOPICS } from '../../components/TableEditor/ChatBot/chatBotTopics';

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_TURNS = 6;
const REQUEST_TIMEOUT_MS = 15000;
// Groq 계정에서 실제로 사용 가능한 모델(https://api.groq.com/openai/v1/models 로 확인).
// 더 높은 품질이 필요하면 'openai/gpt-oss-120b'로 교체.
const GROQ_MODEL = 'openai/gpt-oss-20b';
// 특정 버전(gemini-2.0-flash 등)은 계정/시점에 따라 존재하지 않을 수 있어(404),
// 항상 현재 권장되는 flash 모델을 가리키는 별칭을 사용한다.
const GEMINI_MODEL = 'gemini-flash-latest';

// 서버 인스턴스 메모리에만 유지되는 아주 단순한 rate limit이라 재배포/재시작 시 초기화되고,
// 서버리스 인스턴스가 여러 개 뜨면 인스턴스별로 따로 세어진다 — 남용을 "완전히" 막는 용도가
// 아니라 한 클라이언트가 짧은 시간에 과도하게 호출하는 것만 걷어내는 1차 방어선이다.
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitState = new Map();

function isRateLimited(clientId) {
    const now = Date.now();
    const entry = rateLimitState.get(clientId);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitState.set(clientId, { windowStart: now, count: 1 });
        return false;
    }
    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return true;

    entry.count += 1;
    return false;
}

function getClientId(request) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0].trim();
    return request.headers.get('x-real-ip') || 'unknown';
}

const GUIDE_REFERENCE = ALL_TOPICS.map((topic) => `- ${topic.label}: ${topic.answer.replace(/\n/g, ' ')}`).join('\n');

const SYSTEM_PROMPT =
    '당신은 "HTML 컨텐츠 에디터"라는 웹 기반 표/컨텐츠 편집 도구의 사용법을 안내하는 도우미입니다.\n' +
    '아래는 이 에디터의 공식 가이드 항목입니다. 반드시 이 내용에 근거해서만 답변하세요.\n' +
    '가이드에 없는 내용이거나 확신할 수 없는 경우, 지어내지 말고 "가이드에서 확인되지 않는 내용이에요"라고 답하세요.\n' +
    '답변은 한국어로, 3~4문장 이내로 간결하게 하세요.\n\n' +
    `[가이드 목록]\n${GUIDE_REFERENCE}`;

// history는 프론트 messages state에서 온 {role, content} 배열(최근 대화 맥락). 검증 후
// 최근 MAX_HISTORY_TURNS개만 남기고, 각 항목 길이도 message와 동일한 상한을 적용한다.
function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
        .filter(
            (turn) =>
                turn &&
                (turn.role === 'user' || turn.role === 'assistant') &&
                typeof turn.content === 'string' &&
                turn.content.length > 0 &&
                turn.content.length <= MAX_MESSAGE_LENGTH
        )
        .slice(-MAX_HISTORY_TURNS);
}

async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('timeout');
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

async function askGroq(message, history) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY missing');

    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history,
                { role: 'user', content: message },
            ],
            temperature: 0.3,
            max_tokens: 300,
        }),
    });

    if (!res.ok) throw new Error(`Groq request failed: ${res.status}`);

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('Groq returned empty reply');
    return reply;
}

async function askGemini(message, history) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const contents = [
        ...history.map((turn) => ({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
    ];
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
        }),
    });

    if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) throw new Error('Gemini returned empty reply');
    return reply;
}

export async function POST(request) {
    if (isRateLimited(getClientId(request))) {
        return Response.json({ error: 'rate_limited' }, { status: 429 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
        return Response.json({ error: 'invalid_message' }, { status: 400 });
    }
    const history = sanitizeHistory(body?.history);

    try {
        const reply = await askGroq(message, history);
        return Response.json({ reply, source: 'groq' });
    } catch (groqError) {
        try {
            const reply = await askGemini(message, history);
            return Response.json({ reply, source: 'gemini' });
        } catch (geminiError) {
            console.error('[api/chat] both providers failed', groqError, geminiError);
            const bothTimedOut = groqError.message === 'timeout' && geminiError.message === 'timeout';
            return Response.json({ error: bothTimedOut ? 'timeout' : 'provider_unavailable' }, { status: 502 });
        }
    }
}

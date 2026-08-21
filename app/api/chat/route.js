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
// Groq 계정에서 실제로 사용 가능한 모델(https://api.groq.com/openai/v1/models 로 확인).
// 더 높은 품질이 필요하면 'openai/gpt-oss-120b'로 교체.
const GROQ_MODEL = 'openai/gpt-oss-20b';
const GEMINI_MODEL = 'gemini-2.0-flash';

const GUIDE_REFERENCE = ALL_TOPICS.map((topic) => `- ${topic.label}: ${topic.answer.replace(/\n/g, ' ')}`).join('\n');

const SYSTEM_PROMPT =
    '당신은 "HTML 컨텐츠 에디터"라는 웹 기반 표/컨텐츠 편집 도구의 사용법을 안내하는 도우미입니다.\n' +
    '아래는 이 에디터의 공식 가이드 항목입니다. 반드시 이 내용에 근거해서만 답변하세요.\n' +
    '가이드에 없는 내용이거나 확신할 수 없는 경우, 지어내지 말고 "가이드에서 확인되지 않는 내용이에요"라고 답하세요.\n' +
    '답변은 한국어로, 3~4문장 이내로 간결하게 하세요.\n\n' +
    `[가이드 목록]\n${GUIDE_REFERENCE}`;

async function askGroq(message) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY missing');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
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

async function askGemini(message) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: message }] }],
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

    try {
        const reply = await askGroq(message);
        return Response.json({ reply, source: 'groq' });
    } catch (groqError) {
        try {
            const reply = await askGemini(message);
            return Response.json({ reply, source: 'gemini' });
        } catch (geminiError) {
            console.error('[api/chat] both providers failed', groqError, geminiError);
            return Response.json({ error: 'provider_unavailable' }, { status: 502 });
        }
    }
}

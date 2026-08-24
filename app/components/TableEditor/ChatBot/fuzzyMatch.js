/*
 * [fuzzyMatch.js] 챗봇 자유 텍스트 매칭
 *
 * 기존에는 topic.label.includes(query)만 써서 오타나 공백 차이(예: "열너비" vs "열 너비")가
 * 있으면 전혀 매칭되지 못하고 곧바로 LLM 폴백으로 넘어갔다. 정규화된 부분 문자열 매칭을
 * 우선 시도하고, 실패하면 편집거리 기반으로 라벨/토큰과의 유사도를 봐서 오타를 흡수한다.
 */

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;

    for (let i = 1; i <= m; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = dp[j];
            dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
            prev = temp;
        }
    }
    return dp[n];
}

function normalize(str) {
    return str.replace(/\s+/g, '').toLowerCase();
}

function tokenize(label) {
    return label.split(/[\s/·()]+/).filter(Boolean).map(normalize);
}

// 짧은 질문에는 1글자 오타도 크게 느껴지므로 엄격하게, 긴 질문일수록 여유를 둔다.
function editThreshold(len) {
    if (len <= 3) return 1;
    if (len <= 6) return 2;
    return Math.floor(len * 0.35);
}

export function searchTopics(query, topics, limit = 6) {
    const q = normalize(query);
    if (!q) return [];

    const substringMatches = topics.filter((topic) => normalize(topic.label).includes(q));
    if (substringMatches.length > 0) return substringMatches.slice(0, limit);

    const threshold = editThreshold(q.length);
    const scored = topics
        .map((topic) => {
            const tokens = tokenize(topic.label);
            const distance = Math.min(levenshtein(q, normalize(topic.label)), ...tokens.map((t) => levenshtein(q, t)));
            return { topic, distance };
        })
        .filter(({ distance }) => distance <= threshold)
        .sort((a, b) => a.distance - b.distance);

    return scored.slice(0, limit).map(({ topic }) => topic);
}

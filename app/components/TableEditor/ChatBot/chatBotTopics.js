/*
 * [chatBotTopics.js] 챗봇 안내 콘텐츠 로더
 *
 * 역할:
 *   - 실제 카테고리/답변 데이터는 chatBotContent.json에 있다(개발자가 아니어도
 *     JSON만 수정해서 문구를 갱신할 수 있게 콘텐츠와 로직을 분리했다).
 *   - GUIDE_MESSAGES(constants.js)는 호버 가이드 모드용 짧은 툴팁이라 챗봇에는 쓰지 않는다.
 */

import content from './chatBotContent.json';

// 카테고리 그리드에 표시되는 순서 = JSON categories 배열 순서
export const CATEGORIES = content.categories;

// 자유 텍스트 검색 / 자동완성에서 쓰는 평탄화된 목록
export const ALL_TOPICS = CATEGORIES.flatMap((category) =>
    category.topics.map((topic) => ({
        ...topic,
        category: category.key,
        answer: content.answers[topic.key] || '',
    }))
);

export function getTopicAnswer(key) {
    return content.answers[key] || '';
}

// 빠른 답변(quick-topics) 칩에 노출할 항목
export const QUICK_TOPIC_KEYS = content.quickTopicKeys;

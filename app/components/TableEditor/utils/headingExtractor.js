/*
 * [headingExtractor.js] 제목 후보 자동 감지 유틸리티
 *
 * HTML에서 한국 법령/문서 패턴을 인식해 제목 후보를 추출한다.
 * 감지된 후보는 data-hcand-id 마커가 삽입된 HTML과 함께 반환되며,
 * 사용자가 변환 또는 무시하기 전까지 에디터 내 마커로 추적한다.
 */
import { getDOMParser } from './htmlCleaners';

// 패턴 → 레벨 매핑 (우선순위 순)
const PATTERNS = [
    { re: /^제\s*\d+\s*(편|장)/,              level: 'h3', label: '편/장' },
    { re: /^제\s*\d+\s*(절|조)/,              level: 'h3', label: '절/조' },
    { re: /^제\s*\d+\s*(항|호)/,              level: 'h4', label: '항/호' },
    { re: /^\d{1,2}\.\s+\S/,                  level: 'h3', label: '번호' },
    { re: /^[가나다라마바사아자차카타파하]\.\s+\S/, level: 'h4', label: '가나다' },
];

const HEADING_TAGS = new Set(['h1','h2','h3','h4','h5','h6']);

const genId = () =>
    `hc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

// "1. 내용" → 1 반환, 패턴 없으면 null
const getSeqNum = (el) => {
    const t = el?.textContent?.trim() || '';
    const m = t.match(/^(\d{1,2})\.\s+\S/);
    return m ? parseInt(m[1], 10) : null;
};

/**
 * HTML 내 기존 hcand 마커를 제거한다.
 * @param {string} html
 * @returns {string}
 */
export function stripCandidateMarkers(html) {
    return html ? html.replace(/ data-hcand-id="[^"]*"/g, '') : html;
}

/**
 * HTML에서 제목 후보를 감지하고 마커를 삽입해 반환한다.
 * @param {string} html
 * @returns {{ markedHtml: string, candidates: Array }}
 */
export function extractHeadingCandidates(html) {
    if (!html?.trim()) return { markedHtml: html || '', candidates: [] };

    // 기존 마커 제거 후 파싱
    const clean = stripCandidateMarkers(html);
    const parser = getDOMParser();
    if (!parser) return { markedHtml: html, candidates: [] };

    const doc = parser.parseFromString(clean, 'text/html');
    const candidates = [];

    // 표·목록 밖의 블록 요소 (p, div)
    const textBlocks = Array.from(doc.body.querySelectorAll('p, div'))
        .filter(el =>
            !el.closest('table') &&
            !el.closest('ul') &&
            !el.closest('ol') &&
            !el.querySelector('table, ul, ol')
        );

    // 목록 항목 (li): 표 안 제외, 하위 목록 없는 단순 항목만
    const liBlocks = Array.from(doc.body.querySelectorAll('li'))
        .filter(el =>
            !el.closest('table') &&
            !el.querySelector('table, ul, ol')
        );

    [...textBlocks, ...liBlocks].forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (HEADING_TAGS.has(tag)) return;

        const text = el.textContent?.trim() || '';
        if (!text || text.length > 60) return;

        let matched = null;
        let confidence = 'medium';

        // 1순위: 패턴 매칭
        for (const p of PATTERNS) {
            if (p.re.test(text)) {
                if (p.label === '번호') {
                    matched = p; confidence = 'medium'; break;
                }
                matched = p; confidence = 'high'; break;
            }
        }

        // 2순위: 굵은 글씨만 있는 짧은 단락 (li는 제외)
        if (!matched) {
            if (tag === 'li') return;
            const firstChild = el.children[0];
            const isBoldOnly =
                el.children.length === 1 &&
                (firstChild?.tagName === 'STRONG' || firstChild?.tagName === 'B') &&
                text.length <= 30;
            if (!isBoldOnly) return;
            matched = { level: 'h3', label: '굵은 단락' };
        }

        const id = genId();
        el.setAttribute('data-hcand-id', id);

        const fullText = text.slice(0, 60);
        candidates.push({
            id,
            text: fullText.length > 22 ? fullText.slice(0, 22) + '…' : fullText,
            fullText,
            suggestedLevel: matched.level,
            pattern: matched.label,
            confidence,
        });
    });

    return {
        markedHtml: doc.body.innerHTML,
        candidates,
    };
}

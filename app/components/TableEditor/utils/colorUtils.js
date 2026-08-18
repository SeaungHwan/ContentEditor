
/*
 * [colorUtils.js] 색상 값 → CSS 클래스명 변환 유틸리티
 *
 * 역할:
 *   - 인라인 style의 color 값을 분석해 가장 가까운 CMS 색상 클래스(pc_xxx)로 변환한다.
 *   - traverseAndClean에서 isColorMode + isColorClassMode 옵션이 켜져 있을 때 호출된다.
 *
 * 주요 함수:
 *
 *   extractRGB(colorStr) → [r, g, b] | null  (파일 내부 전용 — mapColorToClass에서만 사용)
 *     - HEX(#fff, #ffffff, #rgba, #rrggbbaa — 알파 채널은 버림), rgba?(r,g,b,...),
 *       색상 이름(gray, blue 등) 세 가지 형식을 파싱.
 *     - 인식 불가 형식이면 null 반환.
 *
 *   mapColorToClass(colorStr, prefix) → 'pc_xxx' | null
 *     - extractRGB로 파싱 후 TARGET_COLORS 목록과 유클리드 거리(RGB 제곱합)를 비교해
 *       가장 가까운 색상을 찾는다.
 *     - 최대 허용 거리(MAX_ALLOWED_DISTANCE = 8000)를 초과하면 null 반환 → 인라인 style 유지.
 *     - 흰색에 가까운 색상(R,G,B 모두 > 240)은 클래스 변환 대상에서 제외.
 *     - LRU 방식의 캐시(Map, 최대 500건)를 사용해 반복 호출 성능을 최적화한다.
 */

import { TARGET_COLORS } from './constants';

const extractRGB = (colorStr) => {
    if (!colorStr) return null;
    const str = colorStr.toLowerCase().trim();

    if (str.startsWith('#')) {
        let hex = str.substring(1);
        // 3자리(#rgb)/4자리(#rgba) 축약형은 각 자리를 두 번씩 늘려 6~8자리로 만든다.
        if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('');
        // 8자리(#rrggbbaa)든 방금 확장한 4자리 유래 8자리든, 알파 채널은 버리고 앞 6자리(RRGGBB)만 쓴다.
        // (이 처리가 없으면 4/8자리 hex가 6자리인 것처럼 잘못 파싱되어 엉뚱한 RGB 값이 나온다)
        hex = hex.substring(0, 6);
        if (hex.length !== 6 || /[^0-9a-f]/.test(hex)) return null;
        const num = parseInt(hex, 16);
        return [num >> 16, (num >> 8) & 255, num & 255];
    }
    
    const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    
    const namedColors = {
        gray: [128, 128, 128], black: [0, 0, 0], blue: [0, 0, 255], red: [255, 0, 0],
        navy: [0, 0, 128], orange: [255, 165, 0], green: [0, 128, 0], yellow: [255, 255, 0],
        purple: [128, 0, 128], skyblue: [135, 206, 235], pink: [255, 192, 203], white: [255, 255, 255]
    };
    return namedColors[str] || null;
};

const colorClassCache = new Map();
const MAX_CACHE_SIZE = 500;

export const mapColorToClass = (colorStr, prefix) => {
    if (!colorStr) return null;
    const cacheKey = `${colorStr.toLowerCase().trim()}-${prefix}`;
    if (colorClassCache.has(cacheKey)) {
        // LRU: Map은 삽입 순서를 유지하므로, 히트한 키를 삭제 후 재삽입해 "가장 최근 사용" 쪽
        // (반복 순서의 맨 뒤)으로 옮긴다. 이걸 하지 않으면 사실상 FIFO와 같아져, 자주 재사용되는
        // 색상도 오래된 항목과 함께 밀려날 수 있다.
        const cached = colorClassCache.get(cacheKey);
        colorClassCache.delete(cacheKey);
        colorClassCache.set(cacheKey, cached);
        return cached;
    }

    const rgb = extractRGB(colorStr);
    if (!rgb || (rgb[0] > 240 && rgb[1] > 240 && rgb[2] > 240)) {
        colorClassCache.set(cacheKey, null);
        return null;
    }

    let minDistance = Infinity;
    let closestColorName = null;
    for (const target of TARGET_COLORS) {
        const rDiff = rgb[0] - target.rgb[0];
        const gDiff = rgb[1] - target.rgb[1];
        const bDiff = rgb[2] - target.rgb[2];
        const distance = (rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff);

        if (distance < minDistance) {
            minDistance = distance;
            closestColorName = target.name;
        }
    }
    const MAX_ALLOWED_DISTANCE = 8000;
    const result = minDistance <= MAX_ALLOWED_DISTANCE && closestColorName ? `${prefix}${closestColorName}` : null;

    if (colorClassCache.size >= MAX_CACHE_SIZE) {
        const firstKey = colorClassCache.keys().next().value;
        colorClassCache.delete(firstKey);
    }

    colorClassCache.set(cacheKey, result);
    return result;
};
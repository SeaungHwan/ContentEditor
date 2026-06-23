/*
 * [useEditorActions.js] 에디터 주요 버튼 액션 로직 훅
 *
 * 역할:
 *   - 툴바 버튼들의 클릭 핸들러를 모아 관리한다.
 *   - TableEditor.jsx에서 분리되어 컴포넌트의 복잡도를 낮춘다.
 *
 * 제공 함수:
 *
 *   handleClear()         - 에디터 내용 초기화
 *   handleManualClean()   - cleanTableHtml 전체 재처리
 *   handleCopy()          - 정제된 HTML 클립보드 복사
 *   handleExternalTableEdit() - 개별 표 설정 모달 열기
 *   handleInsertTemplate(html) - 템플릿 HTML 삽입 후 전체 정리
 */
"use client";
import { useCallback } from 'react';
import { html as html_beautify } from 'js-beautify';
import { cleanTableHtml, updateStylesOnly } from '../cleanTableHtml';
import { RE_WHITESPACE } from '../utils/constants';
import { wrapWithTheme, unwrapThemeDiv } from '../utils/themeWrapper';
import { removeEmptyRowsColsFromHtml } from '../utils/tableEditUtils';
import { getDOMParser } from '../utils/htmlCleaners';

// &nbsp;( ), 제로폭 공백 등 불가시 문자까지 포함해 "실제 텍스트 없음" 판정
function hasRealContent(html) {
    if (!html) return false;
    const doc = getDOMParser().parseFromString(html, 'text/html');
    doc.body.querySelectorAll('p').forEach(p => {
        const kids = Array.from(p.childNodes).filter(n =>
            !(n.nodeType === 3 && n.textContent.trim() === '')
        );
        if (kids.length === 0 || (kids.length === 1 && kids[0].nodeName === 'BR')) p.remove();
    });
    doc.body.querySelectorAll('div[data-theme]').forEach(el => {
        if (el.innerHTML.replace(/\s/g, '') === '') el.remove();
    });
    return doc.body.innerHTML.trim().length > 0;
}

export default function useEditorActions({
    editorRef, config, formattedWidthString, setContent, triggerToast, openTableEditModal
}) {

    // 1. 전체 삭제
    const handleClear = useCallback(() => {
        const currentVal = editorRef.current?.getInstance()?.value;
        if (!hasRealContent(currentVal)) return triggerToast('삭제할 내용이 없습니다.');
        if (editorRef.current) editorRef.current.clear();
        setContent('');
        triggerToast('삭제되었습니다.');
    }, [editorRef, setContent, triggerToast]);

    // 2. 수동 정리
    const handleManualClean = useCallback(async ({ clearFirst = false } = {}) => {
        const currentVal = editorRef.current?.getInstance()?.value;
        if (!hasRealContent(currentVal)) return triggerToast('정리할 내용이 없습니다.');

        if (clearFirst) {
            const instance = editorRef.current?.getInstance();
            if (instance) instance.value = '';
        }

        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

        try {
            const rawVal = unwrapThemeDiv(currentVal);
            const cleanedHtml = cleanTableHtml(rawVal, config, formattedWidthString);
            const { html: noEmptyHtml } = removeEmptyRowsColsFromHtml(cleanedHtml);
            const wrappedHtml = wrapWithTheme(noEmptyHtml, config);

            if (editorRef.current) editorRef.current.setFullContent(wrappedHtml);
            setContent(wrappedHtml);
            triggerToast('문서 정리가 완료되었습니다.');
        } catch (error) {
            console.error("Clean Document Error", error);
            triggerToast('정리 중 오류가 발생했습니다.', 'error');
        }
    }, [editorRef, config, formattedWidthString, setContent, triggerToast]);

    // 3. 복사하기
    const handleCopy = useCallback(async () => {
        const currentVal = editorRef.current?.getInstance()?.value;
        if (!currentVal) return triggerToast('복사할 내용이 없습니다.');

        let finalHtml = updateStylesOnly(unwrapThemeDiv(currentVal), config, formattedWidthString);

        const tempDoc = getDOMParser().parseFromString(finalHtml, 'text/html');
        tempDoc.querySelectorAll('[data-local-config]').forEach(el => el.removeAttribute('data-local-config'));
        tempDoc.querySelectorAll('[data-local-colwidths]').forEach(el => el.removeAttribute('data-local-colwidths'));
        tempDoc.querySelectorAll('[data-temp-id]').forEach(el => el.removeAttribute('data-temp-id'));
        tempDoc.querySelectorAll('[data-origin-html]').forEach(el => el.removeAttribute('data-origin-html'));
        tempDoc.querySelectorAll('[data-hcand-id]').forEach(el => el.removeAttribute('data-hcand-id'));
        tempDoc.querySelectorAll('[data-hconv-id]').forEach(el => el.removeAttribute('data-hconv-id'));
        tempDoc.querySelectorAll('td, th').forEach(cell => {
            const text = cell.textContent.replace(RE_WHITESPACE, '');
            if (text === '' && cell.querySelectorAll('img, iframe, table').length === 0) {
                cell.innerHTML = '';
            }
        });

        finalHtml = tempDoc.body.innerHTML;

        finalHtml = finalHtml.replace(/<p>\s*<br\s*\/?>\s*<\/p>\s*$/i, '');
        finalHtml = finalHtml.replace(/<br\s+class=["']vt-br["']\s*\/?>/gi, '<br />');
        finalHtml = finalHtml.replace(/<\/table>\s*<br\s*\/?>/gi, '</table>');

        const { theme = '', primaryColor, secondaryColor, tertiaryColor, accentColor } = config;
        const overrides = [
            primaryColor   && `--color-primary:${primaryColor}`,
            secondaryColor && `--color-secondary:${secondaryColor}`,
            tertiaryColor  && `--color-tertiary:${tertiaryColor}`,
            accentColor    && `--color-accent:${accentColor}`,
        ].filter(Boolean).join(';');
        finalHtml = `<div data-theme="${theme}"${overrides ? ` style="${overrides}"` : ''}>\n${finalHtml}\n</div>`;

        try {
            const beautified = html_beautify(finalHtml, {
                indent_size: 2, preserve_newlines: false, max_preserve_newlines: 1, wrap_line_length: 0,
                unformatted: ['a', 'span', 'strong', 'em', 'code', 'i', 'b', 'u'],
            });

            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(beautified);
                triggerToast('복사되었습니다.');
            } else {
                triggerToast('현재 환경에서는 클립보드 복사 기능을 지원하지 않습니다.');
            }
        } catch (err) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(finalHtml)
                    .then(() => triggerToast('복사되었습니다.(정렬 실패)'))
                    .catch(() => triggerToast('복사 실패'));
            } else {
                triggerToast('복사 실패: 지원하지 않는 환경입니다.');
            }
        }
    }, [editorRef, config, formattedWidthString, triggerToast]);

    // 4. 외부 표 설정 모달 열기
    const handleExternalTableEdit = useCallback(() => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return triggerToast('에디터를 찾을 수 없습니다.');

        const current = instance.s.current();
        const target = current?.nodeType === 3 ? current.parentElement : current;
        let table = target?.closest('table');

        if (!table) {
            const allTables = instance.editor.querySelectorAll('table');
            if (allTables.length === 1) table = allTables[0];
        }

        if (table) {
            let targetToProcess = table;
            if (table.parentElement && table.parentElement.tagName === 'DIV' && (table.parentElement.className.includes('tbl') || table.parentElement.className.includes('scroll'))) {
                targetToProcess = table.parentElement;
            }

            const tempId = 'tbl-edit-' + Math.random().toString(36).substr(2, 9);
            targetToProcess.setAttribute('data-temp-id', tempId);

            let passedConfig = null;
            let passedColWidths = null;
            if (targetToProcess.hasAttribute('data-local-config')) {
                try { passedConfig = JSON.parse(targetToProcess.getAttribute('data-local-config')); } catch(e){}
            }
            if (targetToProcess.hasAttribute('data-local-colwidths')) {
                try { passedColWidths = JSON.parse(targetToProcess.getAttribute('data-local-colwidths')); } catch(e){}
            }

            openTableEditModal(targetToProcess.outerHTML, tempId, passedConfig, passedColWidths);
        } else {
            triggerToast('표(Table) 내부를 클릭한 후 설정 버튼을 눌러주세요.');
        }
    }, [editorRef, triggerToast, openTableEditModal]);

    // 5. 템플릿 표 삽입 후 전체 정리
    const handleInsertTemplate = useCallback(async (templateHtml) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const currentVal = instance.value || '';
        const raw = unwrapThemeDiv(currentVal);
        const combined = raw ? `${raw}\n${templateHtml}` : templateHtml;

        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));

        try {
            const cleaned = cleanTableHtml(combined, config, formattedWidthString);
            const wrapped = wrapWithTheme(cleaned, config);
            if (editorRef.current) editorRef.current.setFullContent(wrapped);
            setContent(wrapped);
            triggerToast('템플릿이 삽입되었습니다.');
        } catch (e) {
            triggerToast('삽입 중 오류가 발생했습니다.');
        }
    }, [editorRef, config, formattedWidthString, setContent, triggerToast]);

    return { handleClear, handleManualClean, handleCopy, handleExternalTableEdit, handleInsertTemplate };
}

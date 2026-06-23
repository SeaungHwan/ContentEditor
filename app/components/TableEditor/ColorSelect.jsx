"use client";
import React, { useState, useEffect, useRef } from 'react';
import layout from '../../layout.module.css';

const THEMES = [
    { value: 'purple', label: '보라' },
    { value: 'blue',   label: '파랑' },
    { value: 'green',  label: '초록' },
    { value: 'navy',   label: '남색' },
    { value: 'mint',   label: '민트' },
    { value: 'orange', label: '주황' },
    // { value: 'red',    label: '빨강' },
    // { value: 'yellow', label: '노랑' },
];

const COLOR_FIELDS = [
    { key: 'primaryColor',   resolvedKey: 'primary',   label: '주색상' },
    { key: 'tertiaryColor',  resolvedKey: 'tertiary',  label: '보조색상1' },
    { key: 'secondaryColor', resolvedKey: 'secondary', label: '보조색상2' },
    { key: 'accentColor',    resolvedKey: 'accent',    label: '포인트' },
];

// 테마별 CSS 변수 읽기 캐시
const themeColorCache = {};
function resolveThemeColors(themeValue) {
    if (themeColorCache[themeValue]) return themeColorCache[themeValue];
    if (typeof window === 'undefined') return { primary: '#555', secondary: '#777', tertiary: '#999' };
    const el = document.createElement('div');
    el.setAttribute('data-theme', themeValue);
    el.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
    document.body.appendChild(el);
    const c = getComputedStyle(el);
    const result = {
        primary:   c.getPropertyValue('--color-primary').trim() || '#555',
        secondary: c.getPropertyValue('--color-secondary').trim() || '#777',
        tertiary:  c.getPropertyValue('--color-tertiary').trim() || '#999',
    };
    document.body.removeChild(el);
    themeColorCache[themeValue] = result;
    return result;
}

function ThemePreviewCard({ themeValue, label }) {
    const [colors, setColors] = useState(null);
    useEffect(() => {
        setColors(resolveThemeColors(themeValue));
    }, [themeValue]);

    if (!colors) return null;
    return (
        <div className={layout.themePreviewCard} data-theme={themeValue}>
            <div className="tbl-st">
                <table>
                    <thead>
                        <tr>
                            <th style={{padding:'0.2rem', fontSize:'0.6rem'}}>항목</th>
                            <th style={{padding:'0.2rem', fontSize:'0.6rem'}}>내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{padding:'0.2rem', fontSize:'0.6rem'}}>값 1</td>
                            <td style={{padding:'0.2rem', fontSize:'0.6rem'}}>내용 1</td>
                        </tr>
                        <tr>
                            <td style={{padding:'0.2rem', fontSize:'0.6rem'}}>값 2</td>
                            <td style={{padding:'0.2rem', fontSize:'0.6rem'}}>내용 2</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function ColorSelect({ theme, onThemeChange, primaryColor, secondaryColor, tertiaryColor, accentColor, onColorChange }) {
    const [localColors, setLocalColors] = useState({
        primaryColor: primaryColor || '',
        secondaryColor: secondaryColor || '',
        tertiaryColor: tertiaryColor || '',
        accentColor: accentColor || '',
    });
    const [themeColors, setThemeColors] = useState(() => resolveThemeColors(theme));
    const [hoveredTheme, setHoveredTheme] = useState(null);
    const hoverTimerRef = useRef(null);

    // 테마 변경 등 외부에서 props가 바뀔 때 로컬 state 동기화
    useEffect(() => {
        setLocalColors({
            primaryColor: primaryColor || '',
            secondaryColor: secondaryColor || '',
            tertiaryColor: tertiaryColor || '',
            accentColor: accentColor || '',
        });
    }, [primaryColor, secondaryColor, tertiaryColor, accentColor]);

    const hasCustom = !!(primaryColor || secondaryColor || tertiaryColor || accentColor);

    const displayThemes = hasCustom
        ? [...THEMES, { value: 'custom', label: '커스텀' }]
        : THEMES;

    useEffect(() => {
        const colors = resolveThemeColors(theme);
        setThemeColors({
            primary:   colors.primary,
            tertiary:  colors.tertiary,
            secondary: colors.secondary,
            accent:    colors.primary,
        });
    }, [theme]);

    useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

    const handleMouseEnter = (themeValue) => {
        if (themeValue === 'custom') return;
        hoverTimerRef.current = setTimeout(() => setHoveredTheme(themeValue), 200);
    };
    const handleMouseLeave = () => {
        clearTimeout(hoverTimerRef.current);
        setHoveredTheme(null);
    };

    return (
        <div className={layout.colorSelectWrap}>
            <div className={layout.themeSwatchList}>
                <span className={layout.themeTit}>테마</span>
                {displayThemes.map(t => {
                    const isCustom = t.value === 'custom';
                    const isActive = isCustom ? hasCustom : (!hasCustom && theme === t.value);
                    return (
                        <div
                            key={t.value}
                            className={layout.themeSwatchWrap}
                            onMouseEnter={() => handleMouseEnter(t.value)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <button
                                type="button"
                                title={t.label}
                                onClick={() => !isCustom && onThemeChange(t.value)}
                                data-theme={!isCustom ? t.value : undefined}
                                style={isCustom ? {
                                    background: `linear-gradient(135deg, ${primaryColor || themeColors.primary} 50%, ${secondaryColor || themeColors.secondary} 50%)`,
                                    cursor: 'default',
                                } : undefined}
                                className={`${layout.themeSwatch} ${isActive ? layout.themeSwatchActive : ''}`}
                            />
                            {hoveredTheme === t.value && (
                                <ThemePreviewCard themeValue={t.value} label={t.label} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className={layout.colorFieldList}>
                {COLOR_FIELDS.map(field => (
                    <label key={field.key} className={layout.colorFieldLabel}>
                        <input
                            type="color"
                            value={localColors[field.key] || themeColors[field.resolvedKey] || '#000000'}
                            onChange={(e) => setLocalColors(prev => ({ ...prev, [field.key]: e.target.value }))}
                            onBlur={(e) => onColorChange(field.key, e.target.value)}
                            className={layout.colorFieldInput}
                        />
                        {field.label}
                    </label>
                ))}
            </div>
        </div>
    );
}

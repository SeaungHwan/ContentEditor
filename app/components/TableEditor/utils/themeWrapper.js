"use client";

export const unwrapThemeDiv = (html) =>
    html.replace(/^\s*<div\s+(?:data-theme="[^"]*"(?:\s+style="[^"]*")?|style="--color-[^"]*")>\n?([\s\S]*?)\n?<\/div>\s*$/, '$1').trim();

export const wrapWithTheme = (html, cfg) => {
    const { theme = '', primaryColor, secondaryColor, tertiaryColor, accentColor } = cfg;
    const hasCustom = !!(primaryColor || secondaryColor || tertiaryColor || accentColor);
    const overrides = [
        primaryColor   && `--color-primary:${primaryColor}`,
        secondaryColor && `--color-secondary:${secondaryColor}`,
        tertiaryColor  && `--color-tertiary:${tertiaryColor}`,
        accentColor    && `--color-accent:${accentColor}`,
    ].filter(Boolean).join(';');
    const themeAttr = hasCustom ? '' : ` data-theme="${theme}"`;
    return `<div${themeAttr}${overrides ? ` style="${overrides}"` : ''}>\n${html}\n</div>`;
};

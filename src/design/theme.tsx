import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import spectrum from './theme-tokens.json';
import type { DesignNode, LayoutStyle } from './types';

export type AppearancePreference = 'light' | 'dark';
export type ColorContext = 'normal' | 'primary' | 'secondary' | 'strong' | 'gold';

// Foundation colors come from the existing Figma Sáng/Tối prototype actions.
// Category and action colors come from Spectrum's Light/Dark variable modes.
const palettes = {
  light: {
    background: '#f7f8fc', canvas: '#e9eeeb', surface: '#ffffff', input: '#ffffff',
    text: '#1b2934', muted: '#53616e', border: '#dbe3ea', accent: '#165b43',
    onAccent: '#ffffff', primary: '#165b43', secondary: '#ebf3ef',
    onSecondary: '#165b43', sage: '#e9f4ed', scrim: 'rgba(18,61,45,.35)',
    toast: '#123d2d', onToast: '#ffffff',
  },
  dark: {
    background: '#111c25', canvas: '#0b141c', surface: '#1b2a35', input: '#1b2a35',
    text: '#f1f5f8', muted: '#b9c8d4', border: '#40515f', accent: '#a4e2bc',
    onAccent: '#123d2d', primary: '#9fe1ba', secondary: '#233d35',
    onSecondary: '#c4ebd5', sage: '#203a34', scrim: 'rgba(0,0,0,.62)',
    toast: '#203a34', onToast: '#f1f5f8',
  },
};
const categoryColors = Object.fromEntries(spectrum.tokens
  .filter(token => token.name.startsWith('Category/') && !/\/(Strong|Glow)$/.test(token.name))
  .map(token => [token.light, token.dark]));
const extraColors: Record<string, string> = {
  '#ebf3ef': '#233d35', '#e9f4ed': '#203a34', '#fff0db': '#3e3326',
  '#eef2f0': '#24382e', '#718278': '#829a8d', '#b63f41': '#ffb4b4',
  '#fdedee': '#43282a', '#216442': '#a4e2bc', '#eaf5ed': '#213b2c',
  '#87520a': '#f3ce87', '#fff3db': '#3d3424', '#eaf1fc': '#20344c',
  '#b8c7ba': '#829a8d', '#c9d4c9': '#40515f',
};
function normalizeColor(value: string) {
  const color = value.toLowerCase();
  if (color === 'white') return '#ffffff';
  if (/^#[a-f\d]{3}$/.test(color)) return '#' + color.slice(1).split('').map(c => c + c).join('');
  return color;
}

export function themeColor(value: string, isDark: boolean, property = 'color', context: ColorContext = 'normal'): string {
  if (!isDark) return value;
  const color = normalizeColor(value);
  const p = palettes.dark;
  if (color === '#ffffff') return property === 'backgroundColor' ? p.surface : context === 'primary' ? p.onAccent : value;
  if (color === '#f7f8fc') return p.background;
  if (color === '#1b2934') return p.text;
  if (color === '#53616e') return p.muted;
  if (color === '#dbe3ea') return p.border;
  if (color === '#165b43') {
    if (property === 'backgroundColor' && context === 'primary') return p.primary;
    if (context === 'secondary' && property === 'color') return p.onSecondary;
    return p.accent;
  }
  if (color === '#123d2d' && property === 'color' && context !== 'gold' && context !== 'strong' && context !== 'primary') return p.accent;
  return extraColors[color] || categoryColors[color] || value;
}

export function colorContext(node: DesignNode, inherited: ColorContext): ColorContext {
  const bg = normalizeColor(node.style.backgroundColor || '');
  if ((node.tag === 'button' || node.tag === 'a') && bg === '#165b43') return 'primary';
  if (bg === '#ebf3ef') return 'secondary';
  if (bg === '#e7b959' || bg === '#ecc26b') return 'gold';
  if (node.gradient || ['#123d2d', '#276a51', '#38634f', '#58428d'].includes(bg)) return 'strong';
  if (['#ffffff', '#f7f8fc', '#e9f4ed', ...Object.keys(categoryColors).filter(c => c !== '#165b43')].includes(bg)) return 'normal';
  return inherited;
}

export function themeStyle(style: LayoutStyle, isDark: boolean, context: ColorContext): LayoutStyle {
  if (!isDark) return style;
  const result = { ...style };
  for (const key of ['backgroundColor', 'color', 'borderColor']) {
    if (typeof result[key] === 'string') result[key] = themeColor(result[key], true, key, context);
  }
  return result;
}

export function themeSvg(xml: string, isDark: boolean, context: ColorContext = 'normal', icon = false): string {
  if (!isDark) return xml;
  // Apply only paint tokens. Paths, masks, root dimensions and original files
  // remain intact; white ring tracks and gold details retain their colors.
  return xml.replace(/\b(fill|stroke|stop-color|color)=(['"])(.*?)\2/gi, (attribute, name: string, quote: string, value: string) => {
    const paint = value.replace(/#[a-f\d]{6}\b|#[a-f\d]{3}\b|\bwhite\b/gi, color => {
      if (normalizeColor(color) === '#ffffff') return color;
      if (!icon && normalizeColor(color) === '#123d2d') return color;
      if (icon && normalizeColor(color) === '#123d2d' && context === 'normal') return palettes.dark.accent;
      return themeColor(color, true, 'color', context);
    });
    return name + '=' + quote + paint + quote;
  });
}

type Theme = { isDark: boolean; colors: typeof palettes.light };
const Context = createContext<Theme>({ isDark: true, colors: palettes.dark });
export function ThemeProvider({ preference, children }: { preference: AppearancePreference; children: React.ReactNode }) {
  const value = useMemo(() => ({ isDark: preference === 'dark', colors: palettes[preference] }), [preference]);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = preference;
    }
  }, [preference]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTheme() { return useContext(Context); }

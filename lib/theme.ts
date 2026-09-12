export const THEME_OPTIONS = [
  { id: "light", label: "settings.themeLight" },
  { id: "dark", label: "settings.themeDark" },
  { id: "mist", label: "settings.themeMist" },
  { id: "rose", label: "settings.themeRose" },
  { id: "pine", label: "settings.themePine" },
  { id: "deepseek", label: "settings.themeDeepSeek" },
  { id: "deepseek-light", label: "settings.themeDeepSeekLight" },
  { id: "gpt", label: "settings.themeGpt" },
  { id: "gpt-light", label: "settings.themeGptLight" },
  { id: "auto", label: "settings.themeSystem" },
] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number]["id"];
export type ResolvedTheme = Exclude<ThemePreference, "auto">;

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.id === value);
}

/** 暗色主题清单；首屏脚本和 isDarkTheme 共用它，避免两边部署时走调。 */
export const DARK_THEMES = ["dark", "pine", "deepseek", "gpt"] as const satisfies readonly ResolvedTheme[];

export function isDarkTheme(theme: ResolvedTheme): boolean {
  return (DARK_THEMES as readonly string[]).includes(theme);
}

// Apply the saved palette before first paint, including when storage is blocked.
export const THEME_INIT_SCRIPT = `(function(){var t="auto";try{var s=localStorage.getItem("pi-theme");if(${JSON.stringify(THEME_OPTIONS.map((option) => option.id))}.includes(s))t=s}catch(e){}if(t==="auto")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",${JSON.stringify(DARK_THEMES)}.includes(t))})();`;

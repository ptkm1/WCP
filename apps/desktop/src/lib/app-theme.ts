export const APP_THEMES = [
  { id: "aurora", label: "Aurora", hint: "Rosa e azul" },
  { id: "verde", label: "Verde", hint: "Gradiente esmeralda" },
] as const;

export type AppThemeId = (typeof APP_THEMES)[number]["id"];

export const DEFAULT_APP_THEME_ID: AppThemeId = "aurora";

const APP_THEME_STORAGE_KEY = "wcp.theme";

const APP_THEME_IDS = new Set<string>(APP_THEMES.map((theme) => theme.id));

function isAppThemeId(value: string): value is AppThemeId {
  return APP_THEME_IDS.has(value);
}

export function readStoredAppThemeId(): AppThemeId {
  try {
    const value = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (value && isAppThemeId(value)) {
      return value;
    }
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  return DEFAULT_APP_THEME_ID;
}

export function persistAppThemeId(themeId: AppThemeId) {
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, themeId);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function applyAppTheme(themeId: AppThemeId) {
  document.documentElement.dataset.theme = themeId;
}

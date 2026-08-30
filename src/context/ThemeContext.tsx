import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "cloudguest_theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * The theme the app is ALREADY displaying at mount. The pre-paint script in
 * __root.tsx (`THEME_INIT_SCRIPT`) has, by this point, added or removed the
 * `.dark` class on <html> from the exact same source this provider uses. Seed
 * state from that class rather than from a hardcoded `"light"`: if we started
 * "light" and only corrected in the effect below, this provider's own
 * class-sync effect would first REMOVE the `.dark` the script set (a white
 * flash) and then re-add it a render later. Reading the class makes the whole
 * boot a no-op instead of a visible correction. SSR has no document, so it
 * falls back to "light" -- fine, because the only theme-dependent component
 * (ThemeToggle) lives in ssr:false chrome and never renders on the server.
 */
function initialTheme(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // `localStorage` access can throw outright -- Apple's Captive Network
  // Assistant (the websheet iOS opens for WiFi login) treats storage like
  // private browsing and raises a SecurityError on read *and* write. This
  // provider wraps `/portal` (see `__root.tsx`), so an unhandled throw in
  // either effect below tears down the guest's sign-in screen over a
  // cosmetic preference. Both degrade to the OS colour-scheme default.
  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? null;
    } catch {
      stored = null;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = stored ?? (prefersDark ? "dark" : "light");
    setThemeState(initial);
  }, []);

  useEffect(() => {
    // The class toggle is the part that actually renders the theme and
    // stays before the persist, so a storage failure can never leave the
    // document un-themed.
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Preference just won't survive a reload. Not worth an exception.
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

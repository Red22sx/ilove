import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type Colors } from "./tokens";

export type ThemePref = "light" | "dark" | "system";
const KEY = "ilove:theme";

interface Ctx {
  colors: Colors;
  isDark: boolean;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children, onPrefChange }: { children: ReactNode; onPrefChange?: (p: ThemePref) => void }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => (v === "light" || v === "dark" || v === "system") && setPrefState(v))
      .catch(() => undefined); // sem armazenamento: vale só nesta sessão
  }, []);

  const setPref = useCallback(
    (p: ThemePref) => {
      setPrefState(p);
      AsyncStorage.setItem(KEY, p).catch(() => undefined);
      onPrefChange?.(p);
    },
    [onPrefChange],
  );

  const isDark = pref === "system" ? system === "dark" : pref === "dark";
  const value = useMemo<Ctx>(() => ({ colors: isDark ? dark : light, isDark, pref, setPref }), [isDark, pref, setPref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme fora do ThemeProvider");
  return c;
}

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { AppText } from "../ui/AppText";

type Fn = (msg: string, tone?: "ok" | "error") => void;
const Ctx = createContext<Fn>(() => undefined);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<Fn>((msg, tone = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setT({ msg, tone });
    Animated.timing(op, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setT(null)), 3200);
  }, [op]);
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, opacity: op, alignItems: "center" }} accessibilityLiveRegion="polite">
          <View style={{ maxWidth: 460, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: t.tone === "error" ? colors.danger : colors.text }}>
            <AppText variant="smallBold" color={t.tone === "error" ? "#fff" : colors.bg}>{t.msg}</AppText>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";
import { AppText } from "./AppText";

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: selected ? colors.action : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.action : colors.border,
      }}
    >
      {icon}
      <AppText variant="smallBold" color={selected ? colors.actionText : colors.text}>{label}</AppText>
    </Pressable>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "demo" | "ok" | "warn" | "danger" }) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.surface, colors.text],
    demo: [colors.infoBg, colors.info],
    ok: [colors.okBg, colors.ok],
    warn: [colors.warnBg, colors.warn],
    danger: [colors.dangerBg, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <AppText variant="caption" color={fg} style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden", alignSelf: "flex-start" }}>
      {label}
    </AppText>
  );
}

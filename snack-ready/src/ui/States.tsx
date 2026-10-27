import type { ReactNode } from "react";
import { View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useTheme } from "../theme/ThemeProvider";
import { AppText } from "./AppText";
import { Button } from "./Button";

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 10 }}>
      {icon}
      <AppText variant="heading" center>{title}</AppText>
      {text ? <AppText muted center>{text}</AppText> : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="soft" block={false} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", padding: 32, gap: 10 }}>
      <WifiOff color={colors.textMuted} size={32} />
      <AppText variant="heading" center>Não foi possível carregar</AppText>
      <AppText muted center>{message}</AppText>
      {onRetry ? <Button title="Tentar de novo" onPress={onRetry} variant="soft" block={false} /> : null}
    </View>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const { colors } = useTheme();
  const m = { info: [colors.infoBg, colors.info], warn: [colors.warnBg, colors.warn], danger: [colors.dangerBg, colors.danger], ok: [colors.okBg, colors.ok] }[tone];
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={{ backgroundColor: m[0], padding: 12, borderRadius: 12 }}>
      <AppText variant="small" color={m[1]}>{children}</AppText>
    </View>
  );
}

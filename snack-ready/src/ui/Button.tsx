import { useRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";
import { AppText } from "./AppText";

type Variant = "primary" | "soft" | "ghost" | "danger";
interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  small?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, small, block = true, style, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const off = disabled || loading;
  const bg = variant === "primary" ? colors.action : variant === "soft" ? colors.soft : variant === "danger" ? colors.dangerBg : "transparent";
  const fg = variant === "primary" ? colors.actionText : variant === "soft" ? colors.softText : variant === "danger" ? colors.danger : colors.text;
  const border = variant === "ghost" ? colors.border : variant === "danger" ? colors.danger : "transparent";

  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, block ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!off, busy: !!loading }}
        disabled={off}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
        style={{
          minHeight: small ? 40 : 52,
          paddingHorizontal: small ? 16 : 22,
          paddingVertical: 8,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          opacity: disabled ? 0.45 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        }}
      >
        {loading ? <ActivityIndicator color={fg} /> : <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{icon}<AppText variant={small ? "smallBold" : "bodyBold"} color={fg}>{title}</AppText></View>}
      </Pressable>
    </Animated.View>
  );
}

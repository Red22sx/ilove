import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";

export function IconButton({ label, onPress, children, size = 44, filled, disabled, style }: { label: string; onPress: () => void; children: ReactNode; size?: number; filled?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: filled ? colors.surface : "transparent", opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

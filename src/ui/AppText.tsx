import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { type, type TypeVariant } from "../theme/tokens";

interface Props extends TextProps {
  variant?: TypeVariant;
  muted?: boolean;
  color?: string;
  center?: boolean;
}

export function AppText({ variant = "body", muted, color, center, style, ...rest }: Props) {
  const { colors } = useTheme();
  const s: TextStyle = { ...type[variant], color: color ?? (muted ? colors.textMuted : colors.text), textAlign: center ? "center" : undefined };
  // Respeita o tamanho de fonte do sistema (acessibilidade), com teto para não quebrar o layout.
  return <Text maxFontSizeMultiplier={1.6} style={[s, style]} {...rest} />;
}

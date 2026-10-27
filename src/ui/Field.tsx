import type { ComponentRef, Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";
import { AppText } from "./AppText";

interface Props extends TextInputProps {
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, style, multiline, inputRef, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="smallBold">{label}</AppText>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        maxFontSizeMultiplier={1.6}
        style={[
          {
            minHeight: multiline ? 110 : 50,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 16,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
        {...rest}
      />
      {hint && !error ? <AppText variant="caption" muted>{hint}</AppText> : null}
      {error ? <AppText variant="caption" color={colors.danger} accessibilityRole="alert">{error}</AppText> : null}
    </View>
  );
}

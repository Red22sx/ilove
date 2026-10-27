import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  children: ReactNode;
  scroll?: boolean;
  edges?: { top?: boolean; bottom?: boolean };
  padded?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Container base: respeita notch e barras do sistema, teclado e centraliza conteúdo em telas largas. */
export function Screen({ children, scroll = true, edges = { top: true, bottom: false }, padded = true, onRefresh, refreshing, contentStyle }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: edges.top ? insets.top : 0, paddingBottom: edges.bottom ? insets.bottom : 0 };
  const inner: StyleProp<ViewStyle> = [{ width: "100%", maxWidth: 1100, alignSelf: "center" }, padded && { paddingHorizontal: 16 }, contentStyle];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[{ flex: 1, backgroundColor: colors.bg }, pad]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
        >
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, ...(inner as ViewStyle[])]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

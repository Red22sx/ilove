import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "./src/components/Toast";
import { RootNavigator } from "./src/navigation";
import { useSession } from "./src/store/session";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

function Shell() {
  const { colors, isDark } = useTheme();
  const ready = useSession((s) => s.ready);
  const load = useSession((s) => s.load);
  useEffect(() => { void load(); }, [load]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;
  return (
    <ToastProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </ToastProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider onPrefChange={(p) => useSession.getState().savePref(p)}>
          <Shell />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

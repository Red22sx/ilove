import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { View } from "react-native";
import { getRepo } from "../../data";
import { useNotifications } from "../../hooks/queries";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Screen } from "../../ui/Screen";
import { EmptyState, ErrorState } from "../../ui/States";

export function NotificationsScreen() {
  const { colors } = useTheme();
  const q = useNotifications();
  const qc = useQueryClient();
  useEffect(() => () => { void getRepo().markNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ["notifs"] })); }, [qc]);
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 8 }}>
        <AppText variant="title">Notificações</AppText>
        {q.isError ? <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} /> : q.data && q.data.length === 0 ? <EmptyState title="Nada por aqui" /> : q.data?.map((n) => (
          <View key={n.id} style={{ padding: 14, borderRadius: 16, backgroundColor: n.read ? colors.surface : colors.soft, gap: 2 }}>
            <AppText variant="bodyBold" color={n.read ? colors.text : colors.softText}>{n.title}</AppText>
            {!!n.body && <AppText variant="small" color={n.read ? colors.textMuted : colors.softText}>{n.body}</AppText>}
            <AppText variant="caption" color={n.read ? colors.textMuted : colors.softText}>{new Date(n.createdAt).toLocaleString("pt-BR")}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

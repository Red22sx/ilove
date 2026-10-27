import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MessageCircle } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { LoginPrompt } from "../../components/LoginPrompt";
import { useConversations } from "../../hooks/queries";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Badge } from "../../ui/Chip";
import { Screen } from "../../ui/Screen";
import { EmptyState, ErrorState } from "../../ui/States";

export function MessagesScreen() {
  const me = useSession((s) => s.account);
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const q = useConversations();
  if (!me) return <LoginPrompt text="Entre para ver suas conversas." />;
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={{ paddingTop: 12, gap: 8 }}>
        <AppText variant="title">Mensagens</AppText>
        {q.isError ? <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} /> : q.data && q.data.length === 0 ? (
          <EmptyState icon={<MessageCircle size={32} color="#EC4899" />} title="Nenhuma conversa" text="Abra um perfil e toque em Mensagem para começar." />
        ) : q.data?.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Conversa com ${c.otherName}${c.unread ? `, ${c.unread} não lidas` : ""}`} onPress={() => nav.navigate("Thread", { id: c.id, title: c.otherName, otherUserId: c.otherUserId })} style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <AppText variant="bodyBold" style={{ flex: 1 }}>{c.otherName}</AppText>
              {c.unread > 0 && <Badge label={`${c.unread} nova${c.unread > 1 ? "s" : ""}`} tone="warn" />}
            </View>
            <AppText variant="small" muted numberOfLines={1}>{c.lastMessage || "Sem mensagens"}</AppText>
            {c.isDemo && <Badge label="Demonstração" tone="demo" />}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
